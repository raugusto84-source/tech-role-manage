-- Let's completely rebuild the order policies with separate, simple policies
-- First, drop ALL existing order policies to start fresh

DROP POLICY IF EXISTS "View orders policy" ON orders;
DROP POLICY IF EXISTS "Update orders policy" ON orders;
DROP POLICY IF EXISTS "Create orders policy" ON orders;
DROP POLICY IF EXISTS "Delete orders policy" ON orders;
DROP POLICY IF EXISTS "Clients can view orders by email match" ON orders;
DROP POLICY IF EXISTS "Clients can update orders by email match" ON orders;
DROP POLICY IF EXISTS "Technicians can update their assigned orders" ON orders;
DROP POLICY IF EXISTS "Staff can view all orders" ON orders;
DROP POLICY IF EXISTS "Admin and sales can create orders" ON orders;
DROP POLICY IF EXISTS "Clients can create their own orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

-- Create completely separate policies for each role

-- 1. Admins can do everything
CREATE POLICY "admins_full_access" 
ON orders 
FOR ALL 
USING (get_user_role_safe() = 'administrador');

-- 2. Technicians can only view and update their assigned orders (NO client table reference)
CREATE POLICY "technicians_view_assigned" 
ON orders 
FOR SELECT 
USING (
  get_user_role_safe() = 'tecnico' AND 
  assigned_technician = auth.uid()
);

CREATE POLICY "technicians_update_assigned" 
ON orders 
FOR UPDATE 
USING (
  get_user_role_safe() = 'tecnico' AND 
  assigned_technician = auth.uid()
);

-- 3. Sales can view and create orders
CREATE POLICY "sales_view_all" 
ON orders 
FOR SELECT 
USING (get_user_role_safe() = 'vendedor');

CREATE POLICY "sales_create_orders" 
ON orders 
FOR INSERT 
WITH CHECK (get_user_role_safe() = 'vendedor');

-- 4. Simple client policies (separate from technician policies)
CREATE POLICY "clients_view_own" 
ON orders 
FOR SELECT 
USING (
  get_user_role_safe() = 'cliente' AND 
  client_id IS NOT NULL
);

CREATE POLICY "clients_create_own" 
ON orders 
FOR INSERT 
WITH CHECK (get_user_role_safe() = 'cliente');

-- Let's also fix the order_notes foreign key issue
-- First check if the foreign key exists, if not create it
DO $$
BEGIN
  -- Check if the foreign key constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'order_notes_user_id_fkey' 
    AND table_name = 'order_notes'
  ) THEN
    -- Add the foreign key constraint if it doesn't exist
    ALTER TABLE order_notes 
    ADD CONSTRAINT order_notes_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(user_id);
  END IF;
END $$;