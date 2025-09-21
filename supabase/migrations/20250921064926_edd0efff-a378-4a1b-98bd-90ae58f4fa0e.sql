-- Fix cashback not being recorded: create single-entry-per-order cashback processing
BEGIN;

-- 1) Create/replace function to award cashback exactly once when an order is finalized
CREATE OR REPLACE FUNCTION public.process_order_cashback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_total NUMERIC := 0;
  article_total NUMERIC := 0;
  cashback_amount NUMERIC := 0;
  already_exists BOOLEAN := false;
BEGIN
  -- Only when status changes to finalizada
  IF NEW.status = 'finalizada' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Idempotency: skip if an 'earned' record already exists for this order
    SELECT EXISTS(
      SELECT 1 FROM public.reward_transactions rt 
      WHERE rt.order_id = NEW.id AND rt.transaction_type = 'earned'
    ) INTO already_exists;

    IF already_exists THEN
      RETURN NEW;
    END IF;

    -- Sum totals by item type
    SELECT 
      COALESCE(SUM(CASE WHEN oi.item_type = 'servicio' THEN oi.total_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN oi.item_type = 'articulo' THEN oi.total_amount ELSE 0 END), 0)
    INTO service_total, article_total
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id;

    -- Business rule: 5% services + 1% articles, single transaction per order
    cashback_amount := (service_total * 0.05) + (article_total * 0.01);

    IF cashback_amount > 0 THEN
      INSERT INTO public.reward_transactions (
        client_id, transaction_type, amount, description, order_id, expires_at
      ) VALUES (
        NEW.client_id, 'earned', cashback_amount,
        'Cashback por orden #' || NEW.order_number,
        NEW.id, now() + INTERVAL '6 months'
      );

      -- Update cached total cashback
      UPDATE public.client_rewards 
      SET total_cashback = COALESCE(total_cashback, 0) + cashback_amount,
          updated_at = now()
      WHERE client_id = NEW.client_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Ensure only the new trigger is active
DROP TRIGGER IF EXISTS process_updated_order_rewards ON public.orders;
DROP TRIGGER IF EXISTS process_order_rewards_trigger ON public.orders;
DROP TRIGGER IF EXISTS process_order_cashback ON public.orders;

CREATE TRIGGER process_order_cashback
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_order_cashback();

-- 3) Backfill: create a single 'earned' transaction for finalized orders missing it
WITH per_order AS (
  SELECT 
    o.id AS order_id,
    o.client_id,
    o.order_number,
    COALESCE(SUM(CASE WHEN oi.item_type = 'servicio' THEN oi.total_amount ELSE 0 END), 0) AS service_total,
    COALESCE(SUM(CASE WHEN oi.item_type = 'articulo' THEN oi.total_amount ELSE 0 END), 0) AS article_total
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.status = 'finalizada'
  GROUP BY o.id, o.client_id, o.order_number
)
INSERT INTO public.reward_transactions (client_id, transaction_type, amount, description, order_id, expires_at)
SELECT 
  p.client_id,
  'earned',
  (p.service_total * 0.05 + p.article_total * 0.01) AS amount,
  'Cashback por orden #' || p.order_number,
  p.order_id,
  now() + INTERVAL '6 months'
FROM per_order p
LEFT JOIN public.reward_transactions rt 
  ON rt.order_id = p.order_id AND rt.transaction_type = 'earned'
WHERE rt.id IS NULL
  AND (p.service_total * 0.05 + p.article_total * 0.01) > 0;

-- 4) Recalculate cached totals for affected clients
UPDATE public.client_rewards cr
SET total_cashback = COALESCE(
  (
    SELECT COALESCE(SUM(rt.amount), 0)
    FROM public.reward_transactions rt
    WHERE rt.client_id = cr.client_id
      AND rt.transaction_type IN ('earned', 'referral_bonus')
      AND (rt.expires_at IS NULL OR rt.expires_at > now())
  ), 0
),
updated_at = now()
WHERE cr.client_id IN (
  SELECT DISTINCT client_id FROM public.reward_transactions
);

COMMIT;