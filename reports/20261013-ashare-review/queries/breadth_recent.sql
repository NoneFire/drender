SELECT substr(date, 1, 4) || '-' || substr(date, 5, 2) || '-' || substr(date, 7, 2) AS dt,
       traded, up, down, flat, limit_up, limit_down,
       ROUND(median_pct, 2) AS median_pct,
       ROUND(amount / 1e8, 0) AS amount_yi
FROM breadth_day
WHERE date <= '20261013'
ORDER BY date DESC LIMIT 8
