-- Paso 1: Agregar el nuevo valor al enum en una transacción separada
ALTER TYPE order_status ADD VALUE 'pendiente_aprobacion';