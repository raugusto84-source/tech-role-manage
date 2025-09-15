-- Eliminar completamente toda la funcionalidad de cobranzas pendientes

-- Eliminar el trigger
DROP TRIGGER IF EXISTS create_pending_collection_on_order_approval ON public.orders;

-- Eliminar la función
DROP FUNCTION IF EXISTS public.create_pending_collection_on_approval();

-- Eliminar la tabla pending_collections
DROP TABLE IF EXISTS public.pending_collections;