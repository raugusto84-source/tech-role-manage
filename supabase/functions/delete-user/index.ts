import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    // Authenticated client to verify requester role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Invalid user token');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Profile not found');
    if (profile.role !== 'administrador') throw new Error('Unauthorized - only administrators can delete users');

    const { userId } = await req.json();
    if (!userId) throw new Error('Missing userId');

    if (userId === user.id) throw new Error('No puedes eliminar tu propio usuario');

    // Admin client to perform privileged operations
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1) Delete profile row(s) tied to this auth user
    const { error: delProfileError } = await adminSupabase
      .from('profiles')
      .delete()
      .eq('user_id', userId);
    if (delProfileError) throw new Error(`Error deleting profile: ${delProfileError.message}`);

    // 2) Delete auth user
    const { error: delAuthError } = await adminSupabase.auth.admin.deleteUser(userId);
    if (delAuthError) throw new Error(`Error deleting auth user: ${delAuthError.message}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Usuario eliminado completamente' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('delete-user error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
