SELECT industry, ROUND(avg_pct, 2) AS avg_pct, n
FROM industry_day WHERE date = '20261013'
ORDER BY avg_pct ASC LIMIT 10
