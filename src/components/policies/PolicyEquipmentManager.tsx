import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Edit, Trash2, Plus, Monitor, Hash, Info } from 'lucide-react';
import { EquipmentForm } from '@/components/orders/EquipmentForm';

interface PolicyEquipment {
  id: string;
  equipment_name: string;
  brand_name?: string;
  model_name?: string;
  serial_number?: string;
  physical_condition?: string;
  additional_notes?: string;
  equipment_categories?: {
    name: string;
    icon?: string;
  };
}

interface PolicyEquipmentManagerProps {
  policyClientId: string;
  clientName: string;
  policyName: string;
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

export function PolicyEquipmentManager({ policyClientId, clientName, policyName }: PolicyEquipmentManagerProps) {
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<PolicyEquipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<PolicyEquipment | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    loadEquipment();
  }, [policyClientId]);

  const loadEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('policy_equipment')
        .select(`
          *,
          equipment_categories (name, icon)
        `)
        .eq('policy_client_id', policyClientId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      console.error('Error loading equipment:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los equipos",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (equipmentId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este equipo del contrato?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('policy_equipment')
        .update({ is_active: false })
        .eq('id', equipmentId);

      if (error) throw error;

      toast({
        title: "Equipo eliminado",
        description: "El equipo ha sido eliminado del contrato."
      });
      
      loadEquipment();
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

  const handleEdit = (equipment: PolicyEquipment) => {
    setEditingEquipment(equipment);
    setShowEditDialog(true);
  };

  const handleFormSuccess = () => {
    setShowAddDialog(false);
    setShowEditDialog(false);
    setEditingEquipment(null);
    loadEquipment();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">Equipos del Contrato</h3>
          <p className="text-sm text-muted-foreground">
            {clientName} - {policyName}
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Equipo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Equipo al Contrato</DialogTitle>
            </DialogHeader>
            <PolicyEquipmentForm
              policyClientId={policyClientId}
              onSuccess={handleFormSuccess}
              onCancel={() => setShowAddDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {equipment.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No hay equipos registrados para este contrato.
              <br />Haz clic en "Agregar Equipo" para comenzar.
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
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
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

                {item.additional_notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Notas</label>
                    <p className="text-sm mt-1 p-2 bg-muted rounded">{item.additional_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Equipo</DialogTitle>
          </DialogHeader>
          {editingEquipment && (
            <PolicyEquipmentForm
              policyClientId={policyClientId}
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

// Policy Equipment Form Component
interface PolicyEquipmentFormProps {
  policyClientId: string;
  onSuccess: () => void;
  onCancel: () => void;
  equipment?: any;
}

function PolicyEquipmentForm({ policyClientId, onSuccess, onCancel, equipment }: PolicyEquipmentFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [filteredModels, setFilteredModels] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    category_id: equipment?.category_id || '',
    brand_id: equipment?.brand_id || '',
    model_id: equipment?.model_id || '',
    equipment_name: equipment?.equipment_name || '',
    brand_name: equipment?.brand_name || '',
    model_name: equipment?.model_name || '',
    serial_number: equipment?.serial_number || '',
    physical_condition: equipment?.physical_condition || '',
    additional_notes: equipment?.additional_notes || ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.brand_id) {
      setFilteredModels(models.filter(model => model.brand_id === formData.brand_id));
    } else {
      setFilteredModels([]);
    }
  }, [formData.brand_id, models]);

  const loadData = async () => {
    try {
      const [categoriesRes, brandsRes, modelsRes] = await Promise.all([
        supabase.from('equipment_categories').select('id, name, icon').eq('is_active', true).order('name'),
        supabase.from('equipment_brands').select('id, name').eq('is_active', true).order('name'),
        supabase.from('equipment_models').select('id, name, brand_id').eq('is_active', true).order('name')
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (brandsRes.error) throw brandsRes.error;
      if (modelsRes.error) throw modelsRes.error;

      setCategories(categoriesRes.data || []);
      setBrands(brandsRes.data || []);
      setModels(modelsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const selectedBrand = brands.find(b => b.id === formData.brand_id);
      const selectedModel = models.find(m => m.id === formData.model_id);

      const equipmentData = {
        policy_client_id: policyClientId,
        category_id: formData.category_id || null,
        brand_id: formData.brand_id || null,
        model_id: formData.model_id || null,
        equipment_name: formData.equipment_name,
        brand_name: selectedBrand?.name || formData.brand_name || null,
        model_name: selectedModel?.name || formData.model_name || null,
        serial_number: formData.serial_number || null,
        physical_condition: formData.physical_condition || null,
        additional_notes: formData.additional_notes || null
      };

      if (equipment?.id) {
        const { error } = await supabase
          .from('policy_equipment')
          .update(equipmentData)
          .eq('id', equipment.id);

        if (error) throw error;
        
        toast({
          title: "Equipo actualizado",
          description: "El equipo ha sido actualizado exitosamente."
        });
      } else {
        const { error } = await supabase
          .from('policy_equipment')
          .insert(equipmentData);

        if (error) throw error;
        
        toast({
          title: "Equipo agregado",
          description: "El equipo ha sido agregado al contrato."
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
      {/* Similar form fields as EquipmentForm but adapted for policy equipment */}
      <div className="grid gap-4">
        <div>
          <label className="text-sm font-medium">Nombre del Equipo *</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-md"
            value={formData.equipment_name}
            onChange={(e) => setFormData(prev => ({ ...prev, equipment_name: e.target.value }))}
            placeholder="Ej: Laptop HP Pavilion"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Número de Serie</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-md"
            value={formData.serial_number}
            onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
            placeholder="Número de serie del equipo"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Notas Adicionales</label>
          <textarea
            className="w-full px-3 py-2 border rounded-md"
            value={formData.additional_notes}
            onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
            placeholder="Información adicional del equipo"
            rows={3}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {equipment?.id ? 'Actualizar' : 'Agregar'} Equipo
        </Button>
      </div>
    </form>
  );
}
