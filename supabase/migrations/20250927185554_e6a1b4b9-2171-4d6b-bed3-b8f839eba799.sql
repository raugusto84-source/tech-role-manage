-- Agregar campos de soft delete solo donde no existan
DO $$ 
BEGIN
  -- orders table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'deleted_at') THEN
    ALTER TABLE public.orders ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'deleted_by') THEN
    ALTER TABLE public.orders ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'deletion_reason') THEN
    ALTER TABLE public.orders ADD COLUMN deletion_reason TEXT;
  END IF;

  -- order_payments table  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_payments' AND column_name = 'deleted_at') THEN
    ALTER TABLE public.order_payments ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_payments' AND column_name = 'deleted_by') THEN
    ALTER TABLE public.order_payments ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_payments' AND column_name = 'deletion_reason') THEN
    ALTER TABLE public.order_payments ADD COLUMN deletion_reason TEXT;
  END IF;

  -- purchases table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'deleted_at') THEN
    ALTER TABLE public.purchases ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'deleted_by') THEN
    ALTER TABLE public.purchases ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'deletion_reason') THEN
    ALTER TABLE public.purchases ADD COLUMN deletion_reason TEXT;
  END IF;

  -- incomes table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incomes' AND column_name = 'deleted_at') THEN
    ALTER TABLE public.incomes ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incomes' AND column_name = 'deleted_by') THEN
    ALTER TABLE public.incomes ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incomes' AND column_name = 'deletion_reason') THEN
    ALTER TABLE public.incomes ADD COLUMN deletion_reason TEXT;
  END IF;

  -- expenses table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'deleted_at') THEN
    ALTER TABLE public.expenses ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'deleted_by') THEN
    ALTER TABLE public.expenses ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'deletion_reason') THEN
    ALTER TABLE public.expenses ADD COLUMN deletion_reason TEXT;
  END IF;
END $$;

-- Crear tabla para historial de eliminaciones si no existe
CREATE TABLE IF NOT EXISTS public.deletion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  record_data JSONB NOT NULL,
  deletion_reason TEXT NOT NULL,
  deleted_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS en deletion_history
ALTER TABLE public.deletion_history ENABLE ROW LEVEL SECURITY;

-- Política para que solo administradores vean el historial de eliminaciones
DROP POLICY IF EXISTS "Admins can manage deletion history" ON public.deletion_history;
CREATE POLICY "Admins can manage deletion history"
ON public.deletion_history
FOR ALL
USING (get_current_user_role() = 'administrador');

-- Función para registrar eliminaciones
CREATE OR REPLACE FUNCTION public.log_deletion(
  p_table_name TEXT,
  p_record_id UUID,
  p_record_data JSONB,
  p_deletion_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.deletion_history (
    table_name,
    record_id,
    record_data,
    deletion_reason,
    deleted_by
  ) VALUES (
    p_table_name,
    p_record_id,
    p_record_data,
    p_deletion_reason,
    auth.uid()
  );
END;
$$;

-- Función para soft delete de órdenes
CREATE OR REPLACE FUNCTION public.soft_delete_order(
  p_order_id UUID,
  p_reason TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_record RECORD;
BEGIN
  -- Verificar permisos
  IF get_current_user_role() NOT IN ('administrador', 'supervisor') THEN
    RAISE EXCEPTION 'No tiene permisos para eliminar órdenes';
  END IF;
  
  -- Obtener datos de la orden
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = p_order_id AND deleted_at IS NULL;
  
  IF order_record.id IS NULL THEN
    RAISE EXCEPTION 'Orden no encontrada o ya eliminada';
  END IF;
  
  -- Registrar en historial
  PERFORM log_deletion('orders', p_order_id, to_jsonb(order_record), p_reason);
  
  -- Marcar como eliminada
  UPDATE public.orders
  SET 
    deleted_at = now(),
    deleted_by = auth.uid(),
    deletion_reason = p_reason
  WHERE id = p_order_id;
  
  RETURN true;
END;
$$;

-- Función para soft delete de pagos
CREATE OR REPLACE FUNCTION public.soft_delete_payment(
  p_payment_id UUID,
  p_reason TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_record RECORD;
BEGIN
  -- Verificar permisos
  IF get_current_user_role() NOT IN ('administrador', 'supervisor') THEN
    RAISE EXCEPTION 'No tiene permisos para eliminar pagos';
  END IF;
  
  -- Obtener datos del pago
  SELECT * INTO payment_record
  FROM public.order_payments
  WHERE id = p_payment_id AND deleted_at IS NULL;
  
  IF payment_record.id IS NULL THEN
    RAISE EXCEPTION 'Pago no encontrado o ya eliminado';
  END IF;
  
  -- Registrar en historial
  PERFORM log_deletion('order_payments', p_payment_id, to_jsonb(payment_record), p_reason);
  
  -- Marcar como eliminado
  UPDATE public.order_payments
  SET 
    deleted_at = now(),
    deleted_by = auth.uid(),
    deletion_reason = p_reason
  WHERE id = p_payment_id;
  
  RETURN true;
END;
$$;