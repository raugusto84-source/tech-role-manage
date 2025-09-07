-- Actualizar el cliente para asociarlo con el usuario correcto
UPDATE clients 
SET user_id = '7885ea76-2859-4629-ace8-1879861e41a3'
WHERE email = 'cliente1@syslag.com' AND id = 'eebdf9cc-7087-42e1-8a12-7be0c5fbaa4f';