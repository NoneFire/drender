SELECT industry, n, ROUND(avg_pct, 2) AS avg_pct,
       ROUND(median_pct, 2) AS median_pct, up, down, limit_up,
       ROUND(amount / 1e8, 1) AS amount_yi, top_name,
       ROUND(top_pct, 2) AS top_pct
FROM industry_day
WHERE date = '20261013'
ORDER BY avg_pct DESC
