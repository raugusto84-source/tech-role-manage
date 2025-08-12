-- Update the handle_new_user function to process referral codes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  referral_code_input TEXT;
  referrer_client_id UUID;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'cliente'::public.user_role)
  );

  -- Only process referral for cliente role
  IF COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'cliente'::public.user_role) = 'cliente' THEN
    
    -- Get referral code from user metadata
    referral_code_input := NEW.raw_user_meta_data->>'referral_code';
    
    -- Process referral code if provided
    IF referral_code_input IS NOT NULL AND referral_code_input != '' THEN
      
      -- Find the referrer client by referral code
      SELECT referrer_client_id INTO referrer_client_id
      FROM public.client_referrals
      WHERE referral_code = UPPER(referral_code_input)
      AND status = 'active'
      LIMIT 1;
      
      -- If referrer found, create the referral relationship
      IF referrer_client_id IS NOT NULL THEN
        
        -- First create a client record for the new user
        WITH new_client AS (
          INSERT INTO public.clients (name, email, address, created_by, user_id)
          VALUES (
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
            NEW.email,
            'Dirección no especificada',
            NEW.id,
            NEW.id
          )
          RETURNING id
        )
        -- Then update the referral record
        UPDATE public.client_referrals 
        SET referred_client_id = (SELECT id FROM new_client),
            updated_at = now()
        WHERE referral_code = UPPER(referral_code_input)
        AND referrer_client_id = referrer_client_id;
        
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;