import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppNotificationRequest {
  phone: string;
  message: string;
  message_type?: string;
  related_id?: string;
  related_type?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests FIRST
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate Twilio credentials
    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      console.error('Missing Twilio credentials');
      return new Response(JSON.stringify({ 
        error: 'WhatsApp service not configured. Please add Twilio credentials.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const { phone, message, message_type, related_id, related_type }: WhatsAppNotificationRequest = await req.json();

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: 'Phone and message are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`Attempting to send WhatsApp message to ${phone}`);

    // Format phone number for WhatsApp (must include whatsapp: prefix and country code)
    let formattedPhone = phone.trim();
    
    // Add + if not present
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    
    // Add whatsapp: prefix for Twilio
    const twilioTo = `whatsapp:${formattedPhone}`;
    
    // Prepare Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    
    const body = new URLSearchParams({
      To: twilioTo,
      From: twilioWhatsAppNumber,
      Body: message,
    });

    console.log(`Sending to Twilio: ${twilioTo}`);

    // Send message via Twilio
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioData);
      
      // Log failed notification
      await supabase.from('whatsapp_notifications').insert({
        client_whatsapp: formattedPhone,
        message_type: message_type || 'notification',
        related_id,
        related_type,
        message_content: message,
        status: 'failed',
        error_message: twilioData.message || 'Twilio API error',
      });

      return new Response(JSON.stringify({ 
        error: 'Failed to send WhatsApp message',
        details: twilioData.message || 'Unknown error'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log('Twilio response:', twilioData);

    // Log successful notification
    const { error: logError } = await supabase.from('whatsapp_notifications').insert({
      client_whatsapp: formattedPhone,
      message_type: message_type || 'notification',
      related_id,
      related_type,
      message_content: message,
      status: 'sent',
      twilio_sid: twilioData.sid,
      sent_at: new Date().toISOString(),
    });

    if (logError) {
      console.error('Error logging notification:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'WhatsApp message sent successfully',
      sid: twilioData.sid,
      status: twilioData.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in send-whatsapp-notification function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error),
      details: 'Failed to send WhatsApp notification'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};

serve(handler);
