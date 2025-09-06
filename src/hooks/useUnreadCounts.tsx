import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UnreadCounts {
  orders: number;
  quotes: number;
  warranties: number;
}

export function useUnreadCounts() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({
    orders: 0,
    quotes: 0,
    warranties: 0
  });

  const fetchCounts = async () => {
    if (!profile || !['administrador', 'vendedor'].includes(profile.role)) {
      return;
    }

    try {
      // Count pending orders (new or pending approval)
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pendiente', 'pendiente_aprobacion']);

      // Count pending quotes (new requests)
      const { count: quotesCount } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'solicitud');

      // Count active warranties that might need attention
      const { count: warrantiesCount } = await supabase
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .not('warranty_start_date', 'is', null)
        .not('warranty_end_date', 'is', null)
        .gte('warranty_end_date', new Date().toISOString().split('T')[0])
        .lte('warranty_end_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      setCounts({
        orders: ordersCount || 0,
        quotes: quotesCount || 0,
        warranties: warrantiesCount || 0
      });
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  useEffect(() => {
    fetchCounts();

    // Set up real-time subscriptions
    const ordersChannel = supabase
      .channel('orders-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, () => {
        fetchCounts();
      })
      .subscribe();

    const quotesChannel = supabase
      .channel('quotes-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quotes'
      }, () => {
        fetchCounts();
      })
      .subscribe();

    const warrantiesChannel = supabase
      .channel('warranties-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items'
      }, () => {
        fetchCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(quotesChannel);
      supabase.removeChannel(warrantiesChannel);
    };
  }, [profile]);

  return counts;
}