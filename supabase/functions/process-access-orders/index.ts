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

    const today = new Date().toISOString().split('T')[0];
    console.log(`Processing access development orders for date: ${today}`);

    // Get pending scheduled orders for today or earlier
    const { data: pendingOrders, error: fetchError } = await supabase
      .from('access_development_orders')
      .select(`
        *,
        access_developments (
          id, name, address, contact_phone, contact_email, 
          monthly_payment, auto_generate_orders, status
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_date', today);

    if (fetchError) {
      console.error('Error fetching pending orders:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingOrders?.length || 0} pending orders to process`);

    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      details: [] as string[]
    };

    for (const scheduledOrder of pendingOrders || []) {
      const dev = scheduledOrder.access_developments;
      
      // Skip if development is not active or auto-generate is disabled
      if (!dev || dev.status !== 'active' || !dev.auto_generate_orders) {
        results.skipped++;
        results.details.push(`Skipped: ${dev?.name || 'Unknown'} - inactive or auto-generate disabled`);
        continue;
      }

      try {
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
        const orderNumber = `ORD-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

        // Create order
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            order_number: orderNumber,
            client_id: clientId,
            service_type: serviceTypeId,
            failure_description: `Servicio mensual programado - ${dev.name}`,
            estimated_cost: dev.monthly_payment,
            delivery_date: scheduledOrder.scheduled_date,
            status: 'pendiente',
          })
          .select()
          .single();

        if (orderError) {
          console.error('Error creating order:', orderError);
          results.errors++;
          results.details.push(`Error creating order for ${dev.name}: ${orderError.message}`);
          continue;
        }

        // Create order item
        await supabase.from('order_items').insert({
          order_id: newOrder.id,
          service_type_id: serviceTypeId,
          service_name: 'Servicio de Acceso Mensual',
          service_description: `Servicio mensual para ${dev.name}`,
          quantity: 1,
          unit_cost_price: dev.monthly_payment,
          unit_base_price: dev.monthly_payment,
          profit_margin_rate: 0,
          subtotal: dev.monthly_payment,
          vat_rate: 16,
          vat_amount: dev.monthly_payment * 0.16,
          total_amount: dev.monthly_payment * 1.16,
          item_type: 'servicio',
          status: 'pendiente',
          pricing_locked: true
        });

        // Update scheduled order
        await supabase
          .from('access_development_orders')
          .update({
            status: 'generated',
            order_id: newOrder.id,
            generated_at: new Date().toISOString()
          })
          .eq('id', scheduledOrder.id);

        results.processed++;
        results.details.push(`Generated order ${orderNumber} for ${dev.name}`);
        console.log(`Generated order ${orderNumber} for ${dev.name}`);

      } catch (err) {
        console.error('Error processing order:', err);
        results.errors++;
        results.details.push(`Error processing ${dev.name}: ${err.message}`);
      }
    }

    console.log('Processing complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} orders, skipped ${results.skipped}, errors ${results.errors}`,
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
