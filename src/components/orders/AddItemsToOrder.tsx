import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2 } from 'lucide-react';

interface ServiceType {
  id: string;
  name: string;
  base_price?: number;
  cost_price?: number;
  item_type: string;
}

interface NewItem {
  service_type_id: string;
  quantity: number;
  service_name: string;
  unit_price: number;
}

interface AddItemsToOrderProps {
  orderId: string;
  onItemsAdded: () => void;
  onCancel: () => void;
}

export function AddItemsToOrder({ orderId, onItemsAdded, onCancel }: AddItemsToOrderProps) {
  const { toast } = useToast();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [newItems, setNewItems] = useState<NewItem[]>([{
    service_type_id: '',
    quantity: 1,
    service_name: '',
    unit_price: 0
  }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadServiceTypes();
  }, []);

  const loadServiceTypes = async () => {
    const { data, error } = await supabase
      .from('service_types')
      .select('id, name, base_price, cost_price, item_type')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error loading service types:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los tipos de servicio",
        variant: "destructive"
      });
    } else {
      setServiceTypes(data || []);
    }
  };

  const addNewItemRow = () => {
    setNewItems(prev => [...prev, {
      service_type_id: '',
      quantity: 1,
      service_name: '',
      unit_price: 0
    }]);
  };

  const removeItemRow = (index: number) => {
    if (newItems.length > 1) {
      setNewItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof NewItem, value: string | number) => {
    setNewItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value };
        
        // If service type changes, update name and price
        if (field === 'service_type_id') {
          const selectedService = serviceTypes.find(s => s.id === value);
          if (selectedService) {
            updated.service_name = selectedService.name;
            updated.unit_price = selectedService.base_price || selectedService.cost_price || 0;
          }
        }
        
        return updated;
      }
      return item;
    }));
  };

  const calculateItemPricing = async (serviceTypeId: string, quantity: number) => {
    try {
      const { data, error } = await supabase.rpc('calculate_order_item_pricing', {
        p_service_type_id: serviceTypeId,
        p_quantity: quantity
      });

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error calculating pricing:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    // Validate items
    const validItems = newItems.filter(item => 
      item.service_type_id && 
      item.service_name && 
      item.quantity > 0 && 
      item.unit_price > 0
    );

    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un artículo válido",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Add each item to the order
      for (const item of validItems) {
        const pricing = await calculateItemPricing(item.service_type_id, item.quantity);
        
        if (!pricing) {
          throw new Error(`No se pudo calcular el precio para ${item.service_name}`);
        }

        const { error } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            service_type_id: item.service_type_id,
            service_name: item.service_name,
            quantity: item.quantity,
            unit_cost_price: pricing.unit_cost_price,
            unit_base_price: pricing.unit_base_price,
            profit_margin_rate: pricing.profit_margin_rate,
            subtotal: pricing.subtotal,
            vat_rate: pricing.vat_rate,
            vat_amount: pricing.vat_amount,
            total_amount: pricing.total_amount,
            item_type: pricing.item_type,
            status: 'pausa'
          });

        if (error) throw error;
      }

      toast({
        title: "Artículos agregados",
        description: `Se agregaron ${validItems.length} artículos a la orden. El cliente debe aprobar los cambios.`,
      });

      onItemsAdded();
    } catch (error) {
      console.error('Error adding items:', error);
      toast({
        title: "Error",
        description: "No se pudieron agregar los artículos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Agregar Artículos/Servicios a la Orden
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {newItems.map((item, index) => (
          <div key={index} className="border border-border rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Artículo {index + 1}</h4>
              {newItems.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItemRow(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Servicio/Artículo</Label>
                <Select
                  value={item.service_type_id}
                  onValueChange={(value) => updateItem(index, 'service_type_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - {service.item_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-2">
                <Label>Precio Unitario</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {item.service_name && (
              <div className="text-sm text-muted-foreground">
                Total estimado: ${(item.unit_price * item.quantity).toLocaleString()}
              </div>
            )}
          </div>
        ))}

        <Button
          variant="outline"
          onClick={addNewItemRow}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar otro artículo
        </Button>

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Agregando..." : "Agregar artículos"}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}