-- Add assigned_fleet column to orders to store assigned fleet group at creation
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS assigned_fleet uuid NULL;

-- Foreign key to fleet_groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_assigned_fleet_fkey'
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_assigned_fleet_fkey
    FOREIGN KEY (assigned_fleet)
    REFERENCES public.fleet_groups(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
  END IF;
END $$;

-- Optional index to query by fleet
CREATE INDEX IF NOT EXISTS idx_orders_assigned_fleet ON public.orders(assigned_fleet);
