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
    if (!profile || !['administrador', 'vendedor'].includes(profile.role)) {
      return;
    }

    try {
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

      // Count pending policy payments
      const policyPaymentsResult = await (supabase
        .from('policy_payments') as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendiente');
      const pendingPolicyPaymentsCount = policyPaymentsResult.count || 0;

      // Count finalized orders with pending balance (excluding policy orders and deleted orders)
      const finalizedOrdersResult = await supabase
        .from('orders')
        .select('id, estimated_cost, is_policy_order')
        .eq('status', 'finalizada')
        .neq('is_policy_order', true)
        .is('deleted_at', null);

      // Get payments for each finalized order and filter those with remaining balance > 0
      let finalizedCount = 0;
      const finalizedOrders = finalizedOrdersResult.data || [];
      
      for (const order of finalizedOrders) {
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('quantity, unit_cost_price, unit_base_price, vat_rate, total_amount')
          .eq('order_id', order.id);
          
        const { data: payments } = await supabase
          .from('order_payments')
          .select('payment_amount')
          .eq('order_id', order.id)
          .is('deleted_at', null);
        
        // Calculate order total from items
        let orderTotal = 0;
        if (orderItems && orderItems.length > 0) {
          orderTotal = orderItems.reduce((total: number, item: any) => {
            const quantity = item.quantity || 1;
            const hasStoredTotal = item.total_amount && item.total_amount > 0;
            
            if (hasStoredTotal) {
              return total + item.total_amount;
            }
            
            const unitPrice = item.unit_base_price || item.unit_cost_price || 0;
            const vatRate = item.vat_rate || 16;
            const subtotal = unitPrice * quantity;
            const vatAmount = subtotal * (vatRate / 100);
            const itemTotal = Math.ceil((subtotal + vatAmount) / 10) * 10;
            
            return total + itemTotal;
          }, 0);
        } else {
          orderTotal = order.estimated_cost || 0;
        }
        
        const totalPaid = payments?.reduce((sum: number, payment: any) => sum + (payment.payment_amount || 0), 0) || 0;
        const remaining = orderTotal - totalPaid;
        
        if (remaining > 0) {
          finalizedCount++;
        }
      }

      // Count pending development payments
      const devPaymentsResult = await supabase
        .from('access_development_payments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendiente');
      const pendingDevPaymentsCount = devPaymentsResult.count || 0;

      // Total collections = policy payments + finalized orders + development payments
      const totalCollections = pendingPolicyPaymentsCount + finalizedCount + pendingDevPaymentsCount;

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
        ordersFinalized: finalizedCount,
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