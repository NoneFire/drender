-- Company revenue per month, summed across regions.
SELECT month, SUM(revenue) AS revenue
FROM monthly_revenue
GROUP BY month
ORDER BY month
