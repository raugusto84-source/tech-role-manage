import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import NewRequestDialog from "@/components/client/NewRequestDialog";

/**
 * PANEL DE CLIENTE
 * - Historial de órdenes y cotizaciones
 * - Crear nueva orden o solicitud de cotización (usa order_requests)
 * - Estado de órdenes en tiempo real (suscripción y recarga)
 * - Bonos/Recompensas (placeholder visual)
 *
 * Notas de implementación:
 * - Para listar órdenes del cliente, filtramos por email del cliente a través del join con `clients`.
 * - Para cotizaciones, usamos el email directamente (RLS ya permite a clientes ver las suyas propias).
 * - La creación de nuevas solicitudes se hace en la tabla `order_requests` (los clientes tienen permiso de INSERT).
 */
export default function ClientDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState<{
    open: boolean;
    type: "orden" | "cotizacion";
  }>({ open: false, type: "orden" });

  const userEmail = profile?.email || "";

  // SEO básico para la SPA
  useEffect(() => {
    document.title = "Panel Cliente | Historial y Estado de Órdenes";
  }, []);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pendiente":
        return "Pendiente";
      case "en_camino":
        return "En camino";
      case "en_proceso":
        return "En proceso";
      case "finalizada":
        return "Terminada";
      case "cancelada":
        return "Cancelada";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pendiente":
        return "bg-yellow-100 text-yellow-800";
      case "en_camino":
        return "bg-blue-100 text-blue-800";
      case "en_proceso":
        return "bg-indigo-100 text-indigo-800";
      case "finalizada":
        return "bg-green-100 text-green-800";
      case "cancelada":
        return "bg-red-100 text-red-800";
      default:
        return "bg-muted text-foreground";
    }
  };

  // Cargar órdenes del cliente por email (vía join con clients)
  const loadOrders = async () => {
    if (!userEmail) return;
    try {
      setLoadingOrders(true);
      const { data, error } = await supabase
        .from("orders")
        .select(`*, service_types:service_type(name), clients:client_id(name, email, address, phone)`) 
        .eq("clients.email", userEmail)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Error loading client orders:", err);
      toast({ title: "Error", description: "No se pudieron cargar tus órdenes", variant: "destructive" });
    } finally {
      setLoadingOrders(false);
    }
  };

  // Cargar cotizaciones del cliente por email
  const loadQuotes = async () => {
    if (!userEmail) return;
    try {
      setLoadingQuotes(true);
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("client_email", userEmail)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (err) {
      console.error("Error loading client quotes:", err);
      toast({ title: "Error", description: "No se pudieron cargar tus cotizaciones", variant: "destructive" });
    } finally {
      setLoadingQuotes(false);
    }
  };

  // Inicializar datos
  useEffect(() => {
    if (userEmail) {
      loadOrders();
      loadQuotes();
    }
  }, [userEmail]);

  // Suscripción en tiempo real a cambios de órdenes
  useEffect(() => {
    if (!userEmail) return;
    const channel = supabase
      .channel("client-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          // Ante cualquier cambio, recargar lista (simple y confiable)
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userEmail]);

  const OrdersList = useMemo(
    () => (
      <div className="grid gap-4">
        {loadingOrders ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card className="text-center py-10">
            <CardContent>
              <p className="text-muted-foreground">Aún no tienes órdenes.</p>
            </CardContent>
          </Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{o.order_number}</CardTitle>
                <Badge className={getStatusColor(o.status)}>{getStatusLabel(o.status)}</Badge>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Servicio</span>
                  <span>{o.service_types?.name ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Entrega</span>
                  <span>{new Date(o.delivery_date).toLocaleDateString("es-CO")}</span>
                </div>
                {o.clients?.address && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Dirección</span>
                    <span className="text-right truncate max-w-[60%]">{o.clients.address}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    ),
    [orders, loadingOrders]
  );

  const QuotesList = useMemo(
    () => (
      <div className="grid gap-4">
        {loadingQuotes ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : quotes.length === 0 ? (
          <Card className="text-center py-10">
            <CardContent>
              <p className="text-muted-foreground">Aún no tienes cotizaciones.</p>
            </CardContent>
          </Card>
        ) : (
          quotes.map((q) => (
            <Card key={q.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{q.quote_number}</CardTitle>
                <Badge variant="outline">{q.status}</Badge>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Monto estimado</span>
                  <span>{q.estimated_amount ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(q.estimated_amount) : "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Fecha</span>
                  <span>{new Date(q.created_at).toLocaleString("es-CO")}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    ),
    [quotes, loadingQuotes]
  );

  return (
    <AppLayout>
      <main className="space-y-6">
        {/* Encabezado + acciones principales */}
        <section className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Panel del Cliente</h1>
            <p className="text-muted-foreground">Consulta tu historial y crea nuevas solicitudes</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowRequestDialog({ open: true, type: "orden" })}>
              Nueva Orden
            </Button>
            <Button variant="secondary" onClick={() => setShowRequestDialog({ open: true, type: "cotizacion" })}>
              Solicitar Cotización
            </Button>
          </div>
        </section>

        {/* Bonos/Recompensas (placeholder visual) */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bonos y Recompensas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Próximamente verás aquí tus puntos, niveles y recompensas disponibles.
              </p>
              <div className="mt-3 h-2 rounded bg-muted">
                <div className="h-2 rounded bg-primary" style={{ width: "35%" }} />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Historial */}
        <section className="space-y-4">
          <Tabs defaultValue="ordenes" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ordenes">Órdenes</TabsTrigger>
              <TabsTrigger value="cotizaciones">Cotizaciones</TabsTrigger>
            </TabsList>
            <TabsContent value="ordenes">{OrdersList}</TabsContent>
            <TabsContent value="cotizaciones">{QuotesList}</TabsContent>
          </Tabs>
        </section>
      </main>

      {/* Diálogo de nueva solicitud (orden o cotización) */}
      <NewRequestDialog
        open={showRequestDialog.open}
        type={showRequestDialog.type}
        onOpenChange={(open) => setShowRequestDialog((s) => ({ ...s, open }))}
        onSuccess={() => {
          setShowRequestDialog((s) => ({ ...s, open: false }));
          loadOrders();
          loadQuotes();
        }}
      />
    </AppLayout>
  );
}
