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
        setElapsedTime('');
      } else {
        const startTime = new Date(logs[0].changed_at);
        const now = new Date();
        const durationMs = now.getTime() - startTime.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        setElapsedTime(formatHoursAndMinutes(durationHours));
      }

      // Get when the order first entered "en_proceso" for service time calculation
      const { data: enProcesoLog, error: enProcesoError } = await supabase
        .from('order_status_logs')
        .select('changed_at')
        .eq('order_id', orderId)
        .eq('new_status', 'en_proceso' as OrderStatus)
        .order('changed_at', { ascending: true })
        .limit(1);

      if (!enProcesoError && enProcesoLog && enProcesoLog.length > 0) {
        // Calculate service time from when order entered "en_proceso"
        const serviceStartTime = new Date(enProcesoLog[0].changed_at);
        const now = new Date();
        const serviceDurationMs = now.getTime() - serviceStartTime.getTime();
        const serviceDurationHours = serviceDurationMs / (1000 * 60 * 60);
        setServiceTime(formatHoursAndMinutes(serviceDurationHours));
        
        // Total time is now service time (from en_proceso), not from creation
        setTotalTime(formatHoursAndMinutes(serviceDurationHours));
      } else {
        // Order hasn't started yet (still in en_espera or similar)
        setServiceTime('');
        setTotalTime('');
      }

    } catch (error) {
      console.error('Error loading elapsed time:', error);
      setElapsedTime('');
      setTotalTime('');
      setServiceTime('');
    } finally {
      setLoading(false);
    }
  };

  return { elapsedTime, totalTime, serviceTime, loading };
}
