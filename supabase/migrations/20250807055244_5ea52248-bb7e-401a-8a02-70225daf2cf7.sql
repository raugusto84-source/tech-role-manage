-- Actualizar el rol del usuario vendedor@syslag.com a vendedor
UPDATE public.profiles 
SET role = 'vendedor'::user_role
WHERE email = 'vendedor@syslag.com';