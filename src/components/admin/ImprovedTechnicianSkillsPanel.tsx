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
import { CheckCircle, XCircle, Star, TrendingUp, TrendingDown, Users, Wrench, Monitor, Wifi, Lightbulb, ShieldCheck } from 'lucide-react';

// Tipos para TypeScript
interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface TechnicianSkill {
  id: string;
  technician_id: string;
  category_id: string;
  skill_level: number;
  years_experience: number;
  created_at: string;
  updated_at: string;
  service_category?: ServiceCategory;
}

interface Technician {
  user_id: string;
  full_name: string;
  email: string;
}

interface CategoryStats {
  category_id: string;
  category_name: string;
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
 * Panel mejorado de gestión de habilidades técnicas por categorías
 */
export function ImprovedTechnicianSkillsPanel({ selectedUserId, selectedUserRole }: ImprovedTechnicianSkillsPanelProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [skills, setSkills] = useState<TechnicianSkill[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(selectedUserId);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Mapeo de iconos
  const iconMap: Record<string, any> = {
    'wrench': Wrench,
    'monitor': Monitor,
    'wifi': Wifi,
    'lightbulb': Lightbulb,
    'shield-check': ShieldCheck,
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedUserRole === 'tecnico') {
      setSelectedTechnicianId(selectedUserId);
    }
  }, [selectedUserId, selectedUserRole]);

  useEffect(() => {
    if (selectedTechnicianId && serviceCategories.length > 0) {
      loadSkillsForTechnician(selectedTechnicianId);
      loadCategoryStatsForTechnician(selectedTechnicianId);
    }
  }, [selectedTechnicianId, serviceCategories]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTechnicians(),
        loadServiceCategories()
      ]);
    } finally {
      setLoading(false);
    }
  };

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

  const loadServiceCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('id, name, description, icon')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServiceCategories(data || []);
    } catch (error) {
      console.error('Error loading service categories:', error);
    }
  };

  const loadSkillsForTechnician = async (technicianId: string) => {
    try {
      const { data, error } = await supabase
        .from('technician_skills')
        .select('*')
        .eq('technician_id', technicianId);

      if (error) throw error;
      setSkills(data || []);
      
      // Actualizar categorías seleccionadas
      setSelectedCategories(data?.map((skill: any) => skill.category_id) || []);
    } catch (error) {
      console.error('Error loading skills:', error);
    }
  };

  const loadCategoryStatsForTechnician = async (technicianId: string) => {
    try {
      // Obtener estadísticas de órdenes agrupadas por categoría de servicio
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          service_type,
          status,
          service_types!inner(category_id),
          service_categories!inner(id, name)
        `)
        .eq('assigned_technician', technicianId);

      if (error) throw error;

      // Procesar estadísticas por categoría
      const statsMap = new Map<string, CategoryStats>();
      
      orders?.forEach(order => {
        const categoryId = order.service_types?.category_id;
        const categoryName = order.service_categories?.name || 'Sin categoría';
        
        if (!categoryId) return;
        
        if (!statsMap.has(categoryId)) {
          statsMap.set(categoryId, {
            category_id: categoryId,
            category_name: categoryName,
            total_orders: 0,
            successful_orders: 0,
            failed_orders: 0,
            success_rate: 0,
            calculated_skill_level: 1
          });
        }
        
        const stats = statsMap.get(categoryId)!;
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

      setCategoryStats(statsArray);
    } catch (error) {
      console.error('Error loading category stats:', error);
    }
  };

  const handleCategoryToggle = async (categoryId: string, checked: boolean) => {
    if (!selectedTechnicianId) return;

    try {
      if (checked) {
        // Añadir habilidad
        const stats = categoryStats.find(s => s.category_id === categoryId);
        const calculatedLevel = stats?.calculated_skill_level || 1;
        
        const { error } = await supabase
          .from('technician_skills')
          .insert({
            technician_id: selectedTechnicianId,
            category_id: categoryId,
            skill_level: calculatedLevel,
            years_experience: 0
          });

        if (error) throw error;
        
        setSelectedCategories(prev => [...prev, categoryId]);
        
        // Añadir la nueva habilidad al estado local
        const newSkill: TechnicianSkill = {
          id: crypto.randomUUID(),
          technician_id: selectedTechnicianId,
          category_id: categoryId,
          skill_level: calculatedLevel,
          years_experience: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        setSkills(prev => [...prev, newSkill]);
        
        toast({
          title: 'Habilidad añadida',
          description: `Categoría asignada con nivel ${calculatedLevel}`,
        });
      } else {
        // Eliminar habilidad
        const { error } = await supabase
          .from('technician_skills')
          .delete()
          .eq('technician_id', selectedTechnicianId)
          .eq('category_id', categoryId);

        if (error) throw error;
        
        // Actualizar estado local sin recargar
        setSelectedCategories(prev => prev.filter(id => id !== categoryId));
        setSkills(prev => prev.filter(skill => skill.category_id !== categoryId));
        
        toast({
          title: 'Habilidad removida',
          description: 'Categoría eliminada de las habilidades',
        });
      }
      
    } catch (error: any) {
      console.error('Error toggling category:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la habilidad',
        variant: 'destructive'
      });
    }
  };

  const renderStars = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < level ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  const getCategoryStats = (categoryId: string) => {
    return categoryStats.find(s => s.category_id === categoryId);
  };

  const renderCategoryIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || Users;
    return <IconComponent className="h-5 w-5" />;
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
              Selecciona un técnico para ver y gestionar sus habilidades por categoría
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Resumen de rendimiento */}
          {categoryStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Resumen de Rendimiento por Categorías
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {categoryStats.reduce((acc, s) => acc + s.successful_orders, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Servicios Exitosos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {categoryStats.reduce((acc, s) => acc + s.failed_orders, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Servicios Fallidos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {categoryStats.length > 0 
                        ? Math.round(categoryStats.reduce((acc, s) => acc + s.success_rate, 0) / categoryStats.length)
                        : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Tasa de Éxito Promedio</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checklist de categorías */}
          <Card>
            <CardHeader>
              <CardTitle>Categorías de Servicios y Habilidades</CardTitle>
              <p className="text-sm text-muted-foreground">
                Selecciona las categorías de servicios que puede realizar este técnico. 
                El nivel se calcula automáticamente basado en el rendimiento.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {serviceCategories.map((category) => {
                  const isSelected = selectedCategories.includes(category.id);
                  const stats = getCategoryStats(category.id);
                  const skill = skills.find(s => s.category_id === category.id);
                  
                  return (
                    <Card key={category.id} className={`transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => 
                                handleCategoryToggle(category.id, checked as boolean)
                              }
                              className="mt-1"
                            />
                            <div className="flex items-center gap-2 flex-1">
                              {renderCategoryIcon(category.icon)}
                              <div className="flex-1">
                                <h4 className="font-medium">{category.name}</h4>
                                <p className="text-sm text-muted-foreground">{category.description}</p>
                                
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
                          </div>
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