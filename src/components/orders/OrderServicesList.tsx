import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useRewardSettings } from '@/hooks/useRewardSettings';
import { Wrench, Clock, CheckCircle, AlertCircle, Truck, Play, Save, Package, Edit3, Check, X } from 'lucide-react';

interface OrderItem {
  id: string;
  service_name: string;
  service_description?: string;
  quantity: number;
  unit_base_price: number;
  unit_cost_price?: number;
  total_amount: number;
  vat_rate?: number;
  item_type?: string;
  profit_margin_rate?: number;
  status: 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada';
  serial_number?: string;
  supplier_name?: string;
}

interface OrderServicesListProps {
  orderItems: OrderItem[];
  canEdit: boolean;
  onItemUpdate?: () => void;
}

const statusConfig = {
  pendiente: {
    label: 'Pendiente',
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
  },
  en_proceso: {
    label: 'En Proceso',
    icon: Wrench,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
  },
  finalizada: {
    label: 'Finalizada',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
  },
  cancelada: {
    label: 'Cancelada',
    icon: AlertCircle,
    color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
  }
};

export function OrderServicesList({ orderItems, canEdit, onItemUpdate }: OrderServicesListProps) {
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [editingSerialInfo, setEditingSerialInfo] = useState<Set<string>>(new Set());
  const [editableSerialFields, setEditableSerialFields] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { settings: rewardSettings } = useRewardSettings();

  // Calcular precio correcto para un item
  const calculateItemCorrectPrice = (item: OrderItem): number => {
    const quantity = item.quantity || 1;
    const salesVatRate = item.vat_rate || 16;
    const cashbackPercent = rewardSettings?.apply_cashback_to_items
      ? (rewardSettings.general_cashback_percent || 0)
      : 0;

    if (item.item_type === 'servicio') {
      // Para servicios: precio base + IVA + cashback
      const basePrice = (item.unit_base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      return finalWithCashback;
    } else {
      // Para artículos: costo base + IVA compra + margen + IVA venta + cashback
      const purchaseVatRate = 16;
      const baseCost = (item.unit_cost_price || 0) * quantity;
      const profitMargin = item.profit_margin_rate || 20;
      
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      
      return finalWithCashback;
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    if (!canEdit) return;

    setUpdatingItems(prev => new Set(prev).add(itemId));

    try {
      const { error } = await supabase
        .from('order_items')
        .update({ status: newStatus as 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada' })
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: 'Estado actualizado',
        description: 'El estado del servicio se ha actualizado correctamente.',
      });

      onItemUpdate?.();
    } catch (error) {
      console.error('Error updating order item status:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del servicio.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleSerialInfoUpdate = async (itemId: string, serialNumber: string, supplierName: string) => {
    setEditingSerialInfo(prev => new Set(prev).add(itemId));

    try {
      const { error } = await supabase
        .from('order_items')
        .update({ 
          serial_number: serialNumber || null,
          supplier_name: supplierName || null
        })
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: 'Información actualizada',
        description: 'Los datos del artículo se han guardado correctamente.',
      });

      onItemUpdate?.();
    } catch (error) {
      console.error('Error updating serial info:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la información del artículo.',
        variant: 'destructive',
      });
    } finally {
      setEditingSerialInfo(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const getProgressPercentage = () => {
    if (orderItems.length === 0) return 0;
    const completedItems = orderItems.filter(item => 
      item.status === 'finalizada'
    ).length;
    return Math.round((completedItems / orderItems.length) * 100);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const progress = getProgressPercentage();

  if (orderItems.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay servicios en esta orden</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Servicios de la Orden ({orderItems.length})</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Progreso:</span>
          <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium">{progress}%</span>
        </div>
      </div>

      <div className="grid gap-3">
        {orderItems.map((item) => {
          const StatusIcon = statusConfig[item.status]?.icon || AlertCircle;
          const isUpdating = updatingItems.has(item.id);
          const isEditingSerial = editingSerialInfo.has(item.id);

          return (
            <Card key={item.id} className="relative">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{item.service_name}</h4>
                        <Badge 
                          variant="secondary" 
                          className={statusConfig[item.status]?.color}
                        >
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig[item.status]?.label || item.status}
                        </Badge>
                        {item.item_type === 'articulo' && (
                          <Badge variant="outline">
                            <Package className="w-3 h-3 mr-1" />
                            Artículo
                          </Badge>
                        )}
                      </div>
                      
                      {item.service_description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {item.service_description}
                        </p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>
                          <strong>Cantidad:</strong> {item.quantity}
                        </span>
                        <span>
                          <strong>Precio:</strong> {formatCurrency(calculateItemCorrectPrice(item) / (item.quantity || 1))}
                        </span>
                        <span>
                          <strong>Total:</strong> {formatCurrency(calculateItemCorrectPrice(item))}
                        </span>
                      </div>

                      {/* Show serial number and supplier for articles */}
                      {item.item_type === 'articulo' && (item.serial_number || item.supplier_name) && (
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-2">
                          {item.serial_number && (
                            <span>
                              <strong>Serie:</strong> {item.serial_number}
                            </span>
                          )}
                          {item.supplier_name && (
                            <span>
                              <strong>Proveedor:</strong> {item.supplier_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {canEdit && (
                      <div className="ml-4 w-40">
                        <Select
                          value={item.status}
                          onValueChange={(value) => handleStatusChange(item.id, value)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="bg-background border z-50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background border z-50">
                            <SelectItem value="pendiente">
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                Pendiente
                              </div>
                            </SelectItem>
                            <SelectItem value="en_proceso">
                              <div className="flex items-center">
                                <Play className="w-4 h-4 mr-2" />
                                En Proceso
                              </div>
                            </SelectItem>
                            <SelectItem value="finalizada">
                              <div className="flex items-center">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Finalizada
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Serial number and supplier fields for articles - only in order details */}
                  {item.item_type === 'articulo' && (
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center mb-2">
                        <Label className="text-sm font-medium text-muted-foreground">
                          Información del Artículo
                        </Label>
                        {canEdit && (
                          <div className="flex items-center gap-2">
                            {editableSerialFields.has(item.id) ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    // Cancelar edición, revertir cambios
                                    setEditableSerialFields(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(item.id);
                                      return newSet;
                                    });
                                  }}
                                  disabled={isEditingSerial}
                                  className="h-7 px-2"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditableSerialFields(prev => new Set(prev).add(item.id));
                                }}
                                disabled={isEditingSerial}
                                className="h-7 px-2"
                              >
                                <Edit3 className="w-3 h-3 mr-1" />
                                {(item.serial_number || item.supplier_name) ? 'Editar' : 'Agregar'}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                          <Label className="text-xs">Número de Serie</Label>
                          <Input
                            key={`serial-${item.id}-${editableSerialFields.has(item.id)}`}
                            defaultValue={item.serial_number || ''}
                            onBlur={(e) => {
                              if (editableSerialFields.has(item.id)) {
                                const value = e.target.value;
                                if (value !== item.serial_number) {
                                  handleSerialInfoUpdate(item.id, value, item.supplier_name || '');
                                }
                                setEditableSerialFields(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(item.id);
                                  return newSet;
                                });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editableSerialFields.has(item.id)) {
                                const value = e.currentTarget.value;
                                if (value !== item.serial_number) {
                                  handleSerialInfoUpdate(item.id, value, item.supplier_name || '');
                                }
                                setEditableSerialFields(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(item.id);
                                  return newSet;
                                });
                              }
                            }}
                            placeholder="Ingrese número de serie"
                            className="h-8 mt-1"
                            disabled={!editableSerialFields.has(item.id) || isEditingSerial}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Proveedor</Label>
                          <Input
                            key={`supplier-${item.id}-${editableSerialFields.has(item.id)}`}
                            defaultValue={item.supplier_name || ''}
                            onBlur={(e) => {
                              if (editableSerialFields.has(item.id)) {
                                const value = e.target.value;
                                if (value !== item.supplier_name) {
                                  handleSerialInfoUpdate(item.id, item.serial_number || '', value);
                                }
                                setEditableSerialFields(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(item.id);
                                  return newSet;
                                });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editableSerialFields.has(item.id)) {
                                const value = e.currentTarget.value;
                                if (value !== item.supplier_name) {
                                  handleSerialInfoUpdate(item.id, item.serial_number || '', value);
                                }
                                setEditableSerialFields(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(item.id);
                                  return newSet;
                                });
                              }
                            }}
                            placeholder="Nombre del proveedor"
                            className="h-8 mt-1"
                            disabled={!editableSerialFields.has(item.id) || isEditingSerial}
                          />
                        </div>
                        <div className="flex justify-end">
                          {isEditingSerial && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Save className="w-3 h-3 mr-1 animate-spin" />
                              Guardando...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumen de progreso */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-yellow-600">
                {orderItems.filter(item => item.status === 'pendiente').length}
              </div>
              <div className="text-xs text-muted-foreground">Pendientes</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">
                {orderItems.filter(item => item.status === 'en_proceso').length}
              </div>
              <div className="text-xs text-muted-foreground">En Proceso</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {orderItems.filter(item => item.status === 'finalizada').length}
              </div>
              <div className="text-xs text-muted-foreground">Finalizados</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}