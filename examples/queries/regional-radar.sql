-- Region scorecard normalised to the best region on each dimension (best = 100).
SELECT '营收指数' AS dimension, region, revenue * 100.0 / (SELECT MAX(revenue) FROM regional_revenue) AS score
FROM regional_revenue
UNION ALL
SELECT '订单指数', region, orders * 100.0 / (SELECT MAX(orders) FROM regional_revenue)
FROM regional_revenue
UNION ALL
SELECT '单均指数', region,
       (revenue * 1.0 / orders) * 100.0 / (SELECT MAX(revenue * 1.0 / orders) FROM regional_revenue)
FROM regional_revenue
ORDER BY dimension, region
