-- Crear tabla para horarios de trabajo
CREATE TABLE public.work_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  work_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 0=Sunday, 1=Monday, etc.
  break_duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage work schedules"
ON public.work_schedules
FOR ALL
USING (get_current_user_role() = 'administrador');

CREATE POLICY "Staff can view their own schedules"
ON public.work_schedules
FOR SELECT
USING (employee_id = auth.uid() OR get_current_user_role() = 'administrador');

-- Trigger para updated_at
CREATE TRIGGER update_work_schedules_updated_at
BEFORE UPDATE ON public.work_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();