-- Add RLS policy to allow deletion of scheduled services
CREATE POLICY "Admins can delete scheduled services" 
ON public.scheduled_services 
FOR DELETE 
USING (get_current_user_role() = 'administrador');