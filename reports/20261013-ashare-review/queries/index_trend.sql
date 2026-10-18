SELECT substr(date, 1, 4) || '-' || substr(date, 5, 2) || '-' || substr(date, 7, 2) AS dt,
       name, close
FROM index_day
WHERE name IN ('上证指数', '深证综指', '创业板指')
  AND date IN (SELECT date FROM index_day WHERE name = '上证指数'
               AND date <= '20261013' ORDER BY date DESC LIMIT 22)
ORDER BY date, name
