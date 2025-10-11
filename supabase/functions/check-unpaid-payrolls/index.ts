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

    console.log('Checking unpaid payrolls...');

    // Fecha límite: 7 días atrás
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: unpaidPayrolls, error } = await supabase
      .from('payrolls')
      .select('id, employee_name, net_salary, payment_date')
      .eq('status', 'pendiente')
      .lt('payment_date', sevenDaysAgo.toISOString().split('T')[0]);

    if (error) throw error;

    if (unpaidPayrolls && unpaidPayrolls.length > 0) {
      const totalAmount = unpaidPayrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0);

      // Verificar si ya existe notificación no leída de hoy
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('financial_notifications')
        .select('id')
        .eq('notification_type', 'payroll_unpaid')
        .eq('is_read', false)
        .gte('created_at', today)
        .single();

      if (!existing) {
        await supabase.from('financial_notifications').insert({
          notification_type: 'payroll_unpaid',
          title: 'Nóminas Sin Pagar',
          description: `Hay ${unpaidPayrolls.length} nóminas pendientes por un total de $${totalAmount.toFixed(2)}`,
          amount: totalAmount,
          priority: 'urgent',
        });

        console.log(`Created unpaid payrolls notification: ${unpaidPayrolls.length} payrolls for $${totalAmount}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        unpaid_payrolls: unpaidPayrolls?.length || 0,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error checking unpaid payrolls:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});