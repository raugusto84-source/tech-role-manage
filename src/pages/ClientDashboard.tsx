import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Gift, FileText, ClipboardList } from "lucide-react";
import { NewRequestDialog } from "@/components/client/NewRequestDialog";
import { ClientRewardsCard } from "@/components/rewards/ClientRewardsCard";

// Tipos locales para órdenes y cotizaciones (ligeros para no depender de types.ts)
interface Order {
  id: string;
  order_number: string;
  status: "pendiente" | "en_proceso" | "finalizada" | "cancelada" | "en_camino" | "pendiente_aprobacion" | string;
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

  // Cargar cotizaciones del cliente usando user_id
  const loadQuotes = async () => {
    if (!profile?.user_id) return;
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("user_id", profile.user_id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      console.error("Error loading quotes:", error);
      toast({ title: "Error", description: "No se pudieron cargar cotizaciones", variant: "destructive" });
    } else {
      setQuotes((data as any) || []);
    }
  };

  // Cargar órdenes del cliente usando user_id en lugar de email
  const loadOrders = async () => {
    if (!profile?.user_id) return;
    
    // Buscar cliente por user_id (nueva relación)
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", profile.user_id)
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
    const ordersWithTechnicianNames = await Promise.all(
      (ordersData || []).map(async (order: any) => {
        if (order.assigned_technician) {
          const { data: techProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', order.assigned_technician)
            .maybeSingle();
          
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
  }, [profile?.user_id]);

  // Suscripción en tiempo real SOLO para órdenes del cliente
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      if (!profile?.user_id) return;
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", profile.user_id)
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
  }, [profile?.user_id]);

  // Utilidades UI con colores semánticos
  const statusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      pendiente_aprobacion: "bg-warning-light text-warning-foreground border border-warning-border",
      pendiente: "bg-info-light text-info-foreground border border-info-border",
      en_camino: "bg-info-light text-info-foreground border border-info-border",
      en_proceso: "bg-warning-light text-warning-foreground border border-warning-border",
      finalizada: "bg-success-light text-success-foreground border border-success-border",
      cancelada: "bg-error-light text-error-foreground border border-error-border",
    };
    
    const statusText = status === "pendiente_aprobacion" ? "pendiente aprobación" : status.replace("_", " ");
    return <Badge className={statusClasses[status] || "bg-muted text-muted-foreground"}>{statusText}</Badge>;
  };

  const metrics = useMemo(() => ({
    totalOrders: orders.length,
    pending: orders.filter(o => o.status === "pendiente" || o.status === "en_proceso" || o.status === "en_camino" || o.status === "pendiente_aprobacion").length,
    quotesCount: quotes.length,
  }), [orders, quotes]);

  return (
    <AppLayout>
      <header className="mb-4">
        {/* H1 único (SEO) */}
        <h1 className="text-2xl md:text-3xl font-bold">Panel de Cliente</h1>
        <p className="text-muted-foreground">Crea y sigue tus solicitudes de forma sencilla.</p>
      </header>

      {/* Acciones principales optimizadas para móvil */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Button 
          onClick={() => setOpenNew(true)} 
          className="h-16 md:h-20 flex-col items-center justify-center px-4 bg-primary hover:bg-primary-hover text-primary-foreground shadow-colored"
        >
          <Plus className="mb-1" />
          <span className="text-xs md:text-sm font-medium">Nueva solicitud</span>
        </Button>
        <Button 
          variant="secondary" 
          onClick={() => { loadOrders(); loadQuotes(); }} 
          className="h-16 md:h-20 flex-col items-center justify-center px-4 bg-secondary hover:bg-hover text-secondary-foreground"
        >
          <RefreshCw className="mb-1" />
          <span className="text-xs md:text-sm font-medium">Actualizar</span>
        </Button>
        <Button 
          asChild 
          variant="outline" 
          className="h-16 md:h-20 flex-col items-center justify-center px-4 border-2 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
        >
          <Link to="/orders">
            <ClipboardList className="mb-1" />
            <span className="text-xs md:text-sm font-medium">Mis órdenes</span>
          </Link>
        </Button>
        <Button 
          asChild 
          variant="outline" 
          className="h-16 md:h-20 flex-col items-center justify-center px-4 border-2 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
        >
          <Link to="/quotes">
            <FileText className="mb-1" />
            <span className="text-xs md:text-sm font-medium">Mis cotizaciones</span>
          </Link>
        </Button>
      </section>

      {/* Resumen con colores mejorados */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-primary">Órdenes activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{metrics.pending}</p>
            <p className="text-sm text-muted-foreground">En curso o pendientes</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-info/5 to-info/10 border-info/20 hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-info">Total órdenes recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-info">{metrics.totalOrders}</p>
            <p className="text-sm text-muted-foreground">Últimas 5</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20 hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-success">Cotizaciones recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">{metrics.quotesCount}</p>
            <p className="text-sm text-muted-foreground">Últimas 5</p>
          </CardContent>
        </Card>
      </section>

      {/* Listas recientes con mejor diseño móvil */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Órdenes (realtime) */}
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/20">
            <CardTitle className="text-primary">Órdenes recientes</CardTitle>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              Tiempo real
            </Badge>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {orders.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Aún no tienes órdenes</p>
              </div>
            ) : (
              orders.map((o) => (
                <div 
                  key={o.id} 
                  className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                    o.status === 'pendiente_aprobacion' 
                      ? 'bg-warning-light/50 border-warning-border shadow-sm' 
                      : 'bg-card hover:bg-accent/50 border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-foreground">{o.order_number}</h4>
                    {statusBadge(o.status)}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {o.failure_description || "Sin descripción"}
                  </p>
                  {o.status === 'pendiente_aprobacion' && (
                    <div className="flex items-center gap-2 p-2 bg-warning-light rounded-md border border-warning-border">
                      <span className="text-lg">⚠️</span>
                      <p className="text-xs text-warning-foreground font-medium">
                        Requiere tu firma y aprobación
                      </p>
                    </div>
                  )}
                  {o.technician_profile && (
                    <div className="mt-2 p-2 bg-info-light rounded-md border border-info-border">
                      <p className="text-xs text-info-foreground font-medium">
                        Técnico: {o.technician_profile.full_name}
                      </p>
                      {o.assignment_reason && (
                        <p className="text-xs text-muted-foreground italic">
                          {o.assignment_reason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Cotizaciones */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-success/5 to-success/10 border-b border-success/20">
            <CardTitle className="text-success">Cotizaciones recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {quotes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Aún no tienes cotizaciones</p>
              </div>
            ) : (
              quotes.map((q) => (
                <div 
                  key={q.id} 
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 border-border transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-foreground">{q.quote_number}</h4>
                    <Badge variant="outline" className="text-xs">{q.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {q.service_description || "Sin descripción"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Sistema de Recompensas */}
      <section className="mt-6">
        <ClientRewardsCard />
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
