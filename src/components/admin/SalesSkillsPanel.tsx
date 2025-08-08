import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Store, TrendingUp, TrendingDown, CheckCircle, XCircle, Wrench, Monitor, Wifi, Lightbulb, ShieldCheck } from 'lucide-react';

interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface SalesSkill {
  id: string;
  salesperson_id: string;
  category_id: string;
  skill_level: number;
  created_at: string;
  updated_at: string;
  service_category?: ServiceCategory;
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
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [performanceStats, setPerformanceStats] = useState<Record<string, PerformanceStats>>({});
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string | null>(selectedUserId);
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
    loadSalespeople();
    loadServiceCategories();
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedUserRole === 'vendedor') {
      setSelectedSalespersonId(selectedUserId);
    }
  }, [selectedUserId, selectedUserRole]);

  useEffect(() => {
    if (selectedSalespersonId && serviceCategories.length > 0) {
      loadSkillsForSalesperson(selectedSalespersonId);
    }
  }, [selectedSalespersonId, serviceCategories]);

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

  const loadSkillsForSalesperson = async (salespersonId: string) => {
    try {
      const { data, error } = await supabase
        .from('sales_skills')
        .select('*')
        .eq('salesperson_id', salespersonId);

      if (error) throw error;
      const skillsData = data || [];
      setSkills(skillsData);
      setSelectedCategories(skillsData.map((skill: any) => skill.category_id));
      
      // Load performance stats for all categories
      const allCategoryIds = serviceCategories.map(st => st.id);
      await loadPerformanceStats(salespersonId, allCategoryIds);
    } catch (error) {
      console.error('Error loading sales skills:', error);
      setSkills([]);
      setSelectedCategories([]);
    }
  };

  const loadPerformanceStats = async (salespersonId: string, categoryIds: string[]) => {
    if (categoryIds.length === 0) {
      setPerformanceStats({});
      return;
    }

    try {
      const stats: Record<string, PerformanceStats> = {};
      
      // For now, we'll just create empty stats since quotes table doesn't have proper category linkage
      // This can be enhanced later when the relationship is properly established
      for (const categoryId of categoryIds) {
        stats[categoryId] = {
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

  const handleCategoryToggle = async (categoryId: string, isChecked: boolean) => {
    if (!selectedSalespersonId) return;

    try {
      if (isChecked) {
        // Calculate level based on historical performance
        const stats = performanceStats[categoryId] || {
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
            category_id: categoryId,
            skill_level: calculatedLevel
          });

        if (error) throw error;
        
        // Update local state without full reload
        setSelectedCategories(prev => [...prev, categoryId]);
        
        // Add the new skill to local state
        const newSkill: SalesSkill = {
          id: crypto.randomUUID(),
          salesperson_id: selectedSalespersonId,
          category_id: categoryId,
          skill_level: calculatedLevel,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        setSkills(prev => [...prev, newSkill]);
        
        toast({
          title: 'Habilidad añadida',
          description: `Categoría asignada con nivel ${calculatedLevel}`,
        });
      } else {
        const { error } = await supabase
          .from('sales_skills')
          .delete()
          .eq('salesperson_id', selectedSalespersonId)
          .eq('category_id', categoryId);

        if (error) throw error;
        
        // Update local state without reload
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

  const renderPerformanceStats = (categoryId: string) => {
    const stats = performanceStats[categoryId];
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

  const renderCategoryIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || Store;
    return <IconComponent className="h-5 w-5" />;
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
            Conocimientos de Ventas - Categorías ({serviceCategories.length})
          </h3>
          
          {serviceCategories.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No hay categorías de servicios disponibles
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {serviceCategories.map((category) => {
                const isSelected = selectedCategories.includes(category.id);
                const skill = skills.find(s => s.category_id === category.id);
                const stats = performanceStats[category.id];
                
                return (
                  <Card key={category.id} className={`transition-all ${isSelected ? 'border-primary bg-primary/5' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleCategoryToggle(category.id, checked as boolean)}
                          className="mt-1"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          {renderCategoryIcon(category.icon)}
                          <div className="flex-1">
                            <CardTitle className="text-base">{category.name}</CardTitle>
                            {category.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {category.description}
                              </p>
                            )}
                          </div>
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
                          {renderPerformanceStats(category.id)}
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
              Selecciona un vendedor para gestionar sus conocimientos y habilidades comerciales por categoría
            </p>
            <div className="text-sm text-muted-foreground">
              <p>• Gestión de habilidades por categoría de servicio</p>
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