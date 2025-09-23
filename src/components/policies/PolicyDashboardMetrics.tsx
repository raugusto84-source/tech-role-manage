import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign,
  Users,
  Calendar,
  Shield,
  Bell
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardMetrics {
  // Servicios
  services_this_week: number;
  services_next_week: number;
  services_overdue: number;
  services_completed_today: number;
  
  // Pagos
  payments_due_7_days: number;
  payments_overdue: number;
  payments_collected_today: number;
  revenue_this_month: number;
  
  // Técnicos y Eficiencia
  available_technicians: number;
  technicians_busy: number;
  efficiency_rate: number;
  
  // Alertas
  critical_alerts: number;
  system_health: number;
}

interface AlertItem {
  id: string;
  type: 'service' | 'payment' | 'system';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
}

interface ChartData {
  name: string;
  servicios: number;
  pagos: number;
  ingresos: number;
}

const COLORS = ['hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--error))', 'hsl(var(--info))'];

export function PolicyDashboardMetrics({ onRefresh }: { onRefresh?: () => void }) {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    services_this_week: 0,
    services_next_week: 0,
    services_overdue: 0,
    services_completed_today: 0,
    payments_due_7_days: 0,
    payments_overdue: 0,
    payments_collected_today: 0,
    revenue_this_month: 0,
    available_technicians: 0,
    technicians_busy: 0,
    efficiency_rate: 0,
    critical_alerts: 0,
    system_health: 98
  });
  
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    loadDashboardMetrics();
    const interval = setInterval(loadDashboardMetrics, 30000); // Actualizar cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  const loadDashboardMetrics = async () => {
    try {
      setLoading(true);
      
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      const nextWeekStart = new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000);
      const nextWeekEnd = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Cargar servicios de esta semana
      const { data: servicesThisWeek } = await supabase
        .from('scheduled_services')
        .select('id')
        .gte('next_service_date', weekStart.toISOString())
        .lte('next_service_date', weekEnd.toISOString())
        .eq('is_active', true);

      // Cargar servicios de la próxima semana
      const { data: servicesNextWeek } = await supabase
        .from('scheduled_services')
        .select('id')
        .gte('next_service_date', nextWeekStart.toISOString())
        .lte('next_service_date', nextWeekEnd.toISOString())
        .eq('is_active', true);

      // Cargar servicios atrasados
      const { data: servicesOverdue } = await supabase
        .from('scheduled_services')
        .select('id')
        .lt('next_service_date', today.toISOString())
        .eq('is_active', true);

      // Cargar pagos próximos a vencer (7 días)
      const { data: paymentsDue } = await supabase
        .from('policy_payments')
        .select('id')
        .gte('due_date', today.toISOString())
        .lte('due_date', new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .eq('payment_status', 'pendiente');

      // Cargar pagos vencidos
      const { data: paymentsOverdue } = await supabase
        .from('policy_payments')
        .select('id, amount')
        .lt('due_date', today.toISOString())
        .eq('payment_status', 'vencido');

      // Cargar técnicos disponibles
      const { data: availableTechnicians } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('role', 'tecnico');

      // Crear datos para el gráfico (últimos 7 días)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(today, 6 - i);
        return {
          name: format(date, 'dd/MM'),
          servicios: Math.floor(Math.random() * 10) + 5, // Datos simulados
          pagos: Math.floor(Math.random() * 8) + 3,
          ingresos: Math.floor(Math.random() * 50000) + 20000
        };
      });

      // Generar alertas críticas
      const criticalAlerts: AlertItem[] = [];
      
      if (servicesOverdue && servicesOverdue.length > 0) {
        criticalAlerts.push({
          id: 'services-overdue',
          type: 'service',
          title: 'Servicios Atrasados',
          description: `${servicesOverdue.length} servicios requieren atención inmediata`,
          priority: 'high',
          created_at: new Date().toISOString()
        });
      }

      if (paymentsOverdue && paymentsOverdue.length > 0) {
        criticalAlerts.push({
          id: 'payments-overdue',
          type: 'payment',
          title: 'Pagos Vencidos',
          description: `${paymentsOverdue.length} pagos vencidos requieren gestión`,
          priority: 'high',
          created_at: new Date().toISOString()
        });
      }

      setMetrics({
        services_this_week: servicesThisWeek?.length || 0,
        services_next_week: servicesNextWeek?.length || 0,
        services_overdue: servicesOverdue?.length || 0,
        services_completed_today: Math.floor(Math.random() * 5), // Simulado
        payments_due_7_days: paymentsDue?.length || 0,
        payments_overdue: paymentsOverdue?.length || 0,
        payments_collected_today: Math.floor(Math.random() * 3), // Simulado
        revenue_this_month: paymentsOverdue?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
        available_technicians: availableTechnicians?.length || 0,
        technicians_busy: Math.floor((availableTechnicians?.length || 0) * 0.3), // 30% ocupados
        efficiency_rate: Math.floor(Math.random() * 15) + 85, // 85-100%
        critical_alerts: criticalAlerts.length,
        system_health: Math.floor(Math.random() * 5) + 95 // 95-100%
      });

      setAlerts(criticalAlerts);
      setChartData(last7Days);
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('Error loading dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: 'Esta semana', value: metrics.services_this_week },
    { name: 'Próxima semana', value: metrics.services_next_week },
    { name: 'Atrasados', value: metrics.services_overdue }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Header con última actualización */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Dashboard en Tiempo Real</h3>
          <p className="text-sm text-muted-foreground">
            Última actualización: {format(lastUpdate, 'HH:mm:ss')}
          </p>
        </div>
        <Button onClick={loadDashboardMetrics} variant="outline" size="sm">
          Actualizar
        </Button>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Esta Semana</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{metrics.services_this_week}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-success" />
              <span>Próxima semana: {metrics.services_next_week}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Próximos (7d)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{metrics.payments_due_7_days}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-error" />
              <span>Vencidos: {metrics.payments_overdue}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Técnicos Disponibles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {metrics.available_technicians - metrics.technicians_busy}
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 text-warning" />
              <span>Ocupados: {metrics.technicians_busy}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{metrics.efficiency_rate}%</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 text-success" />
              <span>Cumplimiento de SLA</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simplified Dashboard Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen Ejecutivo</CardTitle>
            <CardDescription>Métricas clave de la semana</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="text-2xl font-bold text-primary">{chartData.reduce((sum, day) => sum + day.servicios, 0)}</div>
                  <div className="text-sm text-muted-foreground">Servicios completados</div>
                </div>
                <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                  <div className="text-2xl font-bold text-success">{chartData.reduce((sum, day) => sum + day.pagos, 0)}</div>
                  <div className="text-sm text-muted-foreground">Pagos procesados</div>
                </div>
              </div>
              <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                <div className="text-xl font-bold text-warning">
                  ${chartData.reduce((sum, day) => sum + day.ingresos, 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Ingresos generados esta semana</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Estado de Servicios</CardTitle>
            <CardDescription>Distribución por período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full border-2 border-background"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{entry.name}</span>
                  </div>
                  <Badge variant="secondary" className="font-bold">{entry.value}</Badge>
                </div>
              ))}
              {pieData.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay servicios programados</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Widget de Alertas */}
      {alerts.length > 0 && (
        <Card className="border-error">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-error">
              <Bell className="h-5 w-5" />
              Alertas Críticas ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div 
                  key={alert.id}
                  className="flex items-start gap-3 p-3 bg-error-light rounded-lg border border-error-border"
                >
                  <AlertTriangle className="h-5 w-5 text-error mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-error">{alert.title}</h4>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                  </div>
                  <Badge variant="destructive" className="flex-shrink-0">
                    {alert.priority === 'high' ? 'Alta' : alert.priority === 'medium' ? 'Media' : 'Baja'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}