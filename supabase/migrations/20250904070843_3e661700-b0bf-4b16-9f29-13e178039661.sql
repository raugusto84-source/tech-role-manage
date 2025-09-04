-- Fix security warning by setting search_path
CREATE OR REPLACE FUNCTION process_quote_cashback()
RETURNS TRIGGER
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  client_data RECORD;
BEGIN
  -- Only process when status changes to 'aceptada'
  IF NEW.status = 'aceptada' AND OLD.status != 'aceptada' AND NEW.cashback_applied = true AND NEW.cashback_amount_used > 0 THEN
    
    -- Find client by email
    SELECT id INTO client_data
    FROM public.clients
    WHERE email = NEW.client_email;
    
    IF client_data.id IS NOT NULL THEN
      -- Create reward transaction record
      INSERT INTO public.reward_transactions (
        client_id,
        transaction_type,
        amount,
        description,
        related_quote_id
      ) VALUES (
        client_data.id,
        'redeemed',
        -NEW.cashback_amount_used,
        'Cashback aplicado en cotización ' || NEW.quote_number,
        NEW.id
      );

      -- Update client total cashback
      UPDATE public.client_rewards 
      SET total_cashback = total_cashback - NEW.cashback_amount_used,
          updated_at = now()
      WHERE client_id = client_data.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;