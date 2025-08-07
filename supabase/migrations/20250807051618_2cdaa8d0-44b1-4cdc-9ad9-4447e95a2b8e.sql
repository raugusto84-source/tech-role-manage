-- Verificar y actualizar las políticas RLS para profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Crear políticas más claras y robustas
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Política para administradores (mantener la existente si existe)
CREATE POLICY "Administrators can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Administrators can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (get_current_user_role() = 'administrador');

-- Asegurar que RLS esté habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;