import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  FileText, 
  ClipboardList, 
  Signature, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Star, 
  Gift,
  ArrowRight,
  Zap,
  TrendingUp,
  CalendarDays
} from "lucide-react";
import { DeliverySignature } from "@/components/orders/DeliverySignature";
import { NewRequestDialog } from "@/components/client/NewRequestDialog";

// Tipos locales
interface Order {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  delivery_date?: string;
  failure_description?: string;
  assigned_technician?: string;
  clients?: {
    name: string;
    email?: string;
  } | null;
  technician_profile?: {
    full_name: string;
  } | null;
}

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  created_at: string;
  service_description?: string;
}

export default function ClientDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();

  // Estado
  const [loading, setLoading] = useState(true);
  const [orderToSign, setOrderToSign] = useState<Order | null>(null);
  const [showNewRequestDialog, setShowNewRequestDialog] = useState(false);

  // Datos
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [rewards, setRewards] = useState({
    totalCashback: 0,
    referralCode: "",
    isNewClient: true
  });

  // SEO y metadatos
  useEffect(() => {
    document.title = "Mi Panel | Syslag";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "Panel principal de cliente Syslag - Gestiona tus servicios y solicitudes");
    } else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = "Panel principal de cliente Syslag - Gestiona tus servicios y solicitudes";
      document.head.appendChild(m);
    }
  }, []);

  // Funciones de carga de datos
  const loadQuotes = async () => {
    if (!profile?.email) return;
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("client_email", profile.email)
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (error) {
      console.error("Error loading quotes:", error);
    } else {
      setQuotes(data || []);
    }
  };

  const loadRewards = async () => {
    if (!profile?.email) return;
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('email', profile.email)
        .single();
      
      if (!client) {
        setRewards({ totalCashback: 0, referralCode: "", isNewClient: true });
        return;
      }

      const { data: rewardsData } = await supabase
        .from('client_rewards')
        .select('*')
        .eq('client_id', client.id)
        .single();

      const { data: referralData } = await supabase
        .from('client_referrals')
        .select('referral_code')
        .eq('referrer_client_id', client.id)
        .single();

      setRewards({
        totalCashback: rewardsData?.total_cashback || 0,
        referralCode: referralData?.referral_code || "",
        isNewClient: rewardsData?.is_new_client || true
      });
    } catch (error) {
      console.error('Error loading rewards:', error);
      setRewards({ totalCashback: 0, referralCode: "", isNewClient: true });
    }
  };

  const loadOrders = async () => {
    if (!profile?.user_id) return;

    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", profile.user_id)
      .maybeSingle();
    
    if (clientErr || !client) {
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
      return;
    }

    const ordersWithTechnicianNames = await Promise.all(
      (ordersData || []).map(async (order: any) => {
        if (order.assigned_technician) {
          const { data: techProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', order.assigned_technician)
            .maybeSingle();
          return { ...order, technician_profile: techProfile };
        }
        return { ...order, technician_profile: null };
      })
    );
    
    setOrders(ordersWithTechnicianNames);
  };

  // Carga inicial
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadOrders(), loadQuotes(), loadRewards()]);
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [profile?.user_id]);

  // Suscripción en tiempo real
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

      channel = supabase
        .channel("client-orders-realtime")
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `client_id=eq.${client.id}`
        }, () => loadOrders())
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [profile?.user_id]);

  // Utilidades
  const statusBadge = (status: string) => {
    const statusMap = {
      pendiente: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800" },
      en_proceso: { label: "En Proceso", className: "bg-blue-100 text-blue-800" },
      en_camino: { label: "En Camino", className: "bg-purple-100 text-purple-800" },
      pendiente_entrega: { label: "Listo", className: "bg-green-100 text-green-800" },
      finalizada: { label: "Completada", className: "bg-gray-100 text-gray-800" },
      cancelada: { label: "Cancelada", className: "bg-red-100 text-red-800" },
      solicitud: { label: "Solicitada", className: "bg-yellow-100 text-yellow-800" },
      enviada: { label: "Enviada", className: "bg-blue-100 text-blue-800" },
      aceptada: { label: "Aceptada", className: "bg-green-100 text-green-800" },
      rechazada: { label: "Rechazada", className: "bg-red-100 text-red-800" }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || {
      label: status,
      className: "bg-gray-100 text-gray-800"
    };
    
    return <Badge className={statusInfo.className}>{statusInfo.label}</Badge>;
  };

  // Métricas calculadas
  const metrics = useMemo(() => ({
    pendingOrders: orders.filter(o => 
      ['pendiente', 'en_proceso', 'en_camino'].includes(o.status)
    ).length,
    readyToSign: orders.filter(o => o.status === 'pendiente_entrega').length,
    completedOrders: orders.filter(o => o.status === 'finalizada').length,
    activeQuotes: quotes.filter(q => 
      ['solicitud', 'enviada'].includes(q.status)
    ).length,
  }), [orders, quotes]);

  // Funciones de navegación
  const handleNewRequest = () => {
    setShowNewRequestDialog(true);
  };

  const handleViewAll = (type: 'orders' | 'quotes') => {
    window.location.href = `/${type}`;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground">Cargando tu panel...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-md mx-auto space-y-4">
        {/* Header con saludo */}
        <div className="text-center space-y-2 py-4">
          <Avatar className="h-16 w-16 mx-auto">
            <AvatarImage src="" />
            <AvatarFallback className="text-xl bg-primary/10 text-primary">
              {profile?.full_name?.charAt(0) || 'C'}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-bold">
            ¡Hola, {profile?.full_name?.split(' ')[0] || 'Cliente'}! 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            ¿Qué podemos hacer por ti hoy?
          </p>
        </div>

        {/* Alertas importantes */}
        {metrics.readyToSign > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <Signature className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-orange-800">
                    {metrics.readyToSign} servicio{metrics.readyToSign > 1 ? 's' : ''} listo{metrics.readyToSign > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-orange-600">Toca para firmar entrega</p>
                </div>
                <Button size="sm" variant="outline" className="border-orange-200 text-orange-600">
                  Firmar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botones de acción principales */}
        <div className="grid grid-cols-3 gap-2">
          <Button 
            onClick={() => handleNewRequest()}
            className="h-20 flex-col gap-1 bg-primary hover:bg-primary/90"
            size="sm"
          >
            <div className="h-6 w-6 bg-white/20 rounded-full flex items-center justify-center">
              <Plus className="h-3 w-3" />
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold">Servicio</div>
              <div className="text-[10px] opacity-90">Rápido</div>
            </div>
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/orders?new=1'}
            variant="outline"
            className="h-20 flex-col gap-1 border-2"
            size="sm"
          >
            <div className="h-6 w-6 bg-green-100 rounded-full flex items-center justify-center">
              <Zap className="h-3 w-3 text-green-600" />
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold">Orden</div>
              <div className="text-[10px] text-muted-foreground">Completa</div>
            </div>
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/quotes'}
            variant="outline"
            className="h-20 flex-col gap-1 border-2"
            size="sm"
          >
            <div className="h-6 w-6 bg-primary/10 rounded-full flex items-center justify-center">
              <FileText className="h-3 w-3 text-primary" />
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold">Cotización</div>
              <div className="text-[10px] text-muted-foreground">Solicitar precio</div>
            </div>
          </Button>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 mx-auto mb-1 text-blue-600" />
              <p className="text-xl font-bold text-blue-700">{metrics.pendingOrders}</p>
              <p className="text-xs text-blue-600">En proceso</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 mx-auto mb-1 text-green-600" />
              <p className="text-xl font-bold text-green-700">{metrics.completedOrders}</p>
              <p className="text-xs text-green-600">Completadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Cashback */}
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Gift className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-semibold text-yellow-800">Tu Cashback</p>
                  <p className="text-xl font-bold text-yellow-700">${rewards.totalCashback}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="border-yellow-300 text-yellow-700">
                <Star className="h-3 w-3 mr-1" />
                Ver más
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Actividad reciente */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Actividad Reciente</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {[...orders.slice(0, 2), ...quotes.slice(0, 2)]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 3)
              .map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    {'order_number' in item ? (
                      <ClipboardList className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-green-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {'order_number' in item ? item.order_number : item.quote_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {statusBadge(item.status)}
                </div>
              ))
            }
            
            {orders.length === 0 && quotes.length === 0 && (
              <div className="text-center py-6">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No hay actividad reciente</p>
                <p className="text-xs text-muted-foreground">¡Crea tu primer servicio!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enlaces rápidos */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="ghost" 
            className="h-12 justify-between"
            onClick={() => handleViewAll('orders')}
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span>Mis Órdenes</span>
            </div>
            <ArrowRight className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            className="h-12 justify-between"
            onClick={() => handleViewAll('quotes')}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Cotizaciones</span>
            </div>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Pie de página con versión */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Syslag App • Versión 2.0
          </p>
        </div>
      </div>

      {/* Diálogos */}
      {orderToSign && (
        <DeliverySignature 
          order={{
            id: orderToSign.id,
            order_number: orderToSign.order_number,
            clients: orderToSign.clients
          }} 
          onComplete={() => {
            setOrderToSign(null);
            loadOrders();
            toast({
              title: "¡Entrega firmada!",
              description: "El servicio ha sido marcado como completado"
            });
          }} 
          onClose={() => setOrderToSign(null)} 
        />
      )}
      
      {showNewRequestDialog && (
        <NewRequestDialog
          open={showNewRequestDialog}
          onOpenChange={(open) => {
            setShowNewRequestDialog(open);
          }}
        />
      )}
    </AppLayout>
  );
}