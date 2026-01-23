import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Edit, Trash2, Plus, Monitor, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { PendingEquipmentForm, PendingEquipment } from './PendingEquipmentForm';
import { EquipmentService } from './EquipmentServicesForm';
import { AddPendingEquipmentServicesDialog } from './AddPendingEquipmentServicesDialog';
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

interface ServiceChecklistProps {
  services: EquipmentService[];
  onToggle: (serviceId: string) => void;
  onRemove: (serviceId: string) => void;
}

function ServiceChecklist({ services, onToggle, onRemove }: ServiceChecklistProps) {
  if (services.length === 0) return null;

  return (
    <div className="space-y-1">
      {services.map((service) => (
        <div
          key={service.id}
          className={`flex items-center gap-2 p-2 rounded-md text-xs transition-colors ${
            service.is_selected ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30 border border-transparent'
          }`}
        >
          <Checkbox
            checked={service.is_selected}
            onCheckedChange={() => onToggle(service.id)}
            className="h-4 w-4"
          />
          <div className="flex-1 min-w-0">
            <p className={`font-medium truncate ${!service.is_selected ? 'text-muted-foreground line-through' : ''}`}>
              {service.service_name}
            </p>
            {service.description && (
              <p className="text-muted-foreground text-[10px] truncate">{service.description}</p>
            )}
          </div>
          <span className={`font-semibold whitespace-nowrap ${service.is_selected ? 'text-primary' : 'text-muted-foreground'}`}>
            {formatCOPCeilToTen(service.price)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(service.id)}
            className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function PendingEquipmentList({ equipment, onAdd, onUpdate, onRemove }: PendingEquipmentListProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedServices, setExpandedServices] = useState<Record<number, boolean>>({});
  const [addServicesDialogIndex, setAddServicesDialogIndex] = useState<number | null>(null);

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

  const toggleServicesExpanded = (index: number) => {
    setExpandedServices(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleAddServicesFromCatalog = (equipmentIndex: number, services: EquipmentService[]) => {
    const item = equipment[equipmentIndex];
    const updatedServices = [...(item.services || []), ...services];
    onUpdate(equipmentIndex, { ...item, services: updatedServices });
    setAddServicesDialogIndex(null);
  };

  const handleToggleService = (equipmentIndex: number, serviceId: string) => {
    const item = equipment[equipmentIndex];
    const updatedServices = (item.services || []).map(s =>
      s.id === serviceId ? { ...s, is_selected: !s.is_selected } : s
    );
    onUpdate(equipmentIndex, { ...item, services: updatedServices });
  };

  const handleRemoveService = (equipmentIndex: number, serviceId: string) => {
    const item = equipment[equipmentIndex];
    const updatedServices = (item.services || []).filter(s => s.id !== serviceId);
    onUpdate(equipmentIndex, { ...item, services: updatedServices });
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
              Total servicios equipos: <span className="font-semibold text-primary">{formatCOPCeilToTen(totalEquipmentServicesAmount)}</span>
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
        <div className="space-y-3">
          {equipment.map((item, index) => {
            const servicesTotal = calculateEquipmentServicesTotal(item);
            const hasServices = item.services && item.services.length > 0;
            const selectedCount = item.services?.filter(s => s.is_selected).length || 0;
            const isExpanded = expandedServices[index] ?? true;

            return (
              <Card key={index} className="border-l-4 border-l-primary/50">
                <CardContent className="py-3 px-4 space-y-3">
                  {/* Header del equipo */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{item.equipment_name}</span>
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
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          💬 {item.problem_description}
                        </p>
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

                  {/* Sección de servicios */}
                  <div className="border-t pt-3">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleServicesExpanded(index)}>
                      <div className="flex items-center justify-between mb-2">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 gap-1.5 p-1 -ml-1 text-xs">
                            <Wrench className="h-3.5 w-3.5" />
                            <span className="font-medium">Servicios</span>
                            {hasServices && (
                              <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                                {selectedCount}/{item.services?.length}
                              </Badge>
                            )}
                            {servicesTotal > 0 && (
                              <span className="text-primary font-semibold ml-1">
                                {formatCOPCeilToTen(servicesTotal)}
                              </span>
                            )}
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </Button>
                        </CollapsibleTrigger>
                      </div>

                      <CollapsibleContent className="space-y-2">
                        {/* Lista de servicios como checklist */}
                        <ServiceChecklist
                          services={item.services || []}
                          onToggle={(serviceId) => handleToggleService(index, serviceId)}
                          onRemove={(serviceId) => handleRemoveService(index, serviceId)}
                        />

                        {/* Botón para agregar servicio desde catálogo - igual que en edit */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAddServicesDialogIndex(index)}
                          className="w-full h-9 gap-1.5 border-dashed"
                        >
                          <Plus className="h-4 w-4" />
                          Agregar Servicio a este Equipo
                        </Button>

                        {/* Dialog para agregar servicios desde catálogo */}
                        <AddPendingEquipmentServicesDialog
                          open={addServicesDialogIndex === index}
                          onOpenChange={(open) => !open && setAddServicesDialogIndex(null)}
                          equipmentName={item.equipment_name}
                          onServicesAdded={(services) => handleAddServicesFromCatalog(index, services)}
                        />

                        {/* Total de servicios del equipo */}
                        {hasServices && selectedCount > 0 && (
                          <div className="flex justify-between items-center pt-2 border-t text-xs">
                            <span className="text-muted-foreground">Subtotal servicios:</span>
                            <span className="font-bold text-primary">{formatCOPCeilToTen(servicesTotal)}</span>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
