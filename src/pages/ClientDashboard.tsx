import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Gift, FileText, ClipboardList, Signature, CheckCircle, Clock, AlertCircle, Star, Copy, MessageCircle, Settings } from "lucide-react";
import { DeliverySignature } from "@/components/orders/DeliverySignature";
import { ClientOfficeChat } from "@/components/chat/ClientOfficeChat";
import { PasswordChangeForm } from "@/components/auth/PasswordChangeForm";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

// Tipos locales para órdenes y cotizaciones
interface Order {
  id: string;
  order_number: string;
  status: "pendiente" | "en_proceso" | "finalizada" | "cancelada" | "en_camino" | "pendiente_aprobacion" | "pendiente_entrega" | string;
  created_at: string;
  delivery_date?: string;
  failure_description?: string;
  assigned_technician?: string;
  assignment_reason?: string;
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
  status: "solicitud" | "enviada" | "aceptada" | "rechazada" | "seguimiento" | string;
  request_date?: string;
  created_at: string;
  service_description?: string;
}

/**
 * Panel Unificado de Cliente
 * Todo en una sola página: órdenes, cotizaciones y recompensas
 */
export default function ClientDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();

  // Estado UI
  const [loading, setLoading] = useState(true);
  const [orderToSign, setOrderToSign] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");

  // Datos
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [rewards, setRewards] = useState({
    totalCashback: 0,
    referralCode: "",
    isNewClient: true
  });

  // SEO básico por SPA
  useEffect(() => {
    document.title = "Panel de Cliente | Syslag";
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

  // Cargar cotizaciones del cliente
  const loadQuotes = async () => {
    if (!profile?.user_id) return;
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("client_email", profile.email)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading quotes:", error);
      toast({ title: "Error", description: "No se pudieron cargar cotizaciones", variant: "destructive" });
    } else {
      setQuotes((data as any) || []);
    }
  };

  // Cargar recompensas del cliente
  const loadRewards = async () => {
    if (!profile?.user_id || !profile?.email) return;
    
    try {
      // Buscar cliente por email del perfil
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('email', profile.email)
        .single();

      if (!client) {
        setRewards({
          totalCashback: 0,
          referralCode: "",
          isNewClient: true
        });
        return;
      }

      // Obtener datos reales de recompensas
      const { data: rewardsData } = await supabase
        .from('client_rewards')
        .select('*')
        .eq('client_id', client.id)
        .single();

      // Obtener código de referido si existe
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
      setRewards({
        totalCashback: 0,
        referralCode: "",
        isNewClient: true
      });
    }
  };

  // Cargar órdenes del cliente usando user_id
  const loadOrders = async () => {
    if (!profile?.user_id) return;
    
    // Buscar cliente por user_id
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
      .order("created_at", { ascending: false });

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
      await Promise.all([loadOrders(), loadQuotes(), loadRewards()]);
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
    const statusMap = {
      pendiente: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
      en_proceso: { label: "En Proceso", className: "bg-blue-100 text-blue-800 border-blue-300" },
      en_camino: { label: "En Camino", className: "bg-purple-100 text-purple-800 border-purple-300" },
      pendiente_entrega: { label: "Listo para firmar", className: "bg-green-100 text-green-800 border-green-300" },
      finalizada: { label: "Finalizada", className: "bg-gray-100 text-gray-800 border-gray-300" },
      cancelada: { label: "Cancelada", className: "bg-red-100 text-red-800 border-red-300" },
      solicitud: { label: "Solicitada", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
      enviada: { label: "Enviada", className: "bg-blue-100 text-blue-800 border-blue-300" },
      aceptada: { label: "Aceptada", className: "bg-green-100 text-green-800 border-green-300" },
      rechazada: { label: "Rechazada", className: "bg-red-100 text-red-800 border-red-300" },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, className: "bg-gray-100 text-gray-800 border-gray-300" };
    return <Badge className={statusInfo.className}>{statusInfo.label}</Badge>;
  };

  // Filtrar datos según búsqueda
  const filteredOrders = useMemo(() => 
    orders.filter(o => 
      o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.failure_description || "").toLowerCase().includes(searchTerm.toLowerCase())
    ), [orders, searchTerm]);

  const filteredQuotes = useMemo(() =>
    quotes.filter(q =>
      q.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.service_description || "").toLowerCase().includes(searchTerm.toLowerCase())
    ), [quotes, searchTerm]);

  const metrics = useMemo(() => ({
    totalOrders: orders.length,
    pending: orders.filter(o => o.status === "pendiente" || o.status === "en_proceso" || o.status === "en_camino").length,
    readyToSign: orders.filter(o => o.status === "pendiente_entrega").length,
    completed: orders.filter(o => o.status === "finalizada").length,
    quotesCount: quotes.length,
    quotesAccepted: quotes.filter(q => q.status === "aceptada").length,
  }), [orders, quotes]);

  // Función para crear nueva solicitud
  const handleNewRequest = (type: 'order' | 'quote') => {
    if (type === 'order') {
      window.location.href = '/orders?new=1';
    } else {
      window.location.href = '/quotes?new=1';
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground">Cargando tu información...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header con saludo personalizado */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 border border-primary/20">
          <h1 className="text-2xl md:text-3xl font-bold text-primary mb-2">
            ¡Hola, {profile?.full_name || 'Cliente'}! 👋
          </h1>
          <p className="text-muted-foreground">
            Gestiona tus servicios, cotizaciones y recompensas todo en un solo lugar
          </p>
        </div>

        {/* Botones de acción principales */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => handleNewRequest('order')}
            className="h-20 flex-col justify-center bg-gradient-to-r from-primary to-primary hover:shadow-xl transition-all duration-300"
            size="lg"
          >
            <Plus className="h-6 w-6 mb-2" />
            <span className="font-semibold">Nueva Orden</span>
            <span className="text-xs opacity-90">Reportar problema</span>
          </Button>
          <Button
            onClick={() => handleNewRequest('quote')}
            variant="outline"
            className="h-20 flex-col justify-center border-2 border-primary/30 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300"
            size="lg"
          >
            <FileText className="h-6 w-6 mb-2 text-primary" />
            <span className="font-semibold text-primary">Nueva Cotización</span>
            <span className="text-xs text-muted-foreground">Solicitar precio</span>
          </Button>
        </div>

        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 h-12 bg-muted/50">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Órdenes</span>
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Cotizaciones</span>
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Recompensas</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Ajustes</span>
            </TabsTrigger>
          </TabsList>

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar órdenes o cotizaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Contenido de tabs */}
          <TabsContent value="overview" className="space-y-6">
            {/* Métricas principales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4 text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl font-bold text-blue-700">{metrics.pending}</p>
                  <p className="text-sm text-blue-600">En Proceso</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold text-green-700">{metrics.completed}</p>
                  <p className="text-sm text-green-600">Completadas</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <p className="text-2xl font-bold text-purple-700">{metrics.quotesCount}</p>
                  <p className="text-sm text-purple-600">Cotizaciones</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardContent className="p-4 text-center">
                  <Star className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                  <p className="text-2xl font-bold text-orange-700">${rewards.totalCashback}</p>
                  <p className="text-sm text-orange-600">Cashback</p>
                </CardContent>
              </Card>
            </div>

            {/* Alerta de órdenes para firmar */}
            {metrics.readyToSign > 0 && (
              <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-8 w-8 text-yellow-600 animate-pulse" />
                    <div>
                      <h3 className="font-bold text-yellow-800">
                        ¡{metrics.readyToSign} orden(es) lista(s) para firmar!
                      </h3>
                      <p className="text-yellow-700">
                        Tienes servicios completados esperando tu confirmación
                      </p>
                    </div>
                    <Button
                      onClick={() => setActiveTab("orders")}
                      className="ml-auto bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      Ver Órdenes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actividad reciente */}
            <Card>
              <CardHeader>
                <CardTitle>Actividad Reciente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...orders.slice(0, 3), ...quotes.slice(0, 2)]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 5)
                  .map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        {'order_number' in item ? (
                          <ClipboardList className="h-5 w-5 text-primary" />
                        ) : (
                          <FileText className="h-5 w-5 text-green-600" />
                        )}
                        <div>
                          <p className="font-medium">
                            {'order_number' in item ? item.order_number : item.quote_number}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {statusBadge(item.status)}
                    </div>
                  ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <ClipboardList className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-xl font-semibold mb-2">No hay órdenes</h3>
                    <p className="text-muted-foreground mb-4">Aún no tienes órdenes de servicio</p>
                    <Button onClick={() => handleNewRequest('order')} className="bg-primary hover:bg-primary-hover">
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Primera Orden
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">{order.order_number}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {statusBadge(order.status)}
                      </div>
                      <p className="text-muted-foreground mb-4">
                        {order.failure_description || "Sin descripción"}
                      </p>
                      {order.status === 'pendiente_entrega' && (
                        <Button
                          onClick={() => setOrderToSign(order)}
                          className="w-full bg-primary hover:bg-primary-hover"
                        >
                          <Signature className="h-4 w-4 mr-2" />
                          Firmar Entrega
                        </Button>
                      )}
                      {order.technician_profile && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-800">
                            Técnico: {order.technician_profile.full_name}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="quotes" className="space-y-4">
            <div className="space-y-4">
              {filteredQuotes.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-xl font-semibold mb-2">No hay cotizaciones</h3>
                    <p className="text-muted-foreground mb-4">Aún no tienes cotizaciones solicitadas</p>
                    <Button onClick={() => handleNewRequest('quote')} variant="outline" className="border-primary text-primary hover:bg-primary/5">
                      <Plus className="h-4 w-4 mr-2" />
                      Solicitar Cotización
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredQuotes.map((quote) => (
                  <Card key={quote.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">{quote.quote_number}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(quote.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {statusBadge(quote.status)}
                      </div>
                      <p className="text-muted-foreground">
                        {quote.service_description || "Sin descripción"}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4">
            <div className="grid gap-6">
              {/* Tarjeta de recompensas principales */}
              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-700">
                    <Gift className="h-6 w-6" />
                    Mis Recompensas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-4 bg-white/60 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">${rewards.totalCashback}</p>
                    <p className="text-sm text-purple-600">Cashback Disponible</p>
                  </div>
                  
                  {rewards.isNewClient && (
                    <div className="p-4 bg-gradient-to-r from-green-100 to-blue-100 rounded-lg border border-green-300">
                      <h4 className="font-semibold text-green-800 mb-2">🎉 ¡Cliente Nuevo!</h4>
                      <p className="text-sm text-green-700">
                        Obtén 15% de descuento en tu primera orden de servicio
                      </p>
                    </div>
                  )}

                  {/* Código de referido */}
                  <div className="p-4 bg-white/60 rounded-lg">
                    <h4 className="font-semibold mb-2">Tu código de referido</h4>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-100 px-3 py-2 rounded text-sm font-mono flex-1">
                        {rewards.referralCode}
                      </code>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(rewards.referralCode);
                          toast({ title: "¡Copiado!", description: "Código copiado al portapapeles" });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Comparte tu código y obtén $200 por cada nuevo cliente referido
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Historial de recompensas */}
              <Card>
                <CardHeader>
                  <CardTitle>Historial de Recompensas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium text-green-800">Cashback por servicio</p>
                        <p className="text-sm text-green-600">Orden #ORD-2024-001</p>
                      </div>
                      <p className="font-bold text-green-700">+$125</p>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium text-blue-800">Bono cliente nuevo</p>
                        <p className="text-sm text-blue-600">Bienvenida</p>
                      </div>
                      <p className="font-bold text-blue-700">+$500</p>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                      <div>
                        <p className="font-medium text-purple-800">Referido exitoso</p>
                        <p className="text-sm text-purple-600">Juan Pérez</p>
                      </div>
                      <p className="font-bold text-purple-700">+$200</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <ClientOfficeChat />
          </TabsContent>

          {/* Tab Ajustes */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Cuenta</CardTitle>
                <CardDescription>
                  Gestiona la configuración de tu cuenta y seguridad
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h3 className="font-medium mb-2">Cambiar Contraseña</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Actualiza tu contraseña para mantener tu cuenta segura
                    </p>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4 mr-2" />
                          Cambiar Contraseña
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <PasswordChangeForm onClose={() => {}} />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Diálogo de firma */}
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
              toast({ title: "¡Entrega firmada!", description: "La orden ha sido marcada como completada" });
            }}
            onClose={() => setOrderToSign(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}