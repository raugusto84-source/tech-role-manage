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
    const isFirstDayOfMonth = today.getDate() === 1;
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    console.log(`Processing access development orders for date: ${todayStr}, isFirstDayOfMonth: ${isFirstDayOfMonth}`);

    const results = {
      orders_generated: 0,
      orders_processed: 0,
      orders_skipped: 0,
      payments_generated: 0,
      errors: 0,
      details: [] as string[]
    };

    // If it's the first day of the month, generate orders for ALL active developments
    if (isFirstDayOfMonth) {
      console.log('First day of month - generating orders for all developments');
      
      const { data: developments, error: devError } = await supabase
        .from('access_developments')
        .select('*')
        .eq('status', 'active')
        .eq('auto_generate_orders', true);

      if (devError) {
        console.error('Error fetching developments:', devError);
        throw devError;
      }

      console.log(`Found ${developments?.length || 0} active developments to generate orders for`);

      for (const dev of developments || []) {
        try {
          // Calculate the scheduled date for this month based on service_day
          const scheduledDate = new Date(currentYear, currentMonth, dev.service_day);
          const scheduledDateStr = scheduledDate.toISOString().split('T')[0];

          // Check if order already exists for this development and month
          const { data: existingOrder } = await supabase
            .from('access_development_orders')
            .select('id')
            .eq('development_id', dev.id)
            .gte('scheduled_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
            .lt('scheduled_date', currentMonth === 11 
              ? `${currentYear + 1}-01-01` 
              : `${currentYear}-${String(currentMonth + 2).padStart(2, '0')}-01`)
            .single();

          if (existingOrder) {
            results.orders_skipped++;
            results.details.push(`Order already exists for ${dev.name} this month`);
            continue;
          }

          // Get a default service type
          const { data: serviceTypes } = await supabase
            .from('service_types')
            .select('id')
            .eq('is_active', true)
            .limit(1);

          const serviceTypeId = serviceTypes?.[0]?.id;
          if (!serviceTypeId) {
            results.errors++;
            results.details.push(`Error: No active service types found for ${dev.name}`);
            continue;
          }

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
          const orderNumber = `ORD-${currentYear}-${Date.now().toString().slice(-6)}`;

          // Create order with status 'en_espera' (waiting for scheduled date)
          const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
              order_number: orderNumber,
              client_id: clientId,
              service_type: serviceTypeId,
              failure_description: `Servicio mensual de acceso - ${dev.name}`,
              estimated_cost: 0,
              delivery_date: scheduledDateStr,
              status: 'en_espera',
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

          // Create scheduled order record
          await supabase.from('access_development_orders').insert({
            development_id: dev.id,
            scheduled_date: scheduledDateStr,
            status: 'generated',
            order_id: newOrder.id,
            generated_at: new Date().toISOString()
          });

          results.orders_generated++;
          results.details.push(`Generated order ${orderNumber} for ${dev.name} - scheduled for ${scheduledDateStr}`);
          console.log(`Generated order ${orderNumber} for ${dev.name}`);

        } catch (err) {
          console.error('Error generating order:', err);
          results.errors++;
          results.details.push(`Error generating order for ${dev.name}: ${err.message}`);
        }
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