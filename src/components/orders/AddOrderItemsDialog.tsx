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
  profit_margin_rate?: number;
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
  profit_margin_rate: number;
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

  // Usar precios directos de ventas con 2% adicional después del IVA
  const calculateItemCorrectPrice = (item: NewItem): number => {
    const quantity = item.quantity || 1;
    const unitPrice = item.unit_base_price || 0;
    const vatRate = item.vat_rate || 16;
    
    // Cálculo: precio unitario * cantidad + IVA + 2% adicional
    const subtotal = unitPrice * quantity;
    const withVat = subtotal * (1 + vatRate / 100);
    const withAdditional = withVat * 1.02; // 2% adicional después del IVA
    
    // Redondear a 2 decimales
    return Math.round(withAdditional * 100) / 100;
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
      item_type: 'servicio',
      profit_margin_rate: 0
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
        updated[index].vat_rate = serviceType.vat_rate || 16;
        updated[index].profit_margin_rate = 20; // Valor por defecto
      }
    }

    // Recalcular totales usando la lógica correcta de precios
    if (field === 'quantity' || field === 'unit_base_price' || field === 'service_type_id') {
      const correctPrice = calculateItemCorrectPrice(updated[index]);
      updated[index].total_amount = correctPrice;
      
      // Para mantener compatibilidad con la base de datos
      const item = updated[index];
      item.subtotal = item.unit_base_price * item.quantity;
      item.vat_amount = (item.subtotal * item.vat_rate) / 100;
    }

    setNewItems(updated);
  };

  const calculateTotalChange = () => {
    return newItems.reduce((sum, item) => sum + calculateItemCorrectPrice(item), 0);
  };

  const handleSubmit = async () => {
    console.log('=== HANDLE SUBMIT START ===');
    console.log('Current orderId prop:', orderId);
    console.log('Current reason state:', reason);
    console.log('Reason length:', reason?.length);
    console.log('Reason trimmed:', reason?.trim());
    console.log('NewItems:', newItems);
    
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

    if (!reason || !reason.trim()) {
      toast({
        title: "Error",
        description: "Debe proporcionar una razón para la modificación",
        variant: "destructive"
      });
      return;
    }

    if (!orderId) {
      toast({
        title: "Error",
        description: "ID de orden no válido",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Obtener totales actuales de la orden
      console.log('=== MODIFICATION DEBUG ===');
      console.log('Order ID:', orderId);
      console.log('Reason:', reason);
      
      const { data: currentOrder, error: orderError } = await supabase
        .from('orders')
        .select('estimated_cost')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('Error fetching order:', orderError);
        throw orderError;
      }

      const previousTotal = currentOrder?.estimated_cost || 0;
      const newTotal = previousTotal + calculateTotalChange();
      
      console.log('Previous total:', previousTotal);
      console.log('New total:', newTotal);

      // Obtener información del usuario actual
      const { data: userResult } = await supabase.auth.getUser();
      console.log('Current user:', userResult.user?.id);
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userResult.user?.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }
      
      console.log('Profile data:', profile);
      
      const createdByName = profile?.full_name || 'Usuario desconocido';
      console.log('Created by name:', createdByName);

      // Crear registro de modificación
      const modificationData = {
        order_id: orderId,
        previous_total: previousTotal,
        new_total: newTotal,
        items_added: JSON.stringify(newItems),
        modification_type: 'item_added' as const,
        modification_reason: reason.trim(),
        created_by: userResult.user?.id,
        created_by_name: createdByName,
        notes: `Servicios/productos agregados: ${newItems.map(item => `${item.service_name} (x${item.quantity})`).join(', ')}`
      };
      
      console.log('Modification data to insert:', modificationData);
      
      const { error: modificationError } = await supabase
        .from('order_modifications')
        .insert(modificationData);

      if (modificationError) {
        console.error('Error inserting modification:', modificationError);
        throw modificationError;
      }

      console.log('Modification inserted successfully');

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
             total_amount: calculateItemCorrectPrice(item),
             item_type: item.item_type,
             profit_margin_rate: item.profit_margin_rate,
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
                        <Label>Precio Final Unitario (c/IVA)</Label>
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
                            ${calculateItemCorrectPrice(item).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Subtotal: ${(item.unit_base_price * item.quantity).toFixed(2)} + IVA: ${((item.unit_base_price * item.quantity * (item.vat_rate || 16)) / 100).toFixed(2)}
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
                    +${calculateTotalChange().toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
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