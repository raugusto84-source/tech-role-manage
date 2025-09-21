import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseOrderProgressProps {
  orderId: string;
}

export function useOrderProgress({ orderId }: UseOrderProgressProps) {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  const calculateProgress = async () => {
    try {
      setLoading(true);
      
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select('status')
        .eq('order_id', orderId);

      if (error) throw error;

      if (!orderItems || orderItems.length === 0) {
        setProgress(0);
        return;
      }

      const completedItems = orderItems.filter(item => item.status === 'finalizada').length;
      const progressPercentage = Math.round(completedItems / orderItems.length * 100);
      
      setProgress(progressPercentage);
    } catch (error) {
      console.error('Error calculating order progress:', error);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      calculateProgress();
    }
  }, [orderId]);

  // Suscripción a cambios en tiempo real para actualizar el progreso
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order-items-progress-${orderId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items',
        filter: `order_id=eq.${orderId}`
      }, () => {
        calculateProgress();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return { progress, loading, refresh: calculateProgress };
}