-- Published check: recomputes the monthly totals and the month-over-month change.
SELECT month,
       SUM(revenue) AS revenue,
       ROUND(100.0 * (SUM(revenue) - LAG(SUM(revenue)) OVER (ORDER BY month))
             / LAG(SUM(revenue)) OVER (ORDER BY month), 2) AS mom_pct
FROM monthly_revenue
GROUP BY month
ORDER BY month
