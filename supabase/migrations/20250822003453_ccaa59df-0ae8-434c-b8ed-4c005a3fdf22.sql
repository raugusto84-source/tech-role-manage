-- Agregar nuevo estado para órdenes pendientes de actualización
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pendiente_actualizacion';

-- Asegurar que order_modifications tenga todos los campos necesarios
ALTER TABLE order_modifications 
ADD COLUMN IF NOT EXISTS modification_reason TEXT,
ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- Crear función para procesar modificaciones de orden
CREATE OR REPLACE FUNCTION process_order_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando se inserta una nueva modificación, cambiar el estado de la orden
  IF TG_OP = 'INSERT' THEN
    UPDATE orders 
    SET status = 'pendiente_actualizacion'::order_status,
        updated_at = now()
    WHERE id = NEW.order_id;
    
    -- Log del cambio de estado
    INSERT INTO order_status_logs (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) 
    SELECT 
      NEW.order_id,
      o.status,
      'pendiente_actualizacion'::order_status,
      NEW.created_by,
      'Orden modificada: ' || COALESCE(NEW.modification_reason, 'Servicios/productos agregados')
    FROM orders o 
    WHERE o.id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para procesar modificaciones
DROP TRIGGER IF EXISTS process_order_modification_trigger ON order_modifications;
CREATE TRIGGER process_order_modification_trigger
  AFTER INSERT ON order_modifications
  FOR EACH ROW
  EXECUTE FUNCTION process_order_modification();