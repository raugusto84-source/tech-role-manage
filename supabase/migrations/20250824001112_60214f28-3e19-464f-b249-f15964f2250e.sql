-- Update rewards system with new rules
-- First, update client_rewards table to handle new discount percentages
ALTER TABLE client_rewards 
ADD COLUMN IF NOT EXISTS email_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS registration_source text DEFAULT 'sistema',
ADD COLUMN IF NOT EXISTS policy_client boolean DEFAULT false;

-- Update reward transaction types
ALTER TABLE reward_transactions 
ADD COLUMN IF NOT EXISTS service_discount_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS article_discount_percentage numeric DEFAULT 0;

-- Create follow_up_configurations table for tracking system
CREATE TABLE IF NOT EXISTS follow_up_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  trigger_event text NOT NULL, -- 'quote_received', 'order_created', etc.
  delay_hours integer NOT NULL DEFAULT 2,
  notification_channels text[] DEFAULT ARRAY['system'], -- 'system', 'email', 'whatsapp'
  message_template text NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create follow_up_reminders table for tracking pending reminders
CREATE TABLE IF NOT EXISTS follow_up_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  configuration_id uuid NOT NULL REFERENCES follow_up_configurations(id),
  related_id uuid NOT NULL, -- quote_id, order_id, etc.
  related_type text NOT NULL, -- 'quote', 'order', etc.
  target_user_id uuid, -- who should receive the reminder
  target_email text,
  scheduled_at timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  status text DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
  message_content text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create warranties_summary table for admin dashboard
CREATE TABLE IF NOT EXISTS warranties_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  client_name text NOT NULL,
  service_name text NOT NULL,
  warranty_start_date date NOT NULL,
  warranty_end_date date NOT NULL,
  warranty_status text DEFAULT 'active', -- 'active', 'expired', 'claimed'
  days_remaining integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create achievements_summary table for admin dashboard  
CREATE TABLE IF NOT EXISTS achievements_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  achievement_id uuid NOT NULL REFERENCES achievements(id),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  achievement_name text NOT NULL,
  target_value numeric NOT NULL,
  actual_value numeric NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  earned_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE follow_up_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranties_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies for follow_up_configurations
CREATE POLICY "Admins can manage follow up configurations" 
ON follow_up_configurations FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view follow up configurations" 
ON follow_up_configurations FOR SELECT 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor']));

