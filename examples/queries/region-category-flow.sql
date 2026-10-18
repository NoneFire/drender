-- Region → category value flow, for the Sankey component.
SELECT region AS source, category AS target, SUM(amount) AS amount
FROM large_orders
GROUP BY region, category
ORDER BY amount DESC
