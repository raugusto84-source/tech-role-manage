-- Preferir el total acordado de la orden (estimated_cost) sobre la suma de items
-- y sincronizar registros existentes para corregir casos como ORD-2025-0002

-- Actualizar función de órdenes -> pending_collections
CREATE OR REPLACE FUNCTION public.manage_pending_collections()
RETURNS TRIGGER AS $$
DECLARE
  items_total NUMERIC;
  order_total NUMERIC;
  client_info RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT c.name, c.email INTO client_info
    FROM public.clients c
    WHERE c.id = NEW.client_id;

    -- Calcular suma de items y preferir el total acordado de la orden
    SELECT COALESCE(SUM(total_amount), 0) INTO items_total
    FROM public.order_items
    WHERE order_id = NEW.id;

    order_total := COALESCE(NEW.estimated_cost, items_total, 0);

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
    )
    ON CONFLICT (order_id) DO UPDATE SET
      estimated_cost = EXCLUDED.estimated_cost,
      subtotal_without_vat = EXCLUDED.subtotal_without_vat,
      total_with_vat = EXCLUDED.total_with_vat,
      delivery_date = EXCLUDED.delivery_date,
      remaining_balance = EXCLUDED.estimated_cost - COALESCE(pending_collections.total_paid, 0),
      updated_at = NOW();

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Recalcular suma de items y preferir el total acordado de la orden
    SELECT COALESCE(SUM(total_amount), 0) INTO items_total
    FROM public.order_items
    WHERE order_id = NEW.id;

    order_total := COALESCE(NEW.estimated_cost, items_total, 0);

    UPDATE public.pending_collections
    SET 
      estimated_cost = order_total,
      total_with_vat = order_total,
      subtotal_without_vat = order_total,
      remaining_balance = order_total - COALESCE(total_paid, 0),
      delivery_date = NEW.delivery_date,
      updated_at = NOW()
    WHERE order_id = NEW.id;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Actualizar función de items -> pending_collections
CREATE OR REPLACE FUNCTION public.update_pending_collections_on_items()
RETURNS TRIGGER AS $$
DECLARE
  items_total NUMERIC;
  order_total NUMERIC;
  order_info RECORD;
  client_info RECORD;
BEGIN
  SELECT o.id, o.order_number, o.client_id, o.delivery_date, o.estimated_cost
  INTO order_info
  FROM public.orders o
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  -- Suma de items
  SELECT COALESCE(SUM(total_amount), 0) INTO items_total
  FROM public.order_items
  WHERE order_id = order_info.id;

  -- Preferir total acordado (estimated_cost) si existe
  order_total := COALESCE(order_info.estimated_cost, items_total, 0);

  UPDATE public.pending_collections
  SET 
    estimated_cost = order_total,
    total_with_vat = order_total,
    subtotal_without_vat = order_total,
    remaining_balance = order_total - COALESCE(total_paid, 0),
    delivery_date = order_info.delivery_date,
    updated_at = NOW()
  WHERE order_id = order_info.id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Sincronizar registros existentes con el total acordado de la orden
UPDATE public.pending_collections pc
SET 
  estimated_cost = COALESCE(o.estimated_cost, pc.estimated_cost),
  subtotal_without_vat = COALESCE(o.estimated_cost, pc.subtotal_without_vat),
  total_with_vat = COALESCE(o.estimated_cost, pc.total_with_vat),
  remaining_balance = COALESCE(o.estimated_cost, pc.total_with_vat) - COALESCE(pc.total_paid, 0),
  updated_at = NOW()
FROM public.orders o
WHERE pc.order_id = o.id
  AND o.estimated_cost IS NOT NULL
  AND o.estimated_cost > 0;