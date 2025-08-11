-- Crear una política que permita al trigger crear órdenes automáticamente
CREATE POLICY "system_trigger_create_orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  -- Permitir cuando se ejecuta desde el trigger de cotizaciones
  -- El trigger será ejecutado por el usuario que tiene permisos para actualizar cotizaciones
  get_user_role_safe() = ANY(ARRAY['administrador'::text, 'vendedor'::text])
);