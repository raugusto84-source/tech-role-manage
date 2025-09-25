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

  // Get all scheduled services for this policy client that start on the specified date
  const { data: scheduledServices, error: servicesError } = await supabaseClient
    .from('scheduled_services')
    .select(`
      id,
      policy_client_id,
      services,
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
      )
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

  for (const scheduledService of scheduledServices || []) {
    try {
      const policyClient = Array.isArray(scheduledService.policy_clients) ? scheduledService.policy_clients[0] : scheduledService.policy_clients;
      const client = Array.isArray(policyClient?.clients) ? policyClient.clients[0] : policyClient?.clients;

      if (!client) {
        console.log(`Skipping scheduled service ${scheduledService.id} - missing client data`);
        continue;
      }

      if (!scheduledService.services || !Array.isArray(scheduledService.services) || scheduledService.services.length === 0) {
        console.log(`Skipping scheduled service ${scheduledService.id} - no services configured`);
        continue;
      }

      console.log(`Creating initial orders for client: ${client.name}, services: ${scheduledService.services.length}`);

      // Get service types information for all services
      const serviceTypeIds = scheduledService.services.map((s: any) => s.service_type_id);
      const { data: serviceTypes, error: serviceTypesError } = await supabaseClient
        .from('service_types')
        .select('id, name, description, base_price')
        .in('id', serviceTypeIds);

      if (serviceTypesError) {
        console.error('Error fetching service types:', serviceTypesError);
        continue;
      }

      // Calculate all dates that should have orders created (from start_date to today)
      const startDate = new Date(scheduledService.start_date);
      const today = new Date();
      const serviceDates: string[] = [];

      if (scheduledService.frequency_type === 'weekly_on_day') {
        // For weekly services, find all occurrences from start_date to today
        const targetDay = scheduledService.frequency_value; // 0=Sunday, 1=Monday, etc.
        let currentDate = new Date(startDate);
        
        // Find the first occurrence of the target day from start_date
        while (currentDate.getDay() !== targetDay) {
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Add all weekly occurrences up to today
        while (currentDate <= today) {
          serviceDates.push(currentDate.toISOString().split('T')[0]);
          currentDate.setDate(currentDate.getDate() + 7); // Add 7 days for next week
        }
      } else if (scheduledService.frequency_type === 'monthly_on_day') {
        // For monthly services, find all monthly occurrences
        let currentDate = new Date(startDate);
        currentDate.setDate(scheduledService.frequency_value); // Set to the target day of month
        
        while (currentDate <= today) {
          serviceDates.push(currentDate.toISOString().split('T')[0]);
          currentDate.setMonth(currentDate.getMonth() + 1); // Next month
        }
      } else if (scheduledService.frequency_type === 'days') {
        // For daily frequency, add intervals based on frequency_value
        let currentDate = new Date(startDate);
        
        while (currentDate <= today) {
          serviceDates.push(currentDate.toISOString().split('T')[0]);
          currentDate.setDate(currentDate.getDate() + scheduledService.frequency_value);
        }
      } else {
        // Default: just the start date
        serviceDates.push(start_date);
      }

      console.log(`Will create orders for ${serviceDates.length} dates: ${serviceDates.join(', ')}`);

      // Create orders for each calculated date
      for (const serviceDate of serviceDates) {
        try {
          // Check if order already exists for this date
          const { data: existingOrders } = await supabaseClient
            .from('orders')
            .select('id')
            .eq('is_policy_order', true)
            .like('failure_description', `%Servicio programado%`)
            .eq('client_id', client.id)
            .eq('delivery_date', serviceDate);

          if (existingOrders && existingOrders.length > 0) {
            console.log(`Order already exists for scheduled service ${scheduledService.id} on ${serviceDate}`);
            continue;
          }

          // Calculate total estimated cost
          const totalCost = scheduledService.services.reduce((total: number, service: any) => {
            const serviceType = serviceTypes?.find((st: any) => st.id === service.service_type_id);
            return total + (serviceType?.base_price || 0) * service.quantity;
          }, 0);

          // Create order for this date
          const { data: orderData, error: orderError } = await supabaseClient
            .from('orders')
            .insert({
              order_number: `ORD-POL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              client_id: client.id,
              service_type: serviceTypeIds[0], // Use first service as primary
              service_location: 'domicilio',
              delivery_date: serviceDate,
              estimated_cost: totalCost,
              failure_description: `Servicio programado: ${serviceTypes?.map((st: any) => st.name).join(', ')} (${serviceDate})`,
              status: 'pendiente_aprobacion',
              client_approval: false,
              is_policy_order: true,
              order_priority: scheduledService.priority || 2
            })
            .select()
            .single();

          if (orderError) throw orderError;

          // Create order items for each service
          const orderItemsPromises = scheduledService.services.map((service: any) => {
            const serviceType = serviceTypes?.find((st: any) => st.id === service.service_type_id);
            
            if (!serviceType) {
              console.warn(`Service type not found for ID: ${service.service_type_id}`);
              return null;
            }

            return supabaseClient
              .from('order_items')
              .insert({
                order_id: orderData.id,
                service_type_id: service.service_type_id,
                quantity: service.quantity,
                unit_cost_price: serviceType.base_price || 0,
                unit_base_price: serviceType.base_price || 0,
                profit_margin_rate: 0,
                subtotal: (serviceType.base_price || 0) * service.quantity,
                vat_rate: 16,
                vat_amount: ((serviceType.base_price || 0) * service.quantity) * 0.16,
                total_amount: ((serviceType.base_price || 0) * service.quantity) * 1.16,
                service_name: serviceType.name,
                service_description: scheduledService.service_description || serviceType.description,
                item_type: 'servicio',
                status: 'pendiente',
              });
          }).filter(Boolean);

          const itemResults = await Promise.all(orderItemsPromises);
          const itemErrors = itemResults.filter(result => result?.error);
          
          if (itemErrors.length > 0) {
            console.error('Errors creating order items:', itemErrors);
            throw new Error(`Failed to create ${itemErrors.length} order items`);
          }

          ordersCreated++;
          console.log(`Order created: ${orderData.order_number} for scheduled service ${scheduledService.id} on ${serviceDate} with ${scheduledService.services.length} services`);

        } catch (dateError) {
          console.error(`Error creating order for date ${serviceDate}:`, dateError);
          const errorMessage = dateError instanceof Error ? dateError.message : 'Unknown error';
          errors.push({
            service_id: scheduledService.id,
            date: serviceDate,
            error: errorMessage
          });
        }
      }

      // Update the scheduled service's next_run to the next occurrence after today
      let nextRun = new Date(today);
      nextRun.setDate(nextRun.getDate() + 1); // Start from tomorrow

      if (scheduledService.frequency_type === 'weekly_on_day') {
        const targetDay = scheduledService.frequency_value;
        while (nextRun.getDay() !== targetDay) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
      } else if (scheduledService.frequency_type === 'monthly_on_day') {
        nextRun.setDate(scheduledService.frequency_value);
        if (nextRun <= today) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
      } else if (scheduledService.frequency_type === 'days') {
        // For daily frequency, get next occurrence
        const lastServiceDate = serviceDates[serviceDates.length - 1];
        nextRun = new Date(lastServiceDate);
        nextRun.setDate(nextRun.getDate() + scheduledService.frequency_value);
      }

      // Update scheduled service with next execution date
      await supabaseClient
        .from('scheduled_services')
        .update({ 
          next_run: nextRun.toISOString(),
          next_service_date: nextRun.toISOString().split('T')[0]
        })
        .eq('id', scheduledService.id);

      console.log(`Updated scheduled service ${scheduledService.id} - next run: ${nextRun.toISOString()}`);

    } catch (serviceError) {
      console.error(`Error creating initial order for scheduled service ${scheduledService.id}:`, serviceError);
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Unknown error';
      errors.push({
        service_id: scheduledService.id,
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
      services,
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
      )
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

  for (const scheduledService of dueServices || []) {
    try {
      const policyClient = Array.isArray(scheduledService.policy_clients) ? scheduledService.policy_clients[0] : scheduledService.policy_clients;
      const client = Array.isArray(policyClient?.clients) ? policyClient.clients[0] : policyClient?.clients;

      if (!client) {
        console.log(`Skipping scheduled service ${scheduledService.id} - missing client data`);
        continue;
      }

      if (!scheduledService.services || !Array.isArray(scheduledService.services) || scheduledService.services.length === 0) {
        console.log(`Skipping scheduled service ${scheduledService.id} - no services configured`);
        continue;
      }

      console.log(`Processing scheduled service for client: ${client.name}, services: ${scheduledService.services.length}`);

      // Get service types information for all services
      const serviceTypeIds = scheduledService.services.map((s: any) => s.service_type_id);
      const { data: serviceTypes, error: serviceTypesError } = await supabaseClient
        .from('service_types')
        .select('id, name, description, base_price')
        .in('id', serviceTypeIds);

      if (serviceTypesError) {
        console.error('Error fetching service types:', serviceTypesError);
        continue;
      }
      
      // Check if order already exists today for this scheduled service
      const { data: existingOrders } = await supabaseClient
        .from('orders')
        .select('id')
        .eq('is_policy_order', true)
        .like('failure_description', `%Servicio programado%`)
        .eq('client_id', client.id)
        .gte('created_at', todayStr)
        .lt('created_at', nextDayStr);

      if (existingOrders && existingOrders.length > 0) {
        console.log(`Order already exists for scheduled service ${scheduledService.id} today`);
        continue;
      }

      // Calculate total estimated cost
      const totalCost = scheduledService.services.reduce((total: number, service: any) => {
        const serviceType = serviceTypes?.find((st: any) => st.id === service.service_type_id);
        return total + (serviceType?.base_price || 0) * service.quantity;
      }, 0);

      // Create single order with all services
      const { data: orderData, error: orderError } = await supabaseClient
        .from('orders')
        .insert({
          order_number: `ORD-POL-${Date.now()}-${scheduledService.id.slice(0, 8)}`,
          client_id: client.id,
          service_type: serviceTypeIds[0], // Use first service as primary
          service_location: 'domicilio',
          delivery_date: todayStr,
          estimated_cost: totalCost,
          failure_description: `Servicio programado: ${serviceTypes?.map((st: any) => st.name).join(', ')}`,
          status: 'pendiente_aprobacion',
          client_approval: false,
          is_policy_order: true,
          order_priority: scheduledService.priority || 2
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items for each service
      const orderItemsPromises = scheduledService.services.map((service: any) => {
        const serviceType = serviceTypes?.find((st: any) => st.id === service.service_type_id);
        
        if (!serviceType) {
          console.warn(`Service type not found for ID: ${service.service_type_id}`);
          return null;
        }

        return supabaseClient
          .from('order_items')
          .insert({
            order_id: orderData.id,
            service_type_id: service.service_type_id,
            quantity: service.quantity,
            unit_cost_price: serviceType.base_price || 0,
            unit_base_price: serviceType.base_price || 0,
            profit_margin_rate: 0,
            subtotal: (serviceType.base_price || 0) * service.quantity,
            vat_rate: 16,
            vat_amount: ((serviceType.base_price || 0) * service.quantity) * 0.16,
            total_amount: ((serviceType.base_price || 0) * service.quantity) * 1.16,
            service_name: serviceType.name,
            service_description: scheduledService.service_description || serviceType.description,
            item_type: 'servicio',
            status: 'pendiente',
          });
      }).filter(Boolean);

      const itemResults = await Promise.all(orderItemsPromises);
      const itemErrors = itemResults.filter(result => result?.error);
      
      if (itemErrors.length > 0) {
        console.error('Errors creating order items:', itemErrors);
        throw new Error(`Failed to create ${itemErrors.length} order items`);
      }

      // Advance next_run based on frequency type
      const currentNext = new Date(scheduledService.next_run || new Date());
      const advanced = new Date(currentNext);
      
      if (scheduledService.frequency_type === 'minutes') {
        advanced.setMinutes(advanced.getMinutes() + scheduledService.frequency_value);
      } else if (scheduledService.frequency_type === 'days') {
        advanced.setDate(advanced.getDate() + scheduledService.frequency_value);
      } else if (scheduledService.frequency_type === 'weekly_on_day') {
        // Calculate next occurrence of specific day of week
        const targetDay = scheduledService.frequency_value; // 0=Sunday, 1=Monday, etc.
        const currentDay = advanced.getDay();
        let daysUntilTarget = (targetDay - currentDay + 7) % 7;
        if (daysUntilTarget === 0) daysUntilTarget = 7; // If today is the target day, schedule for next week
        advanced.setDate(advanced.getDate() + daysUntilTarget);
      } else { // monthly_on_day
        advanced.setMonth(advanced.getMonth() + 1);
        advanced.setDate(scheduledService.frequency_value);
      }
      
      await supabaseClient
        .from('scheduled_services')
        .update({ 
          next_run: advanced.toISOString(),
          next_service_date: advanced.toISOString().split('T')[0] 
        })
        .eq('id', scheduledService.id);

      ordersCreated++;
      console.log(`Order created: ${orderData.order_number} for scheduled service ${scheduledService.id} with ${scheduledService.services.length} services`);

    } catch (serviceError) {
      console.error(`Error processing scheduled service ${scheduledService.id}:`, serviceError);
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Unknown error';
      errors.push({
        service_id: scheduledService.id,
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