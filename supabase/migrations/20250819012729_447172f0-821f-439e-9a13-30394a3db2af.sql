-- Insert sample problems and questions for testing
INSERT INTO public.problems (name, description, category_id) VALUES
(
  'Computadora no enciende',
  'El equipo no muestra señales de vida al presionar el botón de encendido',
  (SELECT id FROM public.main_service_categories WHERE name = 'Computadora' LIMIT 1)
),
(
  'Internet lento',
  'La conexión a internet está funcionando pero muy lenta',
  (SELECT id FROM public.main_service_categories WHERE name = 'Computadora' LIMIT 1)
),
(
  'Cámara sin imagen',
  'El sistema de videovigilancia no muestra imagen en una o varias cámaras',
  (SELECT id FROM public.main_service_categories WHERE name = 'Cámaras' LIMIT 1)
)
ON CONFLICT DO NOTHING;

-- Insert sample diagnostic questions
INSERT INTO public.diagnostic_questions (problem_id, question_text, question_order) VALUES
-- Para "Computadora no enciende"
(
  (SELECT id FROM public.problems WHERE name = 'Computadora no enciende' LIMIT 1),
  '¿El cable de poder está conectado correctamente?',
  1
),
(
  (SELECT id FROM public.problems WHERE name = 'Computadora no enciende' LIMIT 1),
  '¿Hay alguna luz encendida en la computadora?',
  2
),
(
  (SELECT id FROM public.problems WHERE name = 'Computadora no enciende' LIMIT 1),
  '¿El monitor está conectado y encendido?',
  3
),
-- Para "Internet lento"
(
  (SELECT id FROM public.problems WHERE name = 'Internet lento' LIMIT 1),
  '¿El problema afecta a todos los dispositivos?',
  1
),
(
  (SELECT id FROM public.problems WHERE name = 'Internet lento' LIMIT 1),
  '¿Ha reiniciado el router/módem?',
  2
),
-- Para "Cámara sin imagen"
(
  (SELECT id FROM public.problems WHERE name = 'Cámara sin imagen' LIMIT 1),
  '¿El cable de red está conectado correctamente?',
  1
),
(
  (SELECT id FROM public.problems WHERE name = 'Cámara sin imagen' LIMIT 1),
  '¿La cámara tiene alimentación eléctrica?',
  2
)
ON CONFLICT DO NOTHING;

-- Insert sample diagnostic rules (simplified for testing)
INSERT INTO public.diagnostic_rules (problem_id, conditions, recommended_services, confidence_score, priority) VALUES
(
  (SELECT id FROM public.problems WHERE name = 'Computadora no enciende' LIMIT 1),
  '[]'::jsonb,
  (SELECT jsonb_agg(id) FROM public.service_types WHERE name ILIKE '%formateo%' OR name ILIKE '%mantenimiento%' LIMIT 2),
  80,
  1
),
(
  (SELECT id FROM public.problems WHERE name = 'Internet lento' LIMIT 1),
  '[]'::jsonb,
  (SELECT jsonb_agg(id) FROM public.service_types WHERE name ILIKE '%red%' OR name ILIKE '%internet%' LIMIT 2),
  75,
  1
),
(
  (SELECT id FROM public.problems WHERE name = 'Cámara sin imagen' LIMIT 1),
  '[]'::jsonb,
  (SELECT jsonb_agg(id) FROM public.service_types WHERE name ILIKE '%camera%' OR name ILIKE '%instalacion%' LIMIT 2),
  85,
  1
)
ON CONFLICT DO NOTHING;