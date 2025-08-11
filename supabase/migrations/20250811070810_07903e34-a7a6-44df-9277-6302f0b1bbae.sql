-- Modificar la tabla order_satisfaction_surveys para simplificar a 3 preguntas básicas
ALTER TABLE public.order_satisfaction_surveys 
DROP COLUMN IF EXISTS technician_knowledge,
DROP COLUMN IF EXISTS technician_customer_service,
DROP COLUMN IF EXISTS technician_attitude,
DROP COLUMN IF EXISTS sales_knowledge,
DROP COLUMN IF EXISTS sales_customer_service,
DROP COLUMN IF EXISTS sales_attitude,
DROP COLUMN IF EXISTS sales_comments,
DROP COLUMN IF EXISTS technician_comments,
DROP COLUMN IF EXISTS overall_recommendation;

-- Agregar las 3 preguntas básicas
ALTER TABLE public.order_satisfaction_surveys 
ADD COLUMN IF NOT EXISTS service_quality INTEGER CHECK (service_quality BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS service_time INTEGER CHECK (service_time BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS would_recommend INTEGER CHECK (would_recommend BETWEEN 1 AND 5);