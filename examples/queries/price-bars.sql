-- Synthetic daily OHLC bars for the candlestick component.
SELECT trade_date, open, high, low, close, volume
FROM price_bars
ORDER BY trade_date
