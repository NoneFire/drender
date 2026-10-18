-- One row: the funnel stage that must reconcile with the paid order count.
SELECT users AS paid_users, position
FROM conversion_steps
WHERE stage = '完成支付'
