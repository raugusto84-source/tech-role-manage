-- Edge function to send follow-up notifications
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for pending follow-up reminders...');

    // Get pending reminders that are due
    const now = new Date().toISOString();
    const { data: pendingReminders, error: reminderError } = await supabase
      .from('follow_up_reminders')
      .select(`
        *,
        follow_up_configurations!inner(notification_channels)
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .limit(50);

    if (reminderError) {
      console.error('Error fetching pending reminders:', reminderError);
      throw reminderError;
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      console.log('No pending reminders found');
      return new Response(JSON.stringify({ message: 'No pending reminders' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Found ${pendingReminders.length} pending reminders`);

    // Process each reminder
    for (const reminder of pendingReminders) {
      try {
        const channels = reminder.follow_up_configurations.notification_channels || ['system'];
        
        // Send notifications based on configured channels
        for (const channel of channels) {
          switch (channel) {
            case 'whatsapp':
              // Call WhatsApp notification function
              await supabase.functions.invoke('send-whatsapp-notification', {
                body: {
                  client_email: reminder.target_email,
                  message_type: 'follow_up',
                  related_id: reminder.related_id,
                  related_type: reminder.related_type,
                  message_content: reminder.message_content
                }
              });
              break;
              
            case 'email':
              // Call email notification function
              console.log(`Sending email to ${reminder.target_email}: ${reminder.message_content}`);
              // Here you would integrate with your email service
              break;
              
            case 'system':
            default:
              // Create system notification
              console.log(`System notification: ${reminder.message_content}`);
              break;
          }
        }

        // Mark reminder as sent
        await supabase
          .from('follow_up_reminders')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', reminder.id);

        console.log(`Processed reminder ${reminder.id} successfully`);

      } catch (reminderError) {
        console.error(`Error processing reminder ${reminder.id}:`, reminderError);
        
        // Mark reminder as failed
        await supabase
          .from('follow_up_reminders')
          .update({ status: 'failed' })
          .eq('id', reminder.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed_reminders: pendingReminders.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in send-follow-up-notifications function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to send follow-up notifications'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};

serve(handler);