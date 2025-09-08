// Create edge function to process follow-up triggers
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FollowUpConfig {
  id: string;
  name: string;
  trigger_event: string;
  delay_hours: number;
  notification_channels: string[];
  message_template: string;
  is_active: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { trigger_event, related_id, related_type, target_email, additional_data = {} } = await req.json();

    console.log(`Processing follow-up for event: ${trigger_event}, related_id: ${related_id}`);

    // Get active configurations for this trigger event
    const { data: configs, error: configError } = await supabase
      .from('follow_up_configurations')
      .select('*')
      .eq('trigger_event', trigger_event)
      .eq('is_active', true);

    if (configError) {
      console.error('Error fetching configurations:', configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      console.log(`No active configurations found for trigger: ${trigger_event}`);
      return new Response(JSON.stringify({ message: 'No configurations found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Create reminders for each configuration
    const reminders = [];
    for (const config of configs) {
      const scheduledAt = new Date();
      scheduledAt.setHours(scheduledAt.getHours() + config.delay_hours);

      // Replace variables in message template
      let messageContent = config.message_template;
      messageContent = messageContent.replace(/\{cliente_nombre\}/g, additional_data.client_name || 'Cliente');
      messageContent = messageContent.replace(/\{orden_numero\}/g, additional_data.order_number || '');
      messageContent = messageContent.replace(/\{cotizacion_numero\}/g, additional_data.quote_number || '');
      messageContent = messageContent.replace(/\{vendedor_nombre\}/g, additional_data.seller_name || '');
      messageContent = messageContent.replace(/\{monto\}/g, additional_data.amount || '');

      const reminder = {
        configuration_id: config.id,
        related_id,
        related_type,
        target_email,
        scheduled_at: scheduledAt.toISOString(),
        message_content: messageContent,
        status: 'pending'
      };

      reminders.push(reminder);
    }

    // Insert reminders
    const { error: insertError } = await supabase
      .from('follow_up_reminders')
      .insert(reminders);

    if (insertError) {
      console.error('Error inserting reminders:', insertError);
      throw insertError;
    }

    console.log(`Created ${reminders.length} follow-up reminders for event: ${trigger_event}`);

    return new Response(JSON.stringify({ 
      success: true, 
      reminders_created: reminders.length,
      trigger_event,
      related_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in process-follow-ups function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to process follow-up configurations'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};

serve(handler);