-- Fix RLS policies for quotes table to allow clients to see quotes created by admins

-- Drop existing policies for quotes table
DROP POLICY IF EXISTS "Clients can view their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Staff can manage all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can create quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can view their own quotes" ON public.quotes;

-- Create comprehensive RLS policies for quotes
CREATE POLICY "Clients can view quotes assigned to them" 
ON public.quotes 
FOR SELECT 
USING (
  -- Cliente puede ver cotizaciones donde su email coincide
  (client_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()))
  OR 
  -- Staff puede ver todas las cotizaciones
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY (ARRAY['administrador'::user_role, 'supervisor'::user_role, 'vendedor'::user_role, 'tecnico'::user_role])
  ))
);

CREATE POLICY "Staff can manage all quotes" 
ON public.quotes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY (ARRAY['administrador'::user_role, 'supervisor'::user_role, 'vendedor'::user_role])
  )
);

CREATE POLICY "Anyone can create quotes" 
ON public.quotes 
FOR INSERT 
WITH CHECK (true);

-- Fix RLS policies for quote_items table to match quotes access
DROP POLICY IF EXISTS "Staff can manage all quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Users can view quote items for accessible quotes" ON public.quote_items;
DROP POLICY IF EXISTS "Anyone can create quote items" ON public.quote_items;

CREATE POLICY "Users can view quote items for accessible quotes" 
ON public.quote_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q 
    WHERE q.id = quote_items.quote_id 
    AND (
      -- Cliente puede ver items de cotizaciones asignadas a él
      q.client_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
      OR 
      -- Staff puede ver todos los items
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role = ANY (ARRAY['administrador'::user_role, 'supervisor'::user_role, 'vendedor'::user_role, 'tecnico'::user_role])
      )
    )
  )
);

CREATE POLICY "Staff can manage all quote items" 
ON public.quote_items 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY (ARRAY['administrador'::user_role, 'supervisor'::user_role, 'vendedor'::user_role])
  )
);

CREATE POLICY "Anyone can create quote items" 
ON public.quote_items 
FOR INSERT 
WITH CHECK (true);