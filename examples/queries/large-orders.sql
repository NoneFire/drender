SELECT order_id, ordered_at, customer_id, region, city, channel, product,
       category, quantity, unit_price, discount, amount, payment_method,
       status, sales_rep
FROM large_orders
ORDER BY ordered_at DESC
