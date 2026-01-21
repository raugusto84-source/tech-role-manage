-- Corregir el pago de Tania Boga de 500 a 200
UPDATE order_payments 
SET payment_amount = 200
WHERE id = 'a16bf131-92df-460b-ab6e-5552bad3ddcb';

-- Actualizar el ingreso correspondiente
UPDATE incomes 
SET amount = 200
WHERE id = 'e26aead3-26ce-45f3-ab0f-6453a9d22e98';

-- Restaurar pending_collections con el saldo pendiente (500 - 200 = 300)
UPDATE pending_collections
SET status = 'pending',
    balance = 300,
    collected_at = NULL
WHERE order_id = '1a175c74-61b6-403a-be0b-a92ac9609541'
AND collection_type = 'order_payment';