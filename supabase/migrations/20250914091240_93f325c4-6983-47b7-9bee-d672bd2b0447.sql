-- Update order_status enum to include the new statuses
ALTER Type order_status ADD VALUE IF NOT EXISTS 'pendiente_aprobacion';
ALTER Type order_status ADD VALUE IF NOT EXISTS 'pendiente_actualizacion';
ALTER Type order_status ADD VALUE IF NOT EXISTS 'pendiente_entrega';

-- Update existing orders that use old statuses to new ones
UPDATE orders SET status = 'pendiente_aprobacion' WHERE status = 'pendiente';
UPDATE orders SET status = 'pendiente_entrega' WHERE status = 'finalizada';