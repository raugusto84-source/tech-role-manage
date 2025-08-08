import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Star, TrendingUp, TrendingDown, Users } from 'lucide-react';

// Tipos para TypeScript
interface ServiceType {
  id: string;
  name: string;
  description: string;
}

interface TechnicianSkill {
  id: string;
  technician_id: string;
  service_type_id: string;
  skill_level: number;
  years_experience: number;
  certifications: string[];
  notes?: string;
  service_type?: ServiceType;
}

interface Technician {
  user_id: string;
  full_name: string;
  email: string;
}

interface ServiceStats {
  service_type_id: string;
  service_name: string;
  total_orders: number;
  successful_orders: number;
  failed_orders: number;
  success_rate: number;
  calculated_skill_level: number;
}

interface ImprovedTechnicianSkillsPanelProps {
  selectedUserId?: string | null;
  selectedUserRole?: string | null;
}

/**
 * Panel mejorado de gestión de habilidades técnicas
 * 
 * Funcionalidades:
 * - Checklist de servicios vinculado a service_types
 * - Cálculo automático del nivel basado en servicios exitosos
 * - Estadísticas vs positivas/negativas por servicio
 * - Vista de rendimiento por técnico
 */
export function ImprovedTechnicianSkillsPanel({ selectedUserId, selectedUserRole }: ImprovedTechnicianSkillsPanelProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [skills, setSkills] = useState<TechnicianSkill[]>([]);
  const [serviceStats, setServiceStats] = useState<ServiceStats[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(selectedUserId);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedUserRole === 'tecnico') {
      setSelectedTechnicianId(selectedUserId);
      loadSkillsForTechnician(selectedUserId);
      loadServiceStatsForTechnician(selectedUserId);
    }
  }, [selectedUserId, selectedUserRole]);

  useEffect(() => {
    if (selectedTechnicianId) {
      loadSkillsForTechnician(selectedTechnicianId);
      loadServiceStatsForTechnician(selectedTechnicianId);
    }
  }, [selectedTechnicianId]);

  /**
   * Carga datos iniciales necesarios
   */
  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTechnicians(),
        loadServiceTypes()
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Carga lista de técnicos disponibles
   */
  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('role', 'tecnico')
        .order('full_name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  /**
   * Carga tipos de servicio disponibles
   */
  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error('Error loading service types:', error);
    }
  };

  /**
   * Carga habilidades de un técnico específico
   */
  const loadSkillsForTechnician = async (technicianId: string) => {
    try {
      const { data, error } = await supabase
        .from('technician_skills')
        .select(`
          *,
          service_type:service_types(id, name, description)
        `)
        .eq('technician_id', technicianId);

      if (error) throw error;
      setSkills(data || []);
      
      // Actualizar servicios seleccionados
      setSelectedServices(data?.map(skill => skill.service_type_id) || []);
    } catch (error) {
      console.error('Error loading skills:', error);
    }
  };

  /**
   * Carga estadísticas de servicios para el técnico
   */
  const loadServiceStatsForTechnician = async (technicianId: string) => {
    try {
      // Obtener estadísticas de órdenes por tipo de servicio
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          service_type,
          status,
          service_types!inner(id, name)
        `)
        .eq('assigned_technician', technicianId);

      if (error) throw error;

      // Procesar estadísticas
      const statsMap = new Map<string, ServiceStats>();
      
      orders?.forEach(order => {
        const serviceTypeId = order.service_type;
        const serviceName = order.service_types?.name || 'Desconocido';
        
        if (!statsMap.has(serviceTypeId)) {
          statsMap.set(serviceTypeId, {
            service_type_id: serviceTypeId,
            service_name: serviceName,
            total_orders: 0,
            successful_orders: 0,
            failed_orders: 0,
            success_rate: 0,
            calculated_skill_level: 1
          });
        }
        
        const stats = statsMap.get(serviceTypeId)!;
        stats.total_orders++;
        
        if (order.status === 'finalizada') {
          stats.successful_orders++;
        } else if (order.status === 'cancelada') {
          stats.failed_orders++;
        }
      });

      // Calcular porcentajes y niveles
      const statsArray = Array.from(statsMap.values()).map(stats => {
        stats.success_rate = stats.total_orders > 0 
          ? (stats.successful_orders / stats.total_orders) * 100 
          : 0;
        
        // Calcular nivel de habilidad basado en tasa de éxito y cantidad de órdenes
        if (stats.total_orders === 0) {
          stats.calculated_skill_level = 1;
        } else if (stats.success_rate >= 90 && stats.total_orders >= 10) {
          stats.calculated_skill_level = 5;
        } else if (stats.success_rate >= 80 && stats.total_orders >= 8) {
          stats.calculated_skill_level = 4;
        } else if (stats.success_rate >= 70 && stats.total_orders >= 5) {
          stats.calculated_skill_level = 3;
        } else if (stats.success_rate >= 60 && stats.total_orders >= 3) {
          stats.calculated_skill_level = 2;
        } else {
          stats.calculated_skill_level = 1;
        }
        
        return stats;
      });

      setServiceStats(statsArray);
    } catch (error) {
      console.error('Error loading service stats:', error);
    }
  };

  /**
   * Maneja la selección/deselección de servicios
   */
  const handleServiceToggle = async (serviceTypeId: string, checked: boolean) => {
    if (!selectedTechnicianId) return;

    try {
      if (checked) {
        // Añadir habilidad
        const stats = serviceStats.find(s => s.service_type_id === serviceTypeId);
        const calculatedLevel = stats?.calculated_skill_level || 1;
        
        const { error } = await supabase
          .from('technician_skills')
          .insert({
            technician_id: selectedTechnicianId,
            service_type_id: serviceTypeId,
            skill_level: calculatedLevel,
            years_experience: 0,
            certifications: [],
            notes: 'Asignado automáticamente basado en rendimiento'
          });

        if (error) throw error;
        
        setSelectedServices(prev => [...prev, serviceTypeId]);
        toast({
          title: 'Habilidad añadida',
          description: `Servicio asignado con nivel ${calculatedLevel}`,
        });
      } else {
        // Eliminar habilidad
        const { error } = await supabase
          .from('technician_skills')
          .delete()
          .eq('technician_id', selectedTechnicianId)
          .eq('service_type_id', serviceTypeId);

        if (error) throw error;
        
        setSelectedServices(prev => prev.filter(id => id !== serviceTypeId));
        toast({
          title: 'Habilidad removida',
          description: 'Servicio eliminado de las habilidades',
        });
      }
      
      // Recargar datos
      loadSkillsForTechnician(selectedTechnicianId);
    } catch (error: any) {
      console.error('Error toggling service:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la habilidad',
        variant: 'destructive'
      });
    }
  };

  /**
   * Renderiza estrellas según el nivel de habilidad
   */
  const renderStars = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < level ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  /**
   * Obtiene estadísticas para un servicio específico
   */
  const getServiceStats = (serviceTypeId: string) => {
    return serviceStats.find(s => s.service_type_id === serviceTypeId);
  };

  if (loading) {
    return <div className="text-center py-6">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Selector de técnico */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="technician">Seleccionar Técnico</Label>
          <Select value={selectedTechnicianId || ''} onValueChange={setSelectedTechnicianId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un técnico para gestionar sus habilidades" />
            </SelectTrigger>
            <SelectContent>
              {technicians.map((tech) => (
                <SelectItem key={tech.user_id} value={tech.user_id}>
                  {tech.full_name} - {tech.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedTechnicianId ? (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Selecciona un técnico para ver y gestionar sus habilidades
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Resumen de rendimiento */}
          {serviceStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Resumen de Rendimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {serviceStats.reduce((acc, s) => acc + s.successful_orders, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Servicios Exitosos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {serviceStats.reduce((acc, s) => acc + s.failed_orders, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Servicios Fallidos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {serviceStats.length > 0 
                        ? Math.round(serviceStats.reduce((acc, s) => acc + s.success_rate, 0) / serviceStats.length)
                        : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Tasa de Éxito Promedio</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checklist de servicios */}
          <Card>
            <CardHeader>
              <CardTitle>Servicios y Habilidades</CardTitle>
              <p className="text-sm text-muted-foreground">
                Selecciona los servicios que puede realizar este técnico. 
                El nivel se calcula automáticamente basado en el rendimiento.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {serviceTypes.map((service) => {
                  const isSelected = selectedServices.includes(service.id);
                  const stats = getServiceStats(service.id);
                  const skill = skills.find(s => s.service_type_id === service.id);
                  
                  return (
                    <Card key={service.id} className={`transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => 
                                handleServiceToggle(service.id, checked as boolean)
                              }
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <h4 className="font-medium">{service.name}</h4>
                              <p className="text-sm text-muted-foreground">{service.description}</p>
                              
                              {isSelected && skill && (
                                <div className="mt-2 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">Nivel:</span>
                                    <div className="flex">{renderStars(skill.skill_level)}</div>
                                    <span className="text-sm text-muted-foreground">
                                      ({skill.skill_level}/5)
                                    </span>
                                  </div>
                                  
                                  {stats && (
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between text-sm">
                                        <span>Tasa de éxito:</span>
                                        <span className={`font-medium ${
                                          stats.success_rate >= 80 ? 'text-green-600' : 
                                          stats.success_rate >= 60 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                          {stats.success_rate.toFixed(1)}%
                                        </span>
                                      </div>
                                      <Progress value={stats.success_rate} className="h-2" />
                                      
                                      <div className="flex justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                          <CheckCircle className="h-3 w-3 text-green-500" />
                                          {stats.successful_orders} exitosos
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <XCircle className="h-3 w-3 text-red-500" />
                                          {stats.failed_orders} fallidos
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <TrendingUp className="h-3 w-3" />
                                          {stats.total_orders} total
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {isSelected && stats && (
                            <div className="text-right">
                              <Badge variant={
                                stats.success_rate >= 80 ? 'default' : 
                                stats.success_rate >= 60 ? 'secondary' : 'destructive'
                              }>
                                {stats.success_rate >= 80 ? 'Excelente' : 
                                 stats.success_rate >= 60 ? 'Bueno' : 'Necesita Mejora'}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}