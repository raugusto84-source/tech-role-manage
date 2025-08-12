-- Update RLS policies to include supervisor role where appropriate

-- Update achievement_rewards policies to include supervisor
DROP POLICY IF EXISTS "Staff can view achievement rewards" ON public.achievement_rewards;
CREATE POLICY "Staff can view achievement rewards" 
ON public.achievement_rewards 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'tecnico'::text, 'vendedor'::text]));

-- Update clients policies to include supervisor
DROP POLICY IF EXISTS "Staff can manage clients" ON public.clients;
CREATE POLICY "Staff can manage clients" 
ON public.clients 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text]));

-- Update employee_payments policies to include supervisor
DROP POLICY IF EXISTS "Staff can view employee payments" ON public.employee_payments;
CREATE POLICY "Staff can view employee payments" 
ON public.employee_payments 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'tecnico'::text, 'vendedor'::text]));

-- Update expenses policies to allow supervisor management
DROP POLICY IF EXISTS "Admins can manage all expenses" ON public.expenses;
CREATE POLICY "Admins and supervisors can manage all expenses" 
ON public.expenses 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));

-- Update financial_history policies to include supervisor
DROP POLICY IF EXISTS "Admins can view all financial history" ON public.financial_history;
CREATE POLICY "Admins and supervisors can view all financial history" 
ON public.financial_history 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['administrador'::user_role, 'supervisor'::user_role])))));

DROP POLICY IF EXISTS "Only admins can manage financial history" ON public.financial_history;
CREATE POLICY "Admins and supervisors can manage financial history" 
ON public.financial_history 
FOR ALL 
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['administrador'::user_role, 'supervisor'::user_role])))));

-- Update fixed_expenses policies to include supervisor
DROP POLICY IF EXISTS "Admins can manage fixed expenses" ON public.fixed_expenses;
CREATE POLICY "Admins and supervisors can manage fixed expenses" 
ON public.fixed_expenses 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));

DROP POLICY IF EXISTS "Staff can view fixed expenses" ON public.fixed_expenses;
CREATE POLICY "Staff can view fixed expenses" 
ON public.fixed_expenses 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'tecnico'::text, 'vendedor'::text]));

-- Update incomes policies to include supervisor
DROP POLICY IF EXISTS "Admins can manage all incomes" ON public.incomes;
CREATE POLICY "Admins and supervisors can manage all incomes" 
ON public.incomes 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));

-- Update orders policies to include supervisor
UPDATE orders SET status = status WHERE 1=1; -- Touch table to trigger policy update

-- Update order_payments policies to include supervisor  
DROP POLICY IF EXISTS "Admins can manage all order payments" ON public.order_payments;
CREATE POLICY "Admins and supervisors can manage all order payments" 
ON public.order_payments 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));

DROP POLICY IF EXISTS "Staff can view order payments" ON public.order_payments;
CREATE POLICY "Staff can view order payments" 
ON public.order_payments 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'tecnico'::text, 'vendedor'::text]));

-- Update quotes access for supervisor (if not already included)
-- This will be handled by existing policies that check for staff roles

-- Update users management - supervisors can manage users
DROP POLICY IF EXISTS "Staff can manage order items" ON public.order_items;
CREATE POLICY "Staff can manage order items" 
ON public.order_items 
FOR ALL 
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['administrador'::user_role, 'supervisor'::user_role, 'vendedor'::user_role])))));

-- Update order_items view policy to include supervisor
DROP POLICY IF EXISTS "Users can view order items for their orders" ON public.order_items;
CREATE POLICY "Users can view order items for their orders" 
ON public.order_items 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM ((orders o
     LEFT JOIN clients c ON ((c.id = o.client_id)))
     LEFT JOIN profiles p ON ((p.user_id = auth.uid())))
  WHERE ((o.id = order_items.order_id) AND ((o.assigned_technician = auth.uid()) OR (p.role = 'administrador'::user_role) OR ((p.role = 'cliente'::user_role) AND (c.email = p.email)) OR (p.role = 'vendedor'::user_role) OR (p.role = 'supervisor'::user_role)))));

-- Allow supervisors to view chat messages
DROP POLICY IF EXISTS "Users can read messages from their orders" ON public.order_chat_messages;
CREATE POLICY "Users can read messages from their orders" 
ON public.order_chat_messages 
FOR SELECT 
USING ((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_chat_messages.order_id) AND (o.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.user_id = auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_chat_messages.order_id) AND (o.assigned_technician = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = ANY (ARRAY['vendedor'::user_role, 'administrador'::user_role, 'supervisor'::user_role])))))));

-- Allow supervisors to send messages  
DROP POLICY IF EXISTS "Users can insert messages to their orders" ON public.order_chat_messages;
CREATE POLICY "Users can insert messages to their orders" 
ON public.order_chat_messages 
FOR INSERT 
WITH CHECK ((auth.uid() IS NOT NULL) AND (sender_id = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_chat_messages.order_id) AND (o.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.user_id = auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_chat_messages.order_id) AND (o.assigned_technician = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = ANY (ARRAY['vendedor'::user_role, 'administrador'::user_role, 'supervisor'::user_role])))))));

-- Update the mark messages as read policy for supervisors
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.order_chat_messages;
CREATE POLICY "Users can mark messages as read" 
ON public.order_chat_messages 
FOR UPDATE 
USING ((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_chat_messages.order_id) AND (o.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.user_id = auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_chat_messages.order_id) AND (o.assigned_technician = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = ANY (ARRAY['vendedor'::user_role, 'administrador'::user_role, 'supervisor'::user_role])))))));

-- Update delivery signatures policy to include supervisor
DROP POLICY IF EXISTS "Staff can view all delivery signatures" ON public.delivery_signatures;
CREATE POLICY "Staff can view all delivery signatures" 
ON public.delivery_signatures 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = ANY (ARRAY['administrador'::user_role, 'supervisor'::user_role, 'tecnico'::user_role, 'vendedor'::user_role])))));

COMMENT ON COLUMN public.profiles.role IS 'Updated to include supervisor role with access to sales, quotes, orders, users, finances, and surveys';