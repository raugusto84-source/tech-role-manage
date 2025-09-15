-- Eliminar función de conversión de cotización a orden para reimplementación limpia
DROP FUNCTION IF EXISTS public.convert_quote_to_order(uuid);