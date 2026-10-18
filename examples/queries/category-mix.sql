-- Category revenue and order spread from the 1000-row synthetic order sample.
SELECT category,
       COUNT(*) AS order_count,
       SUM(amount) AS amount,
       MIN(amount) AS amount_min,
       MAX(amount) AS amount_max
FROM large_orders
GROUP BY category
ORDER BY amount DESC
