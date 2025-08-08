/**
 * COMPONENTE: SkillsManager
 * 
 * PROPÓSITO:
 * - Gestionar las habilidades técnicas de los técnicos
 * - Permite ver, editar y actualizar los niveles de habilidad
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
}

interface TechnicianSkill {
  id: string;
  technician_id: string;
  service_type_id: string;
  skill_level: number;
  years_experience: number;
  certifications: string[];
  notes?: string;
  service_types?: ServiceType;
}

interface SkillsManagerProps {
  technicianId?: string; // Si se proporciona, edita ese técnico específico
  readonly?: boolean; // Si es true, solo muestra las habilidades sin permitir edición
  className?: string;
}

export function SkillsManager({ 
  technicianId, 
  readonly = false, 
  className = "" 
}: SkillsManagerProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [skills, setSkills] = useState<TechnicianSkill[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Determinar qué técnico gestionar
  const targetTechnicianId = technicianId || user?.id;
  const canEdit = !readonly && (
    profile?.role === 'administrador' || 
    (profile?.role === 'tecnico' && targetTechnicianId === user?.id)
  );

  useEffect(() => {
    if (targetTechnicianId) {
      loadSkills();
      loadServiceTypes();
    }
  }, [targetTechnicianId]);

  /**
   * FUNCIÓN: loadSkills
   * 
   * PROPÓSITO:
   * - Cargar las habilidades existentes del técnico
   * - Incluir información del tipo de servicio
   */
  const loadSkills = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('technician_skills')
        .select(`
          *,
          service_types:service_type_id(id, name, description)
        `)
        .eq('technician_id', targetTechnicianId)
        .order('service_types(name)');

      if (error) throw error;
      setSkills(data || []);
    } catch (error) {
      console.error('Error loading skills:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las habilidades técnicas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * FUNCIÓN: loadServiceTypes
   * 
   * PROPÓSITO:
   * - Cargar todos los tipos de servicio disponibles
   * - Permitir agregar nuevas habilidades
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
   * FUNCIÓN: updateSkill
   * 
   * PROPÓSITO:
   * - Actualizar una habilidad existente
   * - Validar datos antes de guardar
   */
  const updateSkill = async (skillId: string, updates: Partial<TechnicianSkill>) => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('technician_skills')
        .update(updates)
        .eq('id', skillId);

      if (error) throw error;
      
      await loadSkills(); // Recargar datos
      
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

  /**
   * FUNCIÓN: addNewSkill
   * 
   * PROPÓSITO:
   * - Agregar una nueva habilidad técnica
   * - Evitar duplicados
   */
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
          notes: ''
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

  /**
   * FUNCIÓN: deleteSkill
   * 
   * PROPÓSITO:
   * - Eliminar una habilidad técnica
   */
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

  /**
   * FUNCIÓN: getSkillStars
   * 
   * PROPÓSITO:
   * - Renderizar estrellas según el nivel de habilidad
   */
  const getSkillStars = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-4 w-4 ${i < level ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
      />
    ));
  };

  /**
   * FUNCIÓN: getUnassignedServiceTypes
   * 
   * PROPÓSITO:
   * - Obtener tipos de servicio que aún no tienen habilidad asignada
   */
  const getUnassignedServiceTypes = () => {
    return serviceTypes.filter(st => 
      !skills.some(skill => skill.service_type_id === st.id)
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse text-muted-foreground">
            Cargando habilidades técnicas...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Habilidades Técnicas
          {!canEdit && <Badge variant="secondary">Solo lectura</Badge>}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {skills.length === 0 ? (
          <Alert>
            <User className="h-4 w-4" />
            <AlertDescription>
              {canEdit 
                ? "No hay habilidades técnicas registradas. Comienza agregando una habilidad."
                : "Este técnico no tiene habilidades técnicas registradas."
              }
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {skills.map((skill) => (
              <div 
                key={skill.id}
                className="border rounded-lg p-4 space-y-3"
              >
                {/* Header de la habilidad */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">
                      {skill.service_types?.name || 'Servicio no especificado'}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      {getSkillStars(skill.skill_level)}
                      <span className="text-sm text-muted-foreground">
                        Nivel {skill.skill_level}/5
                      </span>
                    </div>
                  </div>
                  
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSkill(skill.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                {/* Controles de edición */}
                {canEdit ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nivel de Habilidad (1-5)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        value={skill.skill_level}
                        onChange={(e) => {
                          const newLevel = parseInt(e.target.value);
                          if (newLevel >= 1 && newLevel <= 5) {
                            updateSkill(skill.id, { skill_level: newLevel });
                          }
                        }}
                        disabled={saving}
                      />
                    </div>

                    <div>
                      <Label>Años de Experiencia</Label>
                      <Input
                        type="number"
                        min="0"
                        value={skill.years_experience}
                        onChange={(e) => {
                          const years = parseInt(e.target.value) || 0;
                          updateSkill(skill.id, { years_experience: years });
                        }}
                        disabled={saving}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Certificaciones (separadas por comas)</Label>
                      <Input
                        placeholder="Certificación A, Certificación B..."
                        value={skill.certifications?.join(', ') || ''}
                        onChange={(e) => {
                          const certs = e.target.value
                            .split(',')
                            .map(c => c.trim())
                            .filter(c => c.length > 0);
                          updateSkill(skill.id, { certifications: certs });
                        }}
                        disabled={saving}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Notas adicionales</Label>
                      <Textarea
                        placeholder="Notas sobre esta habilidad..."
                        value={skill.notes || ''}
                        onChange={(e) => {
                          updateSkill(skill.id, { notes: e.target.value });
                        }}
                        disabled={saving}
                        rows={2}
                      />
                    </div>
                  </div>
                ) : (
                  // Vista de solo lectura
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {skill.years_experience} años de experiencia
                      </Badge>
                    </div>
                    
                    {skill.certifications && skill.certifications.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Certificaciones:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {skill.certifications.map((cert, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {skill.notes && (
                      <div>
                        <span className="text-sm font-medium">Notas:</span>
                        <p className="text-sm text-muted-foreground mt-1">{skill.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Agregar nueva habilidad */}
        {canEdit && getUnassignedServiceTypes().length > 0 && (
          <div className="border-t pt-4">
            <h5 className="font-medium mb-2">Agregar Nueva Habilidad</h5>
            <div className="flex flex-wrap gap-2">
              {getUnassignedServiceTypes().map((serviceType) => (
                <Button
                  key={serviceType.id}
                  variant="outline"
                  size="sm"
                  onClick={() => addNewSkill(serviceType.id)}
                  disabled={saving}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {serviceType.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}