-- Ensure cashback trigger is installed and allow secure updates by trigger
BEGIN;

-- 1) Ensure trigger exists for cashback processing
DROP TRIGGER IF EXISTS process_order_cashback ON public.orders;
CREATE TRIGGER process_order_cashback
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_order_cashback();

-- 2) RLS: Allow updates to client_rewards when the actor is related to the client's orders
-- This enables technicians (or creators) finalizing an order to let the trigger update totals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'client_rewards' AND policyname = 'Order-related users can update client rewards' 
  ) THEN
    CREATE POLICY "Order-related users can update client rewards"
    ON public.client_rewards
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 
        FROM public.orders o 
        WHERE o.client_id = client_rewards.client_id 
          AND (o.assigned_technician = auth.uid() OR o.created_by = auth.uid())
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 
        FROM public.orders o 
        WHERE o.client_id = client_rewards.client_id 
          AND (o.assigned_technician = auth.uid() OR o.created_by = auth.uid())
      )
    );
  END IF;
END $$;

COMMIT;