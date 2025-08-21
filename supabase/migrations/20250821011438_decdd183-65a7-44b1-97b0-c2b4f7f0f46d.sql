-- Permitir eliminar árboles/flujo de diagnóstico ligados a servicios sin romper historiales
-- 1) Volver nullable el question_id en client_diagnostics
ALTER TABLE public.client_diagnostics
  ALTER COLUMN question_id DROP NOT NULL;

-- 2) Recrear la FK para que al eliminar diagnostic_trees deje question_id en NULL
ALTER TABLE public.client_diagnostics
  DROP CONSTRAINT IF EXISTS client_diagnostics_question_id_fkey;

ALTER TABLE public.client_diagnostics
  ADD CONSTRAINT client_diagnostics_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES public.diagnostic_trees(id)
  ON DELETE SET NULL;