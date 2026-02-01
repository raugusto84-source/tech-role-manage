import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type QuoteAction = "accept" | "reject";

type QuoteResponseResult =
  | {
      success: true;
      title?: string;
      message?: string;
      quoteNumber?: string;
      newStatus?: string;
      alreadyProcessed?: boolean;
      currentStatus?: string;
    }
  | {
      success: false;
      error: string;
    };

export default function QuoteResponse() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const quoteId = params.get("quoteId") || "";
  const token = params.get("token") || "";
  const actionParam = (params.get("action") || "") as QuoteAction | "";

  const action: QuoteAction | null = useMemo(() => {
    if (actionParam === "accept" || actionParam === "reject") return actionParam;
    return null;
  }, [actionParam]);

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<QuoteResponseResult | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [autoCloseBlocked, setAutoCloseBlocked] = useState(false);

  const errorMessage = useMemo(() => {
    if (!result) return null;
    if (result.success === false) return result.error;
    return null;
  }, [result]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!quoteId || !token || !action) {
        setResult({
          success: false,
          error: "Faltan parámetros en el enlace. Por favor solicite que le reenvíen la cotización.",
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke("quote-response", {
          body: { quoteId, action, token },
        });

        if (error) throw new Error(error.message);

        const payload = (data || null) as QuoteResponseResult | null;
        if (!payload) throw new Error("Respuesta vacía del servidor");

        if (!cancelled) setResult(payload);
      } catch (e: any) {
        if (!cancelled) {
          setResult({
            success: false,
            error: e?.message || "Ocurrió un error al procesar su respuesta",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [quoteId, token, action]);

  useEffect(() => {
    if (!result) return;

    // Count down and attempt to auto-close.
    const initialSeconds = result.success ? 5 : 10;
    setSeconds(initialSeconds);
    setAutoCloseBlocked(false);

    const interval = window.setInterval(() => {
      setSeconds((s) => (s === null ? null : s - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [result]);

  useEffect(() => {
    if (seconds === null) return;
    if (seconds > 0) return;

    try {
      window.close();
    } catch {
      // ignore
    }

    // If the browser blocks closing, show manual options.
    window.setTimeout(() => {
      if (!window.closed) setAutoCloseBlocked(true);
    }, 400);
  }, [seconds]);

  const isAccepted = result?.success && (result.newStatus === "aceptada" || action === "accept");

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Procesando…
              </>
            ) : result?.success ? (
              isAccepted ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-primary" /> Aceptada
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" /> No Aceptada
                </>
              )
            ) : (
              <>
                <XCircle className="h-5 w-5 text-destructive" /> Error
              </>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Por favor espere un momento.
            </p>
          ) : result?.success ? (
            <>
              <p className="text-sm text-muted-foreground">{result.message || "Listo."}</p>
              <p className="text-xs text-muted-foreground">
                Esta ventana intentará cerrarse en {Math.max(0, seconds ?? 0)}s.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{errorMessage || "Ocurrió un error"}</p>
              <p className="text-xs text-muted-foreground">
                Esta ventana intentará cerrarse en {Math.max(0, seconds ?? 0)}s.
              </p>
            </>
          )}

          {autoCloseBlocked && (
            <div className="flex flex-col gap-2">
              <Button onClick={() => window.close()}>
                Cerrar ventana
              </Button>
              <Button variant="outline" onClick={() => navigate("/", { replace: true })}>
                Ir al portal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
