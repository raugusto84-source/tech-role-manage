import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, Plus, Trash2, User, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ServiceType {
  id: string;
  name: string;
  description?: string;
  category: string;
  item_type: string;
}

interface TechnicianSkill {
  id: string;
  technician_id: string;
  service_type_id: string;
  skill_level: number;
  years_experience: number;
  created_at: string;
  updated_at: string;
  service_types?: ServiceType;
  completed_orders_count?: number;
}

interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

interface SkillsManagerProps {
  technicianId?: string;
  readonly?: boolean;
}

export function SkillsManager({ technicianId, readonly = false }: SkillsManagerProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [skills, setSkills] = useState<TechnicianSkill[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(technicianId || '');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersCount, setOrdersCount] = useState<Record<string, number>>({});

  const targetTechnicianId = selectedUserId || technicianId || user?.id;
  const canEdit = !readonly && (
    profile?.role === 'administrador' || 
    (targetTechnicianId === user?.id && (profile?.role === 'tecnico' || profile?.role === 'vendedor'))
  );

  useEffect(() => {
    loadUsers();
    loadServiceTypes();
  }, []);

  useEffect(() => {
    if (targetTechnicianId) {
      loadSkills();
    }
  }, [targetTechnicianId]);

  const loadSkills = async () => {
    if (!targetTechnicianId) return;
    
    try {
      const { data, error } = await supabase
        .from('technician_skills')
        .select(`*, service_types!fk_technician_skills_service_type(*)`)
        .eq('technician_id', targetTechnicianId);

      if (error) throw error;
      
      const validSkills = (data || []).filter((skill: any) => 
        skill.service_types && skill.service_types.id
      ) as unknown as TechnicianSkill[];
      
      setSkills(validSkills);
      setSelectedServices(validSkills.map(skill => skill.service_type_id));
      
      // Cargar conteo de órdenes completadas para cada servicio
      await loadOrdersCount(validSkills);
    } catch (error) {
      console.error('Error loading technician skills:', error);
    }
  };

  const loadOrdersCount = async (skillsList: TechnicianSkill[]) => {
    if (!targetTechnicianId || skillsList.length === 0) return;
    
    try {
      const counts: Record<string, number> = {};
      
      // Obtener conteo para cada tipo de servicio
      for (const skill of skillsList) {
        // Primero obtener los order_ids que contienen este servicio
        const { data: orderIds, error: orderIdsError } = await supabase
          .from('order_items')
          .select('order_id')
          .eq('service_type_id', skill.service_type_id);
        
        if (orderIdsError || !orderIds) {
          counts[skill.service_type_id] = 0;
          continue;
        }
        
        const orderIdsList = orderIds.map(item => item.order_id);
        
        if (orderIdsList.length === 0) {
          counts[skill.service_type_id] = 0;
          continue;
        }
        
        // Luego contar órdenes finalizadas del técnico
        const { count, error } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_technician', targetTechnicianId)
          .eq('status', 'finalizada')
          .in('id', orderIdsList);
        
        if (!error) {
          counts[skill.service_type_id] = count || 0;
        } else {
          counts[skill.service_type_id] = 0;
        }
      }
      
      setOrdersCount(counts);
    } catch (error) {
      console.error('Error loading orders count:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, role')
        .in('role', ['tecnico', 'administrador', 'vendedor'])
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('id, name, description, category, item_type')
        .eq('is_active', true)
        .eq('item_type', 'servicio')
        .order('category, name');

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error('Error loading service types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceToggle = async (serviceTypeId: string, isChecked: boolean) => {
    if (!targetTechnicianId) return;

    try {
      if (isChecked) {
        // Add skill
        const { error } = await supabase
          .from('technician_skills')
          .insert({
            technician_id: targetTechnicianId,
            service_type_id: serviceTypeId,
            skill_level: 1,
            years_experience: 0
          });

        if (error) throw error;
        
        setSelectedServices(prev => [...prev, serviceTypeId]);
        toast({
          title: "Habilidad agregada",
          description: "Nueva habilidad técnica agregada correctamente",
        });
      } else {
        // Remove skill
        const { error } = await supabase
          .from('technician_skills')
          .delete()
          .eq('technician_id', targetTechnicianId)
          .eq('service_type_id', serviceTypeId);

        if (error) throw error;
        
        setSelectedServices(prev => prev.filter(id => id !== serviceTypeId));
        toast({
          title: "Habilidad eliminada",
          description: "La habilidad ha sido eliminada correctamente",
        });
      }
      
      await loadSkills();
    } catch (error) {
      console.error('Error toggling skill:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la habilidad",
        variant: "destructive"
      });
    }
  };

  const updateSkillLevel = async (skillId: string, level: number) => {
    try {
      const { error } = await supabase
        .from('technician_skills')
        .update({ skill_level: level })
        .eq('id', skillId);

      if (error) throw error;
      
      await loadSkills();
      toast({
        title: "Nivel actualizado",
        description: `Nivel de habilidad actualizado a ${level}`,
      });
    } catch (error) {
      console.error('Error updating skill level:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el nivel",
        variant: "destructive"
      });
    }
  };

  const getSkillStars = (level: number, skillId?: string, interactive = false) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i}
        className={`h-4 w-4 ${i < level ? 'text-green-500 fill-green-500' : 'text-muted-foreground'} ${
          interactive && canEdit ? 'cursor-pointer hover:text-green-400' : ''
        }`}
        onClick={interactive && canEdit && skillId ? () => updateSkillLevel(skillId, i + 1) : undefined}
      />
    ));
  };

  // Group services by category
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const selectedUser = users.find(u => u.user_id === selectedUserId);
  const servicesByCategory = getServicesByCategory();

  return (
    <div className="space-y-6">
      {/* User Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Gestión de Habilidades Técnicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Seleccionar Usuario</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un usuario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.full_name} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedUser && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Usuario Seleccionado</label>
                  <div className="flex items-center gap-2 p-2 rounded-md border">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{selectedUser.full_name}</span>
                    <Badge variant="outline">{selectedUser.role}</Badge>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills Management by Category */}
      {selectedUserId && (
        <div className="space-y-6">
          {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                  <Badge variant="outline">{categoryServices.length} servicios</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryServices.map((service) => {
                    const isSelected = selectedServices.includes(service.id);
                    const skill = skills.find(s => s.service_type_id === service.id);
                    
                    return (
                      <Card key={service.id} className={`transition-all ${isSelected ? 'border-primary bg-primary/5' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {canEdit && (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleServiceToggle(service.id, checked as boolean)}
                                className="mt-1"
                              />
                            )}
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{service.name}</h4>
                              {service.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {service.description}
                                </p>
                              )}
                              
                              {isSelected && skill && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Nivel:</span>
                                    <div className="flex gap-1">
                                      {getSkillStars(skill.skill_level, skill.id, true)}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {skill.skill_level}/5
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Completado:</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {ordersCount[service.id] || 0} veces
                                    </Badge>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {Object.keys(servicesByCategory).length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No hay servicios disponibles
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!selectedUserId && (
        <Card>
          <CardContent className="text-center py-12">
            <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Gestión de Habilidades Técnicas</h3>
            <p className="text-muted-foreground mb-4">
              Selecciona un usuario para gestionar sus habilidades técnicas
            </p>
            <div className="text-sm text-muted-foreground">
              <p>• Asigna servicios con checkbox simple</p>
              <p>• Ajusta niveles de habilidad con estrellas</p>
              <p>• Organizado por categorías de servicios</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}