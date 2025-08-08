import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Store, Target, BookOpen, Award, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

// Tipos para TypeScript basados en el esquema de la base de datos
interface SalesSkill {
  id: string;
  salesperson_id: string;
  skill_category: string;
  skill_name: string;
  expertise_level: number; // 1-5
  years_experience: number;
  certifications: string[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
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

/**
 * Panel de gestión de conocimientos y habilidades de ventas
 * 
 * Funcionalidades:
 * - Gestión completa de conocimientos por vendedor
 * - Categorización de habilidades (productos, servicios, territorios, etc.)
 * - Niveles de expertise (1-5)
 * - Registro de certificaciones comerciales
 * 
 * Categorías de habilidades:
 * - Productos: Conocimiento específico de productos
 * - Servicios: Experiencia en tipos de servicios
 * - Territorio: Conocimiento de mercados geográficos
 * - Industria: Especialización en sectores industriales
 * - Herramientas: Manejo de CRM, software de ventas, etc.
 * 
 * Reutilizable para:
 * - Administración de competencias comerciales
 * - Asignación de leads por especialización
 * - Reportes de capacidades de ventas
 * - Planes de desarrollo profesional
 */
export function SalesSkillsPanel({ selectedUserId, selectedUserRole }: SalesSkillsPanelProps) {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [skills, setSkills] = useState<SalesSkill[]>([]);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string | null>(selectedUserId);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Estado del formulario - solo campos que existen en la base de datos
  const [skillForm, setSkillForm] = useState({
    skill_category: 'producto',
    skill_name: '',
    expertise_level: 1,
    years_experience: 0,
    certifications: [] as string[]
  });

  // Estado para nuevas certificaciones
  const [newCertification, setNewCertification] = useState('');

  useEffect(() => {
    loadSalespeople();
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedUserRole === 'vendedor') {
      setSelectedSalespersonId(selectedUserId);
      loadSkillsForSalesperson(selectedUserId);
    }
  }, [selectedUserId, selectedUserRole]);

  useEffect(() => {
    if (selectedSalespersonId) {
      loadSkillsForSalesperson(selectedSalespersonId);
    }
  }, [selectedSalespersonId]);

  /**
   * Carga lista de vendedores disponibles
   */
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

  /**
   * Carga habilidades de un vendedor específico
   */
  const loadSkillsForSalesperson = async (salespersonId: string) => {
    try {
      const { data, error } = await supabase
        .from('sales_skills')
        .select('*')
        .eq('salesperson_id', salespersonId)
        .order('skill_category', { ascending: true });

      if (error) throw error;
      setSkills(data || []);
    } catch (error) {
      console.error('Error loading sales skills:', error);
      setSkills([]);
    }
  };

  /**
   * Crea una nueva habilidad de ventas
   */
  const handleCreateSkill = async () => {
    if (!selectedSalespersonId || !skillForm.skill_name) return;

    try {
      const { error } = await supabase
        .from('sales_skills')
        .insert({
          salesperson_id: selectedSalespersonId,
          skill_category: skillForm.skill_category,
          skill_name: skillForm.skill_name,
          expertise_level: skillForm.expertise_level,
          years_experience: skillForm.years_experience,
          certifications: skillForm.certifications
        });

      if (error) throw error;

      loadSkillsForSalesperson(selectedSalespersonId);
      resetForm();
      setIsDialogOpen(false);
      toast({
        title: 'Conocimiento añadido',
        description: 'Conocimiento de ventas registrado exitosamente'
      });

    } catch (error: any) {
      console.error('Error creating sales skill:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo añadir el conocimiento',
        variant: 'destructive'
      });
    }
  };

