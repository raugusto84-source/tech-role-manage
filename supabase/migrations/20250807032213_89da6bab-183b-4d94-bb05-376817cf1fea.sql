-- Create admin user in auth.users and profiles table
-- This creates an admin user with email: admin@admin.com and password: admin

-- First, let's check if we need to update our trigger function to handle the admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'cliente'::public.user_role)
  );
  RETURN NEW;
END;
$$;