import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Clock, CheckCircle, AlertCircle, Truck, Play } from 'lucide-react';

interface OrderItem {
  id: string;
  service_name: string;
  service_description?: string;
  quantity: number;
  unit_base_price: number;
  total_amount: number;
  status: 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada';
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
  const { toast } = useToast();

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

          return (
            <Card key={item.id} className="relative">
              <CardContent className="p-4">
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
                        <strong>Precio:</strong> {formatCurrency(item.unit_base_price)}
                      </span>
                      <span>
                        <strong>Total:</strong> {formatCurrency(item.total_amount)}
                      </span>
                    </div>
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