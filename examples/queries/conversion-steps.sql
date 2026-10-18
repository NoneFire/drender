-- Ordered funnel stages for October. `position` keeps the stage order stable.
SELECT stage, users, position
FROM conversion_steps
ORDER BY position
