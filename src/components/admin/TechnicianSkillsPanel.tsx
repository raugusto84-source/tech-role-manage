import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, Star, Wrench, BookOpen, Trophy, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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

interface TechnicianSkillsPanelProps {
  selectedUserId?: string | null;
  selectedUserRole?: string | null;
}

/**
 * Panel de gestión de habilidades técnicas
 * 
 * Funcionalidades:
 * - Gestión completa de habilidades por técnico
 * - Asignación de niveles de competencia (1-5 estrellas)
 * - Registro de años de experiencia
 * - Gestión de certificaciones
 * - Notas adicionales
 * 
 * Reutilizable para:
 * - Administración de habilidades
 * - Asignación automática de técnicos
 * - Reportes de competencias
 * - Selección de personal especializado
 */
export function TechnicianSkillsPanel({ selectedUserId, selectedUserRole }: TechnicianSkillsPanelProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [skills, setSkills] = useState<TechnicianSkill[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(selectedUserId);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const { toast } = useToast();

  // Estado del formulario de habilidad
  const [skillForm, setSkillForm] = useState({
    service_type_id: '',
    skill_level: 1,
    years_experience: 0,
    certifications: [] as string[],
    notes: ''
  });

  // Estado del formulario de nuevo servicio
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    estimated_hours: 1,
    base_price: 0
  });

  // Nuevo certificado temporal
  const [newCertification, setNewCertification] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedUserRole === 'tecnico') {
      setSelectedTechnicianId(selectedUserId);
      loadSkillsForTechnician(selectedUserId);
    }
  }, [selectedUserId, selectedUserRole]);

  useEffect(() => {
    if (selectedTechnicianId) {
      loadSkillsForTechnician(selectedTechnicianId);
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
    } catch (error) {
      console.error('Error loading skills:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las habilidades',
        variant: 'destructive'
      });
    }
  };

  /**
   * Crea una nueva habilidad para el técnico
   */
  const handleCreateSkill = async () => {
    if (!selectedTechnicianId || !skillForm.service_type_id) return;

    try {
      const { error } = await supabase
        .from('technician_skills')
        .insert({
          technician_id: selectedTechnicianId,
          service_type_id: skillForm.service_type_id,
          skill_level: skillForm.skill_level,
          years_experience: skillForm.years_experience,
          certifications: skillForm.certifications,
          notes: skillForm.notes || null
        });

      if (error) throw error;

      loadSkillsForTechnician(selectedTechnicianId);
      resetSkillForm();
      setIsDialogOpen(false);
      toast({
        title: 'Habilidad añadida',
        description: 'Habilidad registrada exitosamente'
      });

    } catch (error: any) {
      console.error('Error creating skill:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo añadir la habilidad',
        variant: 'destructive'
      });
    }
  };

  /**
   * Crea un nuevo tipo de servicio
   */
  const handleCreateServiceType = async () => {
    try {
      const { error } = await supabase
        .from('service_types')
        .insert({
          name: serviceForm.name,
          description: serviceForm.description,
          estimated_hours: serviceForm.estimated_hours,
          base_price: serviceForm.base_price,
          is_active: true
        });

      if (error) throw error;

      loadServiceTypes();
      resetServiceForm();
      setIsServiceDialogOpen(false);
      toast({
        title: 'Servicio creado',
        description: 'Nuevo tipo de servicio creado exitosamente'
      });

    } catch (error: any) {
      console.error('Error creating service type:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el tipo de servicio',
        variant: 'destructive'
      });
    }
  };

  /**
   * Elimina una habilidad
   */
  const handleDeleteSkill = async (skillId: string) => {
    try {
      const { error } = await supabase
        .from('technician_skills')
        .delete()
        .eq('id', skillId);

      if (error) throw error;

      if (selectedTechnicianId) {
        loadSkillsForTechnician(selectedTechnicianId);
      }
      toast({
        title: 'Habilidad eliminada',
        description: 'Habilidad eliminada exitosamente'
      });

    } catch (error: any) {
      console.error('Error deleting skill:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar la habilidad',
        variant: 'destructive'
      });
    }
  };

  /**
   * Añade una nueva certificación al formulario
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
   * Elimina una certificación del formulario
   */
  const removeCertification = (index: number) => {
    setSkillForm(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }));
  };

  /**
   * Resetea el formulario de habilidad
   */
  const resetSkillForm = () => {
    setSkillForm({
      service_type_id: '',
      skill_level: 1,
      years_experience: 0,
      certifications: [],
      notes: ''
    });
  };

  /**
   * Resetea el formulario de servicio
   */
  const resetServiceForm = () => {
    setServiceForm({
      name: '',
      description: '',
      estimated_hours: 1,
      base_price: 0
    });
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
   * Obtiene servicios no asignados al técnico actual
   */
  const getUnassignedServices = () => {
    const assignedServiceIds = skills.map(skill => skill.service_type_id);
    return serviceTypes.filter(service => !assignedServiceIds.includes(service.id));
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
        
        {selectedTechnicianId && (
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetSkillForm} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Añadir Habilidad
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Añadir Nueva Habilidad</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="service_type">Tipo de Servicio</Label>
                    <Select value={skillForm.service_type_id} onValueChange={(value) => setSkillForm(prev => ({ ...prev, service_type_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar servicio" />
                      </SelectTrigger>
                      <SelectContent>
                        {getUnassignedServices().map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="skill_level">Nivel de Habilidad (1-5)</Label>
                    <div className="flex items-center gap-2 mt-2">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-6 w-6 cursor-pointer ${i < skillForm.skill_level ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                          onClick={() => setSkillForm(prev => ({ ...prev, skill_level: i + 1 }))}
                        />
                      ))}
                      <span className="ml-2 text-sm text-muted-foreground">
                        {skillForm.skill_level}/5
                      </span>
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
                  
                  <div>
                    <Label htmlFor="notes">Notas Adicionales</Label>
                    <Textarea
                      id="notes"
                      placeholder="Observaciones, especialidades, etc."
                      value={skillForm.notes}
                      onChange={(e) => setSkillForm(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateSkill}
                      disabled={!skillForm.service_type_id}
                    >
                      Añadir Habilidad
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={resetServiceForm} className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Nuevo Servicio
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Tipo de Servicio</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="service_name">Nombre del Servicio</Label>
                    <Input
                      id="service_name"
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej: Reparación de laptops"
                    />
                  </div>
                  <div>
                    <Label htmlFor="service_description">Descripción</Label>
                    <Textarea
                      id="service_description"
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descripción detallada del servicio"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="estimated_hours">Horas Estimadas</Label>
                      <Input
                        id="estimated_hours"
                        type="number"
                        min="1"
                        value={serviceForm.estimated_hours}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, estimated_hours: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="base_price">Precio Base</Label>
                      <Input
                        id="base_price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={serviceForm.base_price}
                        onChange={(e) => setServiceForm(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsServiceDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateServiceType}
                      disabled={!serviceForm.name || !serviceForm.description}
                    >
                      Crear Servicio
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Lista de habilidades del técnico seleccionado */}
      {selectedTechnicianId && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Habilidades del Técnico ({skills.length})
          </h3>
          
          {skills.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Este técnico no tiene habilidades registradas aún
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {skills.map((skill) => (
                <Card key={skill.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{skill.service_type?.name}</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar habilidad?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción eliminará la habilidad en {skill.service_type?.name}.
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
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">Nivel:</span>
                        <div className="flex">
                          {renderStars(skill.skill_level)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{skill.years_experience} años de experiencia</span>
                    </div>
                    
                    {skill.certifications && skill.certifications.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="h-4 w-4 text-muted-foreground" />
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
                    
                    {skill.notes && (
                      <div>
                        <Separator className="my-2" />
                        <p className="text-xs text-muted-foreground">{skill.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedTechnicianId && (
        <Card>
          <CardContent className="text-center py-12">
            <Wrench className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Gestión de Habilidades Técnicas</h3>
            <p className="text-muted-foreground mb-4">
              Selecciona un técnico para gestionar sus habilidades y competencias
            </p>
            <p className="text-sm text-muted-foreground">
              Aquí puedes asignar niveles de competencia, registrar certificaciones y
              gestionar la experiencia de cada técnico por tipo de servicio.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}