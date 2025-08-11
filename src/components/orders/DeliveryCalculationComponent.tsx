import { useEffect } from 'react';
import { useWorkloadCalculation } from '@/hooks/useWorkloadCalculation';
import { calculateSharedTimeHours } from '@/utils/workScheduleCalculator';
import { Loader2 } from 'lucide-react';

interface OrderItem {
  id: string;
  estimated_hours: number;
  shared_time: boolean;
  service_type_id?: string;
  quantity?: number;
  status?: 'pendiente' | 'en_proceso' | 'completado';
}

interface DeliveryCalculationDisplayProps {
  technicianId: string;
  orderItems: OrderItem[];
  technicianSchedules: Record<string, any>;
  supportTechnicianId?: string;
  onDateUpdate: (date: string) => void;
  currentDeliveryDate: string;
}

export function DeliveryCalculationDisplay({
  technicianId,
  orderItems,
  technicianSchedules,
  supportTechnicianId,
  onDateUpdate,
  currentDeliveryDate
}: DeliveryCalculationDisplayProps) {
  // Obtener el horario del técnico principal con valores por defecto mejorados
  const defaultSchedule = {
    work_days: [1, 2, 3, 4, 5],
    start_time: '08:00',
    end_time: '16:00',
    break_duration_minutes: 60
  };

  const primarySchedule = technicianSchedules[technicianId] || defaultSchedule;

  // Obtener el horario del técnico de apoyo si existe
  const supportSchedule = supportTechnicianId 
    ? technicianSchedules[supportTechnicianId] || defaultSchedule
    : undefined;

  // Usar el hook para calcular la carga de trabajo y fecha de entrega
  const { workload, deliveryCalculation, loading, error } = useWorkloadCalculation({
    technicianId,
    orderItems,
    primarySchedule,
    supportSchedule
  });

  // Actualizar la fecha cuando cambie el cálculo
  useEffect(() => {
    if (deliveryCalculation && deliveryCalculation.deliveryDate) {
      const calculatedDateString = deliveryCalculation.deliveryDate.toISOString().split('T')[0];
      if (calculatedDateString !== currentDeliveryDate) {
        onDateUpdate(calculatedDateString);
      }
    }
  }, [deliveryCalculation, currentDeliveryDate, onDateUpdate]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Calculando fecha de entrega...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-600 space-y-1">
        <p>⚠️ {error}</p>
        <p>Usando cálculo básico sin carga de trabajo previa</p>
      </div>
    );
  }

  if (!deliveryCalculation) {
    return (
      <div className="text-xs text-muted-foreground">
        No se pudo calcular la fecha de entrega
      </div>
    );
  }

  const effectiveHours = calculateSharedTimeHours(orderItems);

  return (
    <div className="space-y-1 text-xs">
      <p className="text-blue-600 font-medium">
        Hora estimada de entrega: {deliveryCalculation.deliveryTime}
      </p>
      
      <p className="text-muted-foreground">
        {deliveryCalculation.breakdown}
      </p>
      
      <p className="text-green-600">
        Horas efectivas considerando tiempo compartido: {effectiveHours}h
      </p>
      
      {workload > 0 && (
        <p className="text-orange-600">
          ✓ Carga de trabajo actual del técnico: {workload.toFixed(1)}h
        </p>
      )}
      
      {supportTechnicianId && (
        <p className="text-purple-600 font-medium">
          ⚡ Tiempo reducido 30% con técnico de apoyo
        </p>
      )}
      
      <p className="text-blue-500">
        📅 Fecha actualizada automáticamente considerando disponibilidad
      </p>
    </div>
  );
}