-- Set approved total for order ORD-2025-0001
UPDATE public.orders 
SET approved_total = 49999.60,
    approved_subtotal = 43103.10,
    approved_vat_amount = 6896.50
WHERE order_number = 'ORD-2025-0001';