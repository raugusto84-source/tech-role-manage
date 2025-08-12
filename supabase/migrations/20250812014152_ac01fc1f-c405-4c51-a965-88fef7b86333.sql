-- Create reward system tables
CREATE TABLE public.client_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  total_points NUMERIC DEFAULT 0,
  total_cashback NUMERIC DEFAULT 0,
  is_new_client BOOLEAN DEFAULT true,
  new_client_discount_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Create referral system table
CREATE TABLE public.client_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  referred_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL UNIQUE,
  referral_bonus_given INTEGER DEFAULT 0, -- Track how many bonuses given (max 3)
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referred_client_id)
);

-- Create reward transactions table for history
CREATE TABLE public.reward_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'earned', 'redeemed', 'expired', 'referral_bonus'
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_rewards
CREATE POLICY "Clients can view their own rewards" 
ON public.client_rewards FOR SELECT 
USING (
  client_id IN (
    SELECT c.id FROM public.clients c 
    JOIN public.profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can manage all client rewards" 
ON public.client_rewards FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- RLS Policies for client_referrals
CREATE POLICY "Clients can view their referrals" 
ON public.client_referrals FOR SELECT 
USING (
  referrer_client_id IN (
    SELECT c.id FROM public.clients c 
    JOIN public.profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid()
  ) OR
  referred_client_id IN (
    SELECT c.id FROM public.clients c 
    JOIN public.profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can create referrals" 
ON public.client_referrals FOR INSERT 
WITH CHECK (
  referrer_client_id IN (
    SELECT c.id FROM public.clients c 
    JOIN public.profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can manage all referrals" 
ON public.client_referrals FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- RLS Policies for reward_transactions
CREATE POLICY "Clients can view their transactions" 
ON public.reward_transactions FOR SELECT 
USING (
  client_id IN (
    SELECT c.id FROM public.clients c 
    JOIN public.profiles p ON p.email = c.email 
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can manage all transactions" 
ON public.reward_transactions FOR ALL 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- Create function to initialize client rewards
CREATE OR REPLACE FUNCTION public.initialize_client_rewards()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.client_rewards (client_id, is_new_client)
  VALUES (NEW.id, true)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create rewards for new clients
CREATE TRIGGER initialize_client_rewards_trigger
AFTER INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.initialize_client_rewards();

-- Function to generate referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    code := 'REF' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.client_referrals WHERE referral_code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate cashback and apply new client discount
CREATE OR REPLACE FUNCTION public.process_order_rewards()
RETURNS TRIGGER AS $$
DECLARE
  client_rewards_record RECORD;
  cashback_amount NUMERIC := 0;
  referral_record RECORD;
  referrer_bonus NUMERIC := 0;
  service_total NUMERIC := 0;
BEGIN
  -- Only process when order is finalized
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    
    -- Get client rewards record
    SELECT * INTO client_rewards_record 
    FROM public.client_rewards 
    WHERE client_id = NEW.client_id;
    
    -- Calculate total from service items only (for cashback)
    SELECT COALESCE(SUM(oi.total_amount), 0) INTO service_total
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND oi.item_type = 'servicio';
    
    -- Calculate 2% cashback on services
    IF service_total > 0 THEN
      cashback_amount := service_total * 0.02;
      
      -- Add cashback transaction
      INSERT INTO public.reward_transactions (
        client_id, transaction_type, amount, description, order_id, expires_at
      ) VALUES (
        NEW.client_id, 'earned', cashback_amount, 
        'Cashback 2% por orden #' || NEW.order_number,
        NEW.id, now() + INTERVAL '1 year'
      );
      
      -- Update client rewards
      UPDATE public.client_rewards 
      SET total_cashback = total_cashback + cashback_amount,
          updated_at = now()
      WHERE client_id = NEW.client_id;
    END IF;
    
    -- Mark new client discount as used if it was a new client
    IF client_rewards_record.is_new_client AND NOT client_rewards_record.new_client_discount_used THEN
      UPDATE public.client_rewards 
      SET new_client_discount_used = true, is_new_client = false, updated_at = now()
      WHERE client_id = NEW.client_id;
    END IF;
    
    -- Check for referral bonus
    SELECT * INTO referral_record 
    FROM public.client_referrals 
    WHERE referred_client_id = NEW.client_id 
    AND referral_bonus_given < 3 
    AND status = 'active';
    
    IF referral_record.id IS NOT NULL THEN
      -- Calculate 5% referral bonus
      referrer_bonus := (NEW.estimated_cost * 0.05);
      
      -- Add referral bonus transaction
      INSERT INTO public.reward_transactions (
        client_id, transaction_type, amount, description, order_id, expires_at
      ) VALUES (
        referral_record.referrer_client_id, 'referral_bonus', referrer_bonus,
        'Bono por referido - Orden #' || NEW.order_number,
        NEW.id, now() + INTERVAL '1 year'
      );
      
      -- Update referrer's cashback
      UPDATE public.client_rewards 
      SET total_cashback = total_cashback + referrer_bonus,
          updated_at = now()
      WHERE client_id = referral_record.referrer_client_id;
      
      -- Update referral bonus count
      UPDATE public.client_referrals 
      SET referral_bonus_given = referral_bonus_given + 1
      WHERE id = referral_record.id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for order rewards processing
CREATE TRIGGER process_order_rewards_trigger
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.process_order_rewards();

-- Function to clean expired rewards
CREATE OR REPLACE FUNCTION public.clean_expired_rewards()
RETURNS void AS $$
BEGIN
  -- Mark expired transactions
  UPDATE public.reward_transactions 
  SET transaction_type = 'expired'
  WHERE expires_at < now() 
  AND transaction_type IN ('earned', 'referral_bonus');
  
  -- Recalculate total cashback for affected clients
  UPDATE public.client_rewards 
  SET total_cashback = (
    SELECT COALESCE(SUM(rt.amount), 0)
    FROM public.reward_transactions rt
    WHERE rt.client_id = client_rewards.client_id
    AND rt.transaction_type IN ('earned', 'referral_bonus')
    AND (rt.expires_at IS NULL OR rt.expires_at > now())
  ),
  updated_at = now()
  WHERE client_id IN (
    SELECT DISTINCT client_id 
    FROM public.reward_transactions 
    WHERE transaction_type = 'expired'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;