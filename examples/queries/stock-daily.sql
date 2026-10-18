SELECT trade_date, open, high, low, close, adjusted_close, volume
FROM stock_bars
WHERE provider = ? AND symbol = ? AND interval = ?
ORDER BY trade_date ASC
