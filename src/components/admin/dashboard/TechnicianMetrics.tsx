import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Users, Wrench, MessageCircle, Clock } from 'lucide-react';

interface TechnicianData {
  totalTechnicians: number;
  activeOrders: number;
  pendingOrders: number;
  ordersWithNewChat: number;
  technicianWorkload: Array<{
    id: string;
    full_name: string;
    activeOrders: number;
    workedHours: number;
    idleHours: number;
    workloadPercentage: number;
  }>;
}

interface TechnicianMetricsProps {
  compact?: boolean;
}

export function TechnicianMetrics({ compact = false }: TechnicianMetricsProps) {
  const [data, setData] = useState<TechnicianData>({
    totalTechnicians: 0,
    activeOrders: 0,
    pendingOrders: 0,
    ordersWithNewChat: 0,
    technicianWorkload: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTechnicianData();
  }, []);

  const loadTechnicianData = async () => {
    try {
      // Get all technicians
      const { data: technicians } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('role', 'tecnico');

      // Get active orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, assigned_technician')
        .in('status', ['pendiente', 'en_proceso', 'en_camino']);

      // Mock recent chat data
      const recentChats = [
        { order_id: '1' },
        { order_id: '2' }
      ];

      // Get today's time records
      const today = new Date().toISOString().split('T')[0];
      const { data: timeRecords } = await supabase
        .from('time_records')
        .select('employee_id, total_hours')
        .eq('work_date', today)
        .eq('status', 'checked_out');

      const activeOrders = orders?.filter(o => o.status === 'en_proceso' || o.status === 'en_camino').length || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pendiente').length || 0;
      const ordersWithNewChat = new Set(recentChats.map(c => c.order_id)).size;

      // Calculate workload for each technician
      const technicianWorkload = technicians?.map(tech => {
        const techOrders = orders?.filter(o => o.assigned_technician === tech.user_id).length || 0;
        const workedHours = timeRecords?.find(tr => tr.employee_id === tech.user_id)?.total_hours || 0;
        const idleHours = Math.max(0, 8 - workedHours); // Assuming 8-hour workday
        const workloadPercentage = (techOrders / Math.max(1, (technicians?.length || 1))) * 100;

        return {
          id: tech.user_id,
          full_name: tech.full_name,
          activeOrders: techOrders,
          workedHours,
          idleHours,
          workloadPercentage
        };
      }) || [];

      setData({
        totalTechnicians: technicians?.length || 0,
        activeOrders,
        pendingOrders,
        ordersWithNewChat,
        technicianWorkload
      });
    } catch (error) {
      console.error('Error loading technician data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Técnicos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.activeOrders}</div>
          <p className="text-xs text-muted-foreground">
            Órdenes activas
          </p>
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              {data.pendingOrders} pendientes
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Técnicos</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalTechnicians}</div>
            <p className="text-xs text-muted-foreground">
              Técnicos activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Activas</CardTitle>
            <Wrench className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.activeOrders}</div>
            <p className="text-xs text-muted-foreground">
              En proceso/camino
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{data.pendingOrders}</div>
            <p className="text-xs text-muted-foreground">
              Sin asignar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chat Nuevo</CardTitle>
    
            <MessageCircle className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{data.ordersWithNewChat}</div>
            <p className="text-xs text-muted-foreground">
              Mensajes recientes
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Carga de Trabajo por Técnico</CardTitle>
          <CardDescription>Horas trabajadas vs disponibles hoy</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.technicianWorkload.map(tech => (
              <div key={tech.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{tech.full_name}</span>
                  <div className="flex gap-2">
                    <Badge variant="outline">{tech.activeOrders} órdenes</Badge>
                    <Badge variant="secondary">{tech.workedHours.toFixed(1)}h trabajadas</Badge>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Progress value={(tech.workedHours / 8) * 100} className="flex-1" />
                  <span className="text-sm text-muted-foreground">
                    {tech.idleHours.toFixed(1)}h libres
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}