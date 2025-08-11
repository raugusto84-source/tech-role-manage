-- Remove existing automatic payments to enable the new collection flow
DELETE FROM order_payments WHERE description LIKE 'Pago por servicios completados%';

-- Remove existing automatic incomes to enable the new collection flow  
DELETE FROM incomes WHERE description LIKE 'Ingreso por orden completada%';