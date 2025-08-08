import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Store, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';

interface ServiceType {
  id: string;
  name: string;
  description: string;
}

interface SalesSkill {
  id: string;
  salesperson_id: string;
  service_type_id: string;
  skill_level: number;
  created_at: string;
  updated_at: string;
  service_type?: ServiceType;
}

interface Salesperson {
  user_id: string;
  full_name: string;
  email: string;
}

interface SalesSkillsPanelProps {
  selectedUserId?: string | null;
  selectedUserRole?: string | null;
}

interface PerformanceStats {
  successful_sales: number;
  failed_sales: number;
  total_sales: number;
  success_rate: number;
}

export function SalesSkillsPanel({ selectedUserId, selectedUserRole }: SalesSkillsPanelProps) {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [skills, setSkills] = useState<SalesSkill[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [performanceStats, setPerformanceStats] = useState<Record<string, PerformanceStats>>({});
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string | null>(selectedUserId);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSalespeople();
    loadServiceTypes();
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedUserRole === 'vendedor') {
      setSelectedSalespersonId(selectedUserId);
    }
  }, [selectedUserId, selectedUserRole]);

  useEffect(() => {
    if (selectedSalespersonId && serviceTypes.length > 0) {
      loadSkillsForSalesperson(selectedSalespersonId);
    }
  }, [selectedSalespersonId, serviceTypes]);

  const loadSalespeople = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('role', 'vendedor')
        .order('full_name');

      if (error) throw error;
      setSalespeople(data || []);
    } catch (error) {
      console.error('Error loading salespeople:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('id, name, description')
        .order('name');

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error('Error loading service types:', error);
    }
  };

  const loadSkillsForSalesperson = async (salespersonId: string) => {
    try {
      const { data, error } = await supabase
        .from('sales_skills')
        .select('*')
        .eq('salesperson_id', salespersonId);

      if (error) throw error;
      const skillsData = data || [];
      setSkills(skillsData);
      setSelectedServices(skillsData.map((skill: any) => skill.service_type_id));
      
      // Load performance stats for all services
      const allServiceIds = serviceTypes.map(st => st.id);
      await loadPerformanceStats(salespersonId, allServiceIds);
    } catch (error) {
      console.error('Error loading sales skills:', error);
      setSkills([]);
      setSelectedServices([]);
    }
  };

  const loadPerformanceStats = async (salespersonId: string, serviceTypeIds: string[]) => {
    if (serviceTypeIds.length === 0) {
      setPerformanceStats({});
      return;
    }

    try {
      const stats: Record<string, PerformanceStats> = {};
      
      // For now, we'll just create empty stats since quotes table doesn't have service_type column
      // This can be enhanced later when the relationship is properly established
      for (const serviceTypeId of serviceTypeIds) {
        stats[serviceTypeId] = {
          successful_sales: 0,
          failed_sales: 0,
          total_sales: 0,
          success_rate: 0
        };
      }

      setPerformanceStats(stats);
    } catch (error) {
      console.error('Error loading performance stats:', error);
    }
  };

  const calculateSkillLevel = (stats: PerformanceStats): number => {
    if (stats.total_sales === 0) return 1;
    
    const successRate = stats.success_rate;
    if (successRate >= 90) return 5;
    if (successRate >= 75) return 4;
    if (successRate >= 60) return 3;
    if (successRate >= 40) return 2;
    return 1;
  };

  const handleServiceToggle = async (serviceTypeId: string, isChecked: boolean) => {
    if (!selectedSalespersonId) return;

    try {
      if (isChecked) {
        // Calculate level based on historical performance
        const stats = performanceStats[serviceTypeId] || {
          successful_sales: 0,
          failed_sales: 0,
          total_sales: 0,
          success_rate: 0
        };
        
        const calculatedLevel = calculateSkillLevel(stats);

        const { error } = await supabase
          .from('sales_skills')
          .insert({
            salesperson_id: selectedSalespersonId,
            service_type_id: serviceTypeId,
            skill_level: calculatedLevel
          });

        if (error) throw error;
        
        // Update local state without full reload
        setSelectedServices(prev => [...prev, serviceTypeId]);
        
        // Add the new skill to local state
        const newSkill: SalesSkill = {
          id: crypto.randomUUID(),
          salesperson_id: selectedSalespersonId,
          service_type_id: serviceTypeId,
          skill_level: calculatedLevel,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        setSkills(prev => [...prev, newSkill]);
        
        toast({
          title: 'Habilidad añadida',
          description: `Servicio asignado con nivel ${calculatedLevel}`,
        });
      } else {
        const { error } = await supabase
          .from('sales_skills')
          .delete()
          .eq('salesperson_id', selectedSalespersonId)
          .eq('service_type_id', serviceTypeId);

        if (error) throw error;
        
        // Update local state without reload
        setSelectedServices(prev => prev.filter(id => id !== serviceTypeId));
        setSkills(prev => prev.filter(skill => skill.service_type_id !== serviceTypeId));
        
        toast({
          title: 'Habilidad removida',
          description: 'Servicio eliminado de las habilidades',
        });
      }
      
    } catch (error: any) {
      console.error('Error toggling service:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la habilidad',
        variant: 'destructive'
      });
    }
  };

  const renderSkillLevel = (level: number) => {
    const labels = ['Básico', 'Intermedio', 'Avanzado', 'Experto', 'Master'];
    return (
      <div className="flex items-center gap-2">
        <div className="flex">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`h-2 w-6 mr-1 rounded ${i < level ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{labels[level - 1]}</span>
      </div>
    );
  };

  const renderPerformanceStats = (serviceTypeId: string) => {
    const stats = performanceStats[serviceTypeId];
    if (!stats || stats.total_sales === 0) {
      return (
        <div className="text-sm text-muted-foreground">
          Sin datos de rendimiento
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Tasa de éxito:</span>
          <span className={`font-medium ${stats.success_rate >= 70 ? 'text-green-600' : stats.success_rate >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
            {stats.success_rate.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-600" />
            <span>{stats.successful_sales} exitosas</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-600" />
            <span>{stats.failed_sales} fallidas</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-6">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Selector de vendedor */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="salesperson">Seleccionar Vendedor</Label>
          <Select value={selectedSalespersonId || ''} onValueChange={setSelectedSalespersonId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un vendedor para gestionar sus conocimientos" />
            </SelectTrigger>
            <SelectContent>
              {salespeople.map((salesperson) => (
                <SelectItem key={salesperson.user_id} value={salesperson.user_id}>
                  {salesperson.full_name} - {salesperson.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de conocimientos del vendedor seleccionado */}
      {selectedSalespersonId && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Conocimientos de Ventas - Servicios ({serviceTypes.length})
          </h3>
          
          {serviceTypes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No hay tipos de servicios disponibles
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {serviceTypes.map((serviceType) => {
                const isSelected = selectedServices.includes(serviceType.id);
                const skill = skills.find(s => s.service_type_id === serviceType.id);
                const stats = performanceStats[serviceType.id];
                
                return (
                  <Card key={serviceType.id} className={`transition-all ${isSelected ? 'border-primary bg-primary/5' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleServiceToggle(serviceType.id, checked as boolean)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <CardTitle className="text-base">{serviceType.name}</CardTitle>
                          {serviceType.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {serviceType.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    {isSelected && skill && (
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Nivel calculado:</p>
                          {renderSkillLevel(skill.skill_level)}
                        </div>
                        
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Rendimiento en ventas:</p>
                          {renderPerformanceStats(serviceType.id)}
                        </div>
                      </CardContent>
                    )}
                    
                    {isSelected && stats && stats.total_sales > 0 && (
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2 text-xs">
                          {stats.success_rate >= 70 ? (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-600" />
                          )}
                          <span className="text-muted-foreground">
                            Basado en {stats.total_sales} cotizaciones
                          </span>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mensaje cuando no hay vendedor seleccionado */}
      {!selectedSalespersonId && (
        <Card>
          <CardContent className="text-center py-12">
            <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Gestión de Conocimientos de Ventas</h3>
            <p className="text-muted-foreground mb-4">
              Selecciona un vendedor para gestionar sus conocimientos y habilidades comerciales
            </p>
            <div className="text-sm text-muted-foreground">
              <p>• Gestión de habilidades por tipo de servicio</p>
              <p>• Niveles calculados automáticamente por rendimiento</p>
              <p>• Estadísticas de éxito vs fallos en ventas</p>
              <p>• Seguimiento de especialización comercial</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}