SELECT substr(date, 1, 4) || '-' || substr(date, 5, 2) || '-' || substr(date, 7, 2) AS dt,
       ROUND(amount / 1e8, 1) AS amount_yi
FROM index_day
WHERE name = '上证指数'
  AND date IN (SELECT date FROM index_day WHERE name = '上证指数'
               AND date <= '20261013' ORDER BY date DESC LIMIT 22)
ORDER BY date
