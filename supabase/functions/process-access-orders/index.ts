import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Processing access development orders for date: ${todayStr}`);

    const results = {
      orders_generated: 0,
      orders_processed: 0,
      orders_skipped: 0,
      payments_generated: 0,
      errors: 0,
      details: [] as string[]
    };

    // Get a default service type for creating orders
    const { data: serviceTypes } = await supabase
      .from('service_types')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    const serviceTypeId = serviceTypes?.[0]?.id;
    if (!serviceTypeId) {
      throw new Error('No active service types found');
    }

    // Find all pending development orders that should be executed (scheduled_date <= today)
    const { data: pendingOrders, error: fetchError } = await supabase
      .from('access_development_orders')
      .select(`
        id,
        development_id,
        scheduled_date,
        status,
        order_id,
        access_developments (
          id,
          name,
          address,
          contact_phone,
          contact_email,
          service_day,
          status,
          auto_generate_orders
        )
      `)
      .is('order_id', null)
      .eq('status', 'pending')
      .lte('scheduled_date', todayStr);

    if (fetchError) {
      console.error('Error fetching pending orders:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingOrders?.length || 0} pending development orders to process`);

    for (const devOrder of pendingOrders || []) {
      const dev = devOrder.access_developments;
      
      if (!dev || dev.status !== 'active' || !dev.auto_generate_orders) {
        results.orders_skipped++;
        results.details.push(`Skipped ${dev?.name || 'unknown'} - development inactive or auto_generate disabled`);
        continue;
      }

      try {
        // Find or create client
        let clientId: string | null = null;
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('name', dev.name)
          .limit(1)
          .single();

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              name: dev.name,
              address: dev.address || 'Sin dirección',
              phone: dev.contact_phone,
              email: dev.contact_email
            })
            .select()
            .single();

          if (clientError) {
            console.error('Error creating client:', clientError);
            results.errors++;
            results.details.push(`Error creating client for ${dev.name}: ${clientError.message}`);
            continue;
          }
          clientId = newClient.id;
        }

        // Generate order number
        const orderNumber = `ORD-${today.getFullYear()}-${Date.now().toString().slice(-6)}`;

        // Create order with status 'en_proceso' (ready to work) for past dates or 'en_espera' for future
        const isPastOrToday = devOrder.scheduled_date <= todayStr;
        const orderStatus = isPastOrToday ? 'en_proceso' : 'en_espera';

        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            order_number: orderNumber,
            client_id: clientId,
            service_type: serviceTypeId,
            failure_description: `Servicio mensual de acceso - ${dev.name}`,
            estimated_cost: 0,
            delivery_date: devOrder.scheduled_date,
            status: orderStatus,
            order_category: 'fraccionamientos',
            skip_payment: true,
            source_type: 'development'
          })
          .select()
          .single();

        if (orderError) {
          console.error('Error creating order:', orderError);
          results.errors++;
          results.details.push(`Error creating order for ${dev.name}: ${orderError.message}`);
          continue;
        }

        // Create order item with $0 cost
        await supabase.from('order_items').insert({
          order_id: newOrder.id,
          service_type_id: serviceTypeId,
          service_name: 'Servicio de Acceso Mensual',
          service_description: `Servicio mensual de acceso para ${dev.name}`,
          quantity: 1,
          unit_cost_price: 0,
          unit_base_price: 0,
          profit_margin_rate: 0,
          subtotal: 0,
          vat_rate: 0,
          vat_amount: 0,
          total_amount: 0,
          item_type: 'servicio',
          status: 'pendiente',
          pricing_locked: true
        });

        // Update the development order record with the created order_id
        const { error: updateError } = await supabase
          .from('access_development_orders')
          .update({
            order_id: newOrder.id,
            status: 'generated',
            generated_at: new Date().toISOString()
          })
          .eq('id', devOrder.id);

        if (updateError) {
          console.error('Error updating development order:', updateError);
        }

        // Log the status change
        await supabase.from('order_status_logs').insert({
          order_id: newOrder.id,
          previous_status: null,
          new_status: orderStatus,
          changed_by: null,
          notes: `Orden generada automáticamente para ${dev.name} - fecha programada: ${devOrder.scheduled_date}`
        });

        results.orders_generated++;
        results.details.push(`Generated order ${orderNumber} for ${dev.name} (${devOrder.scheduled_date}) - status: ${orderStatus}`);
        console.log(`Generated order ${orderNumber} for ${dev.name}`);

      } catch (err) {
        console.error('Error generating order:', err);
        results.errors++;
        results.details.push(`Error generating order for ${dev.name}: ${err.message}`);
      }
    }

    // Process payments (existing logic)
    const { data: pendingDevPayments, error: paymentsFetchError } = await supabase
      .from('access_development_payments')
      .select(`
        *,
        access_developments (id, name, contact_email, monthly_payment, status)
      `)
      .in('status', ['pending', 'overdue'])
      .lte('due_date', todayStr);

    if (paymentsFetchError) {
      console.error('Error fetching pending payments:', paymentsFetchError);
    } else {
      console.log(`Found ${pendingDevPayments?.length || 0} pending development payments`);

      for (const devPayment of pendingDevPayments || []) {
        const dev = devPayment.access_developments;
        
        if (!dev || dev.status !== 'active') {
          continue;
        }

        try {
          // Check if pending collection already exists
          const { data: existingCollection } = await supabase
            .from('pending_collections')
            .select('id')
            .eq('related_id', devPayment.id)
            .eq('collection_type', 'development_payment')
            .single();

          if (!existingCollection) {
            // Create pending collection for this development payment
            await supabase.from('pending_collections').insert({
              collection_type: 'development_payment',
              related_id: devPayment.id,
              client_name: dev.name,
              client_email: dev.contact_email,
              amount: devPayment.amount,
              due_date: devPayment.due_date,
              status: devPayment.status === 'overdue' ? 'overdue' : 'pending',
              notes: `Pago mensual fraccionamiento: ${dev.name} - Período: ${devPayment.payment_period}`
            });

            results.payments_generated++;
            results.details.push(`Created pending collection for ${dev.name} - $${devPayment.amount}`);
            console.log(`Created pending collection for ${dev.name} - $${devPayment.amount}`);
          }

          // Update status to overdue if past due
          if (devPayment.status !== 'overdue') {
            await supabase
              .from('access_development_payments')
              .update({ status: 'overdue' })
              .eq('id', devPayment.id);
          }
        } catch (err) {
          console.error('Error processing payment:', err);
          results.errors++;
        }
      }
    }

    console.log('Processing complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${results.orders_generated} orders, ${results.payments_generated} payments, skipped ${results.orders_skipped}, errors ${results.errors}`,
        ...results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});