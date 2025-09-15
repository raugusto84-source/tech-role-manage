import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentSummary {
  totalPaid: number;
  paymentCount: number;
  remainingBalance: number;
  isFullyPaid: boolean;
}

export function useOrderPayments(orderId: string, totalAmount: number) {
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({
    totalPaid: 0,
    paymentCount: 0,
    remainingBalance: 0,
    isFullyPaid: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!orderId || totalAmount <= 0) {
        setPaymentSummary({
          totalPaid: 0,
          paymentCount: 0,
          remainingBalance: totalAmount,
          isFullyPaid: false
        });
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('order_payments')
          .select('payment_amount')
          .eq('order_id', orderId);

        if (error) throw error;

        const totalPaid = data?.reduce((sum, payment) => sum + Number(payment.payment_amount), 0) || 0;
        const paymentCount = data?.length || 0;
        const remainingBalance = Math.max(0, totalAmount - totalPaid);
        const isFullyPaid = remainingBalance <= 0;

        setPaymentSummary({
          totalPaid,
          paymentCount,
          remainingBalance,
          isFullyPaid
        });
      } catch (error) {
        console.error('Error fetching order payments:', error);
        setPaymentSummary({
          totalPaid: 0,
          paymentCount: 0,
          remainingBalance: totalAmount,
          isFullyPaid: false
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [orderId, totalAmount]);

  return { paymentSummary, loading };
}