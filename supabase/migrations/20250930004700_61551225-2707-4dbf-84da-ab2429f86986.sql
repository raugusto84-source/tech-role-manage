-- Fix soft_delete_payment to pass JSONB to log_deletion
CREATE OR REPLACE FUNCTION public.soft_delete_payment(
  p_payment_id UUID,
  p_reason TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payment_record RECORD;
BEGIN
  -- 1) Pending collections (order payments)
  SELECT * INTO payment_record 
  FROM public.pending_collections 
  WHERE id = p_payment_id;
  
  IF FOUND THEN
    PERFORM public.log_deletion('pending_collections'::text, p_payment_id, to_jsonb(payment_record), p_reason);
    DELETE FROM public.pending_collections WHERE id = p_payment_id;
    RETURN json_build_object('success', true, 'type', 'order_payment');
  END IF;
  
  -- 2) Policy payments
  SELECT * INTO payment_record 
  FROM public.policy_payments 
  WHERE id = p_payment_id;
  
  IF FOUND THEN
    PERFORM public.log_deletion('policy_payments'::text, p_payment_id, to_jsonb(payment_record), p_reason);
    DELETE FROM public.policy_payments WHERE id = p_payment_id;
    RETURN json_build_object('success', true, 'type', 'policy_payment');
  END IF;
  
  -- 3) Generic payments table
  SELECT * INTO payment_record 
  FROM public.payments 
  WHERE id = p_payment_id;
  
  IF FOUND THEN
    PERFORM public.log_deletion('payments'::text, p_payment_id, to_jsonb(payment_record), p_reason);
    DELETE FROM public.payments WHERE id = p_payment_id;
    RETURN json_build_object('success', true, 'type', 'payment');
  END IF;
  
  RAISE EXCEPTION 'Pago no encontrado o ya eliminado';
EXCEPTION
  WHEN OTHERS THEN
    -- Bubble up message so UI shows meaningful error
    RAISE;
END;
$$;