import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';

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

interface EquipmentFormProps {
  orderId: string;
  onSuccess: () => void;
  onCancel: () => void;
  equipment?: any;
}

export function EquipmentForm({ orderId, onSuccess, onCancel, equipment }: EquipmentFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [brands, setBrands] = useState<EquipmentBrand[]>([]);
  const [models, setModels] = useState<EquipmentModel[]>([]);
  const [filteredModels, setFilteredModels] = useState<EquipmentModel[]>([]);
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [showNewModel, setShowNewModel] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newModelName, setNewModelName] = useState('');

  const [formData, setFormData] = useState({
    category_id: equipment?.category_id || '',
    brand_id: equipment?.brand_id || '',
    model_id: equipment?.model_id || '',
    equipment_name: equipment?.equipment_name || '',
    brand_name: equipment?.brand_name || '',
    model_name: equipment?.model_name || '',
    serial_number: equipment?.serial_number || '',
    physical_condition: equipment?.physical_condition || '',
    problem_description: equipment?.problem_description || '',
    additional_notes: equipment?.additional_notes || ''
  });

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
    try {
      const { data, error } = await supabase
        .from('equipment_categories')
        .select('id, name, icon')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment_brands')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error loading brands:', error);
    }
  };

  const loadModels = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment_models')
        .select('id, name, brand_id')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setModels(data || []);
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('equipment_brands')
        .insert({ name: newBrandName.trim() })
        .select()
        .single();

      if (error) throw error;

      setBrands(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData(prev => ({ ...prev, brand_id: data.id, brand_name: data.name }));
      setNewBrandName('');
      setShowNewBrand(false);
      
      toast({
        title: "Marca agregada",
        description: `La marca "${data.name}" ha sido agregada exitosamente.`
      });
    } catch (error) {
      console.error('Error adding brand:', error);
      toast({
        title: "Error",
        description: "No se pudo agregar la marca",
        variant: "destructive"
      });
    }
  };

  const handleAddModel = async () => {
    if (!newModelName.trim() || !formData.brand_id) return;
    
    try {
      const { data, error } = await supabase
        .from('equipment_models')
        .insert({ 
          name: newModelName.trim(),
          brand_id: formData.brand_id
        })
        .select()
        .single();

      if (error) throw error;

      setModels(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData(prev => ({ ...prev, model_id: data.id, model_name: data.name }));
      setNewModelName('');
      setShowNewModel(false);
      
      toast({
        title: "Modelo agregado",
        description: `El modelo "${data.name}" ha sido agregado exitosamente.`
      });
    } catch (error) {
      console.error('Error adding model:', error);
      toast({
        title: "Error",
        description: "No se pudo agregar el modelo",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orderId || !orderId.trim()) {
      toast({
        title: "No se puede agregar equipo",
        description: "Primero guarda/crea la orden para poder registrar equipos.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.equipment_name.trim()) {
      toast({
        title: "Error",
        description: "El nombre del equipo es requerido",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Get selected category, brand and model names
      const selectedCategory = categories.find(c => c.id === formData.category_id);
      const selectedBrand = brands.find(b => b.id === formData.brand_id);
      const selectedModel = models.find(m => m.id === formData.model_id);

      const equipmentData = {
        order_id: orderId,
        category_id: formData.category_id || null,
        brand_id: formData.brand_id || null,
        model_id: formData.model_id || null,
        equipment_name: formData.equipment_name,
        brand_name: selectedBrand?.name || formData.brand_name || null,
        model_name: selectedModel?.name || formData.model_name || null,
        serial_number: formData.serial_number || null,
        physical_condition: formData.physical_condition || null,
        problem_description: formData.problem_description || null,
        additional_notes: formData.additional_notes || null
      };

      if (equipment?.id) {
        const { error } = await supabase
          .from('order_equipment')
          .update(equipmentData)
          .eq('id', equipment.id);

        if (error) throw error;
        
        toast({
          title: "Equipo actualizado",
          description: "El equipo ha sido actualizado exitosamente."
        });
      } else {
        const { error } = await supabase
          .from('order_equipment')
          .insert(equipmentData);

        if (error) throw error;
        
        toast({
          title: "Equipo agregado",
          description: "El equipo ha sido agregado exitosamente."
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving equipment:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el equipo",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="category">Categoría del Equipo</Label>
          <Select
            value={formData.category_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="equipment_name">Nombre del Equipo *</Label>
          <Input
            id="equipment_name"
            value={formData.equipment_name}
            onChange={(e) => setFormData(prev => ({ ...prev, equipment_name: e.target.value }))}
            placeholder="Ej: Laptop HP Pavilion, Impresora Canon, etc."
            required
          />
        </div>

        <div>
          <Label htmlFor="brand">Marca</Label>
          <div className="flex gap-2">
            <Select
              value={formData.brand_id}
              onValueChange={(value) => {
                const selectedBrand = brands.find(b => b.id === value);
                setFormData(prev => ({ 
                  ...prev, 
                  brand_id: value,
                  brand_name: selectedBrand?.name || '',
                  model_id: '', // Reset model when brand changes
                  model_name: ''
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar marca" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowNewBrand(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {showNewBrand && (
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Nueva marca"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
              />
              <Button type="button" onClick={handleAddBrand} size="sm">
                Agregar
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowNewBrand(false);
                  setNewBrandName('');
                }}
                size="sm"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="model">Modelo</Label>
          <div className="flex gap-2">
            <Select
              value={formData.model_id}
              onValueChange={(value) => {
                const selectedModel = models.find(m => m.id === value);
                setFormData(prev => ({ 
                  ...prev, 
                  model_id: value,
                  model_name: selectedModel?.name || ''
                }));
              }}
              disabled={!formData.brand_id}
            >
              <SelectTrigger>
                <SelectValue placeholder={!formData.brand_id ? "Primero selecciona una marca" : "Seleccionar modelo"} />
              </SelectTrigger>
              <SelectContent>
                {filteredModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowNewModel(true)}
              disabled={!formData.brand_id}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {showNewModel && formData.brand_id && (
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Nuevo modelo"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
              />
              <Button type="button" onClick={handleAddModel} size="sm">
                Agregar
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowNewModel(false);
                  setNewModelName('');
                }}
                size="sm"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="serial_number">Número de Serie</Label>
          <Input
            id="serial_number"
            value={formData.serial_number}
            onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
            placeholder="Número de serie del equipo"
          />
        </div>

        <div>
          <Label htmlFor="physical_condition">Estado Físico Visual</Label>
          <Select
            value={formData.physical_condition}
            onValueChange={(value) => setFormData(prev => ({ ...prev, physical_condition: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar estado físico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excelente">Excelente</SelectItem>
              <SelectItem value="bueno">Bueno</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="malo">Malo</SelectItem>
              <SelectItem value="muy_malo">Muy Malo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="problem_description">Descripción del Problema</Label>
          <Textarea
            id="problem_description"
            value={formData.problem_description}
            onChange={(e) => setFormData(prev => ({ ...prev, problem_description: e.target.value }))}
            placeholder="Describe el problema o falla del equipo"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="additional_notes">Notas Adicionales</Label>
          <Textarea
            id="additional_notes"
            value={formData.additional_notes}
            onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
            placeholder="Información adicional relevante"
            rows={2}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {equipment?.id ? 'Actualizar' : 'Agregar'} Equipo
        </Button>
      </div>
    </form>
  );
}