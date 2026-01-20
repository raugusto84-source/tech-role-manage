import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit, Trash2, Plus, Monitor, Wrench } from 'lucide-react';
import { PendingEquipmentForm, PendingEquipment } from './PendingEquipmentForm';
import { formatCOPCeilToTen } from '@/utils/currency';

interface PendingEquipmentListProps {
  equipment: PendingEquipment[];
  onAdd: (equipment: PendingEquipment) => void;
  onUpdate: (index: number, equipment: PendingEquipment) => void;
  onRemove: (index: number) => void;
}

const getConditionLabel = (condition?: string) => {
  switch (condition) {
    case 'excelente': return 'Excelente';
    case 'bueno': return 'Bueno';
    case 'regular': return 'Regular';
    case 'malo': return 'Malo';
    case 'muy_malo': return 'Muy Malo';
    default: return null;
  }
};

const getConditionColor = (condition?: string) => {
  switch (condition) {
    case 'excelente': return 'bg-green-100 text-green-800';
    case 'bueno': return 'bg-blue-100 text-blue-800';
    case 'regular': return 'bg-yellow-100 text-yellow-800';
    case 'malo': return 'bg-orange-100 text-orange-800';
    case 'muy_malo': return 'bg-red-100 text-red-800';
    default: return 'bg-muted text-muted-foreground';
  }
};

const calculateEquipmentServicesTotal = (equipment: PendingEquipment): number => {
  if (!equipment.services) return 0;
  return equipment.services
    .filter(s => s.is_selected)
    .reduce((sum, s) => sum + s.price, 0);
};

export function PendingEquipmentList({ equipment, onAdd, onUpdate, onRemove }: PendingEquipmentListProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAdd = (newEquipment: PendingEquipment) => {
    onAdd(newEquipment);
    setShowAddDialog(false);
  };

  const handleUpdate = (updated: PendingEquipment) => {
    if (editingIndex !== null) {
      onUpdate(editingIndex, updated);
      setEditingIndex(null);
    }
  };

  // Calcular total de servicios de todos los equipos
  const totalEquipmentServicesAmount = equipment.reduce((sum, eq) => 
    sum + calculateEquipmentServicesTotal(eq), 0
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Equipos ({equipment.length})
          </h4>
          {totalEquipmentServicesAmount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Servicios de equipos: {formatCOPCeilToTen(totalEquipmentServicesAmount)}
            </p>
          )}
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" />
              Agregar Equipo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Equipo</DialogTitle>
            </DialogHeader>
            <PendingEquipmentForm
              onSubmit={handleAdd}
              onCancel={() => setShowAddDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {equipment.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-lg">
          No hay equipos registrados. Agrega equipos para documentar el trabajo.
        </div>
      ) : (
        <div className="space-y-2">
          {equipment.map((item, index) => (
            <Card key={index} className="border-l-4 border-l-primary/30">
              <CardContent className="py-2 px-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{item.equipment_name}</span>
                      {item.physical_condition && (
                        <Badge variant="outline" className={`text-xs ${getConditionColor(item.physical_condition)}`}>
                          {getConditionLabel(item.physical_condition)}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[item.brand_name, item.model_name, item.serial_number].filter(Boolean).join(' • ') || 'Sin detalles'}
                    </div>
                    {item.problem_description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {item.problem_description}
                      </p>
                    )}
                    {/* Mostrar servicios del equipo */}
                    {item.services && item.services.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Wrench className="h-3 w-3" />
                          <span>Servicios ({item.services.filter(s => s.is_selected).length} seleccionados)</span>
                        </div>
                        <div className="space-y-0.5">
                          {item.services.filter(s => s.is_selected).map((service) => (
                            <div key={service.id} className="flex justify-between text-xs">
                              <span className="truncate">{service.service_name}</span>
                              <span className="font-medium text-primary ml-2">
                                {formatCOPCeilToTen(service.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-xs font-medium mt-1 pt-1 border-t">
                          <span>Total servicios:</span>
                          <span className="text-primary">
                            {formatCOPCeilToTen(calculateEquipmentServicesTotal(item))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Dialog open={editingIndex === index} onOpenChange={(open) => !open && setEditingIndex(null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setEditingIndex(index)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Editar Equipo</DialogTitle>
                        </DialogHeader>
                        <PendingEquipmentForm
                          initialData={item}
                          onSubmit={handleUpdate}
                          onCancel={() => setEditingIndex(null)}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => onRemove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
