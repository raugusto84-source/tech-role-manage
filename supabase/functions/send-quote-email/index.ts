import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendQuoteRequest {
  quoteId: string;
}

interface QuoteItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
  vat_amount: number;
}

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { quoteId }: SendQuoteRequest = await req.json();

    if (!quoteId) {
      throw new Error("Se requiere el ID de la cotización");
    }

    // Generate response token FIRST
    const responseToken = generateToken();
    console.log("Generated response token for quote:", quoteId, "token length:", responseToken.length);

    // Save the token to the quote BEFORE sending email to ensure it's stored
    const { error: tokenError } = await supabase
      .from("quotes")
      .update({ response_token: responseToken })
      .eq("id", quoteId);

    if (tokenError) {
      console.error("Error saving response token:", tokenError);
      throw new Error(`Error al guardar el token: ${tokenError.message}`);
    }
    console.log("Response token saved successfully for quote:", quoteId);

    // Get quote details
    const { data: quote, error: quoteError } = await supabase.from("quotes").select("*").eq("id", quoteId).single();

    if (quoteError || !quote) {
      throw new Error(`No se encontró la cotización: ${quoteError?.message}`);
    }

    // Get quote items
    const { data: items, error: itemsError } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: true });

    if (itemsError) {
      console.error("Error loading items:", itemsError);
    }

    const quoteItems: QuoteItem[] = items || [];

    // Get client credentials
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, email, user_id")
      .eq("email", quote.client_email)
      .maybeSingle();

    let username = "";
    let clientPassword = "";

    if (client?.user_id) {
      // Get username from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", client.user_id)
        .single();

      username = profile?.username || quote.client_email;
      clientPassword = "Su contraseña actual";
    } else {
      username = quote.client_email;
      clientPassword = "Contacte a soporte para sus credenciales";
    }

    // Calculate totals
    const subtotal = quoteItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const totalVat = quoteItems.reduce((sum, item) => sum + item.vat_amount * item.quantity, 0);
    const total = quoteItems.reduce((sum, item) => sum + item.total * item.quantity, 0);

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.ceil(amount / 10) * 10);
    };

    // Build items HTML table
    const itemsHtml =
      quoteItems.length > 0
        ? `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Servicio/Producto</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Cant.</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Precio Unit.</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${quoteItems
              .map(
                (item) => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">
                  <strong>${item.name}</strong>
                  ${item.description ? `<br><small style="color: #6c757d;">${item.description}</small>` : ""}
                </td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #dee2e6;">${item.quantity}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">${formatCurrency(item.unit_price)}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">${formatCurrency(item.total * item.quantity)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Subtotal:</td>
              <td style="padding: 10px; text-align: right;">${formatCurrency(subtotal)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">IVA:</td>
              <td style="padding: 10px; text-align: right;">${formatCurrency(totalVat)}</td>
            </tr>
            <tr style="background-color: #e9ecef;">
              <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.1em;">Total:</td>
              <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.1em; color: #28a745;">${formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      `
        : `<p style="color: #6c757d; font-style: italic;">Los detalles de los servicios se definirán próximamente.</p>`;

    // Login URL for clients
    const loginUrl = "https://login.syslag.com";

    // Build email HTML as a reminder to log in
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cotización ${quote.quote_number}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #007bff;">
      <h1 style="color: #007bff; margin: 0; font-size: 28px;">Cotización ${quote.quote_number}</h1>
      <p style="color: #6c757d; margin-top: 10px;">Fecha: ${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>
    </div>

    <!-- Greeting -->
    <p style="font-size: 16px;">Estimado/a <strong>${quote.client_name}</strong>,</p>
    <p>Le informamos que tiene una cotización pendiente de revisión y aprobación en nuestro sistema.</p>

    <!-- Service Description -->
    <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; border-radius: 0 5px 5px 0;">
      <h3 style="margin: 0 0 10px 0; color: #495057;">Descripción del Servicio</h3>
      <p style="margin: 0; color: #6c757d;">${quote.service_description || "Servicios profesionales según requerimiento"}</p>
    </div>

    <!-- Items Table -->
    <h3 style="color: #495057; border-bottom: 1px solid #dee2e6; padding-bottom: 10px;">Detalle de la Cotización</h3>
    ${itemsHtml}

    <!-- Login Instructions -->
    <div style="background-color: #e7f3ff; border: 2px solid #007bff; border-radius: 10px; padding: 25px; margin: 30px 0; text-align: center;">
      <h3 style="color: #004085; margin-top: 0; margin-bottom: 15px;">📱 Ingrese al Sistema para Responder</h3>
      <p style="color: #6c757d; margin-bottom: 20px;">Para aceptar o rechazar esta cotización, ingrese a nuestro portal con sus credenciales:</p>
      
      <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: left;">
        <p style="margin: 8px 0; font-size: 15px;"><strong>🌐 Portal de Acceso:</strong></p>
        <p style="margin: 5px 0 15px 0;"><a href="${loginUrl}" style="color: #007bff; font-size: 18px; font-weight: bold;">${loginUrl}</a></p>
        <p style="margin: 8px 0;"><strong>👤 Usuario:</strong> <span style="color: #28a745; font-weight: bold;">${username}</span></p>
      </div>
      
      <a href="${loginUrl}" style="display: inline-block; background-color: #007bff; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
        Ingresar al Sistema →
      </a>
      
      <p style="color: #6c757d; font-size: 13px; margin-top: 15px;">Si no recuerda su contraseña, contacte a soporte.</p>
    </div>

    <!-- Notes -->
    ${
      quote.notes
        ? `
      <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
        <strong>Notas:</strong>
        <p style="margin: 10px 0 0 0;">${quote.notes}</p>
      </div>
    `
        : ""
    }

    <!-- Disclaimer -->
    <div style="margin: 25px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #6c757d; font-style: italic;">
        Precios y disponibilidad sujetos a cambios sin previo aviso. Cotización válida por 7 días.
      </p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d;">
      <p style="margin: 0;">¿Tiene alguna pregunta? No dude en contactarnos.</p>
      <p style="margin: 10px 0 0 0; font-size: 14px;">Este es un correo automático generado por el sistema.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Syslag Cotizaciones <sistema@syslag.com>",
      to: [quote.client_email],
      subject: `Cotización ${quote.quote_number} - ${quote.client_name}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    // Check if email was sent successfully
    if (emailResponse.error) {
      throw new Error(`Error al enviar el email: ${emailResponse.error.message}`);
    }

    // Update quote status to 'enviada' (token was already saved earlier)
    const { error: updateError } = await supabase.from("quotes").update({ status: "enviada" }).eq("id", quoteId);

    if (updateError) {
      console.error("Error updating quote status:", updateError);
      throw new Error(`Error al actualizar el estado: ${updateError.message}`);
    }
    console.log("Quote status updated to 'enviada' for:", quoteId);

    // Log the email in quote_status_logs
    const { error: logError } = await supabase.from("quote_status_logs").insert({
      quote_id: quoteId,
      previous_status: quote.status,
      new_status: "enviada",
      notes: `Cotización enviada por correo a ${quote.client_email}`,
    });

    if (logError) {
      console.error("Error logging status change:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cotización enviada exitosamente",
        emailId: emailResponse.data?.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("Error in send-quote-email:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
