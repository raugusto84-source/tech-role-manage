
-- Eliminar el pago de diciembre 2025 de Mayagoitia que se regeneró
DELETE FROM policy_payments 
WHERE id = 'ef7d8a05-8032-4927-81fa-df90ab0f0a59';

-- También eliminar cualquier notificación relacionada
DELETE FROM financial_notifications 
WHERE related_id = 'ef7d8a05-8032-4927-81fa-df90ab0f0a59';

DELETE FROM collections_cache 
WHERE source_id = 'ef7d8a05-8032-4927-81fa-df90ab0f0a59';

DELETE FROM pending_collections 
WHERE policy_client_id = '625a46d5-5eaf-4264-ab85-a48b08de2726'
AND due_date = '2025-12-05';
