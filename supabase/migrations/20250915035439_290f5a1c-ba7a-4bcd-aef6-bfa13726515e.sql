-- Agregar campos para razón de modificación y nuevo monto en firmas de autorización
ALTER TABLE public.order_authorization_signatures 
ADD COLUMN modification_reason TEXT,
ADD COLUMN new_amount NUMERIC;