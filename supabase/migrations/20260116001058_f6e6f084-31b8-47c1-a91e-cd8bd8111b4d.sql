-- Add service_category constraint update to allow fraccionamientos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'service_types'::regclass 
    AND conname = 'service_types_service_category_check'
  ) THEN
    ALTER TABLE public.service_types DROP CONSTRAINT service_types_service_category_check;
    ALTER TABLE public.service_types ADD CONSTRAINT service_types_service_category_check 
    CHECK (service_category = ANY (ARRAY['sistemas'::text, 'seguridad'::text, 'fraccionamientos'::text]));
  END IF;
END $$;

-- Create a default service type for Fraccionamientos if it doesn't exist
INSERT INTO public.service_types (
  name, 
  description, 
  cost_price, 
  base_price, 
  is_active, 
  item_type, 
  service_category,
  estimated_hours,
  vat_rate
)
SELECT 
  'Servicio de Acceso Mensual',
  'Servicio mensual de mantenimiento y soporte de acceso para fraccionamientos',
  0,
  0,
  true,
  'servicio',
  'fraccionamientos',
  2,
  0.16
WHERE NOT EXISTS (
  SELECT 1 FROM service_types 
  WHERE name = 'Servicio de Acceso Mensual' 
  AND service_category = 'fraccionamientos'
);