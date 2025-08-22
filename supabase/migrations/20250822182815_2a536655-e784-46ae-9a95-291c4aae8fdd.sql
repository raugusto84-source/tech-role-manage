-- 1) Create child table to hold bundled items for scheduled services
CREATE TABLE IF NOT EXISTS public.scheduled_service_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_service_id uuid NOT NULL REFERENCES public.scheduled_services(id) ON DELETE CASCADE,
  service_type_id uuid NOT NULL REFERENCES public.service_types(id),
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS mirroring scheduled_services behavior
ALTER TABLE public.scheduled_service_items ENABLE ROW LEVEL SECURITY;

-- Policies: Admins & supervisors manage; staff (admin, supervisor, vendedor, tecnico) can view
CREATE POLICY "Admins can manage scheduled_service_items"
ON public.scheduled_service_items
FOR ALL
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text]));

CREATE POLICY "Staff can view scheduled_service_items"
ON public.scheduled_service_items
FOR SELECT
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text, 'tecnico'::text]));