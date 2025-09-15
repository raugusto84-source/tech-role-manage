-- Recalcular totales para órdenes existentes
DO $$
DECLARE
  order_rec RECORD;
  calc_totals RECORD;
BEGIN
  -- Recalcular todas las órdenes existentes
  FOR order_rec IN 
    SELECT DISTINCT o.id 
    FROM public.orders o
    WHERE EXISTS (SELECT 1 FROM public.order_items WHERE order_id = o.id)
  LOOP
    SELECT * INTO calc_totals FROM public.calculate_order_total(order_rec.id);
    
    IF FOUND THEN
      -- Actualizar o insertar totales corregidos
      INSERT INTO public.order_totals (
        order_id, 
        subtotal, 
        vat_amount, 
        total_amount,
        calculated_at
      ) VALUES (
        order_rec.id,
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
        
      RAISE LOG 'Recalculado total para orden %: %', order_rec.id, calc_totals.total_amount;
    END IF;
  END LOOP;
  
  -- Refrescar pending_collections con los nuevos totales
  PERFORM public.refresh_pending_collections();
  
  RAISE LOG 'Recálculo completo de totales de órdenes finalizado';
END;
$$;