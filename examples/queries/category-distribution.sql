-- One row per order with its category, for the box plot.
SELECT category, amount
FROM large_orders
ORDER BY category, amount
