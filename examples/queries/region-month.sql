-- One row per region and month, for the cross-tabulated view.
SELECT region, month, revenue
FROM monthly_revenue
ORDER BY region, month
