import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Activity,
  BarChart3,
  Users,
  Timer,
  AlertCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface OrderTracking {
  id: string;
  order_id: string;
  status_stage: string;
  started_at: string;
  completed_at?: string;
  hours_elapsed: number;
  sla_status: string;
  orders: {
    order_number: string;
    clients: { name: string };
    profiles?: { full_name: string }[];
  };
}

interface SLAMetrics {
  total_orders: number;
  on_time: number;
  warning: number;
  exceeded: number;
  avg_completion_time: number;
}

export function OrderProcessDashboard() {
  const [activeTracking, setActiveTracking] = useState<OrderTracking[]>([]);
  const [metrics, setMetrics] = useState<SLAMetrics>({
    total_orders: 0,
    on_time: 0,
    warning: 0,
    exceeded: 0,
    avg_completion_time: 0
  });
  const [recentActivity, setRecentActivity] = useState<OrderTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      await Promise.all([
        loadActiveTracking(),
        loadMetrics(),
        loadRecentActivity()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadActiveTracking = async () => {
    const { data, error } = await supabase
      .from('order_process_tracking')
      .select(`
        *,
        orders!inner(
          order_number,
          clients(name),
          profiles(full_name)
        )
      `)
      .is('completed_at', null)
      .order('hours_elapsed', { ascending: false });

    if (error) throw error;
    setActiveTracking(data || []);
  };

  const loadMetrics = async () => {
    // Get metrics for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('order_process_tracking')
      .select('sla_status, hours_elapsed')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (error) throw error;

    const totalOrders = data?.length || 0;
    const onTime = data?.filter(d => d.sla_status === 'on_time').length || 0;
    const warning = data?.filter(d => d.sla_status === 'warning').length || 0;
    const exceeded = data?.filter(d => d.sla_status === 'exceeded').length || 0;
    const avgTime = totalOrders > 0 
      ? data?.reduce((sum, d) => sum + (d.hours_elapsed || 0), 0) / totalOrders 
      : 0;

    setMetrics({
      total_orders: totalOrders,
      on_time: onTime,
      warning: warning,
      exceeded: exceeded,
      avg_completion_time: avgTime
    });
  };

  const loadRecentActivity = async () => {
    const { data, error } = await supabase
      .from('order_process_tracking')
      .select(`
        *,
        orders!inner(
          order_number,
          clients(name),
          profiles(full_name)
        )
      `)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    setRecentActivity(data || []);
  };

  const getSLAStatusBadge = (status: string, hoursElapsed: number) => {
    const badges = {
      on_time: <Badge className="bg-green-500 text-white">A Tiempo</Badge>,
      warning: <Badge className="bg-yellow-500 text-white">Advertencia</Badge>,
      exceeded: <Badge className="bg-red-500 text-white">Vencido</Badge>
    };
    
    return badges[status as keyof typeof badges] || badges.on_time;
  };

  const getStatusProgress = (status: string) => {
    const progressValues = {
      on_time: 100,
      warning: 75,
      exceeded: 25
    };
    
    return progressValues[status as keyof typeof progressValues] || 100;
  };

  const formatTimeElapsed = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    } else if (hours < 24) {
      return `${Math.round(hours)} h`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return `${days}d ${remainingHours}h`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard de Seguimiento de Procesos</h2>
          <p className="text-muted-foreground">
            Monitoreo en tiempo real del rendimiento y SLA de órdenes
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline" size="sm">
          <Activity className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Activas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTracking.length}</div>
            <p className="text-xs text-muted-foreground">
              En proceso actualmente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rendimiento SLA</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics.total_orders > 0 ? Math.round((metrics.on_time / metrics.total_orders) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Cumplimiento últimos 30 días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTimeElapsed(metrics.avg_completion_time)}
            </div>
            <p className="text-xs text-muted-foreground">
              Por etapa completada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Activas</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {activeTracking.filter(t => t.sla_status !== 'on_time').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Órdenes Activas</TabsTrigger>
          <TabsTrigger value="recent">Actividad Reciente</TabsTrigger>
          <TabsTrigger value="metrics">Métricas Detalladas</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Órdenes en Proceso
              </CardTitle>
              <CardDescription>
                Seguimiento en tiempo real de órdenes activas y su estado SLA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Etapa Actual</TableHead>
                    <TableHead>Tiempo Transcurrido</TableHead>
                    <TableHead>Estado SLA</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Técnico</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTracking.map((tracking) => (
                    <TableRow key={tracking.id}>
                      <TableCell className="font-medium">
                        {tracking.orders.order_number}
                      </TableCell>
                      <TableCell>
                        {tracking.orders.clients?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tracking.status_stage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatTimeElapsed(tracking.hours_elapsed)}
                        <div className="text-xs text-muted-foreground">
                          Desde {formatDistanceToNow(new Date(tracking.started_at), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getSLAStatusBadge(tracking.sla_status, tracking.hours_elapsed)}
                      </TableCell>
                      <TableCell>
                        <Progress 
                          value={getStatusProgress(tracking.sla_status)} 
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        {tracking.orders.profiles?.[0]?.full_name || 'Sin asignar'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {activeTracking.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No hay órdenes activas en seguimiento
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Actividad Reciente
              </CardTitle>
              <CardDescription>
                Órdenes completadas recientemente y su rendimiento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Tiempo Total</TableHead>
                    <TableHead>Completado</TableHead>
                    <TableHead>Estado Final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium">
                        {activity.orders.order_number}
                      </TableCell>
                      <TableCell>
                        {activity.orders.clients?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {activity.status_stage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatTimeElapsed(activity.hours_elapsed)}
                      </TableCell>
                      <TableCell>
                        {activity.completed_at && formatDistanceToNow(new Date(activity.completed_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </TableCell>
                      <TableCell>
                        {getSLAStatusBadge(activity.sla_status, activity.hours_elapsed)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {recentActivity.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No hay actividad reciente
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Distribución de SLA
                </CardTitle>
                <CardDescription>
                  Últimos 30 días
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">A Tiempo</span>
                    <span className="text-sm font-medium">{metrics.on_time}</span>
                  </div>
                  <Progress value={(metrics.on_time / Math.max(metrics.total_orders, 1)) * 100} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Advertencia</span>
                    <span className="text-sm font-medium">{metrics.warning}</span>
                  </div>
                  <Progress value={(metrics.warning / Math.max(metrics.total_orders, 1)) * 100} className="h-2 bg-yellow-200" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Vencido</span>
                    <span className="text-sm font-medium">{metrics.exceeded}</span>
                  </div>
                  <Progress value={(metrics.exceeded / Math.max(metrics.total_orders, 1)) * 100} className="h-2 bg-red-200" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Estadísticas Generales
                </CardTitle>
                <CardDescription>
                  Resumen de rendimiento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total de Órdenes:</span>
                  <span className="font-medium">{metrics.total_orders}</span>
                </div>
                <div className="flex justify-between">
                  <span>Promedio Completado:</span>
                  <span className="font-medium">{formatTimeElapsed(metrics.avg_completion_time)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tasa de Éxito:</span>
                  <span className="font-medium text-green-600">
                    {metrics.total_orders > 0 ? Math.round((metrics.on_time / metrics.total_orders) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Requiere Atención:</span>
                  <span className="font-medium text-red-600">
                    {activeTracking.filter(t => t.sla_status !== 'on_time').length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}