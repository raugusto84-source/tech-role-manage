import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Truck, Users, Eye, Calendar, MapPin } from 'lucide-react';

interface FleetGroupWithDetails {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  technicians: Array<{
    id: string;
    full_name: string;
    assigned_at: string;
  }>;
  vehicles: Array<{
    id: string;
    model: string;
    license_plate: string;
    assigned_at: string;
  }>;
}

interface FleetGroupListProps {
  onGroupSelect?: (groupId: string) => void;
}

export function FleetGroupList({ onGroupSelect }: FleetGroupListProps) {
  const [groups, setGroups] = useState<FleetGroupWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroupsWithDetails();
  }, []);

  const loadGroupsWithDetails = async () => {
    try {
      setLoading(true);
      
      // Cargar grupos activos
      const { data: groupsData, error: groupsError } = await supabase
        .from('fleet_groups')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      // Cargar detalles para cada grupo
      const groupsWithDetails = await Promise.all(
        (groupsData || []).map(async (group) => {
          // Cargar técnicos del grupo
          const { data: techniciansData } = await supabase
            .from('fleet_group_technicians')
            .select(`
              id,
              assigned_at,
              profiles!inner(full_name)
            `)
            .eq('fleet_group_id', group.id)
            .eq('is_active', true);

          // Cargar vehículos del grupo  
          const { data: vehiclesData } = await supabase
            .from('fleet_group_vehicles')
            .select(`
              id,
              assigned_at,
              vehicles!inner(model, license_plate)
            `)
            .eq('fleet_group_id', group.id)
            .eq('is_active', true);

          return {
            ...group,
            technicians: (techniciansData || []).map(t => ({
              id: t.id,
              full_name: (t.profiles as any)?.full_name || 'Sin nombre',
              assigned_at: t.assigned_at
            })),
            vehicles: (vehiclesData || []).map(v => ({
              id: v.id,
              model: (v.vehicles as any)?.model || 'Sin modelo',
              license_plate: (v.vehicles as any)?.license_plate || 'Sin placa',
              assigned_at: v.assigned_at
            }))
          };
        })
      );

      setGroups(groupsWithDetails);
    } catch (error) {
      console.error('Error loading fleet groups with details:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles de los grupos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  <span>{group.name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGroupSelect?.(group.id)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Detalles
                </Button>
              </CardTitle>
              {group.description && (
                <p className="text-sm text-muted-foreground">
                  {group.description}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Estadísticas */}
              <div className="flex gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {group.technicians.length} técnicos
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  {group.vehicles.length} vehículos
                </Badge>
              </div>

              {/* Técnicos */}
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Técnicos Asignados
                </h4>
                {group.technicians.length > 0 ? (
                  <div className="space-y-1">
                    {group.technicians.slice(0, 3).map((tech) => (
                      <div key={tech.id} className="flex items-center justify-between text-sm">
                        <span>{tech.full_name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(tech.assigned_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    {group.technicians.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{group.technicians.length - 3} más...
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No hay técnicos asignados
                  </p>
                )}
              </div>

              {/* Vehículos */}
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <Truck className="h-4 w-4" />
                  Vehículos Asignados
                </h4>
                {group.vehicles.length > 0 ? (
                  <div className="space-y-1">
                    {group.vehicles.slice(0, 3).map((vehicle) => (
                      <div key={vehicle.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {vehicle.model} ({vehicle.license_plate})
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(vehicle.assigned_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    {group.vehicles.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{group.vehicles.length - 3} más...
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No hay vehículos asignados
                  </p>
                )}
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
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
              <p>Ve a "Gestión de Grupos" para crear tu primer grupo</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}