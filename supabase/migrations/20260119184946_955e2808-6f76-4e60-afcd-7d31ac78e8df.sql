-- Allow JCF users to see orders list and its related data (clients, items, payments, fleet)

-- Orders
DROP POLICY IF EXISTS "JCF can view all orders" ON public.orders;
CREATE POLICY "JCF can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'jcf'::user_role));

-- Clients (needed for Orders page nested select: clients:client_id(...))
DROP POLICY IF EXISTS "JCF can view all clients" ON public.clients;
CREATE POLICY "JCF can view all clients"
ON public.clients
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'jcf'::user_role));

-- Profiles (needed for technician name lookup in Orders page)
DROP POLICY IF EXISTS "JCF can view all profiles" ON public.profiles;
CREATE POLICY "JCF can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'jcf'::user_role));

-- Order items (nested select order_items(...))
DROP POLICY IF EXISTS "JCF can view all order items" ON public.order_items;
CREATE POLICY "JCF can view all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'jcf'::user_role));

-- Support technicians (used by Orders page enrichment query)
DROP POLICY IF EXISTS "JCF can view support technicians" ON public.order_support_technicians;
CREATE POLICY "JCF can view support technicians"
ON public.order_support_technicians
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'jcf'::user_role));

-- Order payments (used when calculating payment status for finalized orders)
DROP POLICY IF EXISTS "JCF can view order payments" ON public.order_payments;
CREATE POLICY "JCF can view order payments"
ON public.order_payments
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'jcf'::user_role));

-- Fleet tables (used to show technician fleet name)
DROP POLICY IF EXISTS "JCF can view fleet assignments" ON public.fleet_assignments;
CREATE POLICY "JCF can view fleet assignments"
ON public.fleet_assignments
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'jcf'::user_role));

DROP POLICY IF EXISTS "JCF can view fleet groups" ON public.fleet_groups;
CREATE POLICY "JCF can view fleet groups"
ON public.fleet_groups
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'jcf'::user_role));
