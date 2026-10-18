#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用同花顺 v6 日线接口抓取全部 A 股日线（含成交额、换手率），北交所/缺失回落到新浪。

输出 data/raw/stocks_jqka.jsonl，每行：
  {"symbol","name","code","rows":[[date,open,high,low,close,volume,amount,turnover], ...]}
仅保留 2026-08-01 之后的行，控制体积。
"""
import json
import os
import random
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")
KEEP_FROM = "20260801"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


def get(url, referer, tries=3, timeout=20):
    last = None
    for i in range(tries):
        req = urllib.request.Request(url, headers={
            "User-Agent": UA, "Referer": referer, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(0.5 * (i + 1) + random.random() * 0.5)
    raise RuntimeError(str(last)[:90])


def from_jqka(code):
    url = f"http://d.10jqka.com.cn/v6/line/hs_{code}/01/last.js"
    txt = get(url, "http://stockpage.10jqka.com.cn/")
    s, e = txt.find("("), txt.rfind(")")
    obj = json.loads(txt[s + 1:e])
    rows = []
    for line in (obj.get("data") or "").split(";"):
        p = line.split(",")
        if len(p) < 8 or p[0] < KEEP_FROM:
            continue
        try:
            rows.append([p[0], float(p[1]), float(p[2]), float(p[3]), float(p[4]),
                         float(p[5]), float(p[6]), float(p[7])])
        except ValueError:
            continue
    return rows


def from_sina(symbol):
    url = ("https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/"
           f"CN_MarketData.getKLineData?symbol={symbol}&scale=240&ma=no&datalen=45")
    txt = get(url, "https://finance.sina.com.cn")
    rows = []
    for r in (json.loads(txt) if txt.strip() not in ("", "null") else []):
        d = r["day"].replace("-", "")
        if d < KEEP_FROM:
            continue
        rows.append([d, float(r["open"]), float(r["high"]), float(r["low"]),
                     float(r["close"]), float(r["volume"]), None, None])
    return rows


def one(c):
    code, sym = c["code"], c["symbol"]
    src = "jqka"
    try:
        rows = from_jqka(code)
    except Exception:  # noqa: BLE001
        rows = []
    if not rows:
        src = "sina"
        rows = from_sina(sym)
    if not rows:
        raise RuntimeError("empty")
    return {"symbol": sym, "name": c["name"], "code": code,
            "src": src, "rows": rows}


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    codes = json.load(open(os.path.join(RAW, "codes.json")))
    if limit:
        codes = codes[:limit]
    path = os.path.join(RAW, "stocks_jqka.jsonl")
    done = set()
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                try:
                    done.add(json.loads(line)["symbol"])
                except Exception:  # noqa: BLE001
                    pass
    todo = [c for c in codes if c["symbol"] not in done]
    print("have", len(done), "todo", len(todo), flush=True)
    fails, t0 = [], time.time()
    fout = open(path, "a")
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(one, c): c for c in todo}
        for i, fu in enumerate(as_completed(futs), 1):
            c = futs[fu]
            try:
                fout.write(json.dumps(fu.result(), ensure_ascii=False) + "\n")
            except Exception as e:  # noqa: BLE001
                fails.append([c["symbol"], str(e)[:90]])
            if i % 200 == 0:
                fout.flush()
                el = time.time() - t0
                print(f"  {i}/{len(todo)} {el:.0f}s {i/el:.1f}/s fail={len(fails)}",
                      flush=True)
    fout.close()
    with open(os.path.join(RAW, "jqka_fails.json"), "w") as f:
        json.dump(fails, f, ensure_ascii=False)
    print("done fails:", len(fails), fails[:5])


if __name__ == "__main__":
    main()
