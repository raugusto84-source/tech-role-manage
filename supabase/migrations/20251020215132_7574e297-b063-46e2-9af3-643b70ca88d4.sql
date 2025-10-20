-- Fix collection_type for specific order so it appears in Finance > Cobranza
UPDATE public.pending_collections
SET collection_type = 'order_payment'
WHERE order_number = 'ORD-2025-0020'
  AND collection_type = 'order';