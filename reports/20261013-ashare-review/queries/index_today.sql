SELECT name,
       open, high, low, close, pct,
       ROUND(amount / 1e8, 1) AS amount_yi,
       turnover
FROM index_day
WHERE date = '20261013'
ORDER BY CASE name
           WHEN '上证指数' THEN 1 WHEN '深证综指' THEN 2
           WHEN '深证成指' THEN 3 WHEN '创业板指' THEN 4
           WHEN '沪深300' THEN 5 WHEN '上证50' THEN 6
           WHEN '中证500' THEN 7 WHEN '中证1000' THEN 8 END
