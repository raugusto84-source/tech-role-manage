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
  Wrench, 
  Camera, 
  Key, 
  ShieldAlert, 
  Wifi, 
  Lightbulb,
  Package,
  Cpu,
  Monitor,
  Users,
  Settings
} from 'lucide-react';
import { SkillLevelEditor } from './SkillLevelEditor';
import { CategoryManager } from './CategoryManager';

interface TechnicalCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
}

interface TechnicalProduct {
  id: string;
  category_id: string;
  name: string;
  description: string;
  brand: string;
  model?: string;
  is_active: boolean;
}

interface TechnicalKnowledge {
  id: string;
  technician_id: string;
  category_id: string;
  skill_level: number;
  years_experience: number;
  specialization_products: string[];
  certifications: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Technician {
  user_id: string;
  full_name: string;
  email: string;
}

interface TechnicalKnowledgePanelProps {
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
  wrench: Wrench,
  cpu: Cpu,
  monitor: Monitor,
};

export function TechnicalKnowledgePanel({ selectedUserId, selectedUserRole }: TechnicalKnowledgePanelProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [categories, setCategories] = useState<TechnicalCategory[]>([]);
  const [products, setProducts] = useState<TechnicalProduct[]>([]);
  const [knowledge, setKnowledge] = useState<TechnicalKnowledge[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(selectedUserId);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedUserRole === 'tecnico') {
      setSelectedTechnicianId(selectedUserId);
    }
  }, [selectedUserId, selectedUserRole]);

  useEffect(() => {
    if (selectedTechnicianId) {
      loadKnowledgeForTechnician(selectedTechnicianId);
    }
  }, [selectedTechnicianId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTechnicians(),
        loadCategories(),
        loadProducts()
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

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('technical_categories')
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
        .from('technical_products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadKnowledgeForTechnician = async (technicianId: string) => {
    try {
      const { data, error } = await supabase
        .from('technical_knowledge')
        .select('*')
        .eq('technician_id', technicianId);

      if (error) throw error;
      setKnowledge(data || []);
    } catch (error) {
      console.error('Error loading knowledge:', error);
      setKnowledge([]);
    }
  };

  const handleCategoryToggle = async (categoryId: string, isChecked: boolean) => {
    if (!selectedTechnicianId) return;

    try {
      if (isChecked) {
        const { error } = await supabase
          .from('technical_knowledge')
          .insert({
            technician_id: selectedTechnicianId,
            category_id: categoryId,
            skill_level: 1,
            years_experience: 0,
            specialization_products: [],
            certifications: [],
            notes: ''
          });

        if (error) throw error;

        // Add to local state
        const newKnowledge: TechnicalKnowledge = {
          id: crypto.randomUUID(),
          technician_id: selectedTechnicianId,
          category_id: categoryId,
          skill_level: 1,
          years_experience: 0,
          specialization_products: [],
          certifications: [],
          notes: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        setKnowledge(prev => [...prev, newKnowledge]);

        toast({
          title: 'Categoría asignada',
          description: 'Habilidad agregada con nivel básico',
        });
      } else {
        const { error } = await supabase
          .from('technical_knowledge')
          .delete()
          .eq('technician_id', selectedTechnicianId)
          .eq('category_id', categoryId);

        if (error) throw error;

        setKnowledge(prev => prev.filter(k => k.category_id !== categoryId));

        toast({
          title: 'Categoría removida',
          description: 'Habilidad eliminada de la categoría',
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

  const handleKnowledgeUpdate = async (knowledgeId: string, updateData: {
    skill_level: number;
    years_experience?: number;
    specialization_products?: string[];
    certifications?: string[];
    notes?: string;
  }) => {
    try {
      const { error } = await supabase
        .from('technical_knowledge')
        .update({
          skill_level: updateData.skill_level,
          years_experience: updateData.years_experience || 0,
          specialization_products: updateData.specialization_products || [],
          certifications: updateData.certifications || [],
          notes: updateData.notes || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', knowledgeId);

      if (error) throw error;

      setKnowledge(prev => prev.map(k => 
        k.id === knowledgeId 
          ? { 
              ...k, 
              skill_level: updateData.skill_level,
              years_experience: updateData.years_experience || 0,
              specialization_products: updateData.specialization_products || [],
              certifications: updateData.certifications || [],
              notes: updateData.notes || ''
            }
          : k
      ));

      toast({
        title: 'Habilidad actualizada',
        description: 'Los cambios se han guardado correctamente',
      });
    } catch (error: any) {
      console.error('Error updating knowledge:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la habilidad',
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
      skill_level: currentKnowledge.skill_level,
      years_experience: currentKnowledge.years_experience,
      specialization_products: updatedProducts,
      certifications: currentKnowledge.certifications,
      notes: currentKnowledge.notes
    });
  };

  const renderSkillLevel = (level: number) => {
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
    const IconComponent = CATEGORY_ICONS[iconName as keyof typeof CATEGORY_ICONS] || Wrench;
    return IconComponent;
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
              {technicians.map((technician) => (
                <SelectItem key={technician.user_id} value={technician.user_id}>
                  {technician.full_name} - {technician.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedTechnicianId ? (
        <Card>
          <CardContent className="text-center py-12">
            <Wrench className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Gestión de Habilidades Técnicas</h3>
            <p className="text-muted-foreground mb-4">
              Selecciona un técnico para gestionar sus habilidades por categorías técnicas
            </p>
            <div className="text-sm text-muted-foreground">
              <p>• Organización por categorías técnicas</p>
              <p>• Especialización en productos y tecnologías</p>
              <p>• Seguimiento de certificaciones</p>
              <p>• Gestión de años de experiencia</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              Habilidades por Categorías ({categories.length} disponibles)
            </h3>
            <Button 
              variant="outline" 
              onClick={() => setShowCategoryManager(!showCategoryManager)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              {showCategoryManager ? 'Ocultar' : 'Gestionar'} Categorías
            </Button>
          </div>

          {showCategoryManager && (
            <Card>
              <CardContent className="pt-6">
                <CategoryManager 
                  type="technical" 
                  categories={categories} 
                  onCategoriesChange={loadCategories} 
                />
              </CardContent>
            </Card>
          )}

          {categories.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No hay categorías técnicas disponibles
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
                                currentLevel={categoryKnowledge.skill_level}
                                currentExperience={categoryKnowledge.years_experience}
                                currentCertifications={categoryKnowledge.certifications || []}
                                currentNotes={categoryKnowledge.notes || ''}
                                serviceName={category.name}
                                onSave={(data) => handleKnowledgeUpdate(categoryKnowledge.id, {
                                  skill_level: data.skill_level,
                                  years_experience: data.years_experience,
                                  certifications: data.certifications,
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
                        {/* Nivel de habilidad */}
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Nivel de habilidad:</p>
                          {renderSkillLevel(categoryKnowledge.skill_level)}
                        </div>

                        {/* Años de experiencia */}
                        {categoryKnowledge.years_experience > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Experiencia:</p>
                            <Badge variant="outline">
                              {categoryKnowledge.years_experience} año{categoryKnowledge.years_experience !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        )}

                        {/* Certificaciones */}
                        {categoryKnowledge.certifications && categoryKnowledge.certifications.length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Certificaciones:</p>
                            <div className="flex flex-wrap gap-1">
                              {categoryKnowledge.certifications.map((cert, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {cert}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

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