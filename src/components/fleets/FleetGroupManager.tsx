import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Truck, Users } from 'lucide-react';

interface FleetGroup {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  technician_count?: number;
  vehicle_count?: number;
}

interface FleetGroupManagerProps {
  onGroupSelect?: (groupId: string, groupName?: string) => void;
}

export function FleetGroupManager({ onGroupSelect }: FleetGroupManagerProps) {
  const [groups, setGroups] = useState<FleetGroup[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FleetGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      
      // Cargar grupos con contadores
      const { data: groupsData, error } = await supabase
        .from('fleet_groups')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Cargar contadores para cada grupo
      const groupsWithCounts = await Promise.all(
        (groupsData || []).map(async (group) => {
          const [technicianCount, vehicleCount] = await Promise.all([
            supabase
              .from('fleet_group_technicians')
              .select('id', { count: 'exact', head: true })
              .eq('fleet_group_id', group.id)
              .eq('is_active', true),
            supabase
              .from('fleet_group_vehicles')
              .select('id', { count: 'exact', head: true })
              .eq('fleet_group_id', group.id)
              .eq('is_active', true)
          ]);

          return {
            ...group,
            technician_count: technicianCount.count || 0,
            vehicle_count: vehicleCount.count || 0
          };
        })
      );

      setGroups(groupsWithCounts);
    } catch (error) {
      console.error('Error loading fleet groups:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los grupos de flotilla",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "El nombre del grupo es requerido",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingGroup) {
        // Actualizar grupo existente
        const { error } = await supabase
          .from('fleet_groups')
          .update({
            name: formData.name,
            description: formData.description || null
          })
          .eq('id', editingGroup.id);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Grupo actualizado correctamente"
        });
      } else {
        // Crear nuevo grupo
        const { error } = await supabase
          .from('fleet_groups')
          .insert({
            name: formData.name,
            description: formData.description || null
          });

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Grupo creado correctamente"
        });
      }

      resetForm();
      setIsDialogOpen(false);
      loadGroups();
    } catch (error) {
      console.error('Error saving fleet group:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el grupo",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (group: FleetGroup) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el grupo "${group.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('fleet_groups')
        .update({ is_active: false })
        .eq('id', group.id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Grupo eliminado correctamente"
      });
      
      loadGroups();
    } catch (error) {
      console.error('Error deleting fleet group:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el grupo",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setEditingGroup(null);
  };

  const openEditDialog = (group: FleetGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || ''
    });
    setIsDialogOpen(true);
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
      {/* Header con botón de crear */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Grupos de Flotilla</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Grupo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? 'Editar Grupo' : 'Nuevo Grupo de Flotilla'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre del Grupo</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Flotilla Norte, Equipo Urgencias, etc."
                />
              </div>
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción opcional del grupo..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingGroup ? 'Actualizar' : 'Crear'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de grupos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Card key={group.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{group.name}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(group)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(group)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent onClick={() => onGroupSelect?.(group.id, group.name)}>
              <div className="space-y-3">
                {group.description && (
                  <p className="text-sm text-muted-foreground">
                    {group.description}
                  </p>
                )}
                
                <div className="flex gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {group.technician_count || 0} técnicos
                  </Badge>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    {group.vehicle_count || 0} vehículos
                  </Badge>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Creado: {new Date(group.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No hay grupos de flotilla</p>
              <p>Crea tu primer grupo para comenzar a organizar técnicos y vehículos</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}