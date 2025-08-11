import { useState, useEffect } from 'react';
import { getTechnicianCurrentWorkload, calculateAdvancedDeliveryDate } from '@/utils/workScheduleCalculator';

interface OrderItem {
  id: string;
  estimated_hours: number;
  shared_time: boolean;
  service_type_id?: string;
  quantity?: number;
  status?: 'pendiente' | 'en_proceso' | 'completado';
}

interface WorkSchedule {
  work_days: number[];
  start_time: string;
  end_time: string;
  break_duration_minutes: number;
}

interface UseWorkloadCalculationProps {
  technicianId: string;
  orderItems: OrderItem[];
  primarySchedule: WorkSchedule;
  supportSchedule?: WorkSchedule;
}

export function useWorkloadCalculation({
  technicianId,
  orderItems,
  primarySchedule,
  supportSchedule
}: UseWorkloadCalculationProps) {
  const [workload, setWorkload] = useState(0);
  const [deliveryCalculation, setDeliveryCalculation] = useState<{
    deliveryDate: Date;
    deliveryTime: string;
    effectiveHours: number;
    breakdown: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!technicianId || orderItems.length === 0) {
      setWorkload(0);
      setDeliveryCalculation(null);
      setLoading(false);
      return;
    }

    const calculateWorkload = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Obtener la carga de trabajo actual del técnico
        const currentWorkload = await getTechnicianCurrentWorkload(technicianId);
        setWorkload(currentWorkload);

        // Calcular la fecha de entrega considerando la carga actual
        const result = calculateAdvancedDeliveryDate({
          orderItems,
          primaryTechnicianSchedule: primarySchedule,
          supportTechnicianSchedule: supportSchedule,
          creationDate: new Date(),
          currentWorkload
        });

        setDeliveryCalculation(result);
      } catch (err) {
        console.error('Error calculating workload:', err);
        setError('Error al calcular la carga de trabajo');
        
        // Calcular sin carga de trabajo como respaldo
        const fallbackResult = calculateAdvancedDeliveryDate({
          orderItems,
          primaryTechnicianSchedule: primarySchedule,
          supportTechnicianSchedule: supportSchedule,
          creationDate: new Date(),
          currentWorkload: 0
        });
        
        setDeliveryCalculation(fallbackResult);
      } finally {
        setLoading(false);
      }
    };

    calculateWorkload();
  }, [technicianId, orderItems, primarySchedule, supportSchedule]);

  return {
    workload,
    deliveryCalculation,
    loading,
    error
  };
}