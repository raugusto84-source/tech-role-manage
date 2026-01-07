import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { 
      policy_client_id, 
      policy_id, 
      client_id, 
      policy_name, 
      policy_number,
      failure_description, 
      urgency 
    } = body;

    console.log('Creating policy support order:', { 
      policy_client_id, 
      client_id, 
      policy_number,
      urgency,
      failure_description: failure_description?.substring(0, 50) + '...'
    });

    // Validate required fields
    if (!client_id || !failure_description) {
      throw new Error('client_id and failure_description are required');
    }

    // Get client info
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('id, name, address')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      console.error('Error fetching client:', clientError);
      throw new Error('Client not found');
    }

    // Determine priority based on urgency - Policy orders always get HIGH priority
    // critico = 1 (highest), urgente = 1, normal = 1 (all high because it's policy)
    const orderPriority = 1; // All policy support orders get HIGH priority

    // Generate unique order number using RPC
    const { data: orderNumber, error: numberError } = await supabaseClient
      .rpc('generate_policy_order_number');

    if (numberError) {
      console.error('Error generating order number:', numberError);
      throw new Error('Could not generate order number');
    }

    console.log('Generated order number:', orderNumber);

    // Create the service order with HIGH priority
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        client_id: client_id,
        failure_description: `[SOPORTE PÓLIZA ${policy_number}] ${urgency === 'critico' ? '🚨 CRÍTICO: ' : urgency === 'urgente' ? '⚠️ URGENTE: ' : ''}${failure_description}`,
        status: 'pendiente', // Start as pending for immediate assignment
        order_priority: orderPriority,
        is_policy_order: true,
        policy_id: policy_id,
        policy_name: policy_name,
        has_policy_discount: true,
        is_home_service: true,
        service_location: { address: client.address },
        source_type: 'cliente_poliza',
        order_category: 'sistemas' // Default category for support
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw new Error('Could not create order');
    }

    console.log('Order created successfully:', order.id, order.order_number);

    // Log initial status
    await supabaseClient
      .from('order_status_logs')
      .insert({
        order_id: order.id,
        old_status: null,
        new_status: 'pendiente',
        changed_by: client_id,
        notes: `Solicitud de soporte creada por cliente con póliza ${policy_number}. Urgencia: ${urgency}`
      });

    // Create a notification for staff about the new priority order
    await supabaseClient
      .from('financial_notifications')
      .insert({
        notification_type: 'policy_support_request',
        title: `🔔 Solicitud de Soporte - Póliza ${policy_number}`,
        description: `Cliente ${client.name} solicita soporte ${urgency === 'critico' ? 'CRÍTICO' : urgency === 'urgente' ? 'URGENTE' : 'normal'}. Orden: ${orderNumber}`,
        priority: urgency === 'critico' ? 'critical' : urgency === 'urgente' ? 'high' : 'medium',
        related_id: order.id
      });

    console.log('Policy support order created successfully:', {
      order_id: order.id,
      order_number: orderNumber,
      priority: orderPriority,
      urgency
    });

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_number: orderNumber,
        message: 'Solicitud de soporte creada exitosamente'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in create-policy-support-order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
