-- Crear o reemplazar trigger para manejar items manuales correctamente
CREATE OR REPLACE FUNCTION public.validate_order_item_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Si el item tiene pricing_locked=true o service_type_id es NULL (item manual)
  -- no intentar calcular precios, usar los valores proporcionados
  IF NEW.pricing_locked = true OR NEW.service_type_id IS NULL THEN
    -- Para items manuales, asegurarse que los campos requeridos no sean NULL
    IF NEW.unit_cost_price IS NULL THEN
      NEW.unit_cost_price := 0;
    END IF;
    IF NEW.unit_base_price IS NULL THEN
      NEW.unit_base_price := 0;
    END IF;
    IF NEW.subtotal IS NULL THEN
      NEW.subtotal := 0;
    END IF;
    IF NEW.vat_amount IS NULL THEN
      NEW.vat_amount := 0;
    END IF;
    IF NEW.total_amount IS NULL THEN
      NEW.total_amount := 0;
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- Para items con service_type_id válido y sin pricing_locked,
  -- continuar con el proceso normal
  RETURN NEW;
END;
$$;

-- Crear el trigger si no existe
DROP TRIGGER IF EXISTS validate_order_item_trigger ON public.order_items;
CREATE TRIGGER validate_order_item_trigger
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_item_before_insert();