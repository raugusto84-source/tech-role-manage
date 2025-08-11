-- Limpiar registros duplicados de fiscal_withdrawals con amount = 0
-- Estos registros se crearon por error en el proceso de compras
DELETE FROM fiscal_withdrawals WHERE amount = 0;