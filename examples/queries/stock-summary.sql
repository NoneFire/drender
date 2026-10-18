WITH ranked AS (
  SELECT trade_date,
         COALESCE(adjusted_close, close) AS adjusted_close,
         volume,
         ROW_NUMBER() OVER (ORDER BY trade_date DESC) AS position
  FROM stock_bars
  WHERE provider = ? AND symbol = ? AND interval = ?
),
summary AS (
  SELECT MAX(CASE WHEN position = 1 THEN adjusted_close END) AS latest_adjusted_close,
         MAX(CASE WHEN position = 2 THEN adjusted_close END) AS previous_adjusted_close,
         MAX(CASE WHEN position = 21 THEN adjusted_close END) AS twenty_sessions_ago_adjusted_close,
         MAX(CASE WHEN position = 1 THEN volume END) AS latest_volume,
         COUNT(*) AS sample_days,
         MIN(trade_date) AS sample_start_date,
         MAX(trade_date) AS sample_end_date
  FROM ranked
)
SELECT latest_adjusted_close,
       (latest_adjusted_close / NULLIF(previous_adjusted_close, 0)) - 1 AS daily_return,
       ((latest_adjusted_close / NULLIF(twenty_sessions_ago_adjusted_close, 0)) - 1) * 100 AS twenty_session_return_pct,
       latest_volume,
       sample_days,
       sample_start_date,
       sample_end_date,
       sample_start_date || ' 至 ' || sample_end_date AS sample_period
FROM summary
