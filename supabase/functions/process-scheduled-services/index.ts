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

    // Parse request body for action type
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // If no body, default to normal processing
      body = { action: 'process_due_services' };
    }

    const action = body.action || 'process_due_services';
    
    console.log('Processing scheduled services with action:', action);

    if (action === 'create_initial_orders') {
      return await createInitialOrders(supabaseClient, body);
    } else {
      return await processDueServices(supabaseClient);
    }

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

async function createInitialOrders(supabaseClient: any, body: any) {
  const { start_date, policy_client_id } = body;
  
  if (!start_date || !policy_client_id) {
    throw new Error('start_date and policy_client_id are required for creating initial orders');
  }

  console.log(`Creating initial orders for date: ${start_date}, policy client: ${policy_client_id}`);

  // Get all scheduled services for this policy client that start today
  const { data: scheduledServices, error: servicesError } = await supabaseClient
    .from('scheduled_services')
    .select(`
      id,
      policy_client_id,
      service_type_id,
      frequency_type,
      frequency_value,
      quantity,
      service_description,
      priority,
      start_date,
      policy_clients!inner(
        id,
        client_id,
        clients!inner(id, name, email),
        insurance_policies!inner(policy_name)
      ),
      service_types!inner(name, description, base_price)
    `)
    .eq('is_active', true)
    .eq('policy_client_id', policy_client_id)
    .eq('start_date', start_date);

  if (servicesError) {
    console.error('Error fetching scheduled services:', servicesError);
    throw servicesError;
  }

  console.log(`Found ${scheduledServices?.length || 0} scheduled services to start`);

  let ordersCreated = 0;
  const errors: any[] = [];

  for (const service of scheduledServices || []) {
    try {
      const policyClient = Array.isArray(service.policy_clients) ? service.policy_clients[0] : service.policy_clients;
      const client = Array.isArray(policyClient?.clients) ? policyClient.clients[0] : policyClient?.clients;
      const serviceType = Array.isArray(service.service_types) ? service.service_types[0] : service.service_types;

      if (!client || !serviceType) {
        console.log(`Skipping service ${service.id} - missing client or service type data`);
        continue;
      }

      console.log(`Creating initial order for client: ${client.name}, service: ${serviceType.name}`);
      
      // Check if order already exists for this date
      const { data: existingOrders } = await supabaseClient
        .from('orders')
        .select('id')
        .eq('is_policy_order', true)
        .like('failure_description', `%Servicio programado: ${serviceType.name}%`)
        .eq('client_id', client.id)
        .eq('delivery_date', start_date);

      if (existingOrders && existingOrders.length > 0) {
        console.log(`Order already exists for service ${service.id} on ${start_date}`);
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
          delivery_date: start_date,
          estimated_cost: serviceType.base_price || 0,
          failure_description: `Servicio programado: ${serviceType.name} (Inicio: ${start_date})`,
          status: 'pendiente_aprobacion',
          client_approval: false,
          is_policy_order: true,
          order_priority: service.priority || 2
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
          unit_cost_price: serviceType.base_price || 0,
          unit_base_price: serviceType.base_price || 0,
          profit_margin_rate: 0,
          subtotal: serviceType.base_price || 0,
          vat_rate: 16,
          vat_amount: (serviceType.base_price || 0) * 0.16,
          total_amount: (serviceType.base_price || 0) * 1.16,
          service_name: serviceType.name,
          service_description: service.service_description || serviceType.description,
          item_type: 'servicio',
          status: 'pendiente',
        });

      if (itemError) throw itemError;

      ordersCreated++;
      console.log(`Initial order created: ${orderData.order_number} for service ${service.id}`);

    } catch (serviceError) {
      console.error(`Error creating initial order for service ${service.id}:`, serviceError);
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Unknown error';
      errors.push({
        service_id: service.id,
        error: errorMessage
      });
    }
  }

  const result = {
    success: true,
    action: 'create_initial_orders',
    processed_services: scheduledServices?.length || 0,
    orders_created: ordersCreated,
    errors: errors
  };

  console.log('Initial orders creation complete:', result);

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function processDueServices(supabaseClient: any) {
  console.log('Processing due scheduled services...');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const nextDayStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
  
  console.log(`Processing date: ${todayStr}`);

  // Get scheduled services due now or earlier
  const nowStr = new Date().toISOString();
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
      start_date,
      policy_clients!inner(
        id,
        client_id,
        clients!inner(id, name, email),
        insurance_policies!inner(policy_name)
      ),
      service_types!inner(name, description, base_price)
    `)
    .eq('is_active', true)
    .lte('next_run', nowStr);

  if (servicesError) {
    console.error('Error fetching due services:', servicesError);
    throw servicesError;
  }

  console.log(`Found ${dueServices?.length || 0} due services`);

  let ordersCreated = 0;
  const errors: any[] = [];

  for (const service of dueServices || []) {
    try {
      const policyClient = Array.isArray(service.policy_clients) ? service.policy_clients[0] : service.policy_clients;
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
        .gte('created_at', todayStr)
        .lt('created_at', nextDayStr);

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
          delivery_date: todayStr,
          estimated_cost: serviceType.base_price || 0,
          failure_description: `Servicio programado: ${serviceType.name}`,
          status: 'pendiente_aprobacion',
          client_approval: false,
          is_policy_order: true,
          order_priority: service.priority || 2
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
          unit_cost_price: serviceType.base_price || 0,
          unit_base_price: serviceType.base_price || 0,
          profit_margin_rate: 0,
          subtotal: serviceType.base_price || 0,
          vat_rate: 16,
          vat_amount: (serviceType.base_price || 0) * 0.16,
          total_amount: (serviceType.base_price || 0) * 1.16,
          service_name: serviceType.name,
          service_description: service.service_description || serviceType.description,
          item_type: 'servicio',
          status: 'pendiente',
        });

      if (itemError) throw itemError;

      // Advance next_run based on frequency type
      const currentNext = new Date(service.next_run || new Date());
      const advanced = new Date(currentNext);
      
      if (service.frequency_type === 'minutes') {
        advanced.setMinutes(advanced.getMinutes() + service.frequency_value);
      } else if (service.frequency_type === 'days') {
        advanced.setDate(advanced.getDate() + service.frequency_value);
      } else if (service.frequency_type === 'weekly_on_day') {
        // Calculate next occurrence of specific day of week
        const targetDay = service.frequency_value; // 0=Sunday, 1=Monday, etc.
        const currentDay = advanced.getDay();
        let daysUntilTarget = (targetDay - currentDay + 7) % 7;
        if (daysUntilTarget === 0) daysUntilTarget = 7; // If today is the target day, schedule for next week
        advanced.setDate(advanced.getDate() + daysUntilTarget);
      } else { // monthly_on_day
        advanced.setMonth(advanced.getMonth() + 1);
        advanced.setDate(service.frequency_value);
      }
      
      await supabaseClient
        .from('scheduled_services')
        .update({ 
          next_run: advanced.toISOString(),
          next_service_date: advanced.toISOString().split('T')[0] 
        })
        .eq('id', service.id);

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
    action: 'process_due_services',
    processed_services: dueServices?.length || 0,
    orders_created: ordersCreated,
    errors: errors
  };

  console.log('Processing complete:', result);

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}