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

    console.log('Starting collections cache update...');

    // Limpiar cache anterior
    await supabase.from('collections_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    let totalProcessed = 0;
    let totalCached = 0;

    // 1. Procesar órdenes con pagos pendientes
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        estimated_cost,
        delivery_date,
        client_id,
        clients (name),
        order_payments (payment_amount)
      `)
      .in('status', ['pendiente', 'en_proceso', 'pendiente_entrega', 'finalizada'])
      .is('deleted_at', null);

    if (ordersError) throw ordersError;

    for (const order of orders || []) {
      totalProcessed++;
      const totalPaid = (order.order_payments || []).reduce((sum: number, p: any) => sum + (p.payment_amount || 0), 0);
      const pending = (order.estimated_cost || 0) - totalPaid;

      if (pending > 0) {
        const isOverdue = order.delivery_date ? new Date(order.delivery_date) < new Date() : false;
        
        await supabase.from('collections_cache').insert({
          source_type: 'order',
          source_id: order.id,
          amount_pending: pending,
          due_date: order.delivery_date,
          is_overdue: isOverdue,
          client_name: (order.clients as any)?.name || 'Sin nombre',
          client_id: order.client_id,
          order_number: order.order_number,
        });
        totalCached++;
      }
    }

    // 2. Procesar pólizas con pagos pendientes
    const { data: policies, error: policiesError } = await supabase
      .from('policy_clients')
      .select(`
        id,
        policy_number,
        monthly_cost,
        client_id,
        clients (name),
        policy_payments (amount, payment_status, due_date)
      `)
      .eq('status', 'activa');

    if (policiesError) throw policiesError;

    for (const policy of policies || []) {
      totalProcessed++;
      const pendingPayments = (policy.policy_payments || []).filter((p: any) => p.payment_status === 'pendiente');
      
      for (const payment of pendingPayments) {
        const isOverdue = payment.due_date ? new Date(payment.due_date) < new Date() : false;
        
        await supabase.from('collections_cache').insert({
          source_type: 'policy',
          source_id: policy.id,
          amount_pending: payment.amount || 0,
          due_date: payment.due_date,
          is_overdue: isOverdue,
          client_name: (policy.clients as any)?.name || 'Sin nombre',
          client_id: policy.client_id,
          policy_number: policy.policy_number,
        });
        totalCached++;
      }
    }

    console.log(`Collections cache updated: ${totalProcessed} sources processed, ${totalCached} pending items cached`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        cached: totalCached,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error updating collections cache:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});