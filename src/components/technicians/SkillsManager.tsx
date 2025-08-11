/**
 * COMPONENTE: SkillsManager
 * 
 * PROPÓSITO:
 * - Gestionar las habilidades técnicas de los técnicos basadas en los servicios del módulo de ventas
 * - Permite ver, editar y actualizar los niveles de habilidad para cada servicio
 * - Proporciona interfaz para asignar años de experiencia y certificaciones
 * 
 * REUTILIZACIÓN:
 * - Panel de administración para gestionar habilidades
 * - Perfil del técnico para actualizar sus propias habilidades
 * - Módulo de recursos humanos
 * - Reportes de capacidades técnicas
 * 
 * FUNCIONALIDADES:
 * - CRUD completo de habilidades técnicas
 * - Validación de niveles de habilidad (1-5)
 * - Gestión de certificaciones como array de strings
 * - Visualización de estadísticas de habilidades
 * - Integración con servicios del módulo de ventas
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Star, 
  Save, 
  Plus, 
  Trash2, 
  Award,
  Clock,
  User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ServiceType {
  id: string;
  name: string;
  description?: string;
  category: string;
  item_type: string;
  estimated_hours?: number;
}

interface TechnicianSkill {
  id: string;
  technician_id: string;
  service_type_id: string;
  skill_level: number;
  years_experience: number;
  certifications: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
  service_types?: ServiceType;
}

interface SkillsManagerProps {
  technicianId?: string;
  readonly?: boolean;
}

export function SkillsManager({ 
  technicianId, 
  readonly = false 
}: SkillsManagerProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [skills, setSkills] = useState<TechnicianSkill[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Determinar qué técnico gestionar
  const targetTechnicianId = technicianId || user?.id;
  const canEdit = !readonly && (
    profile?.role === 'administrador' || 
    (targetTechnicianId === user?.id && (profile?.role === 'tecnico' || profile?.role === 'vendedor'))
  );

  useEffect(() => {
    if (targetTechnicianId) {
      loadSkills();
      loadServiceTypes();
    }
  }, [targetTechnicianId]);

  const loadSkills = async () => {
    if (!targetTechnicianId) return;
    
    try {
      const { data, error } = await supabase
        .from('technician_skills')
        .select(`
          *,
          service_types!fk_technician_skills_service_type (
            id,
            name,
            description,
            category,
            item_type,
            estimated_hours
          )
        `)
        .eq('technician_id', targetTechnicianId);

      if (error) throw error;
      
      // Filter and type the data properly, converting to unknown first to avoid TypeScript errors
      const validSkills = (data || []).filter((skill: any) => 
        skill.service_types && 
        typeof skill.service_types === 'object' && 
        !('error' in skill.service_types) &&
        skill.service_types.id
      ) as unknown as TechnicianSkill[];
      
      setSkills(validSkills);
    } catch (error) {
      console.error('Error loading technician skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('id, name, description, category, item_type, estimated_hours')
        .eq('is_active', true)
        .eq('item_type', 'servicio') // Solo servicios, no artículos
        .order('category, name');

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error('Error loading service types:', error);
    }
  };

  const updateSkill = async (skillId: string, updates: Partial<TechnicianSkill>) => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('technician_skills')
        .update(updates)
        .eq('id', skillId);

      if (error) throw error;
      
      await loadSkills();
      
      toast({
        title: "Habilidad actualizada",
        description: "Los cambios han sido guardados correctamente",
      });
    } catch (error) {
      console.error('Error updating skill:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la habilidad",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const addNewSkill = async (serviceTypeId: string) => {
    try {
      setSaving(true);
      
      // Verificar si ya existe esta habilidad
      const existingSkill = skills.find(s => s.service_type_id === serviceTypeId);
      if (existingSkill) {
        toast({
          title: "Habilidad ya existe",
          description: "Este técnico ya tiene registrada esta habilidad",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('technician_skills')
        .insert({
          technician_id: targetTechnicianId,
          service_type_id: serviceTypeId,
          skill_level: 1,
          years_experience: 0,
          certifications: [],
          notes: 'Asignado automáticamente basado en servicios disponibles'
        });

      if (error) throw error;
      
      await loadSkills();
      
      toast({
        title: "Habilidad agregada",
        description: "Nueva habilidad técnica agregada correctamente",
      });
    } catch (error) {
      console.error('Error adding skill:', error);
      toast({
        title: "Error",
        description: "No se pudo agregar la habilidad",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteSkill = async (skillId: string) => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('technician_skills')
        .delete()
        .eq('id', skillId);

      if (error) throw error;
      
      await loadSkills();
      
      toast({
        title: "Habilidad eliminada",
        description: "La habilidad ha sido eliminada correctamente",
      });
    } catch (error) {
      console.error('Error deleting skill:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la habilidad",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getSkillStars = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-4 w-4 ${i < level ? 'text-warning fill-warning' : 'text-muted-foreground'}`} 
      />
    ));
  };

  const getUnassignedServiceTypes = () => {
    return serviceTypes.filter(serviceType => 
      !skills.some(skill => skill.service_type_id === serviceType.id)
    );
  };

  // Agrupar servicios por categoría
  const getServicesByCategory = () => {
    const grouped: Record<string, ServiceType[]> = {};
    serviceTypes.forEach(service => {
      if (!grouped[service.category]) {
        grouped[service.category] = [];
      }
      grouped[service.category].push(service);
    });
    return grouped;
  };

  // Obtener habilidades por categoría
  const getSkillsByCategory = () => {
    const grouped: Record<string, TechnicianSkill[]> = {};
    skills.forEach(skill => {
      if (skill.service_types) {
        const category = skill.service_types.category;
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(skill);
      }
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!targetTechnicianId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Gestión de Habilidades Técnicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Selecciona un usuario para gestionar sus habilidades técnicas basadas en los servicios del módulo de ventas.
              Las habilidades pueden asignarse a técnicos, administradores y vendedores.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const servicesByCategory = getServicesByCategory();
  const skillsByCategory = getSkillsByCategory();
  const unassignedServices = getUnassignedServiceTypes();

  return (
    <div className="space-y-6">
      {/* Habilidades existentes agrupadas por categoría */}
      {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Categoría: {category.charAt(0).toUpperCase() + category.slice(1)}
              <Badge variant="outline">{categorySkills.length} habilidades</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categorySkills.map((skill) => (
              <Card key={skill.id} className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">
                          {skill.service_types?.name}
                        </h4>
                        <Badge variant="secondary">
                          {skill.service_types?.estimated_hours}h estimadas
                        </Badge>
                      </div>
                      
                      {skill.service_types?.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {skill.service_types.description}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Nivel de Habilidad */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Nivel de Habilidad</Label>
                          <div className="flex items-center gap-2">
                            {canEdit ? (
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((level) => (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => updateSkill(skill.id, { skill_level: level })}
                                    className={`h-6 w-6 rounded-full border-2 transition-colors ${
                                      skill.skill_level >= level
                                        ? 'bg-warning border-warning text-warning-foreground'
                                        : 'border-border hover:border-warning/50'
                                    }`}
                                  >
                                    <Star className="h-3 w-3 mx-auto" />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              getSkillStars(skill.skill_level)
                            )}
                            <span className="text-sm text-muted-foreground ml-2">
                              {skill.skill_level}/5
                            </span>
                          </div>
                        </div>

                        {/* Años de Experiencia */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Años de Experiencia
                          </Label>
                          {canEdit ? (
                            <Input
                              type="number"
                              min="0"
                              max="50"
                              value={skill.years_experience}
                              onChange={(e) => updateSkill(skill.id, { 
                                years_experience: parseInt(e.target.value) || 0 
                              })}
                              className="w-full"
                            />
                          ) : (
                            <p className="text-sm">{skill.years_experience} años</p>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Acciones</Label>
                          <div className="flex gap-2">
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteSkill(skill.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Certificaciones */}
                      {(skill.certifications?.length > 0 || canEdit) && (
                        <div className="mt-4 space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <Award className="h-4 w-4" />
                            Certificaciones
                          </Label>
                          {canEdit ? (
                            <Textarea
                              placeholder="Certificaciones relacionadas (una por línea)"
                              value={skill.certifications?.join('\n') || ''}
                              onChange={(e) => updateSkill(skill.id, { 
                                certifications: e.target.value.split('\n').filter(cert => cert.trim()) 
                              })}
                              className="w-full"
                              rows={3}
                            />
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {skill.certifications?.map((cert, index) => (
                                <Badge key={index} variant="outline">
                                  {cert}
                                </Badge>
                              )) || <span className="text-sm text-muted-foreground">Sin certificaciones</span>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notas */}
                      {(skill.notes || canEdit) && (
                        <div className="mt-4 space-y-2">
                          <Label className="text-sm font-medium">Notas</Label>
                          {canEdit ? (
                            <Textarea
                              placeholder="Notas adicionales sobre esta habilidad"
                              value={skill.notes || ''}
                              onChange={(e) => updateSkill(skill.id, { notes: e.target.value })}
                              className="w-full"
                              rows={2}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {skill.notes || 'Sin notas adicionales'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Servicios disponibles para agregar */}
      {canEdit && unassignedServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Agregar Nuevas Habilidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(servicesByCategory).map(([category, services]) => {
                const availableServices = services.filter(service => 
                  !skills.some(skill => skill.service_type_id === service.id)
                );
                
                if (availableServices.length === 0) return null;

                return (
                  <div key={category} className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground">
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </h4>
                    {availableServices.map((service) => (
                      <Button
                        key={service.id}
                        variant="outline"
                        size="sm"
                        onClick={() => addNewSkill(service.id)}
                        className="w-full justify-start text-left h-auto p-3"
                      >
                        <div>
                          <div className="font-medium">{service.name}</div>
                          {service.description && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {service.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {service.estimated_hours}h estimadas
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado vacío */}
      {skills.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin habilidades registradas</h3>
            <p className="text-muted-foreground mb-4">
              Este usuario aún no tiene habilidades técnicas asignadas basadas en los servicios del módulo de ventas.
            </p>
            {canEdit && serviceTypes.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Usa la sección "Agregar Nuevas Habilidades" para comenzar a asignar servicios como habilidades técnicas.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}