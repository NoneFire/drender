-- Revenue and East-China concentration per month, for the dual-axis chart.
SELECT month,
       SUM(revenue) AS revenue,
       SUM(CASE WHEN region = '华东' THEN revenue ELSE 0 END) * 1.0 / SUM(revenue) AS share_east
FROM monthly_revenue
GROUP BY month
ORDER BY month
