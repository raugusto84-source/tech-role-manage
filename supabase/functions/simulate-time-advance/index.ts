import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SimulationRequest {
  days_to_advance: number;
  current_date?: string;
  simulate_events?: boolean;
  test_all_events?: boolean;
}

interface SimulationResult {
  success: boolean;
  days_advanced: number;
  events_created: number;
  scheduled_services_created: number;
  policy_payments_created: number;
  follow_ups_created: number;
  simulation_date: string;
  error?: string;
  details: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { days_to_advance, current_date, simulate_events = true, test_all_events = false }: SimulationRequest = await req.json();

    console.log(`Starting time simulation - advancing ${days_to_advance} days from ${current_date || 'today'}`);

    const baseDate = current_date ? new Date(current_date) : new Date();
    const events_created: any[] = [];
    let total_scheduled_services = 0;
    let total_policy_payments = 0;
    let total_follow_ups = 0;

    // Simulate each day in the range
    for (let day = 0; day < days_to_advance; day++) {
      const simulatedDate = new Date(baseDate);
      simulatedDate.setDate(simulatedDate.getDate() + day);
      const simulatedDayOfWeek = simulatedDate.getDay();
      const simulatedDateStr = simulatedDate.toISOString().split('T')[0];

      console.log(`Simulating day ${day + 1}: ${simulatedDateStr} (day of week: ${simulatedDayOfWeek})`);

      if (!simulate_events) continue;

      // 1. Check for scheduled services (policy services due on this day of week)
      // 1. Scheduled services due by next_service_date
      const { data: dueServices, error: servicesError } = await supabaseClient
        .from('scheduled_services')
        .select(`
          id,
          policy_client_id,
          service_type_id,
          next_service_date,
          frequency_days,
          quantity,
          service_description,
          priority,
          policy_clients!inner(
            id,
            client_id,
            clients!inner(id, name, email),
            insurance_policies!inner(policy_name)
          ),
          service_types!inner(name, description)
        `)
        .eq('is_active', true)
        .lte('next_service_date', simulatedDateStr);

      if (servicesError) {
        console.error('Error fetching due scheduled services:', servicesError);
      } else {
        console.log(`Due scheduled services on ${simulatedDateStr}: ${dueServices?.length || 0}`);
        for (const service of dueServices || []) {
          try {
            const policyClient = Array.isArray(service.policy_clients) ? service.policy_clients[0] : service.policy_clients;
            const client = Array.isArray(policyClient?.clients) ? policyClient.clients[0] : policyClient?.clients;
            const serviceType = Array.isArray(service.service_types) ? service.service_types[0] : service.service_types;
            if (!client || !serviceType) {
              console.log(`Skipping service ${service.id} - missing client or service type data`);
              continue;
            }

            // prevent duplicate orders for this simulated day
            const nextDayStr = new Date(simulatedDate.getTime() + 86400000).toISOString().split('T')[0];
            const { data: existingOrders } = await supabaseClient
              .from('orders')
              .select('id')
              .eq('is_policy_order', true)
              .like('failure_description', `%Servicio programado: ${serviceType.name}%`)
              .eq('client_id', client.id)
              .gte('created_at', simulatedDateStr)
              .lt('created_at', nextDayStr);

            if (existingOrders && existingOrders.length > 0) {
              console.log(`Order already exists for service ${service.id} on ${simulatedDateStr}`);
              continue;
            }

            const { data: orderData, error: orderError } = await supabaseClient
              .from('orders')
              .insert({
                order_number: `SIM-${simulatedDateStr}-${service.id.slice(0, 8)}`,
                client_id: client.id,
                service_type: service.service_type_id,
                service_location: 'domicilio',
                delivery_date: simulatedDateStr,
                estimated_cost: 0,
                failure_description: `[SIMULACIÓN] Servicio programado: ${serviceType.name}`,
                status: 'pendiente_aprobacion',
                client_approval: false,
                is_policy_order: true,
                order_priority: 'media'
              })
              .select()
              .single();

            if (orderError || !orderData) {
              console.error('Order insert failed for scheduled service', { service_id: service.id, error: orderError });
              continue;
            }

            const { error: itemError } = await supabaseClient
              .from('order_items')
              .insert({
                order_id: orderData.id,
                service_type_id: service.service_type_id,
                quantity: service.quantity || 1,
                unit_cost_price: 0,
                unit_base_price: 0,
                profit_margin_rate: 0,
                subtotal: 0,
                vat_rate: 16,
                vat_amount: 0,
                total_amount: 0,
                service_name: `[SIM] ${serviceType.name}`,
                service_description: service.service_description || serviceType.description,
                item_type: 'servicio',
                status: 'pendiente',
              });

            if (itemError) {
              console.error('Order item insert failed', { order_id: orderData.id, error: itemError });
              continue;
            }

            // advance next_service_date
            const currentNext = new Date(service.next_service_date);
            const advanced = new Date(currentNext);
            advanced.setDate(advanced.getDate() + (service.frequency_days || 1));
            const advancedStr = advanced.toISOString().split('T')[0];
            const { error: advanceError } = await supabaseClient
              .from('scheduled_services')
              .update({ next_service_date: advancedStr })
              .eq('id', service.id);

            if (advanceError) {
              console.error('Failed to advance next_service_date', { service_id: service.id, error: advanceError });
            }

            total_scheduled_services++;
            events_created.push({
              type: 'scheduled_service',
              date: simulatedDateStr,
              client: client.name,
              service: serviceType.name,
              order_id: orderData.id
            });
          } catch (serviceError) {
            console.error('Error creating simulated service order:', serviceError);
          }
        }
      }

      // 2. Check for monthly policy payments (on the 1st of each month)
      if (simulatedDate.getDate() === 1) {
        const month = simulatedDate.getMonth() + 1;
        const year = simulatedDate.getFullYear();

        try {
          const { data: paymentResult } = await supabaseClient
            .rpc('generate_monthly_policy_payments', {
              target_month: month,
              target_year: year
            });

          if (paymentResult && paymentResult.payments_created > 0) {
            total_policy_payments += paymentResult.payments_created;
            events_created.push({
              type: 'policy_payments',
              date: simulatedDateStr,
              count: paymentResult.payments_created,
              month: month,
              year: year
            });
          }
        } catch (error) {
          console.error('Error generating policy payments:', error);
        }
      }

      // 3. Check for follow-up reminders due
      const { data: dueReminders } = await supabaseClient
        .from('follow_up_reminders')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', simulatedDate.toISOString());

      if (dueReminders && dueReminders.length > 0) {
        // Mark reminders as sent (simulated)
        await supabaseClient
          .from('follow_up_reminders')
          .update({ status: 'sent', sent_at: simulatedDate.toISOString() })
          .in('id', dueReminders.map(r => r.id));

        total_follow_ups += dueReminders.length;
        events_created.push({
          type: 'follow_ups',
          date: simulatedDateStr,
          count: dueReminders.length
        });
      }
    }

    const result: SimulationResult = {
      success: true,
      days_advanced: days_to_advance,
      events_created: events_created.length,
      scheduled_services_created: total_scheduled_services,
      policy_payments_created: total_policy_payments,
      follow_ups_created: total_follow_ups,
      simulation_date: new Date(baseDate.getTime() + (days_to_advance * 86400000)).toISOString().split('T')[0],
      details: events_created
    };

    console.log('Time simulation complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in simulate-time-advance function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        days_advanced: 0,
        events_created: 0,
        scheduled_services_created: 0,
        policy_payments_created: 0,
        follow_ups_created: 0,
        details: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});