import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Edit, Trash2, Plus, Monitor, Hash, Info } from 'lucide-react';
import { EquipmentForm } from './EquipmentForm';

interface Equipment {
  id: string;
  equipment_name: string;
  brand_name?: string;
  model_name?: string;
  serial_number?: string;
  physical_condition?: string;
  problem_description?: string;
  additional_notes?: string;
  serviced_at?: string | null;
  serviced_by?: string | null;
  policy_equipment_id?: string | null;
  equipment_categories?: {
    name: string;
    icon?: string;
  };
}

interface EquipmentListProps {
  orderId: string;
  equipment: Equipment[];
  onUpdate: () => void;
  canEdit: boolean;
  isPolicyOrder?: boolean;
}

const getConditionColor = (condition?: string) => {
  switch (condition) {
    case 'excelente': return 'bg-green-100 text-green-800 border-green-300';
    case 'bueno': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'regular': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'malo': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'muy_malo': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getConditionLabel = (condition?: string) => {
  switch (condition) {
    case 'excelente': return 'Excelente';
    case 'bueno': return 'Bueno';
    case 'regular': return 'Regular';
    case 'malo': return 'Malo';
    case 'muy_malo': return 'Muy Malo';
    default: return 'Sin especificar';
  }
};

export function EquipmentList({ orderId, equipment, onUpdate, canEdit, isPolicyOrder = false }: EquipmentListProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleToggleServiced = async (equipmentId: string, currentlyServiced: boolean) => {
    setLoading(true);
    try {
      const updateData = currentlyServiced
        ? { serviced_at: null, serviced_by: null }
        : { serviced_at: new Date().toISOString(), serviced_by: user?.id };

      const { error } = await supabase
        .from('order_equipment')
        .update(updateData)
        .eq('id', equipmentId);

      if (error) throw error;

      toast({
        title: currentlyServiced ? "Marcado como no atendido" : "Marcado como atendido",
        description: currentlyServiced 
          ? "El equipo ha sido desmarcado" 
          : "El equipo ha sido marcado como atendido en esta visita."
      });
      
      onUpdate();
    } catch (error) {
      console.error('Error toggling serviced status:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del equipo",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (equipmentId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este equipo?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('order_equipment')
        .delete()
        .eq('id', equipmentId);

      if (error) throw error;

      toast({
        title: "Equipo eliminado",
        description: "El equipo ha sido eliminado exitosamente."
      });
      
      onUpdate();
    } catch (error) {
      console.error('Error deleting equipment:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el equipo",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setShowEditDialog(true);
  };

  const handleFormSuccess = () => {
    setShowAddDialog(false);
    setShowEditDialog(false);
    setEditingEquipment(null);
    onUpdate();
  };

  if (equipment.length === 0 && !canEdit) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Equipos ({equipment.length})
        </h3>
        {canEdit && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar Equipo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Agregar Nuevo Equipo</DialogTitle>
              </DialogHeader>
              <EquipmentForm
                orderId={orderId}
                onSuccess={handleFormSuccess}
                onCancel={() => setShowAddDialog(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {equipment.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No hay equipos registrados para esta orden.
              {canEdit && (
                <><br />Haz clic en "Agregar Equipo" para comenzar.</>
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {equipment.map((item) => (
            <Card key={item.id} className="border-l-4 border-l-primary/20">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {item.equipment_categories?.icon || '⚙️'}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{item.equipment_name}</CardTitle>
                      {item.equipment_categories && (
                        <Badge variant="outline" className="mt-1">
                          {item.equipment_categories.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(item)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isPolicyOrder && item.policy_equipment_id && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Checkbox
                      id={`serviced-${item.id}`}
                      checked={!!item.serviced_at}
                      onCheckedChange={() => handleToggleServiced(item.id, !!item.serviced_at)}
                      disabled={loading}
                    />
                    <label
                      htmlFor={`serviced-${item.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {item.serviced_at ? '✓ Atendido en esta visita' : 'Marcar como atendido en esta visita'}
                    </label>
                    {item.serviced_at && (
                      <Badge variant="default" className="ml-auto">
                        Atendido
                      </Badge>
                    )}
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {item.brand_name && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Marca</label>
                      <p className="text-sm">{item.brand_name}</p>
                    </div>
                  )}
                  {item.model_name && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Modelo</label>
                      <p className="text-sm">{item.model_name}</p>
                    </div>
                  )}
                  {item.serial_number && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        Número de Serie
                      </label>
                      <p className="text-sm font-mono">{item.serial_number}</p>
                    </div>
                  )}
                </div>

                {item.physical_condition && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Estado Físico</label>
                    <div className="mt-1">
                      <Badge className={getConditionColor(item.physical_condition)}>
                        {getConditionLabel(item.physical_condition)}
                      </Badge>
                    </div>
                  </div>
                )}

                {item.problem_description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Problema Reportado
                    </label>
                    <p className="text-sm mt-1 p-2 bg-muted rounded">{item.problem_description}</p>
                  </div>
                )}

                {item.additional_notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Notas Adicionales</label>
                    <p className="text-sm mt-1 p-2 bg-muted rounded">{item.additional_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Equipo</DialogTitle>
          </DialogHeader>
          {editingEquipment && (
            <EquipmentForm
              orderId={orderId}
              equipment={editingEquipment}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingEquipment(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}