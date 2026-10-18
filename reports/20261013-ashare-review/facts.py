#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""打印报告所需事实摘要。"""
import sqlite3, os
DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "ashare-20261013.sqlite")
c = sqlite3.connect(DB).cursor()
T, P = "20261013", "20261012"


def show(title, sql, args=()):
    print("\n### " + title)
    c.execute(sql, args)
    cols = [d[0] for d in c.description]
    print(" | ".join(cols))
    for r in c.fetchall():
        print(" | ".join("" if v is None else (f"{v:.4f}" if isinstance(v, float) else str(v)) for v in r))


show("指数 10-13", """
SELECT i.name, i.open, i.high, i.low, i.close, i.pct, ROUND(i.amount/1e8,1) amt_yi,
       i.turnover, p.pct AS pct_1012
FROM index_day i LEFT JOIN index_day p ON p.code=i.code AND p.date=?
WHERE i.date=? ORDER BY i.name""", (P, T))

show("指数近25日", """
SELECT date, name, close, ROUND(amount/1e8,1) amt_yi FROM index_day
WHERE date<=? AND name IN ('上证指数','深证综指','创业板指') ORDER BY date""", (T,))

show("宽度近8日", """
SELECT date, traded, up, down, flat, limit_up, limit_down, median_pct, avg_pct,
       ROUND(amount/1e8,0) amt_yi, up5, down5 FROM breadth_day WHERE date<=?
ORDER BY date""", (T,))

show("涨跌分布 10-13", "SELECT ord,label,kind,cnt FROM pct_bucket WHERE date=? ORDER BY ord", (T,))

show("行业 top/bottom 10-13", """
SELECT industry, n, avg_pct, median_pct, up, down, limit_up, ROUND(amount/1e8,1) amt_yi,
       top_name, top_pct FROM industry_day WHERE date=?
ORDER BY avg_pct DESC""", (T,))

show("板块 10-13", "SELECT * FROM board_day WHERE date=? ORDER BY avg_pct DESC", (T,))

show("涨幅榜 10-13", """
SELECT name, symbol, board, close, pct, ROUND(amount/1e8,2) amt_yi, turnover
FROM stock_day WHERE date=? AND pct IS NOT NULL ORDER BY pct DESC LIMIT 20""", (T,))

show("跌幅榜 10-13", """
SELECT name, symbol, board, close, pct, ROUND(amount/1e8,2) amt_yi, turnover
FROM stock_day WHERE date=? AND pct IS NOT NULL ORDER BY pct ASC LIMIT 20""", (T,))

show("成交额榜 10-13", """
SELECT name, symbol, board, close, pct, ROUND(amount/1e8,2) amt_yi, turnover
FROM stock_day WHERE date=? AND amount IS NOT NULL ORDER BY amount DESC LIMIT 15""", (T,))

show("涨停/跌停结构 10-13", """
SELECT board,
 SUM(is_limit_up) lu, SUM(is_limit_down) ld,
 SUM(CASE WHEN is_limit_up=1 AND substr(symbol,1,2) IN ('sh','sz') AND substr(symbol,3,1) IN ('6','0','3') THEN 1 ELSE 0 END) x
FROM stock_day WHERE date=? GROUP BY board""", (T,))

show("连板股（10-13 涨停且 10-12 也涨停）", """
SELECT a.name, a.symbol, a.board, a.pct,
 (SELECT COUNT(*) FROM stock_day b WHERE b.symbol=a.symbol AND b.date<=? AND b.is_limit_up=1
   AND b.date > (SELECT MAX(d.date) FROM stock_day d WHERE d.symbol=a.symbol AND d.date<=? AND d.is_limit_up=0)) streak
FROM stock_day a WHERE a.date=? AND a.is_limit_up=1 ORDER BY streak DESC, a.amount DESC LIMIT 20""", (T, T, T))

show("两融近15日", "SELECT date, ROUND(rzye/1e8,0) rzye_yi, ROUND(total/1e12,3) total_wy FROM margin_day ORDER BY date DESC LIMIT 15")

show("两市成交额校验", """
SELECT ROUND(SUM(CASE WHEN board IN ('沪市主板','科创板') THEN amount ELSE 0 END)/1e8,1) sh_yi,
       ROUND(SUM(CASE WHEN board IN ('深市主板','创业板') THEN amount ELSE 0 END)/1e8,1) sz_yi,
       ROUND(SUM(amount)/1e8,1) all_yi
FROM stock_day WHERE date=?""", (T,))

show("10-13 无涨跌幅(停牌/新股)", """
SELECT COUNT(*) FROM stock_day WHERE date=? AND pct IS NULL""", (T,))
