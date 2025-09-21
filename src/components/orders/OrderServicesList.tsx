import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { formatCOPCeilToTen } from '@/utils/currency';
import { Wrench, Clock, CheckCircle, AlertCircle, Truck, Play, Save, Package, Edit3, Check, X, Trash2 } from 'lucide-react';
import { useRewardSettings } from '@/hooks/useRewardSettings';
import { ceilToTen } from '@/utils/currency';
import { useEffect } from 'react';
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
  pricing_locked?: boolean;
  status: 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada';
  serial_number?: string;
  supplier_name?: string;
  created_at?: string;
  service_type_id?: string;
}
interface OrderServicesListProps {
  orderItems: OrderItem[];
  canEdit: boolean;
  onItemUpdate?: () => void;
  showReadyButtons?: boolean;
  orderId?: string;
  onBack?: () => void;
  orderStatus?: string;
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
export function OrderServicesList({
  orderItems,
  canEdit,
  onItemUpdate,
  showReadyButtons = false,
  orderId,
  onBack,
  orderStatus
}: OrderServicesListProps) {
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [editingSerialInfo, setEditingSerialInfo] = useState<Set<string>>(new Set());
  const [editableSerialFields, setEditableSerialFields] = useState<Set<string>>(new Set());
  const [finishingAll, setFinishingAll] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [itemModificationNumbers, setItemModificationNumbers] = useState<Map<string, number>>(new Map());
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();
  const { settings: rewardSettings } = useRewardSettings();
  const { profile } = useAuth();
  
  // Check if user is a client - clients have restricted permissions
  const isClient = profile?.role === 'cliente';
  const canEditStatus = canEdit && !isClient;
  const canEditSerialInfo = canEdit && !isClient;
  const canFinishAll = canEdit && !isClient;
  const canDeleteItems = !isClient; // Allow deletion in all states for non-clients
  
  console.log('OrderServicesList debug:', {
    orderStatus,
    canDeleteItems,
    addedItemsCount: addedItems.size,
    modificationNumbersCount: itemModificationNumbers.size,
    orderItemsCount: orderItems.length
  });

  // Calcular precio correcto para un item - MISMA LÓGICA QUE OrderCard y OrderDetails
  const calculateItemCorrectPrice = (item: OrderItem): number => {
    // Fallback para órdenes antiguas: usar total guardado si está bloqueado o faltan datos
    const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
    const isLocked = Boolean(item.pricing_locked);
    const missingKeyData = (item.item_type === 'servicio')
      ? (!item.unit_base_price || item.unit_base_price <= 0)
      : (!item.unit_cost_price || item.unit_cost_price <= 0);

    if (hasStoredTotal && (isLocked || missingKeyData)) {
      return Number(item.total_amount);
    }

    const quantity = item.quantity || 1;
    const salesVatRate = item.vat_rate || 16;
    const cashbackPercent = rewardSettings?.apply_cashback_to_items ? (rewardSettings.general_cashback_percent || 0) : 0;

    if (item.item_type === 'servicio') {
      const basePrice = (item.unit_base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      return finalWithCashback;
    } else {
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

  // Load modification data to identify added items and their update numbers
  const loadAddedItems = async () => {
    console.log('loadAddedItems CALLED with:', {
      orderId,
      orderStatus,
      condition: orderStatus === 'pendiente_actualizacion'
    });
    
    if (!orderId || orderStatus !== 'pendiente_actualizacion') {
      console.log('loadAddedItems: Skipping - orderId:', orderId, 'orderStatus:', orderStatus);
      return;
    }
    
    console.log('loadAddedItems: Loading for order:', orderId, 'status:', orderStatus);
    
    try {
      // Get all modifications for this order, ordered by creation date
      const { data: modifications, error } = await supabase
        .from('order_modifications')
        .select('items_added, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }); // Ascending to get correct numbering

      if (error) {
        console.error('loadAddedItems: Supabase error:', error);
        throw error;
      }
      
      console.log('loadAddedItems: Found modifications:', modifications);
      
      if (modifications && modifications.length > 0) {
        const addedItemIds = new Set<string>();
        const modificationNumbers = new Map<string, number>();
        
        // Process each modification to identify which items belong to which update
        modifications.forEach((modification, index) => {
          const updateNumber = index + 1; // Update numbers start from 1
          const itemsData = modification.items_added as any[];
          const modificationTime = new Date(modification.created_at);
          
          console.log(`loadAddedItems: Processing modification ${updateNumber}:`, {
            items: itemsData,
            time: modificationTime
          });
          
          if (itemsData && itemsData.length > 0) {
            orderItems.forEach(orderItem => {
              // Check if this item was created after this modification
              const itemCreatedAt = new Date(orderItem.created_at || '');
              
              console.log(`loadAddedItems: Checking item ${orderItem.id}:`, {
                itemCreatedAt,
                modificationTime,
                isAfter: itemCreatedAt >= modificationTime
              });
              
              if (itemCreatedAt >= modificationTime) {
                // Check if it matches any of the added items in this modification
                const matchesAdded = itemsData.some(addedItem => 
                  orderItem.service_name === addedItem.service_name &&
                  orderItem.quantity === addedItem.quantity &&
                  orderItem.unit_base_price === addedItem.unit_base_price
                );
                
                console.log(`loadAddedItems: Item match check:`, {
                  itemId: orderItem.id,
                  matchesAdded,
                  itemService: orderItem.service_name
                });
                
                if (matchesAdded && !addedItemIds.has(orderItem.id)) {
                  console.log(`loadAddedItems: Item ${orderItem.id} matches update ${updateNumber}`);
                  addedItemIds.add(orderItem.id);
                  modificationNumbers.set(orderItem.id, updateNumber);
                }
              }
            });
          }
        });
        
        console.log('loadAddedItems: Final results:', {
          addedItems: Array.from(addedItemIds),
          modificationNumbers: Array.from(modificationNumbers.entries())
        });
        
        setAddedItems(addedItemIds);
        setItemModificationNumbers(modificationNumbers);
      } else {
        console.log('loadAddedItems: No modifications found for order:', orderId);
      }
    } catch (error) {
      console.error('Error loading added items:', error);
    }
  };

  // Load added items on mount and when orderItems change
  useEffect(() => {
    console.log('useEffect triggered for loadAddedItems:', {
      orderId,
      orderStatus,
      orderItemsLength: orderItems?.length
    });
    loadAddedItems();
  }, [orderId, orderStatus, orderItems.length]); // Use length instead of full array

  const confirmDeleteItem = (itemId: string, itemName: string) => {
    if (!canDeleteItems) return;
    setItemToDelete({ id: itemId, name: itemName });
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    
    const { id: itemId } = itemToDelete;
    setDeletingItems(prev => new Set(prev).add(itemId));
    
    try {
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: 'Artículo eliminado',
        description: 'El artículo ha sido eliminado de la orden.',
      });

      onItemUpdate?.();
      
      // Remove from added items set
      setAddedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el artículo.',
        variant: 'destructive',
      });
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      setItemToDelete(null);
    }
  };
  const handleStatusChange = async (itemId: string, newStatus: string) => {
    if (!canEditStatus) return;
    
    // Validate required fields for products before finishing
    if (newStatus === 'finalizada') {
      const item = orderItems.find(i => i.id === itemId);
      if (item?.item_type === 'articulo') {
        if (!item.serial_number || !item.supplier_name) {
          toast({
            title: 'Campos obligatorios',
            description: 'Los productos requieren número de serie y proveedor para ser finalizados.',
            variant: 'destructive'
          });
          return;
        }
      }
    }
    
    setUpdatingItems(prev => new Set(prev).add(itemId));
    try {
      const {
        error
      } = await supabase.from('order_items').update({
        status: newStatus as 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada'
      }).eq('id', itemId);
      if (error) throw error;
      toast({
        title: 'Estado actualizado',
        description: 'El estado del servicio se ha actualizado correctamente.'
      });
      onItemUpdate?.();
    } catch (error) {
      console.error('Error updating order item status:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del servicio.',
        variant: 'destructive'
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
    if (!canEditSerialInfo) return;
    setEditingSerialInfo(prev => new Set(prev).add(itemId));
    try {
      const {
        error
      } = await supabase.from('order_items').update({
        serial_number: serialNumber || null,
        supplier_name: supplierName || null
      }).eq('id', itemId);
      if (error) throw error;
      toast({
        title: 'Información actualizada',
        description: 'Los datos del artículo se han guardado correctamente.'
      });
      onItemUpdate?.();
    } catch (error) {
      console.error('Error updating serial info:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la información del artículo.',
        variant: 'destructive'
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
    const completedItems = orderItems.filter(item => item.status === 'finalizada').length;
    return Math.round(completedItems / orderItems.length * 100);
  };
  const formatCurrency = formatCOPCeilToTen;
  const handleFinishAll = async () => {
    if (!orderId || !canFinishAll) return;
    
    // Validate that all products have required fields before finishing
    const incompleteProducts = orderItems.filter(item => 
      item.status !== 'finalizada' && 
      item.item_type === 'articulo' && 
      (!item.serial_number || !item.supplier_name)
    );
    
    if (incompleteProducts.length > 0) {
      toast({
        title: 'Productos incompletos',
        description: `${incompleteProducts.length} producto(s) requieren número de serie y proveedor antes de finalizar.`,
        variant: 'destructive'
      });
      return;
    }
    
    setFinishingAll(true);
    try {
      // Mark all non-finished items as finished
      const {
        error: itemsError
      } = await supabase.from('order_items').update({
        status: 'finalizada'
      }).eq('order_id', orderId).neq('status', 'finalizada');
      if (itemsError) throw itemsError;

      // Update order status to pendiente_entrega
      const {
        error: orderError
      } = await supabase.from('orders').update({
        status: 'pendiente_entrega'
      }).eq('id', orderId);
      if (orderError) throw orderError;
      toast({
        title: 'Orden terminada',
        description: 'Todos los servicios han sido completados y la orden está lista para entrega.'
      });

      // Navigate back to all orders
      if (onBack) {
        onBack();
      }
    } catch (error) {
      console.error('Error finishing all items:', error);
      toast({
        title: 'Error',
        description: 'No se pudo finalizar todos los servicios.',
        variant: 'destructive'
      });
    } finally {
      setFinishingAll(false);
    }
  };
  const progress = getProgressPercentage();
  if (orderItems.length === 0) {
    return <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay servicios en esta orden</p>
          </div>
        </CardContent>
      </Card>;
  }
  return <div className="space-y-3">
      {/* Mobile-first header with progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold truncate">Servicios ({orderItems.length})</h3>
        </div>
        
        {/* Progress bar - Mobile optimized */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progreso:</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {orderItems.map(item => {
        const StatusIcon = statusConfig[item.status]?.icon || AlertCircle;
        const isUpdating = updatingItems.has(item.id);
        const isEditingSerial = editingSerialInfo.has(item.id);
        return <Card key={item.id} className="relative">
              <CardContent className="p-3">
                <div className="space-y-3">
                  {/* Header with title and badges - Mobile First */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm break-words leading-tight mb-2">{item.service_name}</h4>
                      <div className="flex flex-wrap gap-1 mb-2">
                        <Badge variant="secondary" className={`${statusConfig[item.status]?.color} text-xs`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig[item.status]?.label || item.status}
                        </Badge>
                        {item.item_type === 'articulo' && (
                          <Badge variant="outline" className="text-xs">
                            <Package className="w-3 h-3 mr-1" />
                            Artículo
                          </Badge>
                        )}
                        {addedItems.has(item.id) && itemModificationNumbers.has(item.id) && (
                          <Badge variant="default" className="text-xs bg-blue-600 hover:bg-blue-700">
                            Actualización {itemModificationNumbers.get(item.id)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Price and Status Controls - Mobile Friendly */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-2 justify-end mb-1">
                        <div className="text-sm font-medium text-primary break-words text-right">
                          {formatCurrency(calculateItemCorrectPrice(item))}
                        </div>
                        {/* Delete button for all items in any state */}
                        {!isClient && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => confirmDeleteItem(item.id, item.service_name)}
                            disabled={deletingItems.has(item.id)}
                            className="h-7 w-7 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {canEditStatus && (
                        <div className="w-20">
                          {showReadyButtons && item.status !== 'finalizada' ? (
                            <Button 
                              onClick={() => handleStatusChange(item.id, 'finalizada')} 
                              disabled={isUpdating || (item.item_type === 'articulo' && (!item.serial_number || !item.supplier_name))} 
                              variant={item.item_type === 'articulo' && (!item.serial_number || !item.supplier_name) ? "outline" : "default"} 
                              size="sm" 
                              className="w-full h-7 text-xs"
                              title={item.item_type === 'articulo' && (!item.serial_number || !item.supplier_name) ? "Requiere número de serie y proveedor" : ""}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Listo
                            </Button>
                          ) : (
                            <Select 
                              value={item.status} 
                              onValueChange={value => handleStatusChange(item.id, value)} 
                              disabled={isUpdating}
                            >
                              <SelectTrigger className="bg-background border z-50 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background border z-50">
                                <SelectItem value="pendiente">
                                  <div className="flex items-center">
                                    <Clock className="w-3 h-3 mr-2" />
                                    Pendiente
                                  </div>
                                </SelectItem>
                                <SelectItem value="en_proceso">
                                  <div className="flex items-center">
                                    <Play className="w-3 h-3 mr-2" />
                                    En Proceso
                                  </div>
                                </SelectItem>
                                <SelectItem value="finalizada">
                                  <div className="flex items-center">
                                    <CheckCircle className="w-3 h-3 mr-2" />
                                    Finalizada
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Description - Mobile Friendly */}
                  {item.service_description && (
                    <div className="overflow-hidden">
                      <p className="text-xs text-muted-foreground line-clamp-2 break-words whitespace-pre-wrap">
                        {item.service_description}
                      </p>
                    </div>
                  )}
                  
                  {/* Item Details - Mobile Stack Layout */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="overflow-hidden">
                      <span className="font-medium">Cantidad:</span> {item.quantity}
                    </div>
                    <div className="text-right overflow-hidden">
                      <span className="font-medium">Unit:</span> <span className="break-words">{formatCurrency(calculateItemCorrectPrice(item) / (item.quantity || 1))}</span>
                    </div>
                  </div>

                  {/* Show serial number and supplier for articles - Hide supplier from clients */}
                  {item.item_type === 'articulo' && (item.serial_number || (item.supplier_name && !isClient)) && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {item.serial_number && (
                        <div>
                          <span className="font-medium">Serie:</span> {item.serial_number}
                        </div>
                      )}
                      {item.supplier_name && !isClient && (
                        <div>
                          <span className="font-medium">Proveedor:</span> {item.supplier_name}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Serial number and supplier fields for articles - Mobile First - Hidden for clients */}
                  {item.item_type === 'articulo' && canEditSerialInfo && (
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center mb-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Información del Artículo
                        </Label>
                        {canEditSerialInfo && (
                          <div className="flex items-center gap-1">
                            {editableSerialFields.has(item.id) ? (
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
                                className="h-6 px-2"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => {
                                  setEditableSerialFields(prev => new Set(prev).add(item.id));
                                }} 
                                disabled={isEditingSerial} 
                                className="h-6 px-2 text-xs"
                              >
                                <Edit3 className="w-3 h-3 mr-1" />
                                {item.serial_number || item.supplier_name ? 'Editar' : 'Agregar'}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Mobile-first stacked layout for inputs */}
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">Número de Serie</Label>
                          <Input 
                            key={`serial-${item.id}-${editableSerialFields.has(item.id)}`} 
                            defaultValue={item.serial_number || ''} 
                            onBlur={e => {
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
                            onKeyDown={e => {
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
                            className="h-8 mt-1 text-sm" 
                            disabled={!editableSerialFields.has(item.id) || isEditingSerial} 
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Proveedor</Label>
                          <Input 
                            key={`supplier-${item.id}-${editableSerialFields.has(item.id)}`} 
                            defaultValue={item.supplier_name || ''} 
                            onBlur={e => {
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
                            onKeyDown={e => {
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
                            className="h-8 mt-1 text-sm" 
                            disabled={!editableSerialFields.has(item.id) || isEditingSerial} 
                          />
                        </div>
                        {isEditingSerial && (
                          <div className="flex items-center justify-center text-xs text-muted-foreground">
                            <Save className="w-3 h-3 mr-1 animate-spin" />
                            Guardando...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>;
      })}
      </div>

      {/* Resumen de progreso - Mobile First */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-base font-bold text-yellow-600">
                {orderItems.filter(item => item.status === 'pendiente').length}
              </div>
              <div className="text-xs text-muted-foreground">Pendientes</div>
            </div>
            <div>
              <div className="text-base font-bold text-blue-600">
                {orderItems.filter(item => item.status === 'en_proceso').length}
              </div>
              <div className="text-xs text-muted-foreground">En Proceso</div>
            </div>
            <div>
              <div className="text-base font-bold text-green-600">
                {orderItems.filter(item => item.status === 'finalizada').length}
              </div>
              <div className="text-xs text-muted-foreground">Finalizados</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón Terminar Todo - Only for staff, hidden for clients */}
      {!isClient && canEdit && showReadyButtons && orderItems.some(item => item.status !== 'finalizada') && (
        <div className="mt-4">
          <Button 
            onClick={handleFinishAll} 
            disabled={finishingAll} 
            variant="default" 
            size="sm" 
            className="w-full"
          >
            {finishingAll ? (
              <>
                <Save className="w-4 h-4 mr-2 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Terminar Todo
              </>
            )}
          </Button>
        </div>
      )}
      
      {/* Confirmation dialog for item deletion */}
      <AlertDialog open={itemToDelete !== null} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar el artículo "{itemToDelete?.name}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}