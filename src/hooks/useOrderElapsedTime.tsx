import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatHoursAndMinutes } from '@/utils/timeUtils';
import { Database } from '@/integrations/supabase/types';

type OrderStatus = Database['public']['Enums']['order_status'];

export function useOrderElapsedTime(orderId: string, currentStatus: string, orderCreatedAt: string) {
  const [elapsedTime, setElapsedTime] = useState<string>('');
  const [totalTime, setTotalTime] = useState<string>('');
  const [serviceTime, setServiceTime] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If order is in en_espera, don't calculate any time - timer starts at 0
    if (currentStatus === 'en_espera') {
      setElapsedTime('0h 0m');
      setTotalTime('0h 0m');
      setServiceTime('0h 0m');
      setLoading(false);
      return;
    }

    loadElapsedTime();
    
    // Update every minute
    const interval = setInterval(loadElapsedTime, 60000);
    
    // Real-time subscription
    const channel = supabase
      .channel(`elapsed-time-${orderId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_status_logs',
        filter: `order_id=eq.${orderId}`
      }, () => {
        loadElapsedTime();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [orderId, currentStatus, orderCreatedAt]);

  const loadElapsedTime = async () => {
    try {
      setLoading(true);

      // Get the most recent status log for current status
      const { data: logs, error } = await supabase
        .from('order_status_logs')
        .select('changed_at, new_status')
        .eq('order_id', orderId)
        .eq('new_status', currentStatus as OrderStatus)
        .order('changed_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!logs || logs.length === 0) {
        setElapsedTime('0h 0m');
      } else {
        const startTime = new Date(logs[0].changed_at);
        const now = new Date();
        const durationMs = now.getTime() - startTime.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        setElapsedTime(formatHoursAndMinutes(durationHours));
      }

      // Get when the order first entered "pendiente_aprobacion" or "en_proceso" for time calculation
      // Timer starts from pendiente_aprobacion (first active status after en_espera)
      const { data: startLog, error: startError } = await supabase
        .from('order_status_logs')
        .select('changed_at, new_status')
        .eq('order_id', orderId)
        .in('new_status', ['pendiente_aprobacion', 'en_proceso'] as OrderStatus[])
        .order('changed_at', { ascending: true })
        .limit(1);

      if (!startError && startLog && startLog.length > 0) {
        // Calculate total time from when order first became active (pendiente_aprobacion or en_proceso)
        const serviceStartTime = new Date(startLog[0].changed_at);
        const now = new Date();
        const serviceDurationMs = now.getTime() - serviceStartTime.getTime();
        const serviceDurationHours = serviceDurationMs / (1000 * 60 * 60);
        setServiceTime(formatHoursAndMinutes(serviceDurationHours));
        setTotalTime(formatHoursAndMinutes(serviceDurationHours));
      } else {
        // Order hasn't started yet
        setServiceTime('0h 0m');
        setTotalTime('0h 0m');
      }

    } catch (error) {
      console.error('Error loading elapsed time:', error);
      setElapsedTime('0h 0m');
      setTotalTime('0h 0m');
      setServiceTime('0h 0m');
    } finally {
      setLoading(false);
    }
  };

  return { elapsedTime, totalTime, serviceTime, loading };
}
