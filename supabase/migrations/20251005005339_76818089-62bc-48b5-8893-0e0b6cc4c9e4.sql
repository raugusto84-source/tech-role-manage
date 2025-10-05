-- Cambiar el pago de septiembre de Ciruelos Altozano a vencido
UPDATE policy_payments 
SET is_paid = false, 
    payment_status = 'vencido',
    payment_date = NULL
WHERE id = '30de3dfc-36bc-4d21-a867-1ccd38af3876';