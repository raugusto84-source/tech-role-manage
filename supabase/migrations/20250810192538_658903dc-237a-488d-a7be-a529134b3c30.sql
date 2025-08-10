-- Agregar columna shared_time a la tabla service_types
ALTER TABLE public.service_types 
ADD COLUMN shared_time boolean NOT NULL DEFAULT false;

-- Agregar comentario para documentar la columna
COMMENT ON COLUMN public.service_types.shared_time IS 'Indica si múltiples artículos de este servicio comparten el mismo tiempo de ejecución';