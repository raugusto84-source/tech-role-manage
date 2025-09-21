import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrderCashback {
  amount: number;
  description: string;
  createdAt: string;
}

export function useOrderCashback(orderId: string) {
  const [cashback, setCashback] = useState<OrderCashback | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderCashback = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('reward_transactions')
          .select('amount, description, created_at')
          .eq('order_id', orderId)
          .eq('transaction_type', 'earned')
          .maybeSingle();

        if (error) {
          console.error('Error fetching order cashback:', error);
          setCashback(null);
        } else {
          setCashback(data ? {
            amount: data.amount,
            description: data.description,
            createdAt: data.created_at
          } : null);
        }
      } catch (error) {
        console.error('Error fetching order cashback:', error);
        setCashback(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderCashback();

    // Set up real-time subscription for cashback changes
    const channel = supabase
      .channel(`order-cashback-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reward_transactions',
          filter: `order_id=eq.${orderId}`
        },
        () => {
          console.log('New cashback detected, refreshing...');
          fetchOrderCashback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return { cashback, loading };
}