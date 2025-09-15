-- Remove automatic order-creation on quote acceptance to avoid duplicates
-- Drop the trigger and function that auto-created orders when a quote became 'aceptada'
DO $$
BEGIN
  -- Drop trigger if exists
  IF EXISTS(
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_order_from_approved_quote'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_create_order_from_approved_quote ON public.quotes';
  END IF;

  -- Drop helper test trigger if it still exists
  IF EXISTS(
    SELECT 1 FROM pg_trigger WHERE tgname = 'test_trigger_quotes'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS test_trigger_quotes ON public.quotes';
  END IF;
END$$;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS public.create_order_from_approved_quote() CASCADE;
DROP FUNCTION IF EXISTS public.test_trigger_execution() CASCADE;