import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Wrench, Trash2 } from 'lucide-react';
import { EquipmentService } from './EquipmentServicesForm';
import { AddPendingEquipmentServicesDialog } from './AddPendingEquipmentServicesDialog';
import { formatCOPCeilToTen } from '@/utils/currency';

export interface PendingEquipment {
  equipment_name: string;
  category_id?: string;
  brand_id?: string;
  model_id?: string;
  brand_name?: string;
  model_name?: string;
  serial_number?: string;
  physical_condition?: string;
  problem_description?: string;
  additional_notes?: string;
  is_new_brand?: boolean;
  is_new_model?: boolean;
  services?: EquipmentService[];
}

interface EquipmentCategory {
  id: string;
  name: string;
  icon?: string;
}

interface EquipmentBrand {
  id: string;
  name: string;
}

interface EquipmentModel {
  id: string;
  name: string;
  brand_id: string;
}

interface PendingEquipmentFormProps {
  initialData?: PendingEquipment;
  onSubmit: (equipment: PendingEquipment) => void;
  onCancel: () => void;
}

export function PendingEquipmentForm({ initialData, onSubmit, onCancel }: PendingEquipmentFormProps) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [brands, setBrands] = useState<EquipmentBrand[]>([]);
  const [models, setModels] = useState<EquipmentModel[]>([]);
  const [filteredModels, setFilteredModels] = useState<EquipmentModel[]>([]);
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [showNewModel, setShowNewModel] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddServicesDialog, setShowAddServicesDialog] = useState(false);

  const [formData, setFormData] = useState<PendingEquipment>({
    equipment_name: initialData?.equipment_name || '',
    category_id: initialData?.category_id || '',
    brand_id: initialData?.brand_id || '',
    model_id: initialData?.model_id || '',
    brand_name: initialData?.brand_name || '',
    model_name: initialData?.model_name || '',
    serial_number: initialData?.serial_number || '',
    physical_condition: initialData?.physical_condition || '',
    problem_description: initialData?.problem_description || '',
    additional_notes: initialData?.additional_notes || '',
    services: initialData?.services || []
  });

  const handleAddServicesFromCatalog = (services: EquipmentService[]) => {
    setFormData(prev => ({ ...prev, services: [...(prev.services || []), ...services] }));
    setShowAddServicesDialog(false);
  };

  const handleToggleService = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      services: (prev.services || []).map(s =>
        s.id === serviceId ? { ...s, is_selected: !s.is_selected } : s
      )
    }));
  };

  const handleRemoveService = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      services: (prev.services || []).filter(s => s.id !== serviceId)
    }));
  };

  const getSelectedServicesTotal = () => {
    return (formData.services || [])
      .filter(s => s.is_selected)
      .reduce((sum, s) => sum + s.price, 0);
  };

  useEffect(() => {
    loadCategories();
    loadBrands();
    loadModels();
  }, []);

  useEffect(() => {
    if (formData.brand_id) {
      setFilteredModels(models.filter(model => model.brand_id === formData.brand_id));
    } else {
      setFilteredModels([]);
    }
  }, [formData.brand_id, models]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('equipment_categories')
      .select('id, name, icon')
      .eq('is_active', true)
      .order('name');
    setCategories(data || []);
  };

  const loadBrands = async () => {
    const { data } = await supabase
      .from('equipment_brands')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    setBrands(data || []);
  };

  const loadModels = async () => {
    const { data } = await supabase
      .from('equipment_models')
      .select('id, name, brand_id')
      .eq('is_active', true)
      .order('name');
    setModels(data || []);
  };

  // Agregar marca temporalmente (sin guardar en BD)
  const handleAddBrand = () => {
    if (!newBrandName.trim()) return;
    
    const tempId = `temp-brand-${Date.now()}`;
    const newBrand = { id: tempId, name: newBrandName.trim() };
    
    setBrands(prev => [...prev, newBrand]);
    setFormData(prev => ({
      ...prev,
      brand_id: tempId,
      brand_name: newBrandName.trim(),
      is_new_brand: true
    }));
    setNewBrandName('');
    setShowNewBrand(false);
    toast({ title: "Marca agregada", description: `"${newBrand.name}" se guardará al crear la orden.` });
  };

  // Agregar modelo temporalmente (sin guardar en BD)
  const handleAddModel = () => {
    if (!newModelName.trim() || !formData.brand_id) return;
    
    const tempId = `temp-model-${Date.now()}`;
    const newModel = { id: tempId, name: newModelName.trim(), brand_id: formData.brand_id };
    
    setModels(prev => [...prev, newModel]);
    setFilteredModels(prev => [...prev, newModel]);
    setFormData(prev => ({
      ...prev,
      model_id: tempId,
      model_name: newModelName.trim(),
      is_new_model: true
    }));
    setNewModelName('');
    setShowNewModel(false);
    toast({ title: "Modelo agregado", description: `"${newModel.name}" se guardará al crear la orden.` });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Evitar que el submit se propague al formulario padre
    
    if (!formData.equipment_name.trim()) {
      toast({ title: "Error", description: "El nombre del equipo es requerido", variant: "destructive" });
      return;
    }

    const selectedBrand = brands.find(b => b.id === formData.brand_id);
    const selectedModel = models.find(m => m.id === formData.model_id);

    onSubmit({
      ...formData,
      brand_name: selectedBrand?.name || formData.brand_name,
      model_name: selectedModel?.name || formData.model_name
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="equipment_name">Nombre del Equipo *</Label>
        <Input
          id="equipment_name"
          value={formData.equipment_name}
          onChange={(e) => setFormData(prev => ({ ...prev, equipment_name: e.target.value }))}
          placeholder="Ej: Computadora de escritorio"
        />
      </div>

      <div className="space-y-2">
        <Label>Categoría</Label>
        <Select
          value={formData.category_id}
          onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
        >
          <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Marca</Label>
          {showNewBrand ? (
            <div className="flex gap-2">
              <Input
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Nueva marca"
              />
              <Button type="button" size="sm" onClick={handleAddBrand} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewBrand(false)}>
                ✕
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select
                value={formData.brand_id}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  brand_id: value,
                  model_id: '',
                  brand_name: brands.find(b => b.id === value)?.name || ''
                }))}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder="Marca" /></SelectTrigger>
                <SelectContent>
                  {brands.map(brand => (
                    <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="icon" variant="outline" onClick={() => setShowNewBrand(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Modelo</Label>
          {showNewModel ? (
            <div className="flex gap-2">
              <Input
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="Nuevo modelo"
              />
              <Button type="button" size="sm" onClick={handleAddModel} disabled={loading || !formData.brand_id}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewModel(false)}>
                ✕
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select
                value={formData.model_id}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  model_id: value,
                  model_name: models.find(m => m.id === value)?.name || ''
                }))}
                disabled={!formData.brand_id}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder="Modelo" /></SelectTrigger>
                <SelectContent>
                  {filteredModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="icon" variant="outline" onClick={() => setShowNewModel(true)} disabled={!formData.brand_id}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="serial_number">Número de Serie</Label>
        <Input
          id="serial_number"
          value={formData.serial_number}
          onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
          placeholder="Ej: SN-123456789"
        />
      </div>

      <div className="space-y-2">
        <Label>Estado Físico</Label>
        <Select
          value={formData.physical_condition}
          onValueChange={(value) => setFormData(prev => ({ ...prev, physical_condition: value }))}
        >
          <SelectTrigger><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="excelente">Excelente</SelectItem>
            <SelectItem value="bueno">Bueno</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="malo">Malo</SelectItem>
            <SelectItem value="muy_malo">Muy Malo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="problem_description">Problema Reportado</Label>
        <Textarea
          id="problem_description"
          rows={2}
          value={formData.problem_description}
          onChange={(e) => setFormData(prev => ({ ...prev, problem_description: e.target.value }))}
          placeholder="Describe el problema del equipo..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="additional_notes">Notas Adicionales</Label>
        <Textarea
          id="additional_notes"
          rows={2}
          value={formData.additional_notes}
          onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
          placeholder="Observaciones adicionales..."
        />
      </div>

      {/* Servicios para este equipo - estilo igual al de edición */}
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="h-4 w-4" />
            Servicios para este equipo
          </Label>
          {formData.services && formData.services.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Total: <span className="font-semibold text-primary">{formatCOPCeilToTen(getSelectedServicesTotal())}</span>
            </span>
          )}
        </div>

        {/* Lista de servicios como checklist */}
        {formData.services && formData.services.length > 0 && (
          <div className="space-y-1 mb-3">
            {formData.services.map((service) => (
              <div
                key={service.id}
                className={`flex items-center gap-2 p-2 rounded-md text-xs transition-colors ${
                  service.is_selected ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30 border border-transparent'
                }`}
              >
                <Checkbox
                  checked={service.is_selected}
                  onCheckedChange={() => handleToggleService(service.id)}
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
                  onClick={() => handleRemoveService(service.id)}
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Botón para agregar servicio desde catálogo */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddServicesDialog(true)}
          className="w-full h-9 gap-1.5 border-dashed"
        >
          <Plus className="h-4 w-4" />
          Agregar Servicio a este Equipo
        </Button>

        {/* Dialog para agregar servicios desde catálogo */}
        <AddPendingEquipmentServicesDialog
          open={showAddServicesDialog}
          onOpenChange={setShowAddServicesDialog}
          equipmentName={formData.equipment_name || 'Nuevo equipo'}
          onServicesAdded={handleAddServicesFromCatalog}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {initialData ? 'Actualizar' : 'Agregar'} Equipo
        </Button>
      </div>
    </form>
  );
}
