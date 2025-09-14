-- Update existing approved orders to "en_proceso" status
-- This fixes orders that were approved by clients but are still in "pendiente" status
UPDATE orders 
SET 
  status = 'en_proceso',
  updated_at = now()
WHERE 
  status = 'pendiente' 
  AND client_approval = true 
  AND client_approved_at IS NOT NULL;