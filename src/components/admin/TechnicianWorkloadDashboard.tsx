/**
 * COMPONENTE: TechnicianWorkloadDashboard
 * 
 * PROPÓSITO:
 * - Dashboard administrativo para monitorear carga de trabajo de técnicos
 * - Visualizar distribución de órdenes y niveles de habilidad
 * - Identificar técnicos sobrecargados o subutilizados
 * - Proporcionar métricas para optimización de recursos
 * 
 * REUTILIZACIÓN:
 * - Panel de administración principal
 * - Módulo de recursos humanos
 * - Reportes de eficiencia operativa
 * - Herramientas de planificación de capacidad
 * 
 * MÉTRICAS INCLUIDAS:
 * - Carga de trabajo actual por técnico
 * - Distribución de habilidades por tipo de servicio
 * - Técnicos disponibles vs ocupados
 * - Estadísticas de utilización del sistema de sugerencias
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Activity, 
  Star, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Briefcase
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TechnicianWorkload {
  user_id: string;
  full_name: string;
  active_orders: number;
  avg_skill_level: number;
  total_skills: number;
  status: 'available' | 'busy' | 'overloaded';
}

interface ServiceTypeStats {
  service_type_id: string;
  service_name: string;
  technician_count: number;
  avg_skill_level: number;
  max_skill_level: number;
}

interface WorkloadStats {
  total_technicians: number;
  available_technicians: number;
  busy_technicians: number;
  overloaded_technicians: number;
  total_active_orders: number;
}

export function TechnicianWorkloadDashboard() {
  const [workloads, setWorkloads] = useState<TechnicianWorkload[]>([]);
  const [serviceStats, setServiceStats] = useState<ServiceTypeStats[]>([]);
  const [stats, setStats] = useState<WorkloadStats>({
    total_technicians: 0,
    available_technicians: 0,
    busy_technicians: 0,
    overloaded_technicians: 0,
    total_active_orders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * FUNCIÓN: loadDashboardData
   * 
   * PROPÓSITO:
   * - Cargar todos los datos necesarios para el dashboard
   * - Calcular estadísticas agregadas
   * - Determinar estado de cada técnico
   */
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Cargar carga de trabajo de técnicos
      await loadTechnicianWorkloads();
      
      // Cargar estadísticas por tipo de servicio
      await loadServiceTypeStats();
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * FUNCIÓN: loadTechnicianWorkloads
   * 
   * PROPÓSITO:
   * - Obtener carga de trabajo actual de cada técnico
   * - Calcular nivel promedio de habilidades
   * - Determinar estado operativo
   */
  const loadTechnicianWorkloads = async () => {
    const { data: technicians, error: techError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('role', 'tecnico');

    if (techError) throw techError;

    const workloadData: TechnicianWorkload[] = [];
    let totalActiveOrders = 0;

    for (const tech of technicians || []) {
      // Contar órdenes activas
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('assigned_technician', tech.user_id)
        .in('status', ['pendiente', 'en_proceso', 'en_camino']);

      const activeOrders = orders?.length || 0;
      totalActiveOrders += activeOrders;

      // Obtener estadísticas de habilidades
      const { data: skills } = await supabase
        .from('technician_skills')
        .select('skill_level')
        .eq('technician_id', tech.user_id);

      const totalSkills = skills?.length || 0;
      const avgSkillLevel = totalSkills > 0 
        ? skills!.reduce((sum, skill) => sum + skill.skill_level, 0) / totalSkills 
        : 0;

      // Determinar estado
      let status: 'available' | 'busy' | 'overloaded' = 'available';
      if (activeOrders >= 6) status = 'overloaded';
      else if (activeOrders >= 3) status = 'busy';

      workloadData.push({
        user_id: tech.user_id,
        full_name: tech.full_name,
        active_orders: activeOrders,
        avg_skill_level: avgSkillLevel,
        total_skills: totalSkills,
        status
      });
    }

    setWorkloads(workloadData);

    // Calcular estadísticas generales
    const totalTechnicians = workloadData.length;
    const availableTechnicians = workloadData.filter(w => w.status === 'available').length;
    const busyTechnicians = workloadData.filter(w => w.status === 'busy').length;
    const overloadedTechnicians = workloadData.filter(w => w.status === 'overloaded').length;

    setStats({
      total_technicians: totalTechnicians,
      available_technicians: availableTechnicians,
      busy_technicians: busyTechnicians,
      overloaded_technicians: overloadedTechnicians,
      total_active_orders: totalActiveOrders
    });
  };

  /**
   * FUNCIÓN: loadServiceTypeStats
   * 
   * PROPÓSITO:
   * - Analizar distribución de habilidades por tipo de servicio
   * - Identificar servicios con poca cobertura técnica
   */
  const loadServiceTypeStats = async () => {
    const { data, error } = await supabase
      .from('technician_skills')
      .select(`
        service_type_id,
        skill_level,
        service_types:service_type_id(name)
      `);

    if (error) throw error;

    // Agrupar por tipo de servicio
    const serviceMap = new Map<string, {
      name: string;
      skills: number[];
    }>();

    data?.forEach(skill => {
      const serviceId = skill.service_type_id;
      const serviceName = (skill.service_types as any)?.name || 'Desconocido';
      
      if (!serviceMap.has(serviceId)) {
        serviceMap.set(serviceId, { name: serviceName, skills: [] });
      }
      
      serviceMap.get(serviceId)!.skills.push(skill.skill_level);
    });

    // Calcular estadísticas por servicio
    const serviceStatsData: ServiceTypeStats[] = Array.from(serviceMap.entries()).map(([id, data]) => ({
      service_type_id: id,
      service_name: data.name,
      technician_count: data.skills.length,
      avg_skill_level: data.skills.reduce((sum, level) => sum + level, 0) / data.skills.length,
      max_skill_level: Math.max(...data.skills)
    }));

    setServiceStats(serviceStatsData.sort((a, b) => b.avg_skill_level - a.avg_skill_level));
  };

  /**
   * FUNCIÓN: getStatusColor
   * 
   * PROPÓSITO:
   * - Determinar color del badge según estado del técnico
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'overloaded': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * FUNCIÓN: getStatusIcon
   * 
   * PROPÓSITO:
   * - Obtener icono apropiado para cada estado
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="h-4 w-4" />;
      case 'busy': return <Activity className="h-4 w-4" />;
      case 'overloaded': return <AlertTriangle className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas Generales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Técnicos</p>
                <p className="text-2xl font-bold">{stats.total_technicians}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Disponibles</p>
                <p className="text-2xl font-bold text-green-600">{stats.available_technicians}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ocupados</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.busy_technicians}</p>
              </div>
              <Activity className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sobrecargados</p>
                <p className="text-2xl font-bold text-red-600">{stats.overloaded_technicians}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {stats.overloaded_technicians > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Atención:</strong> {stats.overloaded_technicians} técnico(s) están sobrecargados. 
            Considera redistribuir órdenes o contratar personal adicional.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carga de Trabajo por Técnico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Carga de Trabajo por Técnico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {workloads.map((workload) => (
              <div key={workload.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{workload.full_name}</h4>
                    <Badge className={`${getStatusColor(workload.status)} border-0`}>
                      {getStatusIcon(workload.status)}
                      <span className="ml-1 capitalize">{workload.status}</span>
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{workload.active_orders} órdenes activas</span>
                    <span>{workload.total_skills} habilidades</span>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span>{workload.avg_skill_level.toFixed(1)} promedio</span>
                    </div>
                  </div>
                  
                  <Progress 
                    value={Math.min((workload.active_orders / 10) * 100, 100)} 
                    className="h-2 mt-2"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Estadísticas por Tipo de Servicio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cobertura por Tipo de Servicio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {serviceStats.map((service) => (
              <div key={service.service_type_id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium mb-1">{service.service_name}</h4>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{service.technician_count} técnicos</span>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span>Promedio: {service.avg_skill_level.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-green-500" />
                      <span>Máximo: {service.max_skill_level}</span>
                    </div>
                  </div>
                  
                  <Progress 
                    value={(service.avg_skill_level / 5) * 100} 
                    className="h-2 mt-2"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}