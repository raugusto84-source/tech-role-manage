import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentSummary {
  totalPaid: number;
  paymentCount: number;
  remainingBalance: number;
  isFullyPaid: boolean;
  existingAccountType?: 'fiscal' | 'no_fiscal';
  hasISRApplied: boolean;
  totalISRAmount: number;
}

export function useOrderPayments(orderId: string, totalAmount: number) {
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({
    totalPaid: 0,
    paymentCount: 0,
    remainingBalance: 0,
    isFullyPaid: false,
    existingAccountType: undefined,
    hasISRApplied: false,
    totalISRAmount: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    if (!orderId || totalAmount <= 0) {
      setPaymentSummary({
        totalPaid: 0,
        paymentCount: 0,
        remainingBalance: totalAmount,
        isFullyPaid: false,
        existingAccountType: undefined,
        hasISRApplied: false,
        totalISRAmount: 0
      });
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching payments for order:', orderId);
      const { data, error } = await supabase
        .from('order_payments')
        .select('payment_amount, account_type, isr_withholding_applied, isr_withholding_amount')
        .eq('order_id', orderId);

      if (error) throw error;

      console.log('Payment data retrieved:', data);
      const totalPaid = data?.reduce((sum, payment) => sum + Number(payment.payment_amount), 0) || 0;
      const paymentCount = data?.length || 0;
      const existingAccountType = data && data.length > 0 ? data[0].account_type : undefined;
      
      // Verificar si hay ISR aplicado
      const hasISRApplied = data?.some(payment => payment.isr_withholding_applied) || false;
      const totalISRAmount = data?.reduce((sum, payment) => sum + Number(payment.isr_withholding_amount || 0), 0) || 0;
      
      // Si hay ISR aplicado, calcular el remaining balance considerando el total exacto después de ISR
      let remainingBalance = 0;
      if (hasISRApplied) {
        // Calcular el total exacto con ISR aplicado
        const baseAmount = totalAmount / 1.16; // Base sin IVA
        const isrAmount = baseAmount * 0.0125; // ISR 1.25%
        const exactTotalWithISR = totalAmount - isrAmount;
        remainingBalance = Math.max(0, exactTotalWithISR - totalPaid);
      } else {
        remainingBalance = Math.max(0, totalAmount - totalPaid);
      }
      
      const isFullyPaid = remainingBalance <= 0;

      const summary = {
        totalPaid,
        paymentCount,
        remainingBalance,
        isFullyPaid,
        existingAccountType,
        hasISRApplied,
        totalISRAmount
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
        existingAccountType: undefined,
        hasISRApplied: false,
        totalISRAmount: 0
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