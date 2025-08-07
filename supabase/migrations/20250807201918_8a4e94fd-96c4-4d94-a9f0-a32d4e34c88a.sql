-- Método más simple: usar directamente los valores correctos
-- Crear solo el perfil si no existe
INSERT INTO public.profiles (
  user_id, 
  email, 
  full_name, 
  role,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  'tecnico@syslag.com',
  'Técnico SYSLAG',
  'tecnico'::user_role,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE email = 'tecnico@syslag.com'
);