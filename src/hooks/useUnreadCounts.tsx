import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UnreadCounts {
  orders: number;
  quotes: number;
  warranties: number;
  collections: number;
}

export function useUnreadCounts() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({ 
    orders: 0, 
    quotes: 0, 
    warranties: 0,
    collections: 0
  });

  const fetchCounts = async () => {
    if (!profile || !['administrador', 'vendedor'].includes(profile.role)) {
      return;
    }

    try {
      // Count orders pending acceptance or update (pendiente_aprobacion status)
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente_aprobacion');

      // Count quotes pending approval (new status flow)
      const { count: quotesCount } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente_aprobacion');

      // Count warranty claims that are pending resolution
      const { count: warrantiesCount } = await supabase
        .from('warranty_claims')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pendiente', 'en_proceso']);

      setCounts({
        orders: ordersCount || 0,
        quotes: quotesCount || 0,
        warranties: warrantiesCount || 0,
        collections: 0
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
        table: 'warranty_claims'
      }, () => {
        fetchCounts();
      })
      .subscribe();

    const collectionsChannel = supabase
      .channel('collections-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_payments'
      }, () => {
        fetchCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(quotesChannel);
      supabase.removeChannel(warrantiesChannel);
      supabase.removeChannel(collectionsChannel);
    };
  }, [profile]);

  return counts;
}