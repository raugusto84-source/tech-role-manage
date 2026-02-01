import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = "https://tech-role-manage.lovable.app";

interface QuoteResponseRequest {
  quoteId: string;
  action: "accept" | "reject";
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // IMPORTANT: avoid mutating data on GET to prevent email scanners/prefetchers from auto-accepting/rejecting.
  // For old emails that still point to this Edge Function, we redirect the user to a clean frontend page.
  if (req.method === "GET") {
    const url = new URL(req.url);
    const quoteId = url.searchParams.get("quoteId") || "";
    const action = url.searchParams.get("action") || "";
    const token = url.searchParams.get("token") || "";

    const redirectUrl = new URL("/quote-response", APP_URL);
    if (quoteId) redirectUrl.searchParams.set("quoteId", quoteId);
    if (action) redirectUrl.searchParams.set("action", action);
    if (token) redirectUrl.searchParams.set("token", token);

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString(),
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, error: "Método no permitido" },
      { status: 405 },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: QuoteResponseRequest = await req.json();
    const quoteId = body.quoteId;
    const action = body.action;
    const token = body.token;

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
      return jsonResponse({
        success: true,
        alreadyProcessed: true,
        currentStatus: quote.status,
        title: "Cotización ya procesada",
        message: `La cotización ${quote.quote_number} ya fue procesada anteriormente.`,
      });
    }

    // Update quote status based on action
    // Frontend expects "rechazada" (labeled as "No Aceptada")
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
      notes: `Cliente ${action === "accept" ? "aceptó" : "no aceptó"} la cotización desde el correo electrónico`
    });

    // Generate success HTML page
    const successMessage = action === "accept" 
      ? `¡Gracias por aceptar la cotización ${quote.quote_number}!`
      : `La cotización ${quote.quote_number} ha sido marcada como No Aceptada.`;

    return jsonResponse({
      success: true,
      quoteId,
      quoteNumber: quote.quote_number,
      newStatus,
      title: action === "accept" ? "Aceptada" : "No Aceptada",
      message: successMessage,
    });

  } catch (error: any) {
    console.error("Error in quote-response:", error);

    return jsonResponse(
      { success: false, error: error?.message || "Ocurrió un error al procesar su respuesta" },
      { status: 400 },
    );
  }
};

function jsonResponse(
  payload: Record<string, unknown>,
  options: { status?: number } = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

serve(handler);
