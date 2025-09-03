-- Create reward_settings table for configurable cashback percentages and application behavior
CREATE TABLE IF NOT EXISTS public.reward_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  new_client_cashback_percent NUMERIC NOT NULL DEFAULT 2.0,
  general_cashback_percent NUMERIC NOT NULL DEFAULT 2.0,
  apply_cashback_to_items BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.reward_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Admins/Supervisors/Vendedores can manage; all authenticated users can read
CREATE POLICY "Manage reward settings by staff" ON public.reward_settings
  FOR ALL
  USING (get_current_user_role() = ANY(ARRAY['administrador','supervisor','vendedor']))
  WITH CHECK (get_current_user_role() = ANY(ARRAY['administrador','supervisor','vendedor']));

CREATE POLICY "Read reward settings by authenticated users" ON public.reward_settings
  FOR SELECT
  USING (true);

-- Trigger function to update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger
DROP TRIGGER IF EXISTS set_reward_settings_updated_at ON public.reward_settings;
CREATE TRIGGER set_reward_settings_updated_at
BEFORE UPDATE ON public.reward_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Optional: ensure only one active row at a time via partial unique index
DROP INDEX IF EXISTS idx_reward_settings_single_active;
CREATE UNIQUE INDEX idx_reward_settings_single_active
  ON public.reward_settings ((is_active))
  WHERE is_active = true;