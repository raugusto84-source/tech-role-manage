import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuoteResponseRequest {
  quoteId: string;
  action: "accept" | "reject";
  token: string;
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

    // Support both GET (from email link) and POST
    let quoteId: string;
    let action: "accept" | "reject";
    let token: string;

    if (req.method === "GET") {
      const url = new URL(req.url);
      quoteId = url.searchParams.get("quoteId") || "";
      action = (url.searchParams.get("action") as "accept" | "reject") || "reject";
      token = url.searchParams.get("token") || "";
    } else {
      const body: QuoteResponseRequest = await req.json();
      quoteId = body.quoteId;
      action = body.action;
      token = body.token;
    }

    if (!quoteId || !action || !token) {
      throw new Error("Faltan parámetros requeridos");
    }

    // Verify the token matches the quote
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id, quote_number, client_name, client_email, status, response_token")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      throw new Error("Cotización no encontrada");
    }

    // Validate token
    if (quote.response_token !== token) {
      throw new Error("Token inválido o expirado");
    }

    // Check if quote is still in a valid state for response
    if (quote.status !== "enviada") {
      // Return a friendly page instead of error
      const html = generateResponsePage(
        "Cotización ya procesada",
        `La cotización ${quote.quote_number} ya fue ${quote.status === 'aceptada' ? 'aceptada' : 'procesada'} anteriormente.`,
        "info"
      );
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
      });
    }

    // Update quote status based on action
    const newStatus = action === "accept" ? "aceptada" : "rechazada";
    const { error: updateError } = await supabase
      .from("quotes")
      .update({ 
        status: newStatus,
        response_token: null // Clear token after use
      })
      .eq("id", quoteId);

    if (updateError) {
      throw new Error(`Error al actualizar: ${updateError.message}`);
    }

    // Log the status change
    await supabase.from("quote_status_logs").insert({
      quote_id: quoteId,
      previous_status: "enviada",
      new_status: newStatus,
      notes: `Cliente ${action === "accept" ? "aceptó" : "rechazó"} la cotización desde el correo electrónico`
    });

    // Generate success HTML page
    const successMessage = action === "accept" 
      ? `¡Gracias por aceptar la cotización ${quote.quote_number}! Nos pondremos en contacto para coordinar el servicio.`
      : `La cotización ${quote.quote_number} ha sido marcada como no aceptada. Si tiene alguna pregunta, no dude en contactarnos.`;

    const html = generateResponsePage(
      action === "accept" ? "¡Cotización Aceptada!" : "Cotización No Aceptada",
      successMessage,
      action === "accept" ? "success" : "info"
    );

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in quote-response:", error);
    
    const html = generateResponsePage(
      "Error",
      error.message || "Ocurrió un error al procesar su respuesta",
      "error"
    );
    
    return new Response(html, {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
    });
  }
};

function generateResponsePage(title: string, message: string, type: "success" | "error" | "info"): string {
  const colors = {
    success: { bg: "#d4edda", border: "#c3e6cb", text: "#155724", icon: "✓" },
    error: { bg: "#f8d7da", border: "#f5c6cb", text: "#721c24", icon: "✕" },
    info: { bg: "#d1ecf1", border: "#bee5eb", text: "#0c5460", icon: "ℹ" }
  };

  const color = colors[type];

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${color.bg};
      border: 3px solid ${color.border};
      color: ${color.text};
      font-size: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    h1 {
      color: ${color.text};
      font-size: 24px;
      margin-bottom: 16px;
    }
    p {
      color: #666;
      font-size: 16px;
      line-height: 1.6;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #999;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${color.icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="footer">
      Puede cerrar esta ventana.
    </div>
  </div>
</body>
</html>
  `;
}

serve(handler);
