-- Create whatsapp_config table to store WhatsApp provider configuration
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('twilio', 'meta', 'other')),
  business_phone_number text NOT NULL,
  phone_number_id text, -- For Meta/Cloud API
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Only allow one configuration row (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_config_singleton ON public.whatsapp_config ((true));

-- Enable RLS
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can manage WhatsApp configuration
CREATE POLICY "Admins can manage WhatsApp config"
  ON public.whatsapp_config
  FOR ALL
  USING (get_current_user_role() = 'administrador');

-- Policy: Staff can view WhatsApp configuration
CREATE POLICY "Staff can view WhatsApp config"
  ON public.whatsapp_config
  FOR SELECT
  USING (get_current_user_role() IN ('administrador', 'supervisor', 'vendedor', 'tecnico'));

-- Add comment
COMMENT ON TABLE public.whatsapp_config IS 'Stores WhatsApp Business API provider configuration (Twilio, Meta, etc)';