-- Allow clients to create their own client record
CREATE POLICY "clients_can_create_own_record" ON public.clients
FOR INSERT TO authenticated
WITH CHECK (
  get_current_user_role() = 'cliente' AND 
  email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
);