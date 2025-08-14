-- Agregar campos para imagen de entrada y salida
ALTER TABLE public.time_records 
ADD COLUMN check_in_photo_url TEXT,
ADD COLUMN check_out_photo_url TEXT;