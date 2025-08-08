import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Store, 
  TrendingUp, 
  Camera, 
  Key, 
  ShieldAlert, 
  Wifi, 
  Lightbulb,
  Package,
  Plus,
  Users
} from 'lucide-react';
import { SkillLevelEditor } from './SkillLevelEditor';

interface SalesCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
}

interface SalesProduct {
  id: string;
  category_id: string;
  name: string;
  description: string;
  brand: string;
  model?: string;
  is_active: boolean;
}

interface SalesKnowledge {
  id: string;
  salesperson_id: string;
  category_id: string;
  knowledge_level: number;
  specialization_products: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Salesperson {
  user_id: string;
  full_name: string;
  email: string;
}

interface SalesKnowledgePanelProps {
  selectedUserId?: string | null;
  selectedUserRole?: string | null;
}

const CATEGORY_ICONS = {
  camera: Camera,
  key: Key,
  'shield-alert': ShieldAlert,
  wifi: Wifi,
  lightbulb: Lightbulb,
  package: Package,
};

export function SalesKnowledgePanel({ selectedUserId, selectedUserRole }: SalesKnowledgePanelProps) {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [categories, setCategories] = useState<SalesCategory[]>([]);
  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [knowledge, setKnowledge] = useState<SalesKnowledge[]>([]);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string | null>(selectedUserId);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedUserRole === 'vendedor') {
      setSelectedSalespersonId(selectedUserId);
    }
  }, [selectedUserId, selectedUserRole]);

  useEffect(() => {
    if (selectedSalespersonId) {
      loadKnowledgeForSalesperson(selectedSalespersonId);
    }
  }, [selectedSalespersonId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadSalespeople(),
        loadCategories(),
        loadProducts()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadSalespeople = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('role', 'vendedor')
        .order('full_name');

      if (error) throw error;
      setSalespeople(data || []);
    } catch (error) {
      console.error('Error loading salespeople:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadKnowledgeForSalesperson = async (salespersonId: string) => {
    try {
      const { data, error } = await supabase
        .from('sales_knowledge')
        .select('*')
        .eq('salesperson_id', salespersonId);

      if (error) throw error;
      setKnowledge(data || []);
    } catch (error) {
      console.error('Error loading knowledge:', error);
      setKnowledge([]);
    }
  };

  const handleCategoryToggle = async (categoryId: string, isChecked: boolean) => {
    if (!selectedSalespersonId) return;

    try {
      if (isChecked) {
        const { error } = await supabase
          .from('sales_knowledge')
          .insert({
            salesperson_id: selectedSalespersonId,
            category_id: categoryId,
            knowledge_level: 1,
            specialization_products: [],
            notes: ''
          });

        if (error) throw error;

        // Add to local state
        const newKnowledge: SalesKnowledge = {
          id: crypto.randomUUID(),
          salesperson_id: selectedSalespersonId,
          category_id: categoryId,
          knowledge_level: 1,
          specialization_products: [],
          notes: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        setKnowledge(prev => [...prev, newKnowledge]);

        toast({
          title: 'Categoría asignada',
          description: 'Conocimiento agregado con nivel básico',
        });
      } else {
        const { error } = await supabase
          .from('sales_knowledge')
          .delete()
          .eq('salesperson_id', selectedSalespersonId)
          .eq('category_id', categoryId);

        if (error) throw error;

        setKnowledge(prev => prev.filter(k => k.category_id !== categoryId));

        toast({
          title: 'Categoría removida',
          description: 'Conocimiento eliminado de la categoría',
        });
      }
    } catch (error: any) {
      console.error('Error toggling category:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el conocimiento',
        variant: 'destructive'
      });
    }
  };

  const handleKnowledgeUpdate = async (knowledgeId: string, updateData: {
    knowledge_level: number;
    specialization_products?: string[];
    notes?: string;
  }) => {
    try {
      const { error } = await supabase
        .from('sales_knowledge')
        .update({
          knowledge_level: updateData.knowledge_level,
          specialization_products: updateData.specialization_products || [],
          notes: updateData.notes || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', knowledgeId);

      if (error) throw error;

      setKnowledge(prev => prev.map(k => 
        k.id === knowledgeId 
          ? { 
              ...k, 
              knowledge_level: updateData.knowledge_level,
              specialization_products: updateData.specialization_products || [],
              notes: updateData.notes || ''
            }
          : k
      ));

      toast({
        title: 'Conocimiento actualizado',
        description: 'Los cambios se han guardado correctamente',
      });
    } catch (error: any) {
      console.error('Error updating knowledge:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el conocimiento',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const handleProductSpecializationToggle = async (knowledgeId: string, productId: string, isChecked: boolean) => {
    const currentKnowledge = knowledge.find(k => k.id === knowledgeId);
    if (!currentKnowledge) return;

    const updatedProducts = isChecked
      ? [...currentKnowledge.specialization_products, productId]
      : currentKnowledge.specialization_products.filter(id => id !== productId);

    await handleKnowledgeUpdate(knowledgeId, {
      knowledge_level: currentKnowledge.knowledge_level,
      specialization_products: updatedProducts,
      notes: currentKnowledge.notes
    });
  };

  const renderKnowledgeLevel = (level: number) => {
    const labels = ['Principiante', 'Básico', 'Intermedio', 'Avanzado', 'Experto'];
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

  const getCategoryProducts = (categoryId: string) => {
    return products.filter(p => p.category_id === categoryId);
  };

  const getCategoryKnowledge = (categoryId: string) => {
    return knowledge.find(k => k.category_id === categoryId);
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = CATEGORY_ICONS[iconName as keyof typeof CATEGORY_ICONS] || Package;
    return IconComponent;
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

      {!selectedSalespersonId ? (
        <Card>
          <CardContent className="text-center py-12">
            <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Gestión de Conocimientos de Ventas</h3>
            <p className="text-muted-foreground mb-4">
              Selecciona un vendedor para gestionar sus conocimientos por categorías de productos
            </p>
            <div className="text-sm text-muted-foreground">
              <p>• Organización por categorías de productos</p>
              <p>• Especialización en productos específicos</p>
              <p>• Niveles de conocimiento por categoría</p>
              <p>• Seguimiento detallado de habilidades comerciales</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <h3 className="text-lg font-medium">
            Conocimientos por Categorías ({categories.length} disponibles)
          </h3>

          {categories.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No hay categorías de productos disponibles
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {categories.map((category) => {
                const categoryKnowledge = getCategoryKnowledge(category.id);
                const categoryProducts = getCategoryProducts(category.id);
                const isAssigned = !!categoryKnowledge;
                const IconComponent = getIconComponent(category.icon);

                return (
                  <Card key={category.id} className={`${isAssigned ? 'ring-2 ring-primary' : ''}`}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isAssigned}
                          onCheckedChange={(checked) => handleCategoryToggle(category.id, checked as boolean)}
                          className="mt-1"
                        />
                        <IconComponent className="h-6 w-6 text-primary mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{category.name}</CardTitle>
                            {isAssigned && categoryKnowledge && (
                              <SkillLevelEditor
                                currentLevel={categoryKnowledge.knowledge_level}
                                currentNotes={categoryKnowledge.notes || ''}
                                serviceName={category.name}
                                onSave={(data) => handleKnowledgeUpdate(categoryKnowledge.id, {
                                  knowledge_level: data.skill_level,
                                  notes: data.notes,
                                  specialization_products: categoryKnowledge.specialization_products
                                })}
                              />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {category.description}
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    {isAssigned && categoryKnowledge && (
                      <CardContent className="space-y-4">
                        {/* Nivel de conocimiento */}
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Nivel de conocimiento:</p>
                          {renderKnowledgeLevel(categoryKnowledge.knowledge_level)}
                        </div>

                        {/* Productos de especialización */}
                        {categoryProducts.length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Especialización en productos ({categoryKnowledge.specialization_products.length}/{categoryProducts.length}):
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {categoryProducts.map((product) => (
                                <div key={product.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={categoryKnowledge.specialization_products.includes(product.id)}
                                    onCheckedChange={(checked) => 
                                      handleProductSpecializationToggle(
                                        categoryKnowledge.id, 
                                        product.id, 
                                        checked as boolean
                                      )
                                    }
                                  />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{product.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {product.brand} {product.model && `- ${product.model}`}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notas */}
                        {categoryKnowledge.notes && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Notas:</p>
                            <p className="text-sm bg-muted p-2 rounded">
                              {categoryKnowledge.notes}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}