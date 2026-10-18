#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取 2026-10-13 A 股当日行情数据。

数据源：
  - 新浪财经  Market_Center.getHQNodeData   全 A 代码表（含北交所）
  - 腾讯财经  web.ifzq.gtimg.cn fqkline    个股日线（不复权，区间小、请求轻）
  - 同花顺    d.10jqka.com.cn v6/line      指数日线（含成交额、换手率）
  - 新浪财经  newSinaHy.php                行业分类 → 成分股

用法：
  python3 fetch_data.py codes
  python3 fetch_data.py stocks [N]
  python3 fetch_data.py indices
  python3 fetch_data.py industry
"""
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")
os.makedirs(RAW, exist_ok=True)

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

END = "2026-10-13"
START = "2026-09-22"  # 覆盖约 12 个交易日，用于算前收/5 日涨幅


def get(url, referer=None, encoding="utf-8", tries=4, timeout=20):
    last = None
    for i in range(tries):
        req = urllib.request.Request(url, headers={
            "User-Agent": UA,
            "Referer": referer or "https://finance.sina.com.cn",
            "Accept": "*/*",
        })
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode(encoding, "replace")
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(0.6 * (i + 1) + random.random() * 0.4)
    raise RuntimeError(f"GET failed {url}: {last}")


# ---------------------------------------------------------------- 代码表
def cmd_codes(_arg=None):
    out, page = [], 1
    while True:
        url = ("https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/"
               f"Market_Center.getHQNodeData?page={page}&num=100&sort=symbol&asc=1"
               "&node=hs_a&symbol=&_s_r_a=page")
        txt = get(url)
        rows = json.loads(txt) if txt.strip() not in ("", "null") else []
        if not rows:
            break
        for r in rows:
            out.append({"symbol": r["symbol"], "code": r["code"], "name": r["name"]})
        print(f"  page {page}: +{len(rows)} (total {len(out)})", flush=True)
        page += 1
        time.sleep(0.25)
    with open(os.path.join(RAW, "codes.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False)
    print("codes:", len(out))


# ---------------------------------------------------------------- 个股日线
def fetch_one_stock(sym):
    # 腾讯不提供北交所日线，北交所改用新浪
    if sym.startswith("bj"):
        url = ("https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/"
               f"CN_MarketData.getKLineData?symbol={sym}&scale=240&ma=no&datalen=15")
        txt = get(url, referer="https://finance.sina.com.cn")
        rows = json.loads(txt) if txt.strip() not in ("", "null") else []
        day = [[r["day"], r["open"], r["close"], r["high"], r["low"], r["volume"]]
               for r in rows]
        return sym, day
    url = ("https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
           f"?param={sym},day,{START},{END},20,")
    txt = get(url, referer="https://gu.qq.com/")
    d = json.loads(txt)
    block = (d.get("data") or {}).get(sym) or {}
    return sym, block.get("day") or []


def cmd_stocks(limit=None):
    codes = json.load(open(os.path.join(RAW, "codes.json")))
    if limit:
        codes = codes[: int(limit)]
    path = os.path.join(RAW, "stocks.jsonl")
    done = set()
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                try:
                    done.add(json.loads(line)["symbol"])
                except Exception:  # noqa: BLE001
                    pass
        print("resume, already have", len(done))
    todo = [c for c in codes if c["symbol"] not in done]
    print("to fetch:", len(todo))
    fails = []
    t0 = time.time()
    fout = open(path, "a")
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = {ex.submit(fetch_one_stock, c["symbol"]): c for c in todo}
        for i, fu in enumerate(as_completed(futs), 1):
            c = futs[fu]
            try:
                sym, rows = fu.result()
                fout.write(json.dumps({"symbol": sym, "name": c["name"],
                                       "code": c["code"], "day": rows},
                                      ensure_ascii=False) + "\n")
            except Exception as e:  # noqa: BLE001
                fails.append((c["symbol"], str(e)[:80]))
            if i % 250 == 0:
                fout.flush()
                el = time.time() - t0
                print(f"  {i}/{len(todo)}  {el:.0f}s  {i/el:.1f}/s  fail={len(fails)}",
                      flush=True)
    fout.close()
    with open(os.path.join(RAW, "stock_fails.json"), "w") as f:
        json.dump(fails, f, ensure_ascii=False)
    print("done, fails:", len(fails))


# ---------------------------------------------------------------- 指数
INDEXES = [
    ("hs_1A0001", "上证指数"),
    ("hs_399106", "深证综指"),
    ("hs_399001", "深证成指"),
    ("hs_399006", "创业板指"),
    ("hs_1B0300", "沪深300"),
    ("hs_1B0016", "上证50"),
    ("hs_1B0905", "中证500"),
    ("hs_1B0852", "中证1000"),
    ("hs_1B0688", "科创50"),
    ("hs_899050", "北证50"),
]


def fetch_index(code):
    url = f"http://d.10jqka.com.cn/v6/line/{code}/01/2026.js"
    txt = get(url, referer="http://stockpage.10jqka.com.cn/")
    s = txt.find("(")
    e = txt.rfind(")")
    obj = json.loads(txt[s + 1:e])
    return code, obj


def cmd_indices(_arg=None):
    out = {}
    for code, name in INDEXES:
        try:
            _, obj = fetch_index(code)
            out[code] = {"name": name, "data": obj.get("data", "")}
            print(f"  {code} {name}: {len(obj.get('data',''))} chars")
        except Exception as e:  # noqa: BLE001
            print(f"  {code} {name}: FAIL {str(e)[:70]}")
        time.sleep(0.8)
    with open(os.path.join(RAW, "indices.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False)
    print("indices:", len(out))


# ---------------------------------------------------------------- 行业
def cmd_industry(_arg=None):
    txt = get("https://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php",
              encoding="gbk")
    s = txt.find("{")
    e = txt.rfind("}")
    raw = json.loads("{" + txt[s + 1:e] + "}")
    out = {}
    for k, v in raw.items():
        name = v.split(",")[1]
        members, page = [], 1
        while True:
            url = ("https://vip.stock.finance.sina.com.cn/quotes_service/api/"
                   f"json_v2.php/Market_Center.getHQNodeData?page={page}&num=100"
                   f"&sort=symbol&asc=1&node={k}&symbol=&_s_r_a=page")
            try:
                rows = json.loads(get(url))
            except Exception:  # noqa: BLE001
                break
            if not rows:
                break
            members += [r["symbol"] for r in rows]
            if len(rows) < 100:
                break
            page += 1
            time.sleep(0.2)
        out[k] = {"name": name, "members": members}
        print(f"  {k} {name}: {len(members)}", flush=True)
        time.sleep(0.2)
    with open(os.path.join(RAW, "industry.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False)
    print("industries:", len(out), "members total:",
          sum(len(v["members"]) for v in out.values()))


# ---------------------------------------------------------------- 东财（可选）
EM = [
    ("fflow_sh", "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get"
                 "?lmt=0&klt=101&secid=1.000001&fields1=f1,f2,f3,f7"
                 "&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65"),
    ("fflow_sz", "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get"
                 "?lmt=0&klt=101&secid=0.399001&fields1=f1,f2,f3,f7"
                 "&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65"),
    ("fflow_cy", "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get"
                 "?lmt=0&klt=101&secid=0.399006&fields1=f1,f2,f3,f7"
                 "&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65"),
    ("margin", "https://datacenter-web.eastmoney.com/api/data/v1/get"
               "?reportName=RPTA_RZRQ_LSHJ&columns=ALL&pageSize=30"
               "&sortColumns=DIM_DATE&sortTypes=-1"),
]


def cmd_em(_arg=None):
    ok = {}
    for name, url in EM:
        for attempt in range(3):
            try:
                txt = get(url, referer="https://quote.eastmoney.com/", tries=1)
                ok[name] = txt
                print(f"  {name}: ok ({len(txt)} chars)")
                break
            except Exception as e:  # noqa: BLE001
                print(f"  {name}: attempt {attempt+1} fail {str(e)[:60]}")
                time.sleep(3 + attempt * 4)
    with open(os.path.join(RAW, "eastmoney.json"), "w") as f:
        json.dump(ok, f, ensure_ascii=False)
    print("em:", list(ok))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "codes"
    arg = sys.argv[2] if len(sys.argv) > 2 else None
    {"codes": cmd_codes, "stocks": cmd_stocks, "indices": cmd_indices,
     "industry": cmd_industry, "em": cmd_em}[cmd](arg)
