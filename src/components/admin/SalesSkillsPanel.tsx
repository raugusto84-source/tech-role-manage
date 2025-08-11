import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Store, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';
import { SkillLevelEditor } from './SkillLevelEditor';

interface SalesProduct {
  id: string;
  name: string;
  description: string;
  brand: string;
  model: string | null;
  category_id: string;
  is_active: boolean;
}

interface SalesCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
}

interface SalesSkill {
  id: string;
  salesperson_id: string;
  sales_product_id: string;
  skill_level: number;
  years_experience?: number;
  certifications?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  sales_product?: SalesProduct;
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
  const [salesProducts, setSalesProducts] = useState<SalesProduct[]>([]);
  const [salesCategories, setSalesCategories] = useState<SalesCategory[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [performanceStats, setPerformanceStats] = useState<Record<string, PerformanceStats>>({});
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string | null>(selectedUserId);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSalespeople();
    loadSalesProducts();
    loadSalesCategories();
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedUserRole === 'vendedor') {
      setSelectedSalespersonId(selectedUserId);
    }
  }, [selectedUserId, selectedUserRole]);

  useEffect(() => {
    if (selectedSalespersonId && salesProducts.length > 0) {
      loadSkillsForSalesperson(selectedSalespersonId);
    }
  }, [selectedSalespersonId, salesProducts]);

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

  const loadSalesProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_products')
        .select('id, name, description, brand, model, category_id, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSalesProducts(data || []);
    } catch (error) {
      console.error('Error loading sales products:', error);
    }
  };

  const loadSalesCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_categories')
        .select('id, name, description, icon, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSalesCategories(data || []);
    } catch (error) {
      console.error('Error loading sales categories:', error);
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
      
      setSkills(skillsData as any);
      setSelectedProducts((skillsData as any).map((skill: any) => skill.sales_product_id));
      
      // Load performance stats for all products
      const allProductIds = salesProducts.map(sp => sp.id);
      await loadPerformanceStats(salespersonId, allProductIds);
    } catch (error) {
      console.error('Error loading sales skills:', error);
      setSkills([]);
      setSelectedProducts([]);
    }
  };

  const loadPerformanceStats = async (salespersonId: string, productIds: string[]) => {
    if (productIds.length === 0) {
      setPerformanceStats({});
      return;
    }

    try {
      const stats: Record<string, PerformanceStats> = {};
      
      // For now, we'll just create empty stats since quotes don't have direct product relationships yet
      // This can be enhanced later when the relationship is properly established
      for (const productId of productIds) {
        stats[productId] = {
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

  const handleProductToggle = async (productId: string, isChecked: boolean) => {
    if (!selectedSalespersonId) return;

    try {
      if (isChecked) {
        // Calculate level based on historical performance
        const stats = performanceStats[productId] || {
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
            sales_product_id: productId,
            skill_level: calculatedLevel
          });

        if (error) throw error;
        
        // Update local state without full reload
        setSelectedProducts(prev => [...prev, productId]);
        
        // Add the new skill to local state
        const newSkill: SalesSkill = {
          id: crypto.randomUUID(),
          salesperson_id: selectedSalespersonId,
          sales_product_id: productId,
          skill_level: calculatedLevel,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        setSkills(prev => [...prev, newSkill]);
        
        toast({
          title: 'Habilidad añadida',
          description: `Producto asignado con nivel ${calculatedLevel}`,
        });
      } else {
        // Delete the skill
        try {
          await supabase
            .from('sales_skills')
            .delete()
            .match({ salesperson_id: selectedSalespersonId, sales_product_id: productId });
        } catch (deleteError) {
          console.error('Delete error:', deleteError);
        }
        
        // Update local state without reload
        setSelectedProducts(prev => prev.filter(id => id !== productId));
        setSkills(prev => prev.filter(skill => skill.sales_product_id !== productId));
        
        toast({
          title: 'Habilidad removida',
          description: 'Producto eliminado de las habilidades',
        });
      }
      
    } catch (error: any) {
      console.error('Error toggling product:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la habilidad',
        variant: 'destructive'
      });
    }
  };

  /**
   * Actualiza manualmente el nivel de habilidad de venta
   */
  const handleManualSkillUpdate = async (skillId: string, updateData: {
    skill_level: number;
    years_experience?: number;
    notes?: string;
    certifications?: string[];
  }) => {
    try {
      const { error } = await supabase
        .from('sales_skills')
        .update({
          skill_level: updateData.skill_level,
          updated_at: new Date().toISOString()
        })
        .eq('id', skillId);

      if (error) throw error;

      // Actualizar estado local
      setSkills(prev => prev.map(skill => 
        skill.id === skillId 
          ? { 
              ...skill, 
              skill_level: updateData.skill_level
            }
          : skill
      ));

      toast({
        title: 'Habilidad actualizada',
        description: 'El nivel se ha actualizado correctamente',
      });
    } catch (error: any) {
      console.error('Error updating skill:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la habilidad',
        variant: 'destructive'
      });
      throw error;
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

  const renderPerformanceStats = (productId: string) => {
    const stats = performanceStats[productId];
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

  const getIconForCategory = (iconName: string) => {
    switch (iconName) {
      case 'camera': return '📹';
      case 'key': return '🔑';
      case 'shield-alert': return '🚨';
      case 'wifi': return '📡';
      case 'lightbulb': return '💡';
      default: return '📦';
    }
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
        <div className="space-y-6">
          {/* Agrupar productos por categoría */}
          {salesCategories.map((category) => {
            const categoryProducts = salesProducts.filter(p => p.category_id === category.id);
            if (categoryProducts.length === 0) return null;

            return (
              <div key={category.id} className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <span className="text-2xl">{getIconForCategory(category.icon)}</span>
                  {category.name} ({categoryProducts.length} productos)
                </h3>
                <p className="text-sm text-muted-foreground">{category.description}</p>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryProducts.map((product) => {
                    const isSelected = selectedProducts.includes(product.id);
                    const skill = skills.find(s => s.sales_product_id === product.id);
                    const stats = performanceStats[product.id];
                    
                    return (
                      <Card key={product.id} className={`transition-all ${isSelected ? 'border-primary bg-primary/5' : ''}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleProductToggle(product.id, checked as boolean)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <CardTitle className="text-base">{product.name}</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {product.brand} {product.model && `- ${product.model}`}
                              </p>
                              {product.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        
                        {isSelected && skill && (
                          <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground mb-1">Nivel actual:</p>
                                {renderSkillLevel(skill.skill_level)}
                              </div>
                              <SkillLevelEditor
                                currentLevel={skill.skill_level}
                                serviceName={product.name}
                                onSave={(data) => handleManualSkillUpdate(skill.id, data)}
                              />
                            </div>
                            
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Rendimiento en ventas:</p>
                              {renderPerformanceStats(product.id)}
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
              </div>
            );
          })}
          
          {salesCategories.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No hay categorías de productos disponibles
                </p>
              </CardContent>
            </Card>
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
              <p>• Gestión de habilidades por productos de venta</p>
              <p>• Niveles calculados automáticamente por rendimiento</p>
              <p>• Estadísticas de éxito vs fallos en ventas por producto</p>
              <p>• Seguimiento de especialización comercial por categoría</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}