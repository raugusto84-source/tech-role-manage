import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date().toISOString()
    const today = now.split('T')[0]

    // Find orders in "en_espera" that have scheduled_date <= today
    const { data: ordersToActivate, error: fetchError } = await supabase
      .from('orders')
      .select('id, order_number, scheduled_date')
      .eq('status', 'en_espera')
      .lte('scheduled_date', today)

    if (fetchError) {
      throw fetchError
    }

    console.log(`Found ${ordersToActivate?.length || 0} orders to activate`)

    const activatedOrders: string[] = []

    for (const order of ordersToActivate || []) {
      // Update order status to en_proceso
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'en_proceso' })
        .eq('id', order.id)

      if (updateError) {
        console.error(`Error activating order ${order.order_number}:`, updateError)
        continue
      }

      // Log the status change
      const { error: logError } = await supabase
        .from('order_status_logs')
        .insert({
          order_id: order.id,
          previous_status: 'en_espera',
          new_status: 'en_proceso',
          changed_by: null, // System automated
          notes: 'Orden activada automáticamente por fecha programada'
        })

      if (logError) {
        console.error(`Error logging status change for order ${order.order_number}:`, logError)
      }

      activatedOrders.push(order.order_number)
      console.log(`Activated order ${order.order_number}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Activated ${activatedOrders.length} orders`,
        activatedOrders
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in activate-scheduled-orders:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
