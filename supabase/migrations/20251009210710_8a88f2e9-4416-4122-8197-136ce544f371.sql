-- Eliminar ingresos ficticios duplicados creados desde compras
DELETE FROM public.incomes 
WHERE category = 'referencia' 
AND amount = 0 
AND description LIKE 'Referencia fiscal para retiro de compra:%';

-- Hacer que fiscal_withdrawals.income_id sea nullable para no requerir ingresos ficticios
ALTER TABLE public.fiscal_withdrawals 
ALTER COLUMN income_id DROP NOT NULL;