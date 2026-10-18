-- September-to-October revenue bridge: opening balance, regional moves, closing balance.
SELECT 1 AS sort_order, '9 月营收' AS item,
       (SELECT SUM(revenue) FROM monthly_revenue WHERE month = '2026-09') AS delta, 1 AS is_total
UNION ALL
SELECT 2, '华东增量',
       (SELECT revenue FROM monthly_revenue WHERE region = '华东' AND month = '2026-10')
       - (SELECT revenue FROM monthly_revenue WHERE region = '华东' AND month = '2026-09'), 0
UNION ALL
SELECT 3, '华南增量',
       (SELECT revenue FROM monthly_revenue WHERE region = '华南' AND month = '2026-10')
       - (SELECT revenue FROM monthly_revenue WHERE region = '华南' AND month = '2026-09'), 0
UNION ALL
SELECT 4, '华北增量',
       (SELECT revenue FROM monthly_revenue WHERE region = '华北' AND month = '2026-10')
       - (SELECT revenue FROM monthly_revenue WHERE region = '华北' AND month = '2026-09'), 0
UNION ALL
SELECT 5, '10 月营收',
       (SELECT SUM(revenue) FROM monthly_revenue WHERE month = '2026-10'), 1
ORDER BY sort_order
