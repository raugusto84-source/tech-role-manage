import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Wrench } from 'lucide-react';
import { formatCOPCeilToTen } from '@/utils/currency';

export interface EquipmentService {
  id: string;
  service_name: string;
  description?: string;
  price: number;
  is_selected: boolean;
}

interface EquipmentServicesFormProps {
  services: EquipmentService[];
  onServicesChange: (services: EquipmentService[]) => void;
  readOnly?: boolean;
}

export function EquipmentServicesForm({ 
  services, 
  onServicesChange,
  readOnly = false 
}: EquipmentServicesFormProps) {
  const [newService, setNewService] = useState({
    service_name: '',
    description: '',
    price: ''
  });

  const handleAddService = () => {
    if (!newService.service_name.trim()) return;
    
    const service: EquipmentService = {
      id: `temp-${Date.now()}`,
      service_name: newService.service_name.trim(),
      description: newService.description.trim() || undefined,
      price: parseFloat(newService.price) || 0,
      is_selected: true
    };
    
    onServicesChange([...services, service]);
    setNewService({ service_name: '', description: '', price: '' });
  };

  const handleRemoveService = (serviceId: string) => {
    onServicesChange(services.filter(s => s.id !== serviceId));
  };

  const handleToggleSelected = (serviceId: string) => {
    onServicesChange(services.map(s => 
      s.id === serviceId ? { ...s, is_selected: !s.is_selected } : s
    ));
  };

  const handleUpdateService = (serviceId: string, field: keyof EquipmentService, value: any) => {
    onServicesChange(services.map(s =>
      s.id === serviceId ? { ...s, [field]: value } : s
    ));
  };

  const selectedTotal = services
    .filter(s => s.is_selected)
    .reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Wrench className="h-4 w-4" />
          Servicios para este equipo
        </Label>
        {services.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Total seleccionado: {formatCOPCeilToTen(selectedTotal)}
          </span>
        )}
      </div>

      {/* Lista de servicios existentes */}
      {services.length > 0 && (
        <div className="space-y-2">
          {services.map((service) => (
            <Card key={service.id} className={`border ${service.is_selected ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              <CardContent className="py-2 px-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={service.is_selected}
                    onCheckedChange={() => !readOnly && handleToggleSelected(service.id)}
                    disabled={readOnly}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    {readOnly ? (
                      <>
                        <p className="font-medium text-sm">{service.service_name}</p>
                        {service.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <Input
                          value={service.service_name}
                          onChange={(e) => handleUpdateService(service.id, 'service_name', e.target.value)}
                          className="h-8 text-sm font-medium mb-1"
                          placeholder="Nombre del servicio"
                        />
                        <Input
                          value={service.description || ''}
                          onChange={(e) => handleUpdateService(service.id, 'description', e.target.value)}
                          className="h-7 text-xs"
                          placeholder="Descripción (opcional)"
                        />
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {readOnly ? (
                      <span className="text-sm font-medium whitespace-nowrap">
                        {formatCOPCeilToTen(service.price)}
                      </span>
                    ) : (
                      <Input
                        type="number"
                        value={service.price}
                        onChange={(e) => handleUpdateService(service.id, 'price', parseFloat(e.target.value) || 0)}
                        className="h-8 w-24 text-sm text-right"
                        placeholder="Precio"
                      />
                    )}
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveService(service.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulario para agregar nuevo servicio */}
      {!readOnly && (
        <Card className="border-dashed">
          <CardContent className="py-3 px-3">
            <div className="grid gap-2">
              <div className="grid grid-cols-[1fr_100px] gap-2">
                <Input
                  value={newService.service_name}
                  onChange={(e) => setNewService(prev => ({ ...prev, service_name: e.target.value }))}
                  placeholder="Nombre del servicio"
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  value={newService.price}
                  onChange={(e) => setNewService(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="Precio"
                  className="h-8 text-sm text-right"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  value={newService.description}
                  onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción (opcional)"
                  className="h-8 text-sm flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddService}
                  disabled={!newService.service_name.trim()}
                  className="h-8 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {services.length === 0 && readOnly && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No hay servicios asignados a este equipo
        </p>
      )}
    </div>
  );
}
