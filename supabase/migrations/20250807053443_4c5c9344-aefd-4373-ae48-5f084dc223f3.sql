-- Create client record for authenticated user cliente@syslag.com
INSERT INTO public.clients (
  email, 
  name, 
  address, 
  phone,
  created_by
) VALUES (
  'cliente@syslag.com',
  'Cliente',
  'Dirección del cliente',
  NULL,
  'b2b19633-b699-4a16-950f-b62dce667b8c'
);