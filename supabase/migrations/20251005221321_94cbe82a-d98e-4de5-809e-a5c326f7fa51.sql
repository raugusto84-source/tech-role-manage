-- Permitir que service_type_id sea nullable para items manuales
ALTER TABLE public.order_items 
ALTER COLUMN service_type_id DROP NOT NULL;