import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Users, Truck, Plus, X, Wrench, Star, Calendar } from 'lucide-react';

interface Technician {
  user_id: string;
  full_name: string;
  email: string;
  skills: Array<{
    service_name: string;
    skill_level: number;
  }>;
}

interface Vehicle {
  id: string;
  model: string;
  license_plate: string;
  year: number | null;
  status: string;
}

interface Assignment {
  id: string;
  assigned_at: string;
  assigned_by: string;
}

interface FleetAssignmentsProps {
  groupId: string;
}

export function FleetAssignments({ groupId }: FleetAssignmentsProps) {
  const [groupName, setGroupName] = useState('');
  const [assignedTechnicians, setAssignedTechnicians] = useState<(Technician & Assignment)[]>([]);
  const [assignedVehicles, setAssignedVehicles] = useState<(Vehicle & Assignment)[]>([]);
  const [availableTechnicians, setAvailableTechnicians] = useState<Technician[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingTechnician, setIsAddingTechnician] = useState(false);
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);

  useEffect(() => {
    if (groupId) {
      loadAssignments();
    }
  }, [groupId]);

  const loadAssignments = async () => {
    try {
      setLoading(true);

      // Cargar información del grupo
      const { data: groupData, error: groupError } = await supabase
        .from('fleet_groups')
        .select('name')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroupName(groupData.name);

      // Cargar técnicos asignados con habilidades
      const { data: assignedTechData } = await supabase
        .from('fleet_group_technicians')
        .select(`
          id,
          assigned_at,
          assigned_by,
          profiles!inner(user_id, full_name, email)
        `)
        .eq('fleet_group_id', groupId)
        .eq('is_active', true);

      const technicianIds = assignedTechData?.map(t => (t.profiles as any).user_id) || [];
      
      // Cargar habilidades de técnicos asignados
      const assignedWithSkills = await Promise.all(
        (assignedTechData || []).map(async (assignment) => {
          const profile = assignment.profiles as any;
          
          const { data: skills } = await supabase
            .from('technician_skills')
            .select(`
              skill_level,
              service_types!inner(name)
            `)
            .eq('technician_id', profile.user_id);

          return {
            id: assignment.id,
            assigned_at: assignment.assigned_at,
            assigned_by: assignment.assigned_by,
            user_id: profile.user_id,
            full_name: profile.full_name,
            email: profile.email,
            skills: (skills || []).map(s => ({
              service_name: (s.service_types as any).name,
              skill_level: s.skill_level
            }))
          };
        })
      );

      setAssignedTechnicians(assignedWithSkills);

      // Cargar vehículos asignados
      const { data: assignedVehData } = await supabase
        .from('fleet_group_vehicles')
        .select(`
          id,
          assigned_at,
          assigned_by,
          vehicles!inner(id, model, license_plate, year, status)
        `)
        .eq('fleet_group_id', groupId)
        .eq('is_active', true);

      const assignedVehiclesWithDetails = (assignedVehData || []).map(assignment => ({
        id: assignment.id,
        assigned_at: assignment.assigned_at,
        assigned_by: assignment.assigned_by,
        ...(assignment.vehicles as any)
      }));

      setAssignedVehicles(assignedVehiclesWithDetails);

      // Cargar técnicos disponibles (no asignados a este grupo)
      const { data: allTechnicians } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('role', 'tecnico')
        .not('user_id', 'in', technicianIds.length > 0 ? `(${technicianIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)');

      // Cargar habilidades de técnicos disponibles
      const availableWithSkills = await Promise.all(
        (allTechnicians || []).map(async (tech) => {
          const { data: skills } = await supabase
            .from('technician_skills')
            .select(`
              skill_level,
              service_types!inner(name)
            `)
            .eq('technician_id', tech.user_id);

          return {
            ...tech,
            skills: (skills || []).map(s => ({
              service_name: (s.service_types as any).name,
              skill_level: s.skill_level
            }))
          };
        })
      );

      setAvailableTechnicians(availableWithSkills);

      // Cargar vehículos disponibles
      const vehicleIds = assignedVehiclesWithDetails.map(v => v.id);
      const { data: allVehicles } = await supabase
        .from('vehicles')
        .select('id, model, license_plate, year, status')
        .eq('status', 'activo')
        .not('id', 'in', vehicleIds.length > 0 ? `(${vehicleIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)');

      setAvailableVehicles(allVehicles || []);

    } catch (error) {
      console.error('Error loading assignments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las asignaciones",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const assignTechnician = async (technicianId: string) => {
    try {
      // Verificar si ya está asignado
      const { data: existing } = await supabase
        .from('fleet_group_technicians')
        .select('id')
        .eq('fleet_group_id', groupId)
        .eq('technician_id', technicianId)
        .eq('is_active', true);

      if (existing && existing.length > 0) {
        toast({
          title: "Error",
          description: "Este técnico ya está asignado al grupo",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('fleet_group_technicians')
        .insert({
          fleet_group_id: groupId,
          technician_id: technicianId
        });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Técnico asignado correctamente"
      });

      setIsAddingTechnician(false);
      loadAssignments();
    } catch (error) {
      console.error('Error assigning technician:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar el técnico",
        variant: "destructive"
      });
    }
  };

  const assignVehicle = async (vehicleId: string) => {
    try {
      // Verificar si ya está asignado
      const { data: existing } = await supabase
        .from('fleet_group_vehicles')
        .select('id')
        .eq('fleet_group_id', groupId)
        .eq('vehicle_id', vehicleId)
        .eq('is_active', true);

      if (existing && existing.length > 0) {
        toast({
          title: "Error",
          description: "Este vehículo ya está asignado al grupo",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('fleet_group_vehicles')
        .insert({
          fleet_group_id: groupId,
          vehicle_id: vehicleId
        });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Vehículo asignado correctamente"
      });

      setIsAddingVehicle(false);
      loadAssignments();
    } catch (error) {
      console.error('Error assigning vehicle:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar el vehículo",
        variant: "destructive"
      });
    }
  };

  const unassignTechnician = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('fleet_group_technicians')
        .update({ is_active: false })
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Técnico removido del grupo"
      });

      loadAssignments();
    } catch (error) {
      console.error('Error unassigning technician:', error);
      toast({
        title: "Error",
        description: "No se pudo remover el técnico",
        variant: "destructive"
      });
    }
  };

  const unassignVehicle = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('fleet_group_vehicles')
        .update({ is_active: false })
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Vehículo removido del grupo"
      });

      loadAssignments();
    } catch (error) {
      console.error('Error unassigning vehicle:', error);
      toast({
        title: "Error",
        description: "No se pudo remover el vehículo",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Asignaciones - {groupName}
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Técnicos Asignados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Técnicos ({assignedTechnicians.length})
              </div>
              <Dialog open={isAddingTechnician} onOpenChange={setIsAddingTechnician}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Asignar Técnico</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {availableTechnicians.map((tech) => (
                      <div key={tech.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{tech.full_name}</p>
                          <p className="text-sm text-muted-foreground">{tech.email}</p>
                          <div className="flex gap-1 mt-2">
                            {tech.skills.slice(0, 3).map((skill, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {skill.service_name} (Nv.{skill.skill_level})
                              </Badge>
                            ))}
                            {tech.skills.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{tech.skills.length - 3} más
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => assignTechnician(tech.user_id)}
                        >
                          Asignar
                        </Button>
                      </div>
                    ))}
                    {availableTechnicians.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        No hay técnicos disponibles
                      </p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {assignedTechnicians.map((tech) => (
              <div key={tech.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" />
                      <p className="font-medium text-lg">{tech.full_name}</p>
                      <Badge variant="outline" className="text-xs">
                        Asignado
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{tech.email}</p>
                    
                    {/* Habilidades */}
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Habilidades técnicas:</p>
                      <div className="flex flex-wrap gap-1">
                        {tech.skills.map((skill, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {skill.service_name} (Nivel {skill.skill_level})
                          </Badge>
                        ))}
                        {tech.skills.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">Sin habilidades registradas</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Asignado el {new Date(tech.assigned_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unassignTechnician(tech.id)}
                      className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Desasignar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {assignedTechnicians.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No hay técnicos asignados
              </p>
            )}
          </CardContent>
        </Card>

        {/* Vehículos Asignados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Vehículos ({assignedVehicles.length})
              </div>
              <Dialog open={isAddingVehicle} onOpenChange={setIsAddingVehicle}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Asignar Vehículo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {availableVehicles.map((vehicle) => (
                      <div key={vehicle.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{vehicle.model}</p>
                          <p className="text-sm text-muted-foreground">
                            Placa: {vehicle.license_plate}
                            {vehicle.year && ` | Año: ${vehicle.year}`}
                          </p>
                          <Badge variant="secondary" className="mt-1">
                            {vehicle.status}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => assignVehicle(vehicle.id)}
                        >
                          Asignar
                        </Button>
                      </div>
                    ))}
                    {availableVehicles.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        No hay vehículos disponibles
                      </p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {assignedVehicles.map((vehicle) => (
              <div key={vehicle.id} className="p-3 border rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <p className="font-medium">{vehicle.model}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Placa: {vehicle.license_plate}
                      {vehicle.year && ` | Año: ${vehicle.year}`}
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {vehicle.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Asignado: {new Date(vehicle.assigned_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => unassignVehicle(vehicle.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {assignedVehicles.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No hay vehículos asignados
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}