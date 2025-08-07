-- Habilitar RLS nuevamente con políticas correctas
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Las políticas ya existen, no necesitamos recrearlas
-- "Authenticated users can view clients" - permite a todos los usuarios autenticados ver clientes
-- "Staff can manage clients" - permite al staff gestionar clientes