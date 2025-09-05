import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Trash2, User } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface FleetGroup {
  id: string;
  name: string;
}

interface Technician {
  user_id: string;
  full_name: string;
  email: string;
}

interface FleetAssignment {
  id: string;
  fleet_group_id: string;
  technician_id: string;
  is_active: boolean;
  assigned_at: string;
  notes?: string;
  technician_name?: string;
  fleet_name?: string;
}

export function FleetAssignments() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fleetGroups, setFleetGroups] = useState<FleetGroup[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assignments, setAssignments] = useState<FleetAssignment[]>([]);
  const [selectedFleet, setSelectedFleet] = useState('');
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role === 'administrador' || profile?.role === 'supervisor') {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadFleetGroups(),
        loadTechnicians(),
        loadAssignments()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFleetGroups = async () => {
    const { data, error } = await supabase
      .from('fleet_groups')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error loading fleet groups:', error);
      return;
    }

    setFleetGroups(data || []);
  };

  const loadTechnicians = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .eq('role', 'tecnico')
      .order('full_name');

    if (error) {
      console.error('Error loading technicians:', error);
      return;
    }

    setTechnicians(data || []);
  };

  const loadAssignments = async () => {
    const { data, error } = await supabase
      .from('fleet_assignments')
      .select(`
        id,
        fleet_group_id,
        technician_id,
        is_active,
        assigned_at,
        notes,
        fleet_groups!inner(name),
        profiles!inner(full_name)
      `)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('Error loading assignments:', error);
      return;
    }

    // Transform the data to flatten the joined fields
    const transformedData = (data || []).map((item: any) => ({
      id: item.id,
      fleet_group_id: item.fleet_group_id,
      technician_id: item.technician_id,
      is_active: item.is_active,
      assigned_at: item.assigned_at,
      notes: item.notes,
      fleet_name: item.fleet_groups?.name,
      technician_name: item.profiles?.full_name
    }));

    setAssignments(transformedData);
  };

  const handleAddAssignment = async () => {
    if (!selectedFleet || !selectedTechnician) {
      toast({
        title: "Campos requeridos",
        description: "Por favor selecciona una flotilla y un técnico",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Check if assignment already exists
      const { data: existing } = await supabase
        .from('fleet_assignments')
        .select('id')
        .eq('fleet_group_id', selectedFleet)
        .eq('technician_id', selectedTechnician)
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        toast({
          title: "Asignación existente",
          description: "Este técnico ya está asignado a esta flotilla",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('fleet_assignments')
        .insert({
          fleet_group_id: selectedFleet,
          technician_id: selectedTechnician,
          assigned_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Asignación creada",
        description: "El técnico ha sido asignado a la flotilla exitosamente"
      });

      // Reset form and reload data
      setSelectedFleet('');
      setSelectedTechnician('');
      await loadAssignments();

    } catch (error: any) {
      console.error('Error creating assignment:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la asignación",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!assignmentToDelete) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('fleet_assignments')
        .update({ is_active: false })
        .eq('id', assignmentToDelete);

      if (error) throw error;

      toast({
        title: "Asignación eliminada",
        description: "La asignación ha sido removida exitosamente"
      });

      await loadAssignments();
      setDeleteDialogOpen(false);
      setAssignmentToDelete(null);

    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la asignación",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'administrador' && profile?.role !== 'supervisor') {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            No tienes permisos para acceder a esta sección
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Assignment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Asignar Técnico a Flotilla
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Flotilla</Label>
              <Select value={selectedFleet} onValueChange={setSelectedFleet}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar flotilla" />
                </SelectTrigger>
                <SelectContent>
                  {fleetGroups.map((fleet) => (
                    <SelectItem key={fleet.id} value={fleet.id}>
                      {fleet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Técnico</Label>
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar técnico" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.user_id} value={tech.user_id}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleAddAssignment} 
            disabled={loading || !selectedFleet || !selectedTechnician}
            className="w-full md:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Asignar Técnico
          </Button>
        </CardContent>
      </Card>

      {/* Current Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Asignaciones Actuales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Cargando asignaciones...</p>
          ) : assignments.length === 0 ? (
            <p className="text-center text-muted-foreground">No hay asignaciones creadas</p>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{assignment.technician_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Asignado a: <Badge variant="secondary">{assignment.fleet_name}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fecha: {new Date(assignment.assigned_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAssignmentToDelete(assignment.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar asignación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la asignación del técnico de la flotilla. 
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssignment}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}