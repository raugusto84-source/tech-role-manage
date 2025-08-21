-- Allow deleting service_types referenced by client_diagnostics
-- 1) Make service_type_id nullable to support ON DELETE SET NULL
ALTER TABLE public.client_diagnostics
  ALTER COLUMN service_type_id DROP NOT NULL;

-- 2) Recreate FK with ON DELETE SET NULL
ALTER TABLE public.client_diagnostics 
  DROP CONSTRAINT IF EXISTS client_diagnostics_service_type_id_fkey;

ALTER TABLE public.client_diagnostics
  ADD CONSTRAINT client_diagnostics_service_type_id_fkey
  FOREIGN KEY (service_type_id) REFERENCES public.service_types(id)
  ON DELETE SET NULL;