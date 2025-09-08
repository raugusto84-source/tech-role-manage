-- Create follow_up_configurations table if not exists
CREATE TABLE IF NOT EXISTS public.follow_up_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  delay_hours INTEGER NOT NULL DEFAULT 2,
  notification_channels TEXT[] NOT NULL DEFAULT '{system}',
  message_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on follow_up_configurations
ALTER TABLE public.follow_up_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies for follow_up_configurations
CREATE POLICY "Admins can manage follow up configurations"
ON public.follow_up_configurations FOR ALL
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view follow up configurations"
ON public.follow_up_configurations FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_follow_up_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_follow_up_configurations_updated_at
  BEFORE UPDATE ON public.follow_up_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_follow_up_configurations_updated_at();

-- Update follow_up_reminders table with more trigger events
ALTER TABLE public.follow_up_reminders 
ADD COLUMN IF NOT EXISTS trigger_event TEXT;

-- Add more trigger events for comprehensive follow-up
INSERT INTO public.follow_up_configurations (name, description, trigger_event, delay_hours, notification_channels, message_template, is_active) VALUES
('Seguimiento Cotización 2h', 'Recordatorio automático para cotizaciones sin respuesta', 'quote_sent', 2, '{system,whatsapp}', 'Hola {cliente_nombre}, queremos saber si tiene dudas sobre la cotización #{cotizacion_numero}. ¿Podemos ayudarle?', true),
('Orden Pendiente 24h', 'Recordatorio para órdenes pendientes de asignación', 'order_created', 24, '{system,email}', 'Orden #{orden_numero} pendiente de asignación desde hace 24 horas', true),
('Pago Vencido 3 días', 'Recordatorio de pago próximo a vencer', 'payment_due_soon', 72, '{system,whatsapp,email}', 'Su pago vence pronto. Favor contactarnos para procesar el pago de ${monto}', true),
('Cliente Inactivo 30 días', 'Seguimiento a clientes sin actividad', 'client_inactive', 720, '{system,whatsapp}', 'Hola {cliente_nombre}, hace tiempo no sabemos de usted. ¿Necesita algún servicio?', true)
ON CONFLICT DO NOTHING;