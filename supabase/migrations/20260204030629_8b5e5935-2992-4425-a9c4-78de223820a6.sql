-- Fix existing orders without client by matching quote's client_email to clients table
-- First, create clients for quotes that don't have matching clients
INSERT INTO clients (name, email, phone, address)
SELECT DISTINCT q.client_name, q.client_email, COALESCE(q.client_phone, ''), 'Dirección no especificada'
FROM quotes q
JOIN orders o ON o.quote_id = q.id
WHERE o.client_id IS NULL
  AND o.deleted_at IS NULL
  AND q.client_email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.email = q.client_email)
ON CONFLICT DO NOTHING;

-- Now update the orders with the correct client_id
UPDATE orders o
SET client_id = c.id
FROM quotes q
JOIN clients c ON c.email = q.client_email
WHERE o.quote_id = q.id
  AND o.client_id IS NULL
  AND o.deleted_at IS NULL;