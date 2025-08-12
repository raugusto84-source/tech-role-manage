-- Add RLS policies for clients to access their orders (only if they don't exist)

-- Check if policy exists before creating
DO $$ 
BEGIN
  -- Policy for clients to view their own orders
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'orders' 
    AND policyname = 'Clients can view their own orders'
  ) THEN
    EXECUTE 'CREATE POLICY "Clients can view their own orders" 
    ON public.orders FOR SELECT 
    USING (
      client_id IN (
        SELECT c.id FROM public.clients c 
        JOIN public.profiles p ON p.email = c.email 
        WHERE p.user_id = auth.uid() AND p.role = ''cliente''
      )
    )';
  END IF;

  -- Policy for clients to update their own orders (for approval)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'orders' 
    AND policyname = 'Clients can update their own orders for approval'
  ) THEN
    EXECUTE 'CREATE POLICY "Clients can update their own orders for approval" 
    ON public.orders FOR UPDATE 
    USING (
      client_id IN (
        SELECT c.id FROM public.clients c 
        JOIN public.profiles p ON p.email = c.email 
        WHERE p.user_id = auth.uid() AND p.role = ''cliente''
      )
    ) 
    WITH CHECK (
      client_id IN (
        SELECT c.id FROM public.clients c 
        JOIN public.profiles p ON p.email = c.email 
        WHERE p.user_id = auth.uid() AND p.role = ''cliente''
      )
    )';
  END IF;
END $$;