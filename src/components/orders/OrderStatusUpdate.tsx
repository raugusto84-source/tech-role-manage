/**
 * COMPONENTE DE ACTUALIZACIÓN DE ESTADO - REUTILIZABLE
 * 
 * Características:
 * - Modal móvil-first con botones grandes
 * - Solo muestra transiciones válidas de estado
 * - Registro automático de timestamp y usuario
 * - Feedback visual inmediato
 * 
 * Lógica de transiciones:
 * - Pendiente → En Camino, En Proceso
 * - En Camino → En Proceso, Pendiente
 * - En Proceso → Terminado, Pendiente
 * 
 * Reutilización:
 * - Funciona con cualquier orden
 * - Lógica de estados centralizada
 * - Fácil de mantener y extender
 */

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { X, ArrowRight, CheckCircle2, Truck, Wrench } from 'lucide-react';
import { DeliverySignature } from './DeliverySignature';
import { triggerOrderFollowUp } from '@/utils/followUp';

interface OrderStatusUpdateProps {
  order: {
    id: string;
    order_number: string;
    status: 'pendiente_aprobacion' | 'en_proceso' | 'pendiente_actualizacion' | 'pendiente_entrega' | 'cancelada';
    clients?: {
      name: string;
    } | null;
  };
  onClose: () => void;
  onUpdate: () => void;
}

// Configuración de estados disponibles
const STATE_TRANSITIONS = {
  pendiente_aprobacion: [
    { 
      value: 'en_proceso', 
      label: 'En Proceso', 
      icon: Wrench, 
      color: 'bg-orange-500 hover:bg-orange-600',
      description: 'Iniciar trabajo en el proyecto'
    }
  ],
  en_proceso: [
    { 
      value: 'pendiente_actualizacion', 
      label: 'Pendiente Actualización', 
      icon: ArrowRight, 
      color: 'bg-yellow-500 hover:bg-yellow-600',
      description: 'Requiere aprobación de cambios del cliente'
    },
    { 
      value: 'pendiente_entrega', 
      label: 'Pendiente Entrega', 
      icon: CheckCircle2, 
      color: 'bg-green-500 hover:bg-green-600',
      description: 'Trabajo completado, listo para entrega'
    }
  ],
  pendiente_actualizacion: [
    { 
      value: 'en_proceso', 
      label: 'En Proceso', 
      icon: Wrench, 
      color: 'bg-orange-500 hover:bg-orange-600',
      description: 'Continuar con el trabajo'
    },
    { 
      value: 'pendiente_entrega', 
      label: 'Pendiente Entrega', 
      icon: CheckCircle2, 
      color: 'bg-green-500 hover:bg-green-600',
      description: 'Listo para entrega sin cambios'
    }
  ],
  pendiente_entrega: [], // Estado final - requiere firma del cliente
  cancelada: []   // No se puede cambiar desde cancelada
};

