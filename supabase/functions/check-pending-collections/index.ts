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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Checking pending collections...');

    const { data: overdueCollections, error } = await supabase
      .from('collections_cache')
      .select('*')
      .eq('is_overdue', true);

    if (error) throw error;

    if (overdueCollections && overdueCollections.length > 0) {
      const totalAmount = overdueCollections.reduce((sum, c) => sum + (c.amount_pending || 0), 0);

      // Verificar si ya existe notificación no leída de hoy
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('financial_notifications')
        .select('id')
        .eq('notification_type', 'collection_pending')
        .eq('is_read', false)
        .gte('created_at', today)
        .single();

      if (!existing) {
        await supabase.from('financial_notifications').insert({
          notification_type: 'collection_pending',
          title: 'Cobranzas Vencidas',
          description: `Hay ${overdueCollections.length} cobros vencidos por un total de $${totalAmount.toFixed(2)}`,
          amount: totalAmount,
          priority: 'high',
        });

        console.log(`Created pending collections notification: ${overdueCollections.length} collections for $${totalAmount}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        overdue_collections: overdueCollections?.length || 0,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error checking pending collections:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});