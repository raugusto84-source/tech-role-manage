import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UnreadCounts {
  orders: number;
  quotes: number;
  warranties: number;
  collections: number;
  ordersFinalized: number;
  ordersInProcess: number;
  ordersPendingAuth: number;
  ordersPendingDelivery: number;
}

export function useUnreadCounts() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({ 
    orders: 0, 
    quotes: 0, 
    warranties: 0,
    collections: 0,
    ordersFinalized: 0,
    ordersInProcess: 0,
    ordersPendingAuth: 0,
    ordersPendingDelivery: 0
  });

  const fetchCounts = async () => {
    if (!profile || !['administrador', 'vendedor', 'supervisor'].includes(profile.role)) {
      return;
    }

    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-indexed

      // Helper to filter only current month and overdue payments
      const isCurrentOrOverdue = (dueDateStr: string) => {
        if (!dueDateStr) return true;
        const dueDate = new Date(dueDateStr + 'T00:00:00');
        const dueYear = dueDate.getFullYear();
        const dueMonth = dueDate.getMonth();
        if (dueYear < currentYear) return true;
        if (dueYear === currentYear && dueMonth <= currentMonth) return true;
        return false;
      };

      // Count orders pending acceptance or update (pendiente_aprobacion status, excluding deleted orders)
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente_aprobacion')
        .is('deleted_at', null);

      // Count new quote requests (solicitud status - new quotes from clients)
      const { count: quotesCount } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'solicitud');

      // Count warranty claims that are pending resolution
      const { count: warrantiesCount } = await supabase
        .from('warranty_claims')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pendiente', 'en_proceso']);

      // ========== SISTEMAS: Policy Payments (is_paid = false, current month or overdue) ==========
      const { data: policyPaymentsData } = await (supabase
        .from('policy_payments') as any)
        .select('id, due_date')
        .eq('is_paid', false);
      
      const sistemasCount = (policyPaymentsData || []).filter((p: any) => isCurrentOrOverdue(p.due_date)).length;

      // ========== SEGURIDAD: Order Payments from pending_collections (current month or overdue) ==========
      const { data: orderCollectionsData } = await supabase
        .from('pending_collections')
        .select('id, due_date')
        .eq('collection_type', 'order_payment')
        .eq('status', 'pending');
      
      const seguridadCount = (orderCollectionsData || []).filter((p: any) => isCurrentOrOverdue(p.due_date)).length;

      // ========== FRACCIONAMIENTOS: Development Payments (status in ['pending', 'overdue'], current month or overdue) ==========
      const { data: devPaymentsData } = await supabase
        .from('access_development_payments')
        .select('id, due_date')
        .in('status', ['pending', 'overdue']);
      
      const fraccionamientosCount = (devPaymentsData || []).filter((p: any) => isCurrentOrOverdue(p.due_date)).length;

      // Total collections = sistemas + seguridad + fraccionamientos
      const totalCollections = sistemasCount + seguridadCount + fraccionamientosCount;

      const { count: inProcessCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'en_proceso')
        .is('deleted_at', null);

      const { count: pendingAuthCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente_aprobacion')
        .is('deleted_at', null);

      const { count: pendingDeliveryCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente_entrega')
        .neq('is_policy_order', true)
        .is('deleted_at', null);

      setCounts({
        orders: ordersCount || 0,
        quotes: quotesCount || 0,
        warranties: warrantiesCount || 0,
        collections: totalCollections,
        ordersFinalized: seguridadCount,
        ordersInProcess: inProcessCount || 0,
        ordersPendingAuth: pendingAuthCount || 0,
        ordersPendingDelivery: pendingDeliveryCount || 0
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