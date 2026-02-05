 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseAdmin = createClient(
       Deno.env.get('SUPABASE_URL') ?? '',
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
       {
         auth: {
           autoRefreshToken: false,
           persistSession: false
         }
       }
     );
 
     // Verify the requesting user is an admin
     const authHeader = req.headers.get('Authorization');
     if (!authHeader) {
       throw new Error('No authorization header');
     }
 
     const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(
       authHeader.replace('Bearer ', '')
     );
 
     if (authError || !requestingUser) {
       throw new Error('Unauthorized');
     }
 
     // Check if requesting user is admin
     const { data: roleData } = await supabaseAdmin
       .from('user_roles')
       .select('role')
       .eq('user_id', requestingUser.id)
       .single();
 
     if (!roleData || roleData.role !== 'administrador') {
       throw new Error('Solo administradores pueden editar correos');
     }
 
     const { userId, newEmail } = await req.json();
 
     if (!userId || !newEmail) {
       throw new Error('userId y newEmail son requeridos');
     }
 
     // Validate email format
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(newEmail)) {
       throw new Error('Formato de correo inválido');
     }
 
     // Check if email is already in use
     const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
     const emailInUse = existingUser?.users?.some(u => u.email === newEmail && u.id !== userId);
     
     if (emailInUse) {
       throw new Error('Este correo ya está en uso por otro usuario');
     }
 
     // Update email in auth.users
     const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
       userId,
       { email: newEmail, email_confirm: true }
     );
 
     if (updateAuthError) {
       throw new Error(`Error al actualizar auth: ${updateAuthError.message}`);
     }
 
     // Update email in profiles table
     const { error: profileError } = await supabaseAdmin
       .from('profiles')
       .update({ email: newEmail })
       .eq('user_id', userId);
 
     if (profileError) {
       console.error('Error updating profile email:', profileError);
     }
 
     // Update email in clients table if exists
     const { error: clientError } = await supabaseAdmin
       .from('clients')
       .update({ email: newEmail })
       .eq('user_id', userId);
 
     if (clientError) {
       console.error('Error updating client email:', clientError);
     }
 
     return new Response(
       JSON.stringify({ success: true, message: 'Correo actualizado correctamente' }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error) {
     console.error('Error updating user email:', error);
     return new Response(
       JSON.stringify({ success: false, error: error.message }),
       { 
         status: 400, 
         headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       }
     );
   }
 });