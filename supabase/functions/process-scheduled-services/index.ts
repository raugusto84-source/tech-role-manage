import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Processing scheduled services...');

    // Get all active scheduled services that are due (next_service_date <= today)
    const { data: dueServices, error: servicesError } = await supabaseClient
      .from('scheduled_services')
      .select(`
        id,
        policy_client_id,
        service_type_id,
        frequency_days,
        next_service_date,
        service_description,
        priority,
        created_by,
        policy_clients(
          id,
          clients(id, name, email),
          insurance_policies(policy_name)
        ),
        service_types(name, description)
      `)
      .eq('is_active', true)
      .lte('next_service_date', new Date().toISOString().split('T')[0]);

    if (servicesError) {
      console.error('Error fetching due services:', servicesError);
      throw servicesError;
    }

    console.log(`Found ${dueServices?.length || 0} due services`);

    let ordersCreated = 0;
    let errors = [];

    for (const service of dueServices || []) {
      try {
        // Check if an order was already created today for this service
        const { data: existingOrders } = await supabaseClient
          .from('orders')
          .select('id')
          .eq('is_policy_order', true)
          .like('failure_description', `%Servicio programado: ${service.service_types.name}%`)
          .eq('client_id', service.policy_clients.clients.id)
          .gte('created_at', new Date().toISOString().split('T')[0]);

        if (existingOrders && existingOrders.length > 0) {
          console.log(`Order already exists for service ${service.id} today`);
          continue;
        }

        // Create order for due service
        const { data: orderData, error: orderError } = await supabaseClient
          .from('orders')
          .insert({
            order_number: `ORD-POL-${Date.now()}-${service.id.slice(0, 8)}`,
            client_id: service.policy_clients.clients.id,
            service_type: 'domicilio',
            service_location: 'domicilio',
            delivery_date: service.next_service_date,
            estimated_cost: 0,
            failure_description: service.service_description || `Servicio programado: ${service.service_types.name}`,
            status: 'en_proceso',
            is_policy_order: true,
            order_priority: service.priority,
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
            quantity: 1,
            unit_cost_price: 0,
            unit_base_price: 0,
            profit_margin_rate: 0,
            subtotal: 0,
            vat_rate: 0,
            vat_amount: 0,
            total_amount: 0,
            service_name: service.service_types.name,
            service_description: service.service_types.description,
            item_type: 'servicio',
            status: 'pendiente',
          });

        if (itemError) throw itemError;

        // Update scheduled service with new next service date
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + service.frequency_days);

        const { error: updateError } = await supabaseClient
          .from('scheduled_services')
          .update({
            last_service_date: new Date().toISOString().split('T')[0],
            next_service_date: nextDate.toISOString().split('T')[0],
          })
          .eq('id', service.id);

        if (updateError) throw updateError;

        ordersCreated++;
        console.log(`Order created: ${orderData.order_number} for service ${service.id}`);

      } catch (serviceError) {
        console.error(`Error processing service ${service.id}:`, serviceError);
        errors.push({
          service_id: service.id,
          error: serviceError.message
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
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        processed_services: 0,
        orders_created: 0 
      }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});