export function OrderStatusUpdate({ order, onClose, onUpdate }: OrderStatusUpdateProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showDeliverySignature, setShowDeliverySignature] = useState(false);

  /**
   * Obtiene las transiciones disponibles para el estado actual
   */
  const availableTransitions = STATE_TRANSITIONS[order.status] || [];

  /**
   * Maneja el cambio de estado con registro automático
   */
  const handleStatusChange = async (newStatus: 'pendiente_aprobacion' | 'en_proceso' | 'pendiente_actualizacion' | 'pendiente_entrega' | 'cancelada') => {
    if (loading) return;
    
    // Si el nuevo estado es "pendiente_entrega", mostrar componente de firma
    if (newStatus === 'pendiente_entrega') {
      setShowDeliverySignature(true);
      return;
    }
    
    setLoading(true);
    setSelectedStatus(newStatus);

    try {
      // Actualizar el estado en la orden
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      // GUARDAR EL TOTAL DE LA UI SI LA TRANSICIÓN ES DE AUTORIZACIÓN
      if (order.status === 'pendiente_aprobacion' && newStatus === 'en_proceso') {
        console.log('💾 Guardando total de UI al autorizar orden via cambio de estado');
        // Necesitamos obtener los items para calcular el total
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id);
        
        if (orderItems && orderItems.length > 0) {
          // Calcular total usando la misma lógica que otros componentes
          const total = orderItems.reduce((sum, item) => {
            const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
            const isLocked = Boolean(item.pricing_locked);
            if (hasStoredTotal && isLocked) {
              return sum + Number(item.total_amount);
            }
            // Para items sin total guardado, usar precio base * cantidad + IVA aproximado
            const basePrice = item.unit_base_price || item.unit_cost_price || 0;
            const quantity = item.quantity || 1;
            const vatRate = item.vat_rate || 16;
            const itemTotal = basePrice * quantity * (1 + vatRate / 100);
            return sum + Math.ceil(itemTotal / 10) * 10; // Redondear a múltiplo de 10
          }, 0);
          
          await saveUITotalToDatabase(total);
        }
      }

      // Mostrar confirmación
      const statusLabels = {
        'pendiente_aprobacion': 'Pendiente Aprobación',
        'en_proceso': 'En Proceso', 
        'pendiente_actualizacion': 'Pendiente Actualización',
        'pendiente_entrega': 'Pendiente Entrega'
      };

      toast({
        title: "Estado Actualizado",
        description: `Orden cambiada a: ${statusLabels[newStatus as keyof typeof statusLabels]}`,
      });

      // Disparar seguimiento según el nuevo estado
      const eventMap: Record<string, string> = {
        pendiente_aprobacion: 'order_created',
        en_proceso: 'order_in_progress',
        pendiente_actualizacion: 'order_needs_approval',
        pendiente_entrega: 'order_completed'
      };
      const followUpEvent = eventMap[newStatus] || null;
      if (followUpEvent) {
        await triggerOrderFollowUp(order, followUpEvent);
      }

      // Cerrar modal y actualizar vista
      onUpdate();
      onClose();
      
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la orden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setSelectedStatus(null);
    }
  };

  /**
   * Obtiene el color actual del estado
   */
  const getCurrentStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'bg-yellow-100 text-yellow-800';
      case 'en_proceso': return 'bg-orange-100 text-orange-800';
      case 'pendiente_actualizacion': return 'bg-blue-100 text-blue-800';
      case 'pendiente_entrega': return 'bg-green-100 text-green-800';
      case 'cancelada': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCurrentStatusLabel = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'Pendiente Aprobación';
      case 'en_proceso': return 'En Proceso';
      case 'pendiente_actualizacion': return 'Pendiente Actualización';
      case 'pendiente_entrega': return 'Pendiente Entrega';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  // Guardar el total de la UI en order_final_totals cuando se autoriza
  const saveUITotalToDatabase = async (uiTotal: number) => {
    try {
      const { error } = await supabase
        .from('order_final_totals')
        .upsert({
          order_id: order.id,
          final_total_amount: uiTotal,
          display_subtotal: uiTotal / 1.16,
          display_vat_amount: uiTotal - (uiTotal / 1.16),
          calculation_source: 'ui_status_change_authorization',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'order_id'
        });

      if (error) {
        console.error('Error saving authorized UI total via status change:', error);
      } else {
        console.log('✅ Total autorizado guardado via cambio de estado:', uiTotal);
      }
    } catch (error) {
      console.error('Error saving authorized UI total via status change:', error);
    }
  };

  return (
    <>
      {/* Modal principal de cambio de estado - Mobile-first */}
      {!showDeliverySignature && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <Card className="w-full max-w-md mx-0 rounded-t-2xl sm:rounded-lg max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-full duration-300">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Cambiar Estado</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClose}
                  disabled={loading}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Información de la orden */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground truncate">
                  {order.order_number} - {order.clients?.name}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Estado actual:</span>
                  <Badge className={getCurrentStatusColor(order.status)}>
                    {getCurrentStatusLabel(order.status)}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {availableTransitions.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground text-sm">
                    No hay cambios de estado disponibles para esta orden.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Selecciona el nuevo estado:
                  </p>
                  
                  {availableTransitions.map((transition) => {
                    const Icon = transition.icon;
                    const isSelected = selectedStatus === transition.value;
                    const isLoading = loading && isSelected;
                    
                    return (
                      <Button
                        key={transition.value}
                        onClick={() => handleStatusChange(transition.value as 'pendiente_aprobacion' | 'en_proceso' | 'pendiente_actualizacion' | 'pendiente_entrega' | 'cancelada')}
                        disabled={loading}
                        className={`w-full h-auto p-4 flex items-center justify-start gap-3 text-left ${transition.color} text-white relative overflow-hidden touch-manipulation`}
                        variant="default"
                      >
                        {/* Indicador de carga */}
                        {isLoading && (
                          <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{transition.label}</div>
                          <div className="text-xs opacity-90 truncate">{transition.description}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-70" />
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>

            {/* Botones fijos en la parte inferior */}
            <div className="p-4 bg-background border-t flex-shrink-0">
              <Button 
                variant="outline" 
                className="w-full h-11" 
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Componente de firma de entrega */}
      {showDeliverySignature && (
        <DeliverySignature 
          order={order}
          onClose={() => setShowDeliverySignature(false)}
          onComplete={() => {
            setShowDeliverySignature(false);
            onUpdate();
            onClose();
          }}
        />
      )}
    </>
  );
}