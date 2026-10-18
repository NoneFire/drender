#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把原始 JSON/JSONL 装配成 md-report 用的 SQLite 数据集。"""
import json
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")
DB = os.path.join(HERE, "data", "ashare-20261013.sqlite")

TARGET = "20261013"
PREV = "20261012"


def board_of(sym):
    if sym.startswith("bj"):
        return "北交所"
    if sym.startswith("sh68"):
        return "科创板"
    if sym.startswith("sz30"):
        return "创业板"
    if sym.startswith("sh"):
        return "沪市主板"
    return "深市主板"


def limit_rates(sym, name):
    """返回该股票可能的涨跌幅限制集合。

    备注：主板 ST 名义上为 5%，但样本中多只 ST 股票当日振幅超过 5%（如
    *ST威领 +10.0%），说明「当前 ST 名称」与「10-13 当日是否受限 5%」并不一致，
    因此对主板 ST 同时接受 5% 与 10% 两种口径。
    """
    b = board_of(sym)
    st = "ST" in name.upper()
    if b == "北交所":
        return (0.30,)
    if b in ("科创板", "创业板"):
        return (0.20,)
    return (0.05, 0.10) if st else (0.10,)


def f(x):
    return None if x is None or x == "" else float(x)


def main():
    if os.path.exists(DB):
        os.remove(DB)
    con = sqlite3.connect(DB)
    cur = con.cursor()
    cur.executescript("""
    CREATE TABLE index_day(code TEXT, name TEXT, date TEXT, open REAL, high REAL,
        low REAL, close REAL, volume REAL, amount REAL, turnover REAL, pct REAL);
    CREATE TABLE stock_day(symbol TEXT, code TEXT, name TEXT, board TEXT, date TEXT,
        open REAL, high REAL, low REAL, close REAL, prev_close REAL, pct REAL,
        volume REAL, amount REAL, turnover REAL, limit_rate REAL,
        is_limit_up INTEGER, is_limit_down INTEGER);
    CREATE TABLE industry_map(symbol TEXT, industry_key TEXT, industry TEXT);
    CREATE TABLE industry_day(industry TEXT, date TEXT, n INTEGER, avg_pct REAL,
        median_pct REAL, up INTEGER, down INTEGER, flat INTEGER, limit_up INTEGER,
        amount REAL, top_name TEXT, top_pct REAL);
    CREATE TABLE breadth_day(date TEXT, traded INTEGER, up INTEGER, down INTEGER,
        flat INTEGER, limit_up INTEGER, limit_down INTEGER, median_pct REAL,
        avg_pct REAL, amount REAL, up5 INTEGER, down5 INTEGER);
    CREATE TABLE pct_bucket(date TEXT, ord INTEGER, label TEXT, kind TEXT, cnt INTEGER);
    CREATE TABLE board_day(date TEXT, board TEXT, n INTEGER, up INTEGER, down INTEGER,
        avg_pct REAL, limit_up INTEGER, amount REAL);
    CREATE TABLE margin_day(date TEXT, rzye REAL, rqye REAL, total REAL);
    """)

    # ---------------- 指数 ----------------
    idx = json.load(open(os.path.join(RAW, "indices.json")))
    for code, obj in idx.items():
        name = obj["name"]
        rows = []
        for line in obj["data"].split(";"):
            p = line.split(",")
            if len(p) < 7 or not p[0].isdigit():
                continue
            rows.append([p[0], f(p[1]), f(p[2]), f(p[3]), f(p[4]), f(p[5]),
                         f(p[6]), f(p[7]) if len(p) > 7 else None])
        rows.sort()
        prev = None
        for r in rows:
            pct = None if not prev else round((r[4] / prev - 1) * 100, 4)
            cur.execute("INSERT INTO index_day VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                        (code, name, r[0], r[1], r[2], r[3], r[4], r[5], r[6],
                         r[7], pct))
            prev = r[4]
    print("index_day done")

    # ---------------- 个股 ----------------
    path = os.path.join(RAW, "stocks_jqka.jsonl")
    n = 0
    for line in open(path):
        o = json.loads(line)
        sym, name, code = o["symbol"], o["name"], o["code"]
        rows = sorted(o["rows"])
        rates = limit_rates(sym, name)
        prev = None
        for r in rows:
            date, op, hi, lo, cl = r[0], r[1], r[2], r[3], r[4]
            vol, amt, to = r[5], r[6], r[7]
            pct = None if not prev else round((cl / prev - 1) * 100, 4)
            lu = ld = 0
            if prev:
                # 涨停/跌停 = 收盘价恰好落在某个可能限制价上（±0.005 容差）
                lu = int(any(abs(cl - round(prev * (1 + r), 2)) <= 0.005
                             for r in rates))
                ld = int(any(abs(cl - round(prev * (1 - r), 2)) <= 0.005
                             for r in rates))
            cur.execute("INSERT INTO stock_day VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (sym, code, name, board_of(sym), date, op, hi, lo, cl, prev,
                         pct, vol, amt, to, rates[0], lu, ld))
            prev = cl
            n += 1
    print("stock_day done", n)
    con.commit()

    # ---------------- 行业 ----------------
    ind = json.load(open(os.path.join(RAW, "industry.json")))
    sym2ind = {}
    for k, v in ind.items():
        for s in v["members"]:
            sym2ind[s] = v["name"]
        for s in v["members"]:
            cur.execute("INSERT INTO industry_map VALUES(?,?,?)", (s, k, v["name"]))
    print("industry_map done", len(sym2ind))

    for date in (TARGET, PREV):
        cur.execute("""SELECT s.symbol, s.name, s.pct, s.amount, s.is_limit_up
                       FROM stock_day s WHERE s.date=? AND s.pct IS NOT NULL""", (date,))
        buckets = {}
        for sym, name, pct, amt, lu in cur.fetchall():
            it = sym2ind.get(sym)
            if not it:
                continue
            buckets.setdefault(it, []).append((pct, amt or 0, name, lu))
        for it, arr in buckets.items():
            pcts = sorted(x[0] for x in arr)
            med = pcts[len(pcts) // 2]
            top = max(arr, key=lambda x: x[0])
            cur.execute("INSERT INTO industry_day VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                        (it, date, len(arr), round(sum(pcts) / len(pcts), 4), med,
                         sum(1 for x in arr if x[0] > 0),
                         sum(1 for x in arr if x[0] < 0),
                         sum(1 for x in arr if x[0] == 0),
                         sum(x[3] for x in arr), round(sum(x[1] for x in arr), 2),
                         top[2], top[0]))
    print("industry_day done")

    # ---------------- 市场宽度 / 分布 / 板块 ----------------
    for date in (TARGET, PREV):
        cur.execute("""SELECT board, pct, amount, is_limit_up, is_limit_down, close
                       FROM stock_day WHERE date=?""", (date,))
        rows = cur.fetchall()
        traded = [r for r in rows if r[1] is not None]
        pcts = sorted(r[1] for r in traded)
        cur.execute("INSERT INTO breadth_day VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", (
            date, len(traded),
            sum(1 for x in pcts if x > 0), sum(1 for x in pcts if x < 0),
            sum(1 for x in pcts if x == 0),
            sum(r[3] for r in rows), sum(r[4] for r in rows),
            pcts[len(pcts) // 2], round(sum(pcts) / len(pcts), 4),
            round(sum(r[2] or 0 for r in rows), 2),
            sum(1 for x in pcts if x >= 5), sum(1 for x in pcts if x <= -5)))
        # 分布
        edges = [(-100, -10.5), (-10.5, -9), (-9, -7), (-7, -5), (-5, -3), (-3, -1),
                 (-1, -0.01), (0, 0), (0.01, 1), (1, 3), (3, 5), (5, 7), (7, 9),
                 (9, 10.5), (10.5, 100)]
        names = ["跌超10%", "跌9%~10%", "跌7%~9%", "跌5%~7%", "跌3%~5%",
                 "跌1%~3%", "跌0~1%", "平盘", "涨0~1%", "涨1%~3%", "涨3%~5%",
                 "涨5%~7%", "涨7%~9%", "涨9%~10%", "涨超10%（含20cm个股）"]
        for i, (lo, hi) in enumerate(edges):
            if i == 7:
                c = sum(1 for x in pcts if x == 0)
            elif i < 7:
                c = sum(1 for x in pcts if lo < x <= hi)
            else:
                c = sum(1 for x in pcts if lo < x <= hi)
            kind = "down" if i < 7 else ("flat" if i == 7 else "up")
            cur.execute("INSERT INTO pct_bucket VALUES(?,?,?,?,?)",
                        (date, i, names[i], kind, c))
        # 板块
        bd = {}
        for b, pct, amt, lu, _ld, _c in rows:
            bd.setdefault(b, []).append((pct, amt or 0, lu))
        for b, arr in bd.items():
            ps = [x[0] for x in arr if x[0] is not None]
            cur.execute("INSERT INTO board_day VALUES(?,?,?,?,?,?,?,?)",
                        (date, b, len(arr), sum(1 for x in ps if x > 0),
                         sum(1 for x in ps if x < 0),
                         round(sum(ps) / len(ps), 4), sum(x[2] for x in arr),
                         round(sum(x[1] for x in arr), 2)))
    print("breadth/bucket/board done")

    # ---------------- 两融 ----------------
    emp = os.path.join(RAW, "eastmoney.json")
    if os.path.exists(emp):
        d = json.load(open(emp))
        if "margin" in d:
            try:
                obj = json.loads(d["margin"])["result"]["data"]
                for r in obj:
                    date = (r.get("DIM_DATE") or "")[:10].replace("-", "")
                    cur.execute("INSERT INTO margin_day VALUES(?,?,?,?)", (
                        date, r.get("RZYE"), r.get("RQYE"),
                        (r.get("RZYE") or 0) + (r.get("RQYE") or 0)))
                print("margin_day done", len(obj))
            except Exception as e:  # noqa: BLE001
                print("margin parse fail", e)
    con.commit()
    cur.execute("SELECT COUNT(*) FROM stock_day WHERE date=?", (TARGET,))
    print("rows on target date:", cur.fetchone()[0])
    cur.execute("SELECT date,traded,up,down,limit_up,limit_down,amount FROM breadth_day")
    for r in cur.fetchall():
        print("  breadth", r)
    con.close()


if __name__ == "__main__":
    main()
