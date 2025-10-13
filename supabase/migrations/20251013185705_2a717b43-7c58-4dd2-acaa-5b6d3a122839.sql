-- Update default status for orders to 'pendiente_aprobacion' and migrate existing records
-- 1) Set new default on orders.status
ALTER TABLE public.orders 
ALTER COLUMN status SET DEFAULT 'pendiente_aprobacion'::order_status;

-- 2) Migrate any existing orders still in deprecated 'pendiente' status
UPDATE public.orders
SET status = 'pendiente_aprobacion'::order_status,
    updated_at = now()
WHERE status = 'pendiente'::order_status;

-- 3) Optional: ensure order_status_logs remains consistent is not needed; keep as-is for history
-- No changes to enum values to preserve backward compatibility