  /**
   * Elimina una habilidad de ventas
   */
  const handleDeleteSkill = async (skillId: string) => {
    try {
      const { error } = await supabase
        .from('sales_skills')
        .delete()
        .eq('id', skillId);

      if (error) throw error;

      if (selectedSalespersonId) {
        loadSkillsForSalesperson(selectedSalespersonId);
      }
      toast({
        title: 'Conocimiento eliminado',
        description: 'Conocimiento eliminado exitosamente'
      });

    } catch (error: any) {
      console.error('Error deleting sales skill:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el conocimiento',
        variant: 'destructive'
      });
    }
  };

  /**
   * Añade una nueva certificación
   */
  const addCertification = () => {
    if (newCertification.trim()) {
      setSkillForm(prev => ({
        ...prev,
        certifications: [...prev.certifications, newCertification.trim()]
      }));
      setNewCertification('');
    }
  };

  /**
   * Elimina una certificación
   */
  const removeCertification = (index: number) => {
    setSkillForm(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }));
  };

  /**
   * Resetea el formulario
   */
  const resetForm = () => {
    setSkillForm({
      skill_category: 'producto',
      skill_name: '',
      expertise_level: 1,
      years_experience: 0,
      certifications: []
    });
    setNewCertification('');
  };

  /**
   * Renderiza indicador de nivel de expertise
   */
  const renderExpertiseLevel = (level: number) => {
    const labels = ['Básico', 'Intermedio', 'Avanzado', 'Experto', 'Master'];
    return (
      <div className="flex items-center gap-2">
        <div className="flex">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`h-2 w-6 mr-1 rounded ${i < level ? 'bg-primary' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{labels[level - 1]}</span>
      </div>
    );
  };

  /**
   * Obtiene el icono según la categoría
   */
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'producto': return <Store className="h-4 w-4" />;
      case 'servicio': return <Target className="h-4 w-4" />;
      case 'territorio': return <BookOpen className="h-4 w-4" />;
      case 'industria': return <Award className="h-4 w-4" />;
      case 'herramienta': return <Plus className="h-4 w-4" />;
      default: return <Store className="h-4 w-4" />;
    }
  };

  /**
   * Traduce categorías al español
   */
  const translateCategory = (category: string) => {
    const translations = {
      'producto': 'Productos',
      'servicio': 'Servicios',
      'territorio': 'Territorios',
      'industria': 'Industrias',
      'herramienta': 'Herramientas'
    };
    return translations[category as keyof typeof translations] || category;
  };

  /**
   * Agrupa habilidades por categoría
   */
  const skillsByCategory = skills.reduce((acc, skill) => {
    if (!acc[skill.skill_category]) acc[skill.skill_category] = [];
    acc[skill.skill_category].push(skill);
    return acc;
  }, {} as Record<string, SalesSkill[]>);

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
        
        {selectedSalespersonId && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Añadir Conocimiento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Añadir Nuevo Conocimiento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="category">Categoría</Label>
                  <Select value={skillForm.skill_category} onValueChange={(value) => setSkillForm(prev => ({ ...prev, skill_category: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="producto">Productos</SelectItem>
                      <SelectItem value="servicio">Servicios</SelectItem>
                      <SelectItem value="territorio">Territorios</SelectItem>
                      <SelectItem value="industria">Industrias</SelectItem>
                      <SelectItem value="herramienta">Herramientas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="skill_name">Nombre del Conocimiento</Label>
                  <Input
                    id="skill_name"
                    value={skillForm.skill_name}
                    onChange={(e) => setSkillForm(prev => ({ ...prev, skill_name: e.target.value }))}
                    placeholder="Ej: CRM Salesforce, Sector Automotriz, etc."
                  />
                </div>
                
                <div>
                  <Label>Nivel de Expertise (1-5)</Label>
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      {Array.from({ length: 5 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`h-8 w-12 rounded ${i < skillForm.expertise_level ? 'bg-primary text-primary-foreground' : 'bg-gray-200'}`}
                          onClick={() => setSkillForm(prev => ({ ...prev, expertise_level: i + 1 }))}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    {renderExpertiseLevel(skillForm.expertise_level)}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="years_experience">Años de Experiencia</Label>
                  <Input
                    id="years_experience"
                    type="number"
                    min="0"
                    value={skillForm.years_experience}
                    onChange={(e) => setSkillForm(prev => ({ ...prev, years_experience: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                
                <div>
                  <Label>Certificaciones</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nombre de la certificación"
                        value={newCertification}
                        onChange={(e) => setNewCertification(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addCertification()}
                      />
                      <Button type="button" onClick={addCertification} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {skillForm.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {skillForm.certifications.map((cert, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            {cert}
                            <button
                              type="button"
                              onClick={() => removeCertification(index)}
                              className="ml-1 text-xs"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateSkill}
                    disabled={!skillForm.skill_name}
                  >
                    Añadir Conocimiento
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Lista de conocimientos del vendedor seleccionado */}
      {selectedSalespersonId && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Conocimientos del Vendedor ({skills.length})
          </h3>
          
          {skills.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Este vendedor no tiene conocimientos registrados aún
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getCategoryIcon(category)}
                      {translateCategory(category)} ({categorySkills.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {categorySkills.map((skill) => (
                        <Card key={skill.id} className="border-l-4 border-l-primary">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between text-base">
                              <span>{skill.skill_name}</span>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar conocimiento?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción eliminará el conocimiento en {skill.skill_name}.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteSkill(skill.id)}>
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div>
                              <span className="text-sm font-medium">Nivel de Expertise:</span>
                              <div className="mt-1">
                                {renderExpertiseLevel(skill.expertise_level)}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{skill.years_experience} años de experiencia</span>
                            </div>
                            
                            {skill.certifications && skill.certifications.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <Award className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">Certificaciones:</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {skill.certifications.map((cert, index) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                      {cert}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedSalespersonId && (
        <Card>
          <CardContent className="text-center py-12">
            <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Gestión de Conocimientos de Ventas</h3>
            <p className="text-muted-foreground mb-4">
              Selecciona un vendedor para gestionar sus conocimientos y competencias comerciales
            </p>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Aquí puedes registrar conocimientos en productos, servicios, territorios,
                industrias y herramientas de cada vendedor.
              </p>
              <p>
                Incluye certificaciones y niveles de experiencia.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}