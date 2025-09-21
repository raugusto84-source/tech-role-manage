-- Eliminar el trigger que aplica cashback al finalizar la orden
-- Solo debe aplicarse cuando la orden esté completamente pagada (Restante = 0)

-- Eliminar el trigger que se activa al finalizar la orden
DROP TRIGGER IF EXISTS process_order_cashback ON public.orders;

-- Mantener solo el trigger calculate_cashback_on_full_payment_trigger 
-- que se activa al hacer pagos y verifica que esté completamente pagada

-- Log para debugging
RAISE LOG 'Removed process_order_cashback trigger - cashback now only applies when order is fully paid';