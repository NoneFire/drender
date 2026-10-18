SELECT name, code, board, close, ROUND(pct, 2) AS pct,
       ROUND(amount / 1e8, 2) AS amount_yi,
       ROUND(turnover, 2) AS turnover
FROM stock_day WHERE date = '20261013' AND amount IS NOT NULL
ORDER BY amount DESC LIMIT 15
