-- Published check: recomputes the regional table and the shares quoted in the report.
SELECT region,
       revenue,
       orders,
       ROUND(100.0 * revenue / (SELECT SUM(revenue) FROM regional_revenue), 2) AS share_pct
FROM regional_revenue
ORDER BY revenue DESC
