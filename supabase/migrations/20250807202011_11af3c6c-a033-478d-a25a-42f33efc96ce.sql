-- Arreglar el rol del perfil técnico
UPDATE public.profiles 
SET role = 'tecnico'::user_role,
    full_name = 'Técnico SYSLAG',
    updated_at = now()
WHERE email = 'tecnico@syslag.com';

-- Crear el usuario en auth.users usando el user_id del perfil existente
WITH profile_data AS (
  SELECT user_id FROM public.profiles WHERE email = 'tecnico@syslag.com'
)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT 
  '00000000-0000-0000-0000-000000000000',
  profile_data.user_id,
  'authenticated',
  'authenticated',
  'tecnico@syslag.com',
  crypt('123456', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Técnico SYSLAG", "role": "tecnico"}',
  now(),
  now()
FROM profile_data
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'tecnico@syslag.com'
);