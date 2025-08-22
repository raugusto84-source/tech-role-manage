import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Minus, ShoppingCart, CheckCircle2 } from 'lucide-react';

interface AddOrderItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onItemsAdded: () => void;
}

interface ServiceType {
  id: string;
  name: string;
  description?: string;
  cost_price?: number;
  base_price?: number;
  vat_rate?: number;
  item_type: string;
}

interface NewItem {
  service_type_id: string;
  service_name: string;
  quantity: number;
  unit_cost_price: number;
  unit_base_price: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  item_type: string;
}

export function AddOrderItemsDialog({ 
  open, 
  onOpenChange, 
  orderId, 
  orderNumber, 
  onItemsAdded 
}: AddOrderItemsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      loadServiceTypes();
    }
  }, [open]);

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('id, name, description, cost_price, base_price, vat_rate, item_type')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error('Error loading service types:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los servicios disponibles",
        variant: "destructive"
      });
    }
  };

  const addNewItem = () => {
    setNewItems([...newItems, {
      service_type_id: '',
      service_name: '',
      quantity: 1,
      unit_cost_price: 0,
      unit_base_price: 0,
      subtotal: 0,
      vat_rate: 0,
      vat_amount: 0,
      total_amount: 0,
      item_type: 'servicio'
    }]);
  };

  const removeItem = (index: number) => {
    setNewItems(newItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof NewItem, value: any) => {
    const updated = [...newItems];
    updated[index] = { ...updated[index], [field]: value };

    // Si se cambió el servicio, recalcular precios
    if (field === 'service_type_id') {
      const serviceType = serviceTypes.find(st => st.id === value);
      if (serviceType) {
        updated[index].service_name = serviceType.name;
        updated[index].item_type = serviceType.item_type;
        updated[index].unit_cost_price = serviceType.cost_price || serviceType.base_price || 0;
        updated[index].unit_base_price = serviceType.base_price || serviceType.cost_price || 0;
        updated[index].vat_rate = serviceType.vat_rate || 0;
      }
    }

    // Recalcular totales
    if (field === 'quantity' || field === 'unit_base_price' || field === 'service_type_id') {
      const item = updated[index];
      item.subtotal = item.unit_base_price * item.quantity;
      item.vat_amount = (item.subtotal * item.vat_rate) / 100;
      item.total_amount = item.subtotal + item.vat_amount;
    }

    setNewItems(updated);
  };

  const calculateTotalChange = () => {
    return newItems.reduce((sum, item) => sum + item.total_amount, 0);
  };

  const handleSubmit = async () => {
    if (newItems.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un servicio o producto",
        variant: "destructive"
      });
      return;
    }

    if (newItems.some(item => !item.service_type_id)) {
      toast({
        title: "Error", 
        description: "Todos los items deben tener un servicio seleccionado",
        variant: "destructive"
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Debe proporcionar una razón para la modificación",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Obtener totales actuales de la orden
      const { data: currentOrder, error: orderError } = await supabase
        .from('orders')
        .select('estimated_cost')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const previousTotal = currentOrder.estimated_cost || 0;
      const newTotal = previousTotal + calculateTotalChange();

      // Obtener información del usuario actual
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      // Crear registro de modificación
      const { error: modificationError } = await supabase
        .from('order_modifications')
        .insert({
          order_id: orderId,
          previous_total: previousTotal,
          new_total: newTotal,
          items_added: JSON.stringify(newItems),
          modification_type: 'item_added',
          modification_reason: reason,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          created_by_name: profile?.full_name || 'Usuario desconocido',
          notes: `Servicios/productos agregados: ${newItems.map(item => `${item.service_name} (x${item.quantity})`).join(', ')}`
        });

      if (modificationError) throw modificationError;

      // Agregar los nuevos items a la orden uno por uno
      for (const item of newItems) {
        const { error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            service_type_id: item.service_type_id,
            service_name: item.service_name,
            quantity: item.quantity,
            unit_cost_price: item.unit_cost_price,
            unit_base_price: item.unit_base_price,
            subtotal: item.subtotal,
            vat_rate: item.vat_rate,
            vat_amount: item.vat_amount,
            total_amount: item.total_amount,
            item_type: item.item_type,
            status: 'pendiente' as const
          });

        if (itemError) throw itemError;
      }

      // Actualizar el costo estimado de la orden
      const { error: updateError } = await supabase
        .from('orders')
        .update({ estimated_cost: newTotal })
        .eq('id', orderId);

      if (updateError) throw updateError;

      toast({
        title: "Servicios agregados",
        description: `Se agregaron ${newItems.length} servicios/productos. La orden requiere nueva aprobación del cliente.`,
        variant: "default"
      });

      onItemsAdded();
      onOpenChange(false);
      setNewItems([]);
      setReason('');

    } catch (error) {
      console.error('Error adding items:', error);
      toast({
        title: "Error",
        description: "No se pudieron agregar los servicios. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2" />
            Agregar Servicios/Productos - Orden {orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Razón de la modificación */}
          <Card>
            <CardHeader>
              <CardTitle>Razón de la Modificación</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Explique por qué se están agregando estos servicios/productos..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-20"
              />
            </CardContent>
          </Card>

          {/* Lista de nuevos items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Servicios/Productos a Agregar
                <Button onClick={addNewItem} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar Item
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {newItems.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No hay servicios agregados. Haga clic en "Agregar Item" para comenzar.
                </div>
              ) : (
                newItems.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label>Servicio/Producto</Label>
                        <Select
                          value={item.service_type_id}
                          onValueChange={(value) => updateItem(index, 'service_type_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {serviceTypes.map((st) => (
                              <SelectItem key={st.id} value={st.id}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{st.name}</span>
                                  <Badge variant="outline" className="ml-2">
                                    {st.item_type}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Cantidad</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>

                      <div>
                        <Label>Precio Unitario</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_base_price}
                          onChange={(e) => updateItem(index, 'unit_base_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Total</Label>
                          <div className="font-medium text-lg">
                            ${item.total_amount.toLocaleString()}
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {item.vat_amount > 0 && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Subtotal: ${item.subtotal.toLocaleString()} + IVA ({item.vat_rate}%): ${item.vat_amount.toLocaleString()}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* Resumen del cambio total */}
          {newItems.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Incremento Total:</span>
                  <span className="text-green-600">
                    +${calculateTotalChange().toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || newItems.length === 0}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Agregar y Enviar para Aprobación
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}