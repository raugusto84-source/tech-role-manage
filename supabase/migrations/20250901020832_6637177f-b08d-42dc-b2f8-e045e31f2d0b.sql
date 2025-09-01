-- Add username field to profiles table
ALTER TABLE public.profiles ADD COLUMN username text;

-- Create unique index for username
CREATE UNIQUE INDEX idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;

-- Add comment for username field
COMMENT ON COLUMN public.profiles.username IS 'Unique username for login instead of email';

-- Update existing profiles to have a username based on email (temporary)
UPDATE public.profiles 
SET username = CASE 
  WHEN role = 'administrador' THEN 'admin' || id::text
  WHEN role = 'tecnico' THEN 'tec' || id::text  
  WHEN role = 'vendedor' THEN 'vend' || id::text
  WHEN role = 'supervisor' THEN 'sup' || id::text
  WHEN role = 'cliente' THEN 'cli' || id::text
  ELSE 'user' || id::text
END
WHERE username IS NULL;

-- Make username NOT NULL after setting values
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;