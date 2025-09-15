import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentSummary {
  totalPaid: number;
  paymentCount: number;
  remainingBalance: number;
  isFullyPaid: boolean;
  existingAccountType?: 'fiscal' | 'no_fiscal';
}

export function useOrderPayments(orderId: string, totalAmount: number) {
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({
    totalPaid: 0,
    paymentCount: 0,
    remainingBalance: 0,
    isFullyPaid: false,
    existingAccountType: undefined
  });
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    if (!orderId || totalAmount <= 0) {
      setPaymentSummary({
        totalPaid: 0,
        paymentCount: 0,
        remainingBalance: totalAmount,
        isFullyPaid: false,
        existingAccountType: undefined
      });
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching payments for order:', orderId);
      const { data, error } = await supabase
        .from('order_payments')
        .select('payment_amount, account_type')
        .eq('order_id', orderId);

      if (error) throw error;

      console.log('Payment data retrieved:', data);
      const totalPaid = data?.reduce((sum, payment) => sum + Number(payment.payment_amount), 0) || 0;
      const paymentCount = data?.length || 0;
      const remainingBalance = Math.max(0, totalAmount - totalPaid);
      const isFullyPaid = remainingBalance <= 0;
      const existingAccountType = data && data.length > 0 ? data[0].account_type : undefined;

      const summary = {
        totalPaid,
        paymentCount,
        remainingBalance,
        isFullyPaid,
        existingAccountType
      };
      
      console.log('Payment summary calculated:', summary);
      setPaymentSummary(summary);
    } catch (error) {
      console.error('Error fetching order payments:', error);
      setPaymentSummary({
        totalPaid: 0,
        paymentCount: 0,
        remainingBalance: totalAmount,
        isFullyPaid: false,
        existingAccountType: undefined
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [orderId, totalAmount]);

  // Set up real-time subscription for payment updates
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order-payments-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_payments',
          filter: `order_id=eq.${orderId}`
        },
        () => {
          console.log('New payment detected, refreshing data...');
          fetchPayments();
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up payment subscription for order:', orderId);
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return { paymentSummary, loading, refreshPayments: fetchPayments };
}