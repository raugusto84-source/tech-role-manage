-- Create client records for existing client profiles to ensure independence
INSERT INTO clients (email, name, client_number, address, created_by)
VALUES 
  ('cliente1@syslag.com', 'Cliente 1', 'CLI-0002', 'Dirección no especificada', 'b2b19633-b699-4a16-950f-b62dce667b8c'),
  ('cliente2@syslag.com', 'Cliente 2', 'CLI-0003', 'Dirección no especificada', 'b2b19633-b699-4a16-950f-b62dce667b8c')
ON CONFLICT (email) DO NOTHING;

-- Create client_rewards records for the new clients
INSERT INTO client_rewards (client_id, total_cashback)
SELECT c.id, 0
FROM clients c
WHERE c.email IN ('cliente1@syslag.com', 'cliente2@syslag.com')
ON CONFLICT (client_id) DO NOTHING;