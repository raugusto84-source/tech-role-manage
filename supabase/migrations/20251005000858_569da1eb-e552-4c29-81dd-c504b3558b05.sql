-- Actualizar números de póliza existentes al formato de 4 dígitos
DO $$
DECLARE
  policy_record RECORD;
  new_number INTEGER := 1;
BEGIN
  -- Iterar sobre todas las pólizas ordenadas por fecha de creación
  FOR policy_record IN 
    SELECT id, policy_number, created_at
    FROM public.insurance_policies
    ORDER BY created_at ASC
  LOOP
    -- Actualizar con el nuevo formato
    UPDATE public.insurance_policies
    SET policy_number = 'POL-' || LPAD(new_number::TEXT, 4, '0')
    WHERE id = policy_record.id;
    
    new_number := new_number + 1;
  END LOOP;
END $$;