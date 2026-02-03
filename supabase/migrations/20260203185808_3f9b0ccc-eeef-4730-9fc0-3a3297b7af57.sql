-- Eliminar órdenes duplicadas (mantener las originales ORD-POL-00023 y ORD-POL-00024)
-- ORD-POL-00025 (Mayagoitia duplicada) y ORD-POL-00026 (Hotel duplicada)
DELETE FROM order_items WHERE order_id IN ('1b304f5f-7bd4-45e4-bf51-2007e4b8ba17', 'e112075a-e4d3-4b32-a017-de61d8580ca6');
DELETE FROM order_equipment WHERE order_id IN ('1b304f5f-7bd4-45e4-bf51-2007e4b8ba17', 'e112075a-e4d3-4b32-a017-de61d8580ca6');
DELETE FROM orders WHERE id IN ('1b304f5f-7bd4-45e4-bf51-2007e4b8ba17', 'e112075a-e4d3-4b32-a017-de61d8580ca6');