-- Crear tabla para almacenar totales calculados de órdenes
CREATE TABLE public.order_totals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.order_totals ENABLE ROW LEVEL SECURITY;

-- Política para que staff pueda ver y gestionar todos los totales
CREATE POLICY "Staff can manage order totals" 
ON public.order_totals 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['administrador'::text, 'vendedor'::text, 'tecnico'::text]));

-- Política para que clientes puedan ver totales de sus órdenes
CREATE POLICY "Clients can view their order totals" 
ON public.order_totals 
FOR SELECT 
USING (EXISTS (
  SELECT 1 
  FROM public.orders o 
  JOIN public.clients c ON c.id = o.client_id 
  JOIN public.profiles p ON p.email = c.email 
  WHERE o.id = order_totals.order_id 
  AND p.user_id = auth.uid()
));

-- Función para calcular el total correcto de una orden usando la lógica de sales pricing
CREATE OR REPLACE FUNCTION public.calculate_order_total(p_order_id UUID)
RETURNS TABLE(subtotal NUMERIC, vat_amount NUMERIC, total_amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_rec RECORD;
  order_rec RECORD;
  rs RECORD;
  item_subtotal NUMERIC;
  item_vat NUMERIC;
  item_total NUMERIC;
  total_sub NUMERIC := 0;
  total_vat NUMERIC := 0;
  total_amt NUMERIC := 0;
  is_new_client BOOLEAN := false;
  cashback_rate NUMERIC := 0;
BEGIN
  -- Obtener información de la orden
  SELECT o.*, o.created_at INTO order_rec
  FROM public.orders o 
  WHERE o.id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Obtener configuración de rewards activa
  SELECT * INTO rs FROM public.reward_settings WHERE is_active = true LIMIT 1;
  
  -- Determinar si es cliente nuevo
  SELECT COUNT(*) = 0 INTO is_new_client
  FROM public.orders
  WHERE client_id = order_rec.client_id
    AND status = 'finalizada'
    AND created_at < order_rec.created_at;
  
  -- Calcular cashback a aplicar
  IF rs IS NOT NULL AND rs.apply_cashback_to_items THEN
    cashback_rate := CASE 
      WHEN is_new_client THEN rs.new_client_cashback_percent 
      ELSE rs.general_cashback_percent 
    END;
  ELSE
    cashback_rate := 0;
  END IF;
  
  -- Calcular total de todos los items
  FOR item_rec IN 
    SELECT * FROM public.order_items 
    WHERE order_id = p_order_id
  LOOP
    IF item_rec.item_type = 'servicio' THEN
      -- Para servicios: precio base + IVA + cashback
      item_subtotal := (COALESCE(item_rec.unit_base_price, 0) * GREATEST(item_rec.quantity, 1));
      item_vat := item_subtotal * (COALESCE(item_rec.vat_rate, 0) / 100.0);
      item_total := (item_subtotal + item_vat) * (1 + cashback_rate / 100.0);
    ELSE
      -- Para artículos: costo + IVA compra + margen + IVA venta + cashback
      DECLARE
        cost_with_purchase_vat NUMERIC;
        cost_with_margin NUMERIC;
        cost_with_sales_vat NUMERIC;
        final_price NUMERIC;
      BEGIN
        cost_with_purchase_vat := COALESCE(item_rec.unit_cost_price, 0) * (1 + 16.0 / 100.0); -- IVA compra 16%
        cost_with_margin := cost_with_purchase_vat * (1 + COALESCE(item_rec.profit_margin_rate, 0) / 100.0);
        cost_with_sales_vat := cost_with_margin * (1 + COALESCE(item_rec.vat_rate, 0) / 100.0);
        final_price := cost_with_sales_vat * (1 + cashback_rate / 100.0);
        item_total := final_price * GREATEST(item_rec.quantity, 1);
        
        -- Separar subtotal y VAT para artículos
        item_subtotal := item_total / (1 + COALESCE(item_rec.vat_rate, 0) / 100.0);
        item_vat := item_total - item_subtotal;
      END;
    END IF;
    
    -- Redondear hacia arriba a decenas
    item_total := CEIL(item_total / 10.0) * 10;
    item_subtotal := CEIL(item_subtotal / 10.0) * 10;
    item_vat := item_total - item_subtotal;
    
    total_sub := total_sub + item_subtotal;
    total_vat := total_vat + item_vat;
    total_amt := total_amt + item_total;
  END LOOP;
  
  subtotal := total_sub;
  vat_amount := total_vat;
  total_amount := total_amt;
  RETURN NEXT;
END;
$function$;

-- Trigger para calcular y guardar totales cuando se crea una orden
CREATE OR REPLACE FUNCTION public.create_order_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  calc_totals RECORD;
BEGIN
  -- Solo calcular para órdenes nuevas con items
  IF TG_OP = 'INSERT' THEN
    -- Esperar un momento para que se creen los items primero
    PERFORM pg_sleep(0.1);
    
    -- Calcular totales
    SELECT * INTO calc_totals FROM public.calculate_order_total(NEW.id);
    
    IF FOUND THEN
      -- Insertar o actualizar totales
      INSERT INTO public.order_totals (
        order_id, 
        subtotal, 
        vat_amount, 
        total_amount,
        calculated_at
      ) VALUES (
        NEW.id,
        calc_totals.subtotal,
        calc_totals.vat_amount, 
        calc_totals.total_amount,
        now()
      )
      ON CONFLICT (order_id) DO UPDATE SET
        subtotal = EXCLUDED.subtotal,
        vat_amount = EXCLUDED.vat_amount,
        total_amount = EXCLUDED.total_amount,
        calculated_at = now(),
        updated_at = now();
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Trigger para recalcular totales cuando se modifican items de orden
CREATE OR REPLACE FUNCTION public.recalculate_order_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  calc_totals RECORD;
  target_order_id UUID;
BEGIN
  -- Determinar el order_id según la operación
  IF TG_OP = 'DELETE' THEN
    target_order_id := OLD.order_id;
  ELSE
    target_order_id := NEW.order_id;
  END IF;
  
  -- Calcular nuevos totales
  SELECT * INTO calc_totals FROM public.calculate_order_total(target_order_id);
  
  IF FOUND THEN
    -- Actualizar totales existentes
    UPDATE public.order_totals SET
      subtotal = calc_totals.subtotal,
      vat_amount = calc_totals.vat_amount,
      total_amount = calc_totals.total_amount,
      calculated_at = now(),
      updated_at = now()
    WHERE order_id = target_order_id;
    
    -- Si no existe, crear nuevo registro
    IF NOT FOUND THEN
      INSERT INTO public.order_totals (
        order_id, 
        subtotal, 
        vat_amount, 
        total_amount,
        calculated_at
      ) VALUES (
        target_order_id,
        calc_totals.subtotal,
        calc_totals.vat_amount,
        calc_totals.total_amount,
        now()
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Crear triggers
CREATE TRIGGER create_order_total_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_order_total();

CREATE TRIGGER recalculate_order_total_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_order_total();

-- Actualizar función refresh_pending_collections para usar totales guardados
CREATE OR REPLACE FUNCTION public.refresh_pending_collections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_rec RECORD;
BEGIN
  -- Limpiar tabla
  TRUNCATE public.pending_collections;

  -- Agregar órdenes que están aprobadas por cliente O fueron finalizadas, y no están completamente pagadas
  FOR order_rec IN 
    SELECT DISTINCT 
      o.id, 
      o.order_number, 
      o.client_id, 
      c.name AS client_name, 
      c.email AS client_email,
      COALESCE(ot.total_amount, 0) AS order_total
    FROM public.orders o
    JOIN public.clients c ON c.id = o.client_id
    LEFT JOIN public.order_totals ot ON ot.order_id = o.id
    WHERE (
      o.client_approval = true
      OR EXISTS (
        SELECT 1 FROM public.order_status_logs osl 
        WHERE osl.order_id = o.id 
        AND osl.new_status = 'finalizada'
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.incomes i 
      WHERE i.description ILIKE '%' || o.order_number || '%'
    )
  LOOP
    INSERT INTO public.pending_collections (
      order_id, 
      order_number, 
      client_name, 
      client_email, 
      amount, 
      balance
    ) VALUES (
      order_rec.id, 
      order_rec.order_number, 
      order_rec.client_name, 
      order_rec.client_email, 
      order_rec.order_total, 
      order_rec.order_total
    );
  END LOOP;
END;
$function$;