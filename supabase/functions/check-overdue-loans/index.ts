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

    console.log('Checking overdue loans...');

    const today = new Date().toISOString().split('T')[0];

    const { data: overduePayments, error } = await supabase
      .from('loan_payments')
      .select('id, amount, loan_id, due_date')
      .eq('payment_status', 'vencido');

    if (error) throw error;

    if (overduePayments && overduePayments.length > 0) {
      const totalAmount = overduePayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Verificar si ya existe notificación no leída de hoy
      const { data: existing } = await supabase
        .from('financial_notifications')
        .select('id')
        .eq('notification_type', 'loan_overdue')
        .eq('is_read', false)
        .gte('created_at', today)
        .single();

      if (!existing) {
        await supabase.from('financial_notifications').insert({
          notification_type: 'loan_overdue',
          title: 'Préstamos Vencidos',
          description: `Hay ${overduePayments.length} pagos de préstamos vencidos por un total de $${totalAmount.toFixed(2)}`,
          amount: totalAmount,
          priority: 'high',
        });

        console.log(`Created overdue loans notification: ${overduePayments.length} payments for $${totalAmount}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        overdue_payments: overduePayments?.length || 0,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error checking overdue loans:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});