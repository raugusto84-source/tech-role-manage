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
 
     const { 
       development_id, 
       client_id, 
       development_name,
       failure_description, 
       urgency 
     } = await req.json();
 
     if (!development_id || !client_id || !failure_description) {
       throw new Error('development_id, client_id, and failure_description are required');
     }
 
     console.log(`Creating support order for development: ${development_id}, client: ${client_id}`);
 
     // Get development details
     const { data: dev, error: devError } = await supabase
       .from('access_developments')
       .select('*')
       .eq('id', development_id)
       .single();
 
     if (devError || !dev) {
       throw new Error(`Development not found: ${devError?.message || 'Unknown'}`);
     }
 
     // Verify the development is active
     if (dev.status !== 'activo') {
       throw new Error('El contrato de fraccionamiento no está activo');
     }
 
     // Get a default service type for support
     const { data: serviceTypes } = await supabase
       .from('service_types')
       .select('id')
       .eq('is_active', true)
       .limit(1);
 
     const serviceTypeId = serviceTypes?.[0]?.id;
     if (!serviceTypeId) {
       throw new Error('No active service types found');
     }
 
     // Determine priority based on urgency
     let priorityLevel = 'normal';
     if (urgency === 'urgente') priorityLevel = 'alta';
     if (urgency === 'critico') priorityLevel = 'critica';
 
     // Generate order number
     const orderNumber = `ORD-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
 
     // Create order - set as high priority if urgent
     const orderData: any = {
       order_number: orderNumber,
       client_id: client_id,
       service_type: serviceTypeId,
       failure_description: `[SOPORTE FRACCIONAMIENTO - ${development_name}] ${failure_description}`,
       estimated_cost: 0,
       status: urgency === 'critico' ? 'en_proceso' : 'en_espera',
       order_category: 'fraccionamientos',
       skip_payment: true,
       source_type: 'development_support',
       priority: priorityLevel
     };
 
     const { data: newOrder, error: orderError } = await supabase
       .from('orders')
       .insert(orderData)
       .select()
       .single();
 
     if (orderError) {
       throw new Error(`Error creating order: ${orderError.message}`);
     }
 
     // Create order item for the support request
     await supabase.from('order_items').insert({
       order_id: newOrder.id,
       service_type_id: serviceTypeId,
       service_name: 'Soporte de Fraccionamiento',
       service_description: failure_description,
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
 
     // Create note about the support request
     await supabase.from('order_notes').insert({
       order_id: newOrder.id,
       note_text: `Solicitud de soporte creada por el cliente.\n\nNivel de urgencia: ${urgency}\n\nDescripción: ${failure_description}`,
       is_internal: false
     });
 
     console.log(`Created support order ${orderNumber} for development ${development_name}`);
 
     return new Response(
       JSON.stringify({
         success: true,
         order_id: newOrder.id,
         order_number: orderNumber,
         development_name: development_name,
         urgency: urgency
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