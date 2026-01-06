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

    const { development_id, scheduled_date, fix_status } = await req.json();

    // Si fix_status es true, actualizar órdenes existentes a en_espera
    if (fix_status) {
      const { data: updated, error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'en_espera' })
        .eq('order_category', 'fraccionamientos')
        .in('status', ['pendiente_actualizacion', 'pendiente_aprobacion'])
        .select('id, order_number, status');
      
      if (updateErr) throw updateErr;
      
      return new Response(
        JSON.stringify({ success: true, updated_orders: updated }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (!development_id) {
      throw new Error('development_id is required');
    }

    console.log(`Creating order for development: ${development_id}, scheduled: ${scheduled_date}`);

    // Get development
    const { data: dev, error: devError } = await supabase
      .from('access_developments')
      .select('*')
      .eq('id', development_id)
      .single();

    if (devError || !dev) {
      throw new Error(`Development not found: ${devError?.message || 'Unknown'}`);
    }

    // Get a default service type
    const { data: serviceTypes } = await supabase
      .from('service_types')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    const serviceTypeId = serviceTypes?.[0]?.id;
    if (!serviceTypeId) {
      throw new Error('No active service types found');
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
        throw new Error(`Error creating client: ${clientError.message}`);
      }
      clientId = newClient.id;
    }

    // Calculate dates: scheduled_date is the service day, delivery is day after
    const scheduledDateObj = new Date(scheduled_date + 'T12:00:00Z');
    const deliveryDateObj = new Date(scheduledDateObj);
    deliveryDateObj.setDate(deliveryDateObj.getDate() + 1);
    
    const scheduledDateStr = scheduledDateObj.toISOString().split('T')[0];
    const deliveryDateStr = deliveryDateObj.toISOString().split('T')[0];

    // Generate order number
    const orderNumber = `ORD-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Create order - delivery_date stores scheduled, estimated_delivery_date stores actual delivery
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        client_id: clientId,
        service_type: serviceTypeId,
        failure_description: `Servicio mensual de acceso - ${dev.name}`,
        estimated_cost: 0,
        delivery_date: scheduledDateStr,
        estimated_delivery_date: deliveryDateStr,
        status: 'en_espera',
        order_category: 'fraccionamientos',
        skip_payment: true,
        source_type: 'development'
      })
      .select()
      .single();

    if (orderError) {
      throw new Error(`Error creating order: ${orderError.message}`);
    }

    // Force update status to en_espera (bypass any triggers)
    await supabase
      .from('orders')
      .update({ status: 'en_espera' })
      .eq('id', newOrder.id);

    // Create order item
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

    console.log(`Created order ${orderNumber} for ${dev.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: newOrder.id,
        order_number: orderNumber,
        development_name: dev.name,
        scheduled_date: scheduledDateStr,
        delivery_date: deliveryDateStr,
        status: 'en_espera'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});