-- Fix the remaining order without client by matching by phone or name
UPDATE orders o
SET client_id = c.id
FROM quotes q
JOIN clients c ON (c.name = q.client_name OR c.phone = q.client_phone)
WHERE o.quote_id = q.id
  AND o.client_id IS NULL
  AND o.deleted_at IS NULL
  AND q.client_email IS NULL;