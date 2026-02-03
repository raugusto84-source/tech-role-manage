import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationRequest {
  notification_type: 'quote_accepted' | 'order_completed';
  data: {
    quote_number?: string;
    order_number?: string;
    client_name?: string;
    total?: number;
    description?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { notification_type, data }: NotificationRequest = await req.json();

    // Create Supabase client to get email addresses
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine which email type to use
    const emailType = notification_type === 'quote_accepted' ? 'ventas' : 'facturacion';
    
    // Get the email address from system_emails table
    const { data: emailConfig, error: emailError } = await supabase
      .from('system_emails')
      .select('email_address')
      .eq('email_type', emailType)
      .single();

    if (emailError || !emailConfig) {
      console.error('Error getting email config:', emailError);
      throw new Error(`No se encontró configuración de email para: ${emailType}`);
    }

    const toEmail = emailConfig.email_address;
    let subject = '';
    let htmlContent = '';

    if (notification_type === 'quote_accepted') {
      subject = `✅ Cotización ${data.quote_number} Aceptada por Cliente`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">¡Cotización Aceptada!</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <p style="font-size: 16px; color: #374151;">
              El cliente <strong>${data.client_name || 'N/A'}</strong> ha aceptado la cotización desde el portal.
            </p>
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981;">
              <h3 style="margin-top: 0; color: #374151;">Detalles:</h3>
              <p><strong>Cotización:</strong> ${data.quote_number}</p>
              <p><strong>Cliente:</strong> ${data.client_name || 'N/A'}</p>
              ${data.total ? `<p><strong>Monto:</strong> $${data.total.toLocaleString('es-CO')}</p>` : ''}
              ${data.description ? `<p><strong>Descripción:</strong> ${data.description}</p>` : ''}
            </div>
            <p style="color: #6B7280; font-size: 14px;">
              Se ha generado automáticamente una orden de servicio. 
              Ingresa al sistema para revisar los detalles y dar seguimiento.
            </p>
          </div>
          <div style="background: #374151; padding: 15px; text-align: center;">
            <p style="color: #9CA3AF; margin: 0; font-size: 12px;">
              Sistema de Notificaciones - SYSLAG
            </p>
          </div>
        </div>
      `;
    } else if (notification_type === 'order_completed') {
      subject = `📦 Orden ${data.order_number} Completada - Lista para Facturar`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3B82F6, #2563EB); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Orden Completada</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <p style="font-size: 16px; color: #374151;">
              La orden <strong>${data.order_number}</strong> ha sido completada y está lista para facturación.
            </p>
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3B82F6;">
              <h3 style="margin-top: 0; color: #374151;">Detalles:</h3>
              <p><strong>Orden:</strong> ${data.order_number}</p>
              <p><strong>Cliente:</strong> ${data.client_name || 'N/A'}</p>
              ${data.total ? `<p><strong>Monto:</strong> $${data.total.toLocaleString('es-CO')}</p>` : ''}
            </div>
            <p style="color: #6B7280; font-size: 14px;">
              Por favor, procede con el proceso de facturación.
            </p>
          </div>
          <div style="background: #374151; padding: 15px; text-align: center;">
            <p style="color: #9CA3AF; margin: 0; font-size: 12px;">
              Sistema de Notificaciones - SYSLAG
            </p>
          </div>
        </div>
      `;
    }

    console.log(`Sending ${notification_type} notification to: ${toEmail}`);

    const emailResponse = await resend.emails.send({
      from: "Sistema SYSLAG <sistema@syslag.com>",
      to: [toEmail],
      subject: subject,
      html: htmlContent,
    });

    console.log("Internal notification sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-internal-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
