import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Checking fiscal withdrawals...');

    // Fecha límite: 3 días atrás
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: withdrawals, error } = await supabase
      .from('fiscal_withdrawals')
      .select('id, amount, created_at')
      .eq('withdrawal_status', 'available')
      .lt('created_at', threeDaysAgo.toISOString());

    if (error) throw error;

    if (withdrawals && withdrawals.length > 0) {
      const totalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

      // Verificar si ya existe notificación no leída de hoy
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('financial_notifications')
        .select('id')
        .eq('notification_type', 'fiscal_withdrawal')
        .eq('is_read', false)
        .gte('created_at', today)
        .single();

      if (!existing) {
        await supabase.from('financial_notifications').insert({
          notification_type: 'fiscal_withdrawal',
          title: 'Retiros Fiscales Disponibles',
          description: `Hay ${withdrawals.length} retiros fiscales disponibles por un total de $${totalAmount.toFixed(2)}`,
          amount: totalAmount,
          priority: withdrawals.length > 10 ? 'high' : 'normal',
        });

        console.log(`Created fiscal withdrawal notification: ${withdrawals.length} withdrawals for $${totalAmount}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        withdrawals_found: withdrawals?.length || 0,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error checking fiscal withdrawals:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});