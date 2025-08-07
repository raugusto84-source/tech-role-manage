-- Deshabilitar temporalmente RLS en clients para diagnosticar
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;

-- Verificar que ahora funcione sin RLS
-- Una vez confirmado, volveremos a habilitar RLS con políticas correctas