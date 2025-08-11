import { useState, useEffect, useRef, useCallback } from 'react';
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

interface SupportTechnician {
  id: string;
  schedule: WorkSchedule;
  reductionPercentage: number;
}

interface UseWorkloadCalculationProps {
  technicianId: string;
  orderItems: OrderItem[];
  primarySchedule: WorkSchedule;
  supportTechnicians?: SupportTechnician[];
}

export function useWorkloadCalculation({
  technicianId,
  orderItems,
  primarySchedule,
  supportTechnicians = []
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
  
  // Use refs to track calculation state and prevent duplicate requests
  const calculationRef = useRef<AbortController | null>(null);
  const lastCalculationKey = useRef<string>('');

  // Create a stable key for comparison
  const calculationKey = `${technicianId}-${JSON.stringify(orderItems)}-${JSON.stringify(primarySchedule)}-${JSON.stringify(supportTechnicians)}`;

  const calculateWorkload = useCallback(async () => {
    // Prevent duplicate calculations
    if (calculationKey === lastCalculationKey.current) {
      return;
    }

    // Cancel any ongoing calculation
    if (calculationRef.current) {
      calculationRef.current.abort();
    }

    if (!technicianId || orderItems.length === 0) {
      setWorkload(0);
      setDeliveryCalculation(null);
      setLoading(false);
      setError(null);
      lastCalculationKey.current = calculationKey;
      return;
    }

    // Create new abort controller for this calculation
    calculationRef.current = new AbortController();
    const currentController = calculationRef.current;

    setLoading(true);
    setError(null);
    
    try {
      // Check if calculation was aborted
      if (currentController.signal.aborted) {
        return;
      }

      // Get current workload with timeout
      const currentWorkload = await Promise.race([
        getTechnicianCurrentWorkload(technicianId),
        new Promise<number>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);

      // Check if calculation was aborted after workload fetch
      if (currentController.signal.aborted) {
        return;
      }

      setWorkload(currentWorkload);

        // Calculate delivery date
        console.log('=== CALLING calculateAdvancedDeliveryDate ===');
        console.log('Order items:', orderItems);
        console.log('Primary schedule:', primarySchedule);
        console.log('Support technicians:', supportTechnicians);
        console.log('Current workload:', currentWorkload);
        
        const result = calculateAdvancedDeliveryDate({
          orderItems,
          primaryTechnicianSchedule: primarySchedule,
          supportTechnicians,
          creationDate: new Date(),
          currentWorkload
        });
        
        console.log('=== CALCULATION RESULT ===');
        console.log('Result:', result);

      // Only update state if this calculation wasn't aborted
      if (!currentController.signal.aborted) {
        setDeliveryCalculation(result);
        lastCalculationKey.current = calculationKey;
      }
    } catch (err: any) {
      // Only handle error if calculation wasn't aborted
      if (!currentController.signal.aborted) {
        console.error('Error calculating workload:', err);
        setError('Error al calcular la carga de trabajo');
        
        // Fallback calculation
        try {
          const fallbackResult = calculateAdvancedDeliveryDate({
            orderItems,
            primaryTechnicianSchedule: primarySchedule,
            supportTechnicians,
            creationDate: new Date(),
            currentWorkload: 0
          });
          
          setDeliveryCalculation(fallbackResult);
          lastCalculationKey.current = calculationKey;
        } catch (fallbackErr) {
          console.error('Fallback calculation also failed:', fallbackErr);
        }
      }
    } finally {
      // Only update loading state if this calculation wasn't aborted
      if (!currentController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [technicianId, calculationKey, orderItems, primarySchedule, supportTechnicians]);

  useEffect(() => {
    // Debounce the calculation
    const timeoutId = setTimeout(() => {
      calculateWorkload();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      // Cancel any ongoing calculation when component unmounts or dependencies change
      if (calculationRef.current) {
        calculationRef.current.abort();
      }
    };
  }, [calculateWorkload]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (calculationRef.current) {
        calculationRef.current.abort();
      }
    };
  }, []);

  return {
    workload,
    deliveryCalculation,
    loading,
    error
  };
}