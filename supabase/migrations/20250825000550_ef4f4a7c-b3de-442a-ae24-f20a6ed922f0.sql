-- Update user role enum to include visor_tecnico
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = pg_type.oid AND enumlabel = 'visor_tecnico')) THEN
        ALTER TYPE user_role ADD VALUE 'visor_tecnico';
    END IF;
END $$;

-- Create task categories table
CREATE TABLE IF NOT EXISTS public.task_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  allowed_roles TEXT[] DEFAULT ARRAY['administrador'::text, 'tecnico'::text],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on task_categories
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_categories
CREATE POLICY "Admins can manage task categories" ON public.task_categories
  FOR ALL USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view task categories" ON public.task_categories
  FOR SELECT USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text, 'visor_tecnico'::text]));

-- Update tasks table to include category
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.task_categories(id);

-- Create pending expenses table for non-fiscal purchases
CREATE TABLE IF NOT EXISTS public.pending_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMP WITH TIME ZONE,
  applied_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pending_expenses
ALTER TABLE public.pending_expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies for pending_expenses
CREATE POLICY "Admin and supervisors can manage pending expenses" ON public.pending_expenses
  FOR ALL USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text]));

-- Create general chats table
CREATE TABLE IF NOT EXISTS public.general_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_by JSONB DEFAULT '[]'::jsonb
);

-- Enable RLS on general_chats
ALTER TABLE public.general_chats ENABLE ROW LEVEL SECURITY;

-- RLS policies for general_chats
CREATE POLICY "Staff can manage general chats" ON public.general_chats
  FOR ALL USING (get_current_user_role() = ANY(ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text, 'visor_tecnico'::text, 'cliente'::text]));

-- Add reversal tracking to financial tables
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN DEFAULT false;
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id);
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

-- Insert default task categories
INSERT INTO public.task_categories (name, description, color, allowed_roles) VALUES
  ('Mantenimiento', 'Tareas de mantenimiento preventivo y correctivo', '#10b981', ARRAY['tecnico'::text, 'administrador'::text]),
  ('Reparación', 'Reparación de equipos y sistemas', '#f59e0b', ARRAY['tecnico'::text, 'administrador'::text]),
  ('Instalación', 'Instalación de nuevos equipos y software', '#3b82f6', ARRAY['tecnico'::text, 'administrador'::text]),
  ('Soporte', 'Soporte técnico y asistencia', '#8b5cf6', ARRAY['tecnico'::text, 'vendedor'::text, 'administrador'::text]),
  ('Formateo', 'Formateo y reinstalación de sistemas', '#ef4444', ARRAY['tecnico'::text, 'administrador'::text]),
  ('Consultoría', 'Asesorías y consultorías técnicas', '#06b6d4', ARRAY['vendedor'::text, 'administrador'::text])
ON CONFLICT DO NOTHING;

-- Create function to check if user has logged time today (for non-client users)
CREATE OR REPLACE FUNCTION public.has_logged_time_today(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.time_records 
    WHERE employee_id = user_id 
    AND work_date = CURRENT_DATE
    AND check_in_time IS NOT NULL
  );
$$;

-- Enable realtime for general_chats
ALTER TABLE public.general_chats REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.general_chats;