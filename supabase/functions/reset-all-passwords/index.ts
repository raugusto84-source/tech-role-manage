import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify caller is admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'administrador') {
      throw new Error('Unauthorized - only administrators can reset all passwords');
    }

    const { newPassword } = await req.json();
    if (!newPassword) {
      throw new Error('New password is required');
    }

    // Use admin client to update all passwords
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get all users from profiles
    const { data: profiles, error: profilesError } = await adminSupabase
      .from('profiles')
      .select('user_id, full_name, username');

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const p of profiles || []) {
      try {
        const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
          p.user_id,
          { password: newPassword }
        );

        if (updateError) {
          results.push({ user: p.username, status: 'error', message: updateError.message });
          errorCount++;
        } else {
          results.push({ user: p.username, status: 'success' });
          successCount++;
        }
      } catch (e) {
        results.push({ user: p.username, status: 'error', message: String(e) });
        errorCount++;
      }
    }

    console.log(`Password reset complete: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Contraseñas actualizadas: ${successCount} exitosas, ${errorCount} errores`,
        successCount,
        errorCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
