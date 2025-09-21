-- Eliminar el trigger que aplica cashback al finalizar la orden
-- Solo debe aplicarse cuando la orden esté completamente pagada (Restante = 0)

DROP TRIGGER IF EXISTS process_order_cashback ON public.orders;