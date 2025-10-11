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

    console.log('Calculating VAT status...');

    // Obtener mes actual
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // IVA cobrado (ingresos fiscales)
    const { data: incomes } = await supabase
      .from('incomes')
      .select('vat_amount')
      .eq('account_type', 'fiscal')
      .eq('status', 'recibido')
      .gte('income_date', firstDayOfMonth)
      .lte('income_date', lastDayOfMonth);

    const vatCollected = (incomes || []).reduce((sum, i) => sum + (i.vat_amount || 0), 0);

    // IVA pagado (gastos fiscales)
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('account_type', 'fiscal')
      .gte('expense_date', firstDayOfMonth)
      .lte('expense_date', lastDayOfMonth);

    // Aproximación: IVA pagado es 16% del monto del gasto
    const vatPaid = (expenses || []).reduce((sum, e) => sum + ((e.amount || 0) * 0.16), 0);

    const vatBalance = vatCollected - vatPaid;
    const threshold = 10000;

    if (Math.abs(vatBalance) > threshold) {
      // Verificar si ya existe notificación no leída de esta semana
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const { data: existing } = await supabase
        .from('financial_notifications')
        .select('id')
        .eq('notification_type', 'vat_status')
        .eq('is_read', false)
        .gte('created_at', startOfWeek.toISOString())
        .single();

      if (!existing) {
        const isInFavor = vatBalance > 0;
        await supabase.from('financial_notifications').insert({
          notification_type: 'vat_status',
          title: isInFavor ? 'IVA a Favor' : 'IVA a Pagar',
          description: `${isInFavor ? 'Tienes' : 'Debes'} $${Math.abs(vatBalance).toFixed(2)} de IVA del mes actual`,
          amount: Math.abs(vatBalance),
          priority: isInFavor ? 'normal' : 'high',
        });

        console.log(`Created VAT status notification: ${isInFavor ? 'favor' : 'against'} $${Math.abs(vatBalance)}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        vat_collected: vatCollected,
        vat_paid: vatPaid,
        vat_balance: vatBalance,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error calculating VAT status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});