-- Agregar el estado 'en_espera' al enum order_status
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'en_espera';