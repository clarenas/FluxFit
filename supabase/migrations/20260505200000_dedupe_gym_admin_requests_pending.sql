/*
  # Deduplicate pending gym_admin_requests

  Keeps the newest row (highest id) per (user_id, gym_name) where status = 'pending'.

  Optional verification (run in SQL Editor before applying):
  SELECT user_id, gym_name, COUNT(*) AS duplicates
  FROM gym_admin_requests
  WHERE status = 'pending'
  GROUP BY user_id, gym_name
  HAVING COUNT(*) > 1;
*/

DELETE FROM gym_admin_requests a
USING gym_admin_requests b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.gym_name = b.gym_name
  AND a.status = 'pending'
  AND b.status = 'pending';
