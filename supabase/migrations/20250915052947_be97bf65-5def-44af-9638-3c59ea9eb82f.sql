-- Crear función para gestionar cobranzas pendientes automáticamente
CREATE OR REPLACE FUNCTION public.manage_pending_collections()
RETURNS TRIGGER AS $$
DECLARE
  order_total NUMERIC;
  client_info RECORD;
BEGIN
  -- Para INSERT - crear nueva cobranza pendiente
  IF TG_OP = 'INSERT' THEN
    -- Obtener información del cliente
    SELECT c.name, c.email INTO client_info
    FROM public.clients c
    WHERE c.id = NEW.client_id;
    
    -- Calcular total inicial de la orden
    order_total := COALESCE(NEW.estimated_cost, 0);
    
    -- Crear registro en pending_collections
    INSERT INTO public.pending_collections (
      order_id,
      order_number,
      client_name,
      client_email,
      estimated_cost,
      delivery_date,
      total_paid,
      remaining_balance,
      total_vat_amount,
      subtotal_without_vat,
      total_with_vat,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.order_number,
      COALESCE(client_info.name, 'Cliente'),
      COALESCE(client_info.email, ''),
      order_total,
      NEW.delivery_date,
      0, -- total_paid inicial
      order_total, -- remaining_balance inicial
      0, -- total_vat_amount
      order_total, -- subtotal_without_vat
      order_total, -- total_with_vat
      NOW(),
      NOW()
    );
    
    RETURN NEW;
  END IF;
  
  -- Para UPDATE - actualizar cobranzas existentes
  IF TG_OP = 'UPDATE' THEN
    -- Calcular nuevo total basado en order_items
    SELECT COALESCE(SUM(total_amount), COALESCE(NEW.estimated_cost, 0))
    INTO order_total
    FROM public.order_items
    WHERE order_id = NEW.id;
    
    -- Si no hay items, usar estimated_cost
    IF order_total IS NULL OR order_total = 0 THEN
      order_total := COALESCE(NEW.estimated_cost, 0);
    END IF;
    
    -- Actualizar pending_collections si existe
    UPDATE public.pending_collections
    SET 
      estimated_cost = order_total,
      total_with_vat = order_total,
      subtotal_without_vat = order_total,
      remaining_balance = order_total - COALESCE(total_paid, 0),
      delivery_date = NEW.delivery_date,
      updated_at = NOW()
    WHERE order_id = NEW.id;
    
    -- Si no existe registro y el total es mayor a 0, crearlo
    IF NOT FOUND AND order_total > 0 THEN
      -- Obtener información del cliente
      SELECT c.name, c.email INTO client_info
      FROM public.clients c
      WHERE c.id = NEW.client_id;
      
      INSERT INTO public.pending_collections (
        order_id,
        order_number,
        client_name,
        client_email,
        estimated_cost,
        delivery_date,
        total_paid,
        remaining_balance,
        total_vat_amount,
        subtotal_without_vat,
        total_with_vat,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.order_number,
        COALESCE(client_info.name, 'Cliente'),
        COALESCE(client_info.email, ''),
        order_total,
        NEW.delivery_date,
        0,
        order_total,
        0,
        order_total,
        order_total,
        NOW(),
        NOW()
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear función para actualizar cobranzas cuando cambien los order_items
CREATE OR REPLACE FUNCTION public.update_pending_collections_on_items()
RETURNS TRIGGER AS $$
DECLARE
  order_total NUMERIC;
  order_info RECORD;
  client_info RECORD;
BEGIN
  -- Obtener información de la orden
  SELECT o.id, o.order_number, o.client_id, o.delivery_date
  INTO order_info
  FROM public.orders o
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Calcular nuevo total basado en todos los items de la orden
  SELECT COALESCE(SUM(total_amount), 0)
  INTO order_total
  FROM public.order_items
  WHERE order_id = order_info.id;
  
  -- Obtener información del cliente
  SELECT c.name, c.email INTO client_info
  FROM public.clients c
  WHERE c.id = order_info.client_id;
  
  -- Actualizar o crear registro en pending_collections
  INSERT INTO public.pending_collections (
    order_id,
    order_number,
    client_name,
    client_email,
    estimated_cost,
    delivery_date,
    total_paid,
    remaining_balance,
    total_vat_amount,
    subtotal_without_vat,
    total_with_vat,
    created_at,
    updated_at
  ) VALUES (
    order_info.id,
    order_info.order_number,
    COALESCE(client_info.name, 'Cliente'),
    COALESCE(client_info.email, ''),
    order_total,
    order_info.delivery_date,
    0,
    order_total,
    0,
    order_total,
    order_total,
    NOW(),
    NOW()
  )
  ON CONFLICT (order_id) 
  DO UPDATE SET
    estimated_cost = EXCLUDED.estimated_cost,
    total_with_vat = EXCLUDED.estimated_cost,
    subtotal_without_vat = EXCLUDED.estimated_cost,
    remaining_balance = EXCLUDED.estimated_cost - COALESCE(pending_collections.total_paid, 0),
    updated_at = NOW()
  WHERE pending_collections.order_id = order_info.id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear triggers para órdenes
DROP TRIGGER IF EXISTS trigger_manage_pending_collections ON public.orders;
CREATE TRIGGER trigger_manage_pending_collections
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.manage_pending_collections();

-- Crear triggers para order_items
DROP TRIGGER IF EXISTS trigger_update_pending_collections_items ON public.order_items;
CREATE TRIGGER trigger_update_pending_collections_items
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pending_collections_on_items();

-- Asegurar que pending_collections tenga constraint único por order_id
ALTER TABLE public.pending_collections 
DROP CONSTRAINT IF EXISTS pending_collections_order_id_unique;

ALTER TABLE public.pending_collections 
ADD CONSTRAINT pending_collections_order_id_unique UNIQUE (order_id);