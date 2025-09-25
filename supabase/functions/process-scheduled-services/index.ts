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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Processing scheduled services...');

    const today = new Date();
    const currentDayOfWeek = today.getDay();
    
    console.log(`Today is ${today.toISOString().split('T')[0]}, day of week: ${currentDayOfWeek}`);

    // Get policy service configurations for today
    const { data: dueServices, error: servicesError } = await supabaseClient
      .from('policy_service_configurations')
      .select(`
        id,
        policy_client_id,
        service_type_id,
        day_of_week,
        quantity,
        created_by,
        policy_clients(
          id,
          client_id,
          clients(id, name, email),
          insurance_policies(policy_name)
        ),
        service_types(name, description)
      `)
      .eq('is_active', true)
      .eq('day_of_week', currentDayOfWeek);

    if (servicesError) {
      console.error('Error fetching due services:', servicesError);
      throw servicesError;
    }

    console.log(`Found ${dueServices?.length || 0} due services`);

    let ordersCreated = 0;
    const errors: any[] = [];

    for (const service of dueServices || []) {
      try {
        const policyClient = service.policy_clients;
        const client = Array.isArray(policyClient?.clients) ? policyClient.clients[0] : policyClient?.clients;
        const serviceType = Array.isArray(service.service_types) ? service.service_types[0] : service.service_types;

        if (!client || !serviceType) {
          console.log(`Skipping service ${service.id} - missing client or service type data`);
          continue;
        }

        console.log(`Processing service for client: ${client.name}, service: ${serviceType.name}`);
        
        // Check if order already exists today
        const { data: existingOrders } = await supabaseClient
          .from('orders')
          .select('id')
          .eq('is_policy_order', true)
          .like('failure_description', `%Servicio programado: ${serviceType.name}%`)
          .eq('client_id', client.id)
          .gte('created_at', today.toISOString().split('T')[0]);

        if (existingOrders && existingOrders.length > 0) {
          console.log(`Order already exists for service ${service.id} today`);
          continue;
        }

        // Create order
        const { data: orderData, error: orderError } = await supabaseClient
          .from('orders')
          .insert({
            order_number: `ORD-POL-${Date.now()}-${service.id.slice(0, 8)}`,
            client_id: client.id,
            service_type: service.service_type_id,
            service_location: 'domicilio',
            delivery_date: today.toISOString().split('T')[0],
            estimated_cost: 0,
            failure_description: `Servicio programado: ${serviceType.name}`,
            status: 'pendiente_aprobacion',
            client_approval: false,
            is_policy_order: true,
            order_priority: 'media',
            created_by: service.created_by,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Create order item
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
            service_name: serviceType.name,
            service_description: serviceType.description,
            item_type: 'servicio',
            status: 'pendiente',
          });

        if (itemError) throw itemError;

        ordersCreated++;
        console.log(`Order created: ${orderData.order_number} for service ${service.id}`);

      } catch (serviceError) {
        console.error(`Error processing service ${service.id}:`, serviceError);
        const errorMessage = serviceError instanceof Error ? serviceError.message : 'Unknown error';
        errors.push({
          service_id: service.id,
          error: errorMessage
        });
      }
    }

    const result = {
      success: true,
      processed_services: dueServices?.length || 0,
      orders_created: ordersCreated,
      errors: errors
    };

    console.log('Processing complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-scheduled-services function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        processed_services: 0,
        orders_created: 0 
      }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});