-- Cambiar campos de fecha para incluir hora en las tablas principales
-- Esto permitirá registrar fecha y hora completa en lugar de solo fecha

-- Cambiar income_date a timestamp with time zone
ALTER TABLE public.incomes 
ALTER COLUMN income_date TYPE timestamp with time zone 
USING income_date::timestamp with time zone;

-- Cambiar expense_date a timestamp with time zone  
ALTER TABLE public.expenses 
ALTER COLUMN expense_date TYPE timestamp with time zone
USING expense_date::timestamp with time zone;

-- Cambiar payment_date a timestamp with time zone
ALTER TABLE public.order_payments 
ALTER COLUMN payment_date TYPE timestamp with time zone
USING payment_date::timestamp with time zone;

-- Actualizar defaults para usar timestamp actual en lugar de solo fecha
ALTER TABLE public.incomes 
ALTER COLUMN income_date SET DEFAULT now();

ALTER TABLE public.expenses 
ALTER COLUMN expense_date SET DEFAULT now();

ALTER TABLE public.order_payments 
ALTER COLUMN payment_date SET DEFAULT now();