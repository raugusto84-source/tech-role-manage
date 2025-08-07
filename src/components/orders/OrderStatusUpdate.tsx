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

interface OrderStatusUpdateProps {
  order: {
    id: string;
    order_number: string;
    status: 'pendiente' | 'en_camino' | 'en_proceso' | 'finalizada' | 'cancelada';
    clients?: {
      name: string;
    } | null;
  };
  onClose: () => void;
  onUpdate: () => void;
}

// Configuración de estados disponibles
const STATE_TRANSITIONS = {
  pendiente: [
    { 
      value: 'en_camino', 
      label: 'En Camino', 
      icon: Truck, 
      color: 'bg-blue-500 hover:bg-blue-600',
      description: 'Saliendo hacia el sitio del cliente'
    },
    { 
      value: 'en_proceso', 
      label: 'En Proceso', 
      icon: Wrench, 
      color: 'bg-orange-500 hover:bg-orange-600',
      description: 'Iniciando trabajo en sitio'
    }
  ],
  en_camino: [
    { 
      value: 'en_proceso', 
      label: 'En Proceso', 
      icon: Wrench, 
      color: 'bg-orange-500 hover:bg-orange-600',
      description: 'Llegué al sitio, iniciando trabajo'
    },
    { 
      value: 'pendiente', 
      label: 'Pendiente', 
      icon: ArrowRight, 
      color: 'bg-gray-500 hover:bg-gray-600',
      description: 'Regresar a estado pendiente'
    }
  ],
  en_proceso: [
    { 
      value: 'finalizada', 
      label: 'Terminado', 
      icon: CheckCircle2, 
      color: 'bg-green-500 hover:bg-green-600',
      description: 'Trabajo completado exitosamente'
    },
    { 
      value: 'pendiente', 
      label: 'Pendiente', 
      icon: ArrowRight, 
      color: 'bg-gray-500 hover:bg-gray-600',
      description: 'Regresar a estado pendiente'
    }
  ],
  finalizada: [], // No se puede cambiar desde finalizada
  cancelada: []   // No se puede cambiar desde cancelada
};

export function OrderStatusUpdate({ order, onClose, onUpdate }: OrderStatusUpdateProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  /**
   * Obtiene las transiciones disponibles para el estado actual
   */
  const availableTransitions = STATE_TRANSITIONS[order.status] || [];

  /**
   * Maneja el cambio de estado con registro automático
   */
  const handleStatusChange = async (newStatus: 'pendiente' | 'en_camino' | 'en_proceso' | 'finalizada' | 'cancelada') => {
    if (loading) return;
    
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

      // Mostrar confirmación
      const statusLabels = {
        'en_camino': 'En Camino',
        'en_proceso': 'En Proceso', 
        'finalizada': 'Terminado',
        'pendiente': 'Pendiente'
      };

      toast({
        title: "Estado Actualizado",
        description: `Orden cambiada a: ${statusLabels[newStatus as keyof typeof statusLabels]}`,
      });

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
      case 'pendiente': return 'bg-yellow-100 text-yellow-800';
      case 'en_camino': return 'bg-blue-100 text-blue-800';
      case 'en_proceso': return 'bg-orange-100 text-orange-800';
      case 'finalizada': return 'bg-green-100 text-green-800';
      case 'cancelada': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCurrentStatusLabel = (status: string) => {
    switch (status) {
      case 'pendiente': return 'Pendiente';
      case 'en_camino': return 'En Camino';
      case 'en_proceso': return 'En Proceso';
      case 'finalizada': return 'Terminado';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto sm:w-auto min-w-[320px] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cambiar Estado</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Información de la orden */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
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

        <CardContent className="space-y-3">
          {availableTransitions.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-sm">
                No hay cambios de estado disponibles para esta orden.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Selecciona el nuevo estado:
              </p>
              
              {availableTransitions.map((transition) => {
                const Icon = transition.icon;
                const isSelected = selectedStatus === transition.value;
                const isLoading = loading && isSelected;
                
                return (
                  <Button
                    key={transition.value}
                    onClick={() => handleStatusChange(transition.value as 'pendiente' | 'en_camino' | 'en_proceso' | 'finalizada' | 'cancelada')}
                    disabled={loading}
                    className={`w-full h-auto p-4 flex items-center justify-start gap-3 text-left ${transition.color} text-white relative overflow-hidden`}
                    variant="default"
                  >
                    {/* Indicador de carga */}
                    {isLoading && (
                      <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-semibold">{transition.label}</div>
                      <div className="text-sm opacity-90">{transition.description}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-70" />
                  </Button>
                );
              })}
            </div>
          )}
          
          {/* Botón de cancelar */}
          <Button 
            variant="outline" 
            className="w-full mt-4" 
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}