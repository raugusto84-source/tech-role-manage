import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    const { paymentId, developmentId, email, isNotice } = await req.json();

    if (!paymentId || !email) {
      throw new Error("Missing required parameters: paymentId and email");
    }

    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from("access_development_payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment not found");
    }

    // Get development details
    const { data: development, error: devError } = await supabase
      .from("access_developments")
      .select("*")
      .eq("id", developmentId || payment.development_id)
      .single();

    if (devError || !development) {
      throw new Error("Development not found");
    }

    // Format period
    const periodDate = new Date(payment.payment_period);
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const periodFormatted = `${monthNames[periodDate.getMonth()]} ${periodDate.getFullYear()}`;

    const amountFormatted = payment.amount.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    });

    let html: string;
    let subject: string;

    if (isNotice) {
      // Generate payment notice (aviso de pago)
      const dueDate = new Date(payment.due_date);
      const noticeNumber = `AVI-${dueDate.getFullYear()}${String(dueDate.getMonth() + 1).padStart(2, "0")}-${payment.id.slice(0, 6).toUpperCase()}`;

      const dueDateFormatted = dueDate.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const today = new Date();
      const isOverdue = dueDate < today;

      subject = `Aviso de Pago - ${development.name} - ${periodFormatted}`;

      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Aviso de Pago - ${noticeNumber}</title>
        </head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #d97706, #b45309); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">SYSLAG</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Aviso de Pago</p>
              <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 14px;">${noticeNumber}</p>
            </div>

            <!-- Content -->
            <div style="padding: 30px;">
              
              <!-- Development Info -->
              <div style="margin-bottom: 25px;">
                <h3 style="color: #666; font-size: 12px; text-transform: uppercase; margin: 0 0 10px;">Fraccionamiento</h3>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                  <p style="margin: 0 0 5px; font-weight: 600; font-size: 16px;">${development.name}</p>
                  <p style="margin: 0 0 5px; color: #666; font-size: 14px;">${development.address || "Sin dirección"}</p>
                  <p style="margin: 0; color: #666; font-size: 14px;">${development.contact_name || ""} ${development.contact_phone ? "• " + development.contact_phone : ""}</p>
                </div>
              </div>

              <!-- Payment Details -->
              <div style="margin-bottom: 25px;">
                <h3 style="color: #666; font-size: 12px; text-transform: uppercase; margin: 0 0 10px;">Detalles del Pago</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px dotted #ddd; color: #666;">Período:</td>
                    <td style="padding: 10px 0; border-bottom: 1px dotted #ddd; text-align: right; font-weight: 600;">${periodFormatted}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666;">Fecha de Vencimiento:</td>
                    <td style="padding: 10px 0; text-align: right; font-weight: 600; ${isOverdue ? "color: #dc2626;" : ""}">${dueDateFormatted}${isOverdue ? " (VENCIDO)" : ""}</td>
                  </tr>
                </table>
              </div>

              <!-- Amount -->
              <div style="background: ${isOverdue ? "linear-gradient(135deg, #dc2626, #b91c1c)" : "linear-gradient(135deg, #d97706, #b45309)"}; padding: 25px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
                <p style="color: rgba(255,255,255,0.9); margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">Monto a Pagar</p>
                <p style="color: white; margin: 0; font-size: 32px; font-weight: bold;">${amountFormatted}</p>
              </div>

              <!-- Stamp -->
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="display: inline-block; padding: 10px 25px; border: 3px solid ${isOverdue ? "#dc2626" : "#d97706"}; color: ${isOverdue ? "#dc2626" : "#d97706"}; font-weight: bold; font-size: 18px; border-radius: 4px;">
                  ${isOverdue ? "⚠ VENCIDO" : "⏳ PENDIENTE"}
                </span>
              </div>

              <!-- Payment Info -->
              <div style="background: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #d97706; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  <strong>Información Importante:</strong><br>
                  Por favor realice su pago antes de la fecha de vencimiento para evitar cargos por mora.
                  Para cualquier duda o aclaración, contacte a nuestro equipo.
                </p>
              </div>

            </div>

            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 5px; color: #666; font-size: 12px;">Este documento es un aviso de pago, no es un recibo.</p>
              <p style="margin: 0; color: #999; font-size: 11px;">Syslag - Sistemas y Seguridad de la Laguna</p>
            </div>

          </div>
        </body>
        </html>
      `;
    } else {
      // Generate receipt (recibo de pago) - Original logic
      const paidDate = new Date(payment.paid_at);
      const receiptNumber = `REC-${paidDate.getFullYear()}${String(paidDate.getMonth() + 1).padStart(2, "0")}-${payment.id.slice(0, 6).toUpperCase()}`;

      // Format payment method
      const paymentMethods: Record<string, string> = {
        efectivo: "Efectivo",
        transferencia: "Transferencia",
        tarjeta: "Tarjeta",
        tarjeta_debito: "Tarjeta de Débito",
        tarjeta_credito: "Tarjeta de Crédito",
        cheque: "Cheque",
      };
      const paymentMethodLabel =
        paymentMethods[payment.payment_method || ""] || payment.payment_method || "No especificado";

      // Format dates
      const paidDateFormatted = paidDate.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      subject = `Recibo de Pago - ${development.name} - ${periodFormatted}`;

      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Recibo de Pago - ${receiptNumber}</title>
        </head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">SYSLAG</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Recibo de Pago</p>
              <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 14px;">${receiptNumber}</p>
            </div>

            <!-- Content -->
            <div style="padding: 30px;">
              
              <!-- Development Info -->
              <div style="margin-bottom: 25px;">
                <h3 style="color: #666; font-size: 12px; text-transform: uppercase; margin: 0 0 10px;">Fraccionamiento</h3>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                  <p style="margin: 0 0 5px; font-weight: 600; font-size: 16px;">${development.name}</p>
                  <p style="margin: 0 0 5px; color: #666; font-size: 14px;">${development.address || "Sin dirección"}</p>
                  <p style="margin: 0; color: #666; font-size: 14px;">${development.contact_name || ""} ${development.contact_phone ? "• " + development.contact_phone : ""}</p>
                </div>
              </div>

              <!-- Payment Details -->
              <div style="margin-bottom: 25px;">
                <h3 style="color: #666; font-size: 12px; text-transform: uppercase; margin: 0 0 10px;">Detalles del Pago</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px dotted #ddd; color: #666;">Período:</td>
                    <td style="padding: 10px 0; border-bottom: 1px dotted #ddd; text-align: right; font-weight: 600;">${periodFormatted}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px dotted #ddd; color: #666;">Fecha de Pago:</td>
                    <td style="padding: 10px 0; border-bottom: 1px dotted #ddd; text-align: right; font-weight: 600;">${paidDateFormatted}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px dotted #ddd; color: #666;">Método de Pago:</td>
                    <td style="padding: 10px 0; border-bottom: 1px dotted #ddd; text-align: right; font-weight: 600;">${paymentMethodLabel}</td>
                  </tr>
                  ${
                    payment.payment_reference
                      ? `
                  <tr>
                    <td style="padding: 10px 0; color: #666;">Referencia:</td>
                    <td style="padding: 10px 0; text-align: right; font-weight: 600;">${payment.payment_reference}</td>
                  </tr>
                  `
                      : ""
                  }
                </table>
              </div>

              <!-- Amount -->
              <div style="background: linear-gradient(135deg, #059669, #047857); padding: 25px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
                <p style="color: rgba(255,255,255,0.9); margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">Monto Total Pagado</p>
                <p style="color: white; margin: 0; font-size: 32px; font-weight: bold;">${amountFormatted}</p>
              </div>

              <!-- Stamp -->
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="display: inline-block; padding: 10px 25px; border: 3px solid #059669; color: #059669; font-weight: bold; font-size: 18px; border-radius: 4px; transform: rotate(-3deg);">
                  ✓ PAGADO
                </span>
              </div>

            </div>

            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0 0 5px; color: #666; font-size: 12px;">Este recibo es un comprobante de pago válido.</p>
              <p style="margin: 0; color: #999; font-size: 11px;">Syslag - Sistemas y Seguridad de la Laguna</p>
            </div>

          </div>
        </body>
        </html>
      `;
    }

    // Send email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Syslag <sistema@syslag.com>",
      to: [email],
      subject: subject,
      html: html,
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      throw emailError;
    }

    console.log(`${isNotice ? "Payment notice" : "Receipt"} email sent successfully:`, emailData);

    return new Response(JSON.stringify({ success: true, emailId: emailData?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending receipt:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
