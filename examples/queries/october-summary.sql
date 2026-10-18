-- Exactly one summary row for the headline KPIs: October totals, September
-- baselines, and each region's share of the month, computed from the data.
SELECT
  (SELECT SUM(revenue) FROM regional_revenue) AS revenue_total,
  (SELECT SUM(orders) FROM regional_revenue) AS orders_total,
  (SELECT SUM(revenue) FROM regional_revenue) * 1.0
    / (SELECT SUM(orders) FROM regional_revenue) AS average_order_value,
  (SELECT SUM(revenue) FROM monthly_revenue WHERE month = '2026-09') AS revenue_prev,
  (SELECT revenue FROM regional_revenue WHERE region = '华东') AS revenue_east,
  (SELECT revenue FROM regional_revenue WHERE region = '华南') AS revenue_south,
  (SELECT revenue FROM regional_revenue WHERE region = '华北') AS revenue_north,
  (SELECT revenue FROM regional_revenue WHERE region = '华东') * 1.0
    / (SELECT SUM(revenue) FROM regional_revenue) AS share_east,
  (SELECT revenue FROM regional_revenue WHERE region = '华南') * 1.0
    / (SELECT SUM(revenue) FROM regional_revenue) AS share_south,
  (SELECT revenue FROM regional_revenue WHERE region = '华北') * 1.0
    / (SELECT SUM(revenue) FROM regional_revenue) AS share_north,
  (SELECT revenue FROM monthly_revenue WHERE region = '华东' AND month = '2026-09') * 1.0
    / (SELECT SUM(revenue) FROM monthly_revenue WHERE month = '2026-09') AS share_east_prev,
  (SELECT revenue FROM monthly_revenue WHERE region = '华南' AND month = '2026-09') * 1.0
    / (SELECT SUM(revenue) FROM monthly_revenue WHERE month = '2026-09') AS share_south_prev,
  (SELECT revenue FROM monthly_revenue WHERE region = '华北' AND month = '2026-09') * 1.0
    / (SELECT SUM(revenue) FROM monthly_revenue WHERE month = '2026-09') AS share_north_prev,
  (SELECT SUM(revenue) FROM regional_revenue) * 1.0
    / (SELECT SUM(revenue) FROM monthly_revenue WHERE month = '2026-09') - 1 AS revenue_mom,
  (SELECT revenue FROM regional_revenue WHERE region = '华东') * 1.0
    / (SELECT SUM(revenue) FROM regional_revenue)
    - (SELECT revenue FROM monthly_revenue WHERE region = '华东' AND month = '2026-09') * 1.0
      / (SELECT SUM(revenue) FROM monthly_revenue WHERE month = '2026-09') AS share_east_delta,
  (SELECT revenue FROM regional_revenue WHERE region = '华南') * 1.0
    / (SELECT SUM(revenue) FROM regional_revenue)
    - (SELECT revenue FROM monthly_revenue WHERE region = '华南' AND month = '2026-09') * 1.0
      / (SELECT SUM(revenue) FROM monthly_revenue WHERE month = '2026-09') AS share_south_delta,
  (SELECT revenue FROM regional_revenue WHERE region = '华北') * 1.0
    / (SELECT SUM(revenue) FROM regional_revenue)
    - (SELECT revenue FROM monthly_revenue WHERE region = '华北' AND month = '2026-09') * 1.0
      / (SELECT SUM(revenue) FROM monthly_revenue WHERE month = '2026-09') AS share_north_delta,
  (SELECT revenue FROM regional_revenue WHERE region = '华东') * 1.0
    / (SELECT SUM(revenue) FROM regional_revenue)
    - (SELECT revenue FROM monthly_revenue WHERE region = '华东' AND month = '2026-05') * 1.0
      / (SELECT SUM(revenue) FROM monthly_revenue WHERE month = '2026-05') AS share_east_gain
