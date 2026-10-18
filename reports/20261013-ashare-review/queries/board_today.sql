SELECT board, n, up, down, ROUND(avg_pct, 2) AS avg_pct, limit_up,
       ROUND(amount / 1e8, 0) AS amount_yi
FROM board_day WHERE date = '20261013'
ORDER BY avg_pct DESC
