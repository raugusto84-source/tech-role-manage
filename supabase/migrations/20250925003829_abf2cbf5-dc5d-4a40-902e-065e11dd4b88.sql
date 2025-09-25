-- Create scheduled services from existing policy service configurations
INSERT INTO scheduled_services (
  policy_client_id,
  service_type_id,
  frequency_days,
  next_service_date,
  service_description,
  priority,
  created_by,
  is_active
)
SELECT 
  psc.policy_client_id,
  psc.service_type_id,
  psc.frequency_days,
  CURRENT_DATE + INTERVAL '1 day' as next_service_date, -- Set next service for tomorrow to test
  CONCAT('Servicio programado: ', st.name) as service_description,
  2 as priority, -- Use integer value instead
  psc.created_by,
  true as is_active
FROM policy_service_configurations psc
JOIN service_types st ON st.id = psc.service_type_id
WHERE psc.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM scheduled_services ss 
    WHERE ss.policy_client_id = psc.policy_client_id 
    AND ss.service_type_id = psc.service_type_id
  );