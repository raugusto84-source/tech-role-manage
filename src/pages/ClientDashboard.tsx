import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Gift, FileText, ClipboardList, User } from "lucide-react";
import { NewRequestDialog } from "@/components/client/NewRequestDialog";

// Tipos locales para órdenes y cotizaciones (ligeros para no depender de types.ts)
interface Order {
  id: string;
  order_number: string;
  status: "pendiente" | "en_proceso" | "finalizada" | "cancelada" | "en_camino" | string;
  created_at: string;
  delivery_date?: string;
  failure_description?: string;
  assigned_technician?: string;
  assignment_reason?: string;
  technician_profile?: {
    full_name: string;
  } | null;
}

interface Quote {
  id: string;
  quote_number: string;
  status: "solicitud" | "enviada" | "aceptada" | "rechazada" | "seguimiento" | string;
  request_date?: string;
  created_at: string;
  service_description?: string;
}

/**
 * Panel de Cliente
 * - Crear nueva orden o cotización (botón destacado)
 * - Ver estado de órdenes en tiempo real (suscripción Supabase)
 * - Bonos/recompensas (placeholder visual)
 * - Interfaz sencilla inspirada en apps bancarias
 */
export default function ClientDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();

  // Estado UI
  const [openNew, setOpenNew] = useState(false);
  const [loading, setLoading] = useState(true);

  // Datos
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const userEmail = profile?.email ?? null;

  // SEO básico por SPA
  useEffect(() => {
    document.title = "Panel de Cliente | Syslag"; // Title tag (SEO)
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Panel de cliente Syslag: crea órdenes o cotizaciones y sigue tu estado en tiempo real.");
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = "Panel de cliente Syslag: crea órdenes o cotizaciones y sigue tu estado en tiempo real.";
      document.head.appendChild(m);
    }
    const canonical = document.querySelector('link[rel="canonical"]') || document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", window.location.href);
    if (!canonical.parentElement) document.head.appendChild(canonical);
  }, []);

  // Cargar cotizaciones del cliente (por email)
  const loadQuotes = async () => {
    if (!userEmail) return;
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("client_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      console.error("Error loading quotes:", error);
      toast({ title: "Error", description: "No se pudieron cargar cotizaciones", variant: "destructive" });
    } else {
      setQuotes((data as any) || []);
    }
  };

  // Cargar órdenes del cliente
  const loadOrders = async () => {
    if (!userEmail) return;
    // Primero obtenemos el id del cliente para filtrar por client_id
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("email", userEmail)
      .maybeSingle();

    if (clientErr) {
      console.error("Error loading client:", clientErr);
      toast({ title: "Error", description: "No se pudo identificar tu cliente", variant: "destructive" });
      return;
    }

    if (!client) {
      setOrders([]);
      return;
    }

    const { data: ordersData, error } = await supabase
      .from("orders")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error loading orders:", error);
      toast({ title: "Error", description: "No se pudieron cargar órdenes", variant: "destructive" });
      return;
    }

    // Get technician profiles separately for assigned orders
    console.log('CLIENT: Raw orders data:', ordersData);
    
    const ordersWithTechnicianNames = await Promise.all(
      (ordersData || []).map(async (order: any) => {
        console.log(`CLIENT: Order ${order.order_number}: assigned_technician = ${order.assigned_technician}`);
        
        if (order.assigned_technician) {
          const { data: techProfile, error } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', order.assigned_technician)
            .maybeSingle();
          
          console.log(`CLIENT: Technician profile for ${order.order_number}:`, techProfile, 'Error:', error);
          
          return {
            ...order,
            technician_profile: techProfile
          };
        }
        return {
          ...order,
          technician_profile: null
        };
      })
    );

    console.log('CLIENT: Final orders with technician names:', ordersWithTechnicianNames);
    setOrders(ordersWithTechnicianNames);
  };

  // Carga inicial
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadOrders(), loadQuotes()]);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [userEmail]);

  // Suscripción en tiempo real SOLO para órdenes del cliente
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      if (!userEmail) return;
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle();

      if (!client) return;

      // Canal realtime, escucha INSERT/UPDATE en orders del cliente
      channel = supabase
        .channel("orders-realtime-client")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders", filter: `client_id=eq.${client.id}` },
          (_payload) => {
            // Simplificamos recargando top 5 para mantener consistencia
            loadOrders();
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `client_id=eq.${client.id}` },
          (_payload) => {
            loadOrders();
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [userEmail]);

  // Utilidades UI
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pendiente: "bg-warning/10 text-warning border-warning/20",
      en_camino: "bg-info/10 text-info border-info/20",
      en_proceso: "bg-info/10 text-info border-info/20",
      finalizada: "bg-success/10 text-success border-success/20",
      cancelada: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return <Badge className={map[status] || "bg-muted text-foreground"}>{status.replace("_", " ")}</Badge>;
  };

  const metrics = useMemo(() => ({
    totalOrders: orders.length,
    pending: orders.filter(o => o.status === "pendiente" || o.status === "en_proceso" || o.status === "en_camino").length,
    quotesCount: quotes.length,
  }), [orders, quotes]);

  return (
    <AppLayout>
      <header className="mb-4">
        {/* H1 único (SEO) */}
        <h1 className="text-2xl md:text-3xl font-bold">Panel de Cliente</h1>
        <p className="text-muted-foreground">Crea y sigue tus solicitudes de forma sencilla.</p>
      </header>

      {/* Acciones principales al estilo app bancaria */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Button onClick={() => setOpenNew(true)} className="h-16 flex-col items-start justify-center px-4">
          <Plus />
          <span className="text-left text-sm">Nueva solicitud</span>
        </Button>
        <Button variant="secondary" onClick={() => { loadOrders(); loadQuotes(); }} className="h-16 flex-col items-start justify-center px-4">
          <RefreshCw />
          <span className="text-left text-sm">Actualizar</span>
        </Button>
        <Button asChild variant="outline" className="h-16 flex-col items-start justify-center px-4">
          <a href="/orders">
            <ClipboardList />
            <span className="text-left text-sm">Mis órdenes</span>
          </a>
        </Button>
        <Button asChild variant="outline" className="h-16 flex-col items-start justify-center px-4">
          <a href="/quotes">
            <FileText />
            <span className="text-left text-sm">Mis cotizaciones</span>
          </a>
        </Button>
      </section>

      {/* Resumen */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Órdenes activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.pending}</p>
            <p className="text-muted-foreground text-sm">En curso o pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total órdenes recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.totalOrders}</p>
            <p className="text-muted-foreground text-sm">Últimas 5</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cotizaciones recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.quotesCount}</p>
            <p className="text-muted-foreground text-sm">Últimas 5</p>
          </CardContent>
        </Card>
      </section>

      {/* Listas recientes */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Órdenes (realtime) */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Órdenes recientes</CardTitle>
            <Badge variant="secondary">Tiempo real</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {orders.length === 0 ? (
              <p className="text-muted-foreground">Aún no tienes órdenes</p>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="flex items-start justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{o.order_number}</p>
                      {statusBadge(o.status)}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {o.failure_description || "Sin descripción"}
                    </p>
                    
                    {o.technician_profile && (
                      <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-md w-fit">
                        <User className="h-4 w-4" />
                        <div>
                          <span className="text-sm font-medium">
                            {o.technician_profile.full_name}
                          </span>
                          {o.assignment_reason && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {o.assignment_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {!o.technician_profile && (
                      <div className="flex items-center gap-2 bg-muted/50 text-muted-foreground px-3 py-2 rounded-md w-fit">
                        <User className="h-4 w-4" />
                        <span className="text-sm">Sin técnico asignado</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Cotizaciones */}
        <Card>
          <CardHeader>
            <CardTitle>Cotizaciones recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quotes.length === 0 ? (
              <p className="text-muted-foreground">Aún no tienes cotizaciones</p>
            ) : (
              quotes.map((q) => (
                <div key={q.id} className="flex items-start justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{q.quote_number}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{q.service_description || "Sin descripción"}</p>
                  </div>
                  <Badge variant="outline">{q.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Bonos y recompensas (placeholder visual) */}
      <section className="mt-6">
        <Card className="border-dashed">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Bonos y Recompensas</CardTitle>
              <p className="text-sm text-muted-foreground">Programa de puntos y beneficios</p>
            </div>
            <Gift className="opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Tus puntos</p>
                <p className="text-2xl font-bold">—</p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Nivel</p>
                <p className="text-2xl font-bold">—</p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Beneficios</p>
                <p className="text-2xl font-bold">Próximamente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Dialog para nueva solicitud */}
      <NewRequestDialog open={openNew} onOpenChange={setOpenNew} />

      {/* Loader simple */}
      {loading && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}
    </AppLayout>
  );
}
