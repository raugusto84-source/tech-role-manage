-- Agregar nuevos estados a las cotizaciones para el flujo de trabajo
-- 1. Verificar y agregar 'asignando' al enum de quote_status si no existe
DO $$
BEGIN
  -- Check if 'asignando' exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'asignando' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quote_status')
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'asignando';
  END IF;
END$$;

-- 2. Agregar columnas para el flujo de trabajo en cotizaciones
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS has_equipment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS equipment_ready BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS equipment_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS equipment_confirmed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS tdr_deadline TIMESTAMP WITH TIME ZONE;

-- 3. Crear tabla para configuración de TDR por etapa
CREATE TABLE IF NOT EXISTS workflow_tdr_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage TEXT NOT NULL UNIQUE,
  stage_label TEXT NOT NULL,
  tdr_hours INTEGER NOT NULL DEFAULT 4,
  warning_hours INTEGER DEFAULT 2,
  notification_channels TEXT[] DEFAULT ARRAY['system'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insertar configuraciones TDR por defecto
INSERT INTO workflow_tdr_config (stage, stage_label, tdr_hours, warning_hours, notification_channels) VALUES
  ('quote_created', 'Cotización Creada', 4, 2, ARRAY['system', 'whatsapp']),
  ('quote_sent', 'Cotización Enviada al Cliente', 4, 2, ARRAY['system', 'whatsapp']),
  ('quote_approved', 'Cotización Aprobada', 4, 2, ARRAY['system']),
  ('quote_assigning', 'Esperando Material', 24, 12, ARRAY['system']),
  ('order_created', 'Orden Creada', 4, 2, ARRAY['system']),
  ('order_in_progress', 'Orden en Progreso', 0, 0, ARRAY['system']),
  ('order_completed', 'Orden Completada', 4, 2, ARRAY['system', 'whatsapp']),
  ('payment_pending', 'Pago Pendiente', 4, 2, ARRAY['system', 'whatsapp']),
  ('survey_pending', 'Encuesta Pendiente', 168, 0, ARRAY['whatsapp'])
ON CONFLICT (stage) DO NOTHING;

-- 4. Agregar RLS a workflow_tdr_config
ALTER TABLE workflow_tdr_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view workflow tdr config"
ON workflow_tdr_config FOR SELECT
USING (get_current_user_role() IN ('administrador', 'supervisor', 'vendedor', 'tecnico'));

CREATE POLICY "Admins can manage workflow tdr config"
ON workflow_tdr_config FOR ALL
USING (get_current_user_role() = 'administrador');

-- 5. Crear tabla para tracking de TDR de cotizaciones/órdenes
CREATE TABLE IF NOT EXISTS workflow_tdr_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'quote' o 'order'
  entity_id UUID NOT NULL,
  stage TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deadline_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  warning_sent BOOLEAN DEFAULT false,
  overdue_sent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_tdr_entity ON workflow_tdr_tracking(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tdr_deadline ON workflow_tdr_tracking(deadline_at) WHERE status = 'active';

-- RLS para workflow_tdr_tracking
ALTER TABLE workflow_tdr_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view workflow tdr tracking"
ON workflow_tdr_tracking FOR SELECT
USING (get_current_user_role() IN ('administrador', 'supervisor', 'vendedor', 'tecnico'));

CREATE POLICY "Staff can manage workflow tdr tracking"
ON workflow_tdr_tracking FOR ALL
USING (get_current_user_role() IN ('administrador', 'supervisor', 'vendedor'));

-- 6. Agregar campo para marcar órdenes de pólizas/fraccionamientos
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS skip_payment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS source_type TEXT; -- 'quote', 'policy', 'development', 'direct'

-- 7. Función para crear TDR tracking automáticamente
CREATE OR REPLACE FUNCTION create_workflow_tdr_tracking()
RETURNS TRIGGER AS $$
DECLARE
  tdr_config workflow_tdr_config%ROWTYPE;
  stage_name TEXT;
BEGIN
  -- Determinar el stage según el tipo y estado
  IF TG_TABLE_NAME = 'quotes' THEN
    IF NEW.status = 'pendiente_aprobacion' OR NEW.status = 'solicitud' THEN
      stage_name := 'quote_created';
    ELSIF NEW.status = 'enviada' THEN
      stage_name := 'quote_sent';
    ELSIF NEW.status = 'aceptada' THEN
      stage_name := 'quote_approved';
    ELSIF NEW.status = 'asignando' THEN
      stage_name := 'quote_assigning';
    ELSE
      RETURN NEW;
    END IF;
    
    -- Obtener configuración TDR
    SELECT * INTO tdr_config FROM workflow_tdr_config WHERE stage = stage_name AND is_active = true;
    
    IF FOUND AND tdr_config.tdr_hours > 0 THEN
      -- Cancelar tracking anterior de esta cotización
      UPDATE workflow_tdr_tracking 
      SET status = 'cancelled' 
      WHERE entity_type = 'quote' AND entity_id = NEW.id AND status = 'active';
      
      -- Crear nuevo tracking
      INSERT INTO workflow_tdr_tracking (entity_type, entity_id, stage, deadline_at)
      VALUES ('quote', NEW.id, stage_name, now() + (tdr_config.tdr_hours || ' hours')::interval);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para quotes
DROP TRIGGER IF EXISTS trigger_quote_tdr_tracking ON quotes;
CREATE TRIGGER trigger_quote_tdr_tracking
AFTER INSERT OR UPDATE OF status ON quotes
FOR EACH ROW
EXECUTE FUNCTION create_workflow_tdr_tracking();