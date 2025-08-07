-- Crear usuario técnico usando el método más directo posible
-- Primero verificar que no exista
DELETE FROM public.profiles WHERE email = 'tecnico@syslag.com';

-- Crear directamente el perfil (el trigger handle_new_user se activará automáticamente)
INSERT INTO public.profiles (
  user_id, 
  email, 
  full_name, 
  role,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'tecnico@syslag.com',
  'Técnico SYSLAG',
  'tecnico'::user_role,
  now(),
  now()
) 
ON CONFLICT (email) DO UPDATE SET
  role = 'tecnico'::user_role,
  full_name = 'Técnico SYSLAG',
  updated_at = now();

-- Ahora actualizar la contraseña en auth.users para que sea 123456
-- (Esto asume que el usuario ya fue creado en auth.users)
UPDATE auth.users 
SET encrypted_password = crypt('123456', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now()
WHERE email = 'tecnico@syslag.com';