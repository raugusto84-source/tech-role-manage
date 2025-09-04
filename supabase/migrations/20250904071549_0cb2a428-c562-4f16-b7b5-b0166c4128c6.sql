-- Add missing column used by process_quote_cashback()
DO $$
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reward_transactions'
      AND column_name = 'related_quote_id'
  ) THEN
    ALTER TABLE public.reward_transactions
      ADD COLUMN related_quote_id uuid;
  END IF;

  -- Add foreign key constraint if it doesn't exist and column exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reward_transactions'
      AND column_name = 'related_quote_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reward_transactions_related_quote_id_fkey'
  ) THEN
    ALTER TABLE public.reward_transactions
      ADD CONSTRAINT reward_transactions_related_quote_id_fkey
      FOREIGN KEY (related_quote_id)
      REFERENCES public.quotes(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reward_transactions_related_quote_id
  ON public.reward_transactions(related_quote_id);

-- Optional: clarify purpose
COMMENT ON COLUMN public.reward_transactions.related_quote_id IS 'Reference to the quote where cashback was applied';