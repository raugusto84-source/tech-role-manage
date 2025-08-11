import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { calculateAdvancedDeliveryDateWithWorkload } from '@/utils/workScheduleCalculator';
import { OrderItem } from '@/components/orders/OrderItemsList';

interface DeliveryCalculationComponentProps {
  orderItems: OrderItem[];
  formData: {
    assigned_technician: string;
    support_technician: string;
    delivery_date: string;
  };
  technicianSchedules: Record<string, any>;
  onDateUpdate: (date: string) => void;
}

export function DeliveryCalculationComponent({ 
  orderItems, 
  formData, 
  technicianSchedules, 
  onDateUpdate 
}: DeliveryCalculationComponentProps) {
  const [deliveryInfo, setDeliveryInfo] = useState<{
    formattedDate: string;
    time: string;
    hours: number;
    breakdown: string;
    canUseSharedTime?: boolean;
    sharedServicesCount?: number;
  } | null>(null);
  
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    const calculateDelivery = async () => {
      // Solo calcular si hay items de orden
      if (orderItems.length === 0) {
        setDeliveryInfo(null);
        return;
      }

      setIsCalculating(true);
      
      try {
        // Obtener el horario real del técnico asignado desde la base de datos
        const technicianSchedule = technicianSchedules[formData.assigned_technician];
        
        // Si no hay horario específico, usar valores por defecto
        const primarySchedule = technicianSchedule || {
          work_days: [1, 2, 3, 4, 5],
          start_time: '08:00',
          end_time: '16:00',
          break_duration_minutes: 0
        };
        
        let supportSchedule = undefined;
        if (formData.support_technician && formData.support_technician !== 'none') {
          supportSchedule = technicianSchedules[formData.support_technician] || primarySchedule;
        }

        // Calcular fecha de entrega con carga activa del técnico
        const { deliveryDate, deliveryTime, effectiveHours, breakdown, canUseSharedTime, sharedServicesCount } = await calculateAdvancedDeliveryDateWithWorkload({
          orderItems: orderItems.map(item => ({
            id: item.id,
            estimated_hours: item.estimated_hours || 0,
            shared_time: item.shared_time || false,
            status: item.status || 'pendiente',
            service_type_id: item.service_type_id,
            quantity: item.quantity || 1
          })),
          primaryTechnicianSchedule: primarySchedule,
          supportTechnicianSchedule: supportSchedule,
          creationDate: new Date(),
          technicianId: formData.assigned_technician || undefined
        });
        
        // Actualizar automáticamente la fecha si es diferente (formateo local)
        const calculatedDateString = format(deliveryDate, 'yyyy-MM-dd');
        if (calculatedDateString !== formData.delivery_date) {
          onDateUpdate(calculatedDateString);
        }

        setDeliveryInfo({
          formattedDate: deliveryDate.toLocaleDateString('es-ES'),
          time: deliveryTime,
          hours: effectiveHours,
          breakdown: breakdown || `${effectiveHours}h efectivas`,
          canUseSharedTime,
          sharedServicesCount
        });

      } catch (error) {
        console.error('Error calculating delivery:', error);
        setDeliveryInfo({
          formattedDate: 'Error en cálculo',
          time: 'No calculado',
          hours: 0,
          breakdown: 'Error en cálculo'
        });
      } finally {
        setIsCalculating(false);
      }
    };

    calculateDelivery();
  }, [orderItems, formData.assigned_technician, formData.support_technician, technicianSchedules, formData.delivery_date, onDateUpdate]);

  if (isCalculating) {
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">Calculando fecha de entrega...</p>
      </div>
    );
  }

  if (!deliveryInfo) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-blue-600 font-medium">
        📅 {deliveryInfo.formattedDate} - 🕐 {deliveryInfo.time}
      </p>
      <p className="text-xs text-green-600">
        ⚡ Horas efectivas: {deliveryInfo.hours}h
      </p>
      {formData.assigned_technician && (
        <p className="text-xs text-muted-foreground">
          ✅ Incluye órdenes activas del técnico
        </p>
      )}
      {deliveryInfo.canUseSharedTime === false && (
        <p className="text-xs text-amber-600">
          ⚠️ Límite de servicios compartidos alcanzado ({deliveryInfo.sharedServicesCount}/3)
        </p>
      )}
      {deliveryInfo.canUseSharedTime === true && deliveryInfo.sharedServicesCount !== undefined && (
        <p className="text-xs text-green-600">
          🔄 Servicios compartidos: {deliveryInfo.sharedServicesCount}/3
        </p>
      )}
    </div>
  );
}