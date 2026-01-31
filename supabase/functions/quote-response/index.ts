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
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Update quote status based on action - use "no_aceptada" for reject
    const newStatus = action === "accept" ? "aceptada" : "no_aceptada";
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
      notes: `Cliente ${action === "accept" ? "aceptó" : "no aceptó"} la cotización desde el correo electrónico`
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
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

  } catch (error: any) {
    console.error("Error in quote-response:", error);
    
    const html = generateResponsePage(
      "Error",
      error.message || "Ocurrió un error al procesar su respuesta",
      "error"
    );
    
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
};

function generateResponsePage(title: string, message: string, type: "success" | "error" | "info"): string {
  const colors = {
    success: { bg: "#d4edda", border: "#28a745", text: "#155724", icon: "✓", gradient: "linear-gradient(135deg, #28a745 0%, #20c997 100%)" },
    error: { bg: "#f8d7da", border: "#dc3545", text: "#721c24", icon: "✕", gradient: "linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)" },
    info: { bg: "#d1ecf1", border: "#17a2b8", text: "#0c5460", icon: "ℹ", gradient: "linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%)" }
  };

  const color = colors[type];
  const autoCloseSeconds = type === "success" ? 5 : 10;

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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: ${color.gradient};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 50px 40px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      animation: slideUp 0.5s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .icon {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      background: ${color.gradient};
      color: white;
      font-size: 45px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 25px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    h1 {
      color: #333;
      font-size: 26px;
      margin-bottom: 15px;
      font-weight: 600;
    }
    p {
      color: #666;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 25px;
    }
    .countdown {
      display: inline-block;
      background: #f5f5f5;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 14px;
      color: #888;
    }
    .countdown span {
      font-weight: bold;
      color: ${color.text};
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${color.icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="countdown">
      Esta ventana se cerrará en <span id="timer">${autoCloseSeconds}</span> segundos
    </div>
  </div>
  <script>
    let seconds = ${autoCloseSeconds};
    const timer = document.getElementById('timer');
    const interval = setInterval(() => {
      seconds--;
      timer.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(interval);
        window.close();
        // If window.close() doesn't work (some browsers block it), show a message
        setTimeout(() => {
          document.querySelector('.countdown').innerHTML = 'Puede cerrar esta ventana manualmente';
        }, 500);
      }
    }, 1000);
  </script>
</body>
</html>
  `;
}

serve(handler);
