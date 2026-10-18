SELECT substr(date, 1, 4) || '-' || substr(date, 5, 2) || '-' || substr(date, 7, 2) AS dt,
       ROUND(rzye / 1e8, 0) AS rzye_yi,
       ROUND(rqye / 1e8, 0) AS rqye_yi,
       ROUND(total / 1e12, 3) AS total_wy
FROM margin_day
WHERE date IN (SELECT date FROM margin_day WHERE date <= '20261013'
               ORDER BY date DESC LIMIT 22)
ORDER BY date
