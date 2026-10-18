SELECT order_id, region, channel, amount, paid_at, status
FROM order_details
WHERE status = 'paid'
ORDER BY amount DESC
