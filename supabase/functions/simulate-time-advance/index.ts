import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SimulationRequest {
  days_to_advance?: number;
  minutes_to_advance?: number;
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

    const { days_to_advance = 0, minutes_to_advance = 0, current_date, simulate_events = true, test_all_events = false }: SimulationRequest = await req.json();

    const totalMinutes = (days_to_advance * 24 * 60) + minutes_to_advance;
    console.log(`Starting time simulation - advancing ${totalMinutes} minutes (${days_to_advance} days + ${minutes_to_advance} minutes) from ${current_date || 'now'}`);

    const baseDate = current_date ? new Date(current_date) : new Date();
    const events_created: any[] = [];
    let total_scheduled_services = 0;
    let total_policy_payments = 0;
    let total_follow_ups = 0;

    // Simulate in minute intervals for flexible frequency checking
    for (let minute = 0; minute < totalMinutes; minute += 1) {
      const simulatedDate = new Date(baseDate);
      simulatedDate.setMinutes(simulatedDate.getMinutes() + minute);
      const simulatedDateStr = simulatedDate.toISOString();

      // Only log every 60 minutes to reduce noise
      if (minute % 60 === 0) {
        console.log(`Simulating minute ${minute}: ${simulatedDateStr}`);
      }

      if (!simulate_events) continue;

      // 1. Check for scheduled services due by next_run timestamp
      const { data: dueServices, error: servicesError } = await supabaseClient
        .from('scheduled_services')
        .select(`
          id,
          policy_client_id,
          service_type_id,
          frequency_type,
          frequency_value,
          next_run,
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
        .lte('next_run', simulatedDateStr);

      if (servicesError) {
        console.error('Error fetching due scheduled services:', servicesError);
      } else {
        if (dueServices?.length && minute % 60 === 0) {
          console.log(`Due scheduled services on ${simulatedDateStr}: ${dueServices.length}`);
        }
        for (const service of dueServices || []) {
          try {
            const policyClient = Array.isArray(service.policy_clients) ? service.policy_clients[0] : service.policy_clients;
            const client = Array.isArray(policyClient?.clients) ? policyClient.clients[0] : policyClient?.clients;
            const serviceType = Array.isArray(service.service_types) ? service.service_types[0] : service.service_types;
            if (!client || !serviceType) {
              console.log(`Skipping service ${service.id} - missing client or service type data`);
              continue;
            }

            // prevent duplicate orders for this simulated minute/hour
            const nextHourStr = new Date(simulatedDate.getTime() + 3600000).toISOString();
            const { data: existingOrders } = await supabaseClient
              .from('orders')
              .select('id')
              .eq('is_policy_order', true)
              .like('failure_description', `%Servicio programado: ${serviceType.name}%`)
              .eq('client_id', client.id)
              .gte('created_at', simulatedDate.toISOString())
              .lt('created_at', nextHourStr);

            if (existingOrders && existingOrders.length > 0) {
              continue;
            }

            const { data: orderData, error: orderError } = await supabaseClient
              .from('orders')
              .insert({
                order_number: `SIM-${simulatedDate.toISOString().slice(0, 19).replace(/[:-]/g, '')}-${service.id.slice(0, 8)}`,
                client_id: client.id,
                service_type: service.service_type_id,
                service_location: 'domicilio',
                delivery_date: simulatedDate.toISOString().split('T')[0],
                estimated_cost: 0,
                failure_description: `[SIMULACIÓN] Servicio programado: ${serviceType.name}`,
                status: 'pendiente_aprobacion',
                client_approval: false,
                is_policy_order: true,
                order_priority: service.priority || 2
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

            // advance next_run based on frequency type
            const currentNext = new Date(service.next_run || simulatedDate);
            const advanced = new Date(currentNext);
            
            if (service.frequency_type === 'minutes') {
              advanced.setMinutes(advanced.getMinutes() + service.frequency_value);
            } else if (service.frequency_type === 'days') {
              advanced.setDate(advanced.getDate() + service.frequency_value);
            } else { // monthly_on_day
              advanced.setMonth(advanced.getMonth() + 1);
              advanced.setDate(service.frequency_value);
            }
            
            const { error: advanceError } = await supabaseClient
              .from('scheduled_services')
              .update({ next_run: advanced.toISOString() })
              .eq('id', service.id);

            if (advanceError) {
              console.error('Failed to advance next_run', { service_id: service.id, error: advanceError });
            }

            total_scheduled_services++;
            events_created.push({
              type: 'scheduled_service',
              date: simulatedDate.toISOString(),
              client: client.name,
              service: serviceType.name,
              order_id: orderData.id,
              frequency_type: service.frequency_type,
              next_run: advanced.toISOString()
            });
          } catch (serviceError) {
            console.error('Error creating simulated service order:', serviceError);
          }
        }
      }

      // 2. Check for policy payments due by next_billing_run (every minute check)
      const { data: dueBillings, error: billingError } = await supabaseClient
        .from('policy_clients')
        .select(`
          id,
          billing_frequency_type,
          billing_frequency_value,
          next_billing_run,
          clients!inner(name, email),
          insurance_policies!inner(policy_name, monthly_fee)
        `)
        .eq('is_active', true)
        .lte('next_billing_run', simulatedDate.toISOString());

      if (billingError) {
        console.error('Error fetching due billings:', billingError);
      } else if (dueBillings?.length) {
        for (const billing of dueBillings) {
          try {
            const client = Array.isArray(billing.clients) ? billing.clients[0] : billing.clients;
            const policy = Array.isArray(billing.insurance_policies) ? billing.insurance_policies[0] : billing.insurance_policies;
            
            // Create policy payment
            const { error: paymentError } = await supabaseClient
              .from('policy_payments')
              .insert({
                policy_client_id: billing.id,
                payment_month: simulatedDate.getMonth() + 1,
                payment_year: simulatedDate.getFullYear(),
                amount: policy.monthly_fee,
                account_type: 'no_fiscal',
                due_date: simulatedDate.toISOString().split('T')[0],
                is_paid: false,
                payment_status: 'pendiente'
              });

            if (paymentError) {
              console.error('Payment insert failed:', paymentError);
              continue;
            }

            // Advance next billing run
            const nextBilling = new Date(billing.next_billing_run);
            if (billing.billing_frequency_type === 'minutes') {
              nextBilling.setMinutes(nextBilling.getMinutes() + billing.billing_frequency_value);
            } else if (billing.billing_frequency_type === 'days') {
              nextBilling.setDate(nextBilling.getDate() + billing.billing_frequency_value);
            } else { // monthly_on_day
              nextBilling.setMonth(nextBilling.getMonth() + 1);
              nextBilling.setDate(billing.billing_frequency_value);
            }

            await supabaseClient
              .from('policy_clients')
              .update({ next_billing_run: nextBilling.toISOString() })
              .eq('id', billing.id);

            total_policy_payments++;
            events_created.push({
              type: 'policy_payment',
              date: simulatedDate.toISOString(),
              client: client.name,
              policy: policy.policy_name,
              amount: policy.monthly_fee,
              next_billing: nextBilling.toISOString()
            });
          } catch (error) {
            console.error('Error creating policy payment:', error);
          }
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
      simulation_date: new Date(baseDate.getTime() + (totalMinutes * 60000)).toISOString(),
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