-- RLS Policies for follow_up_reminders
CREATE POLICY "Admins can manage follow up reminders" 
ON follow_up_reminders FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Users can view their reminders" 
ON follow_up_reminders FOR SELECT 
USING (target_user_id = auth.uid() OR get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

-- RLS Policies for warranties_summary
CREATE POLICY "Admins can manage warranties summary" 
ON warranties_summary FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view warranties summary" 
ON warranties_summary FOR SELECT 
USING (get_current_user_role() = ANY(ARRAY['administrador', 'supervisor', 'vendedor', 'tecnico']));

-- RLS Policies for achievements_summary
CREATE POLICY "Admins can manage achievements summary" 
ON achievements_summary FOR ALL 
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Users can view achievements summary" 
ON achievements_summary FOR SELECT 
USING (user_id = auth.uid() OR get_current_user_role() = ANY(ARRAY['administrador', 'supervisor']));

-- Function to process new client rewards with updated rules
CREATE OR REPLACE FUNCTION public.process_updated_order_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  client_rewards_record RECORD;
  service_cashback_amount NUMERIC := 0;
  article_cashback_amount NUMERIC := 0;
  service_total NUMERIC := 0;
  article_total NUMERIC := 0;
  referral_record RECORD;
  referrer_bonus NUMERIC := 0;
  new_client_service_discount NUMERIC := 0;
  new_client_article_discount NUMERIC := 0;
  is_validated_client BOOLEAN := false;
BEGIN
  -- Only process when order is finalized
  IF NEW.status = 'finalizada' AND OLD.status != 'finalizada' THEN
    
    -- Get client rewards record
    SELECT * INTO client_rewards_record 
    FROM public.client_rewards 
    WHERE client_id = NEW.client_id;
    
    -- Check if client is validated (registered on www.login.syslag.com with email and whatsapp)
    SELECT 
      (email_validated AND whatsapp_validated AND registration_source = 'www.login.syslag.com') 
    INTO is_validated_client
    FROM public.client_rewards 
    WHERE client_id = NEW.client_id;
    
    -- Only process rewards for validated clients
    IF is_validated_client THEN
      
      -- Calculate totals by item type
      SELECT 
        COALESCE(SUM(CASE WHEN oi.item_type = 'servicio' THEN oi.total_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN oi.item_type = 'articulo' THEN oi.total_amount ELSE 0 END), 0)
      INTO service_total, article_total
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id;
      
      -- Apply new client discounts (20% services, 5% articles) for first purchase
      IF client_rewards_record.is_new_client AND NOT client_rewards_record.new_client_discount_used THEN
        new_client_service_discount := service_total * 0.20;
        new_client_article_discount := article_total * 0.05;
        
        -- Mark discount as used
        UPDATE public.client_rewards 
        SET new_client_discount_used = true, is_new_client = false, updated_at = now()
        WHERE client_id = NEW.client_id;
        
        -- Record discount transactions
        IF new_client_service_discount > 0 THEN
          INSERT INTO public.reward_transactions (
            client_id, transaction_type, amount, description, order_id, 
            service_discount_percentage, expires_at
          ) VALUES (
            NEW.client_id, 'new_client_service_discount', new_client_service_discount,
            'Descuento 20% servicios - Cliente nuevo en orden #' || NEW.order_number,
            NEW.id, 20, now() + INTERVAL '6 months'
          );
        END IF;
        
        IF new_client_article_discount > 0 THEN
          INSERT INTO public.reward_transactions (
            client_id, transaction_type, amount, description, order_id,
            article_discount_percentage, expires_at
          ) VALUES (
            NEW.client_id, 'new_client_article_discount', new_client_article_discount,
            'Descuento 5% artículos - Cliente nuevo en orden #' || NEW.order_number,
            NEW.id, 5, now() + INTERVAL '6 months'
          );
        END IF;
      ELSE
        -- Apply regular cashback (5% services, 1% articles) for returning clients
        IF service_total > 0 THEN
          service_cashback_amount := service_total * 0.05;
          
          INSERT INTO public.reward_transactions (
            client_id, transaction_type, amount, description, order_id, expires_at
          ) VALUES (
            NEW.client_id, 'earned', service_cashback_amount, 
            'Cashback 5% servicios por orden #' || NEW.order_number,
            NEW.id, now() + INTERVAL '6 months'
          );
        END IF;
        
        IF article_total > 0 THEN
          article_cashback_amount := article_total * 0.01;
          
          INSERT INTO public.reward_transactions (
            client_id, transaction_type, amount, description, order_id, expires_at
          ) VALUES (
            NEW.client_id, 'earned', article_cashback_amount, 
            'Cashback 1% artículos por orden #' || NEW.order_number,
            NEW.id, now() + INTERVAL '6 months'
          );
        END IF;
        
        -- Update client total cashback
        UPDATE public.client_rewards 
        SET total_cashback = total_cashback + service_cashback_amount + article_cashback_amount,
            updated_at = now()
        WHERE client_id = NEW.client_id;
      END IF;
      
      -- Check for referral bonus (5% of services for both referrer and referred)
      SELECT * INTO referral_record 
      FROM public.client_referrals 
      WHERE referred_client_id = NEW.client_id 
      AND referral_bonus_given < 3 
      AND status = 'active';
      
      IF referral_record.id IS NOT NULL AND service_total > 0 THEN
        referrer_bonus := service_total * 0.05;
        
        -- Add referral bonus for referrer
        INSERT INTO public.reward_transactions (
          client_id, transaction_type, amount, description, order_id, expires_at
        ) VALUES (
          referral_record.referrer_client_id, 'referral_bonus', referrer_bonus,
          'Bono 5% por referido - Orden #' || NEW.order_number,
          NEW.id, now() + INTERVAL '6 months'
        );
        
        -- Add referral bonus for referred (first purchase)
        IF client_rewards_record.is_new_client THEN
          INSERT INTO public.reward_transactions (
            client_id, transaction_type, amount, description, order_id, expires_at
          ) VALUES (
            NEW.client_id, 'referral_bonus', referrer_bonus,
            'Bono 5% por ser referido - Orden #' || NEW.order_number,
            NEW.id, now() + INTERVAL '6 months'
          );
        END IF;
        
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
    
    -- Special handling for policy clients (100% discount on services)
    SELECT policy_client INTO is_validated_client
    FROM public.client_rewards 
    WHERE client_id = NEW.client_id;
    
    IF is_validated_client AND service_total > 0 THEN
      INSERT INTO public.reward_transactions (
        client_id, transaction_type, amount, description, order_id, 
        service_discount_percentage, expires_at
      ) VALUES (
        NEW.client_id, 'policy_discount', service_total,
        'Descuento 100% servicios - Cliente de póliza en orden #' || NEW.order_number,
        NEW.id, 100, now() + INTERVAL '1 year'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Replace the old trigger with the updated one
DROP TRIGGER IF EXISTS process_order_rewards ON orders;
CREATE TRIGGER process_updated_order_rewards
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_updated_order_rewards();