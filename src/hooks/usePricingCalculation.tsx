import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRewardSettings } from './useRewardSettings';

interface OrderItem {
  subtotal: number;
  vat_amount: number;
  vat_rate: number;
}

interface PricingTotals {
  totalCostPrice: number;
  totalVATAmount: number;
  totalAmount: number;
  hasCashbackAdjustment: boolean;
  isNewClient: boolean;
}

export function usePricingCalculation(orderItems: OrderItem[], clientId: string) {
  const { settings: rewardSettings } = useRewardSettings();
  const [pricing, setPricing] = useState<PricingTotals>({
    totalCostPrice: 0,
    totalVATAmount: 0,
    totalAmount: 0,
    hasCashbackAdjustment: false,
    isNewClient: false
  });

  useEffect(() => {
    calculatePricing();
  }, [orderItems, clientId, rewardSettings]);

  const calculatePricing = async () => {
    let totalCostPrice = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    let totalVATAmount = orderItems.reduce((sum, item) => sum + item.vat_amount, 0);
    let hasCashbackAdjustment = false;
    let isNewClient = false;

    // Check if client is new and if cashback should be applied to price
    if (rewardSettings?.apply_cashback_to_items && clientId) {
      try {
        const { data: clientOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('client_id', clientId)
          .eq('status', 'finalizada');
        
        isNewClient = !clientOrders || clientOrders.length === 0;
        
        // Only apply to price if NOT a new client (use general cashback)
        if (!isNewClient) {
          const cashbackPercent = rewardSettings.general_cashback_percent;
          const cashbackAmount = totalCostPrice * (cashbackPercent / 100);
          totalCostPrice += cashbackAmount;
          // Recalculate VAT on the new total
          totalVATAmount = orderItems.reduce((sum, item) => {
            const itemCashback = item.subtotal * (cashbackPercent / 100);
            const newItemSubtotal = item.subtotal + itemCashback;
            return sum + (newItemSubtotal * item.vat_rate / 100);
          }, 0);
          hasCashbackAdjustment = true;
        }
      } catch (error) {
        console.error('Error checking client status:', error);
      }
    }

    setPricing({
      totalCostPrice,
      totalVATAmount,
      totalAmount: totalCostPrice + totalVATAmount,
      hasCashbackAdjustment,
      isNewClient
    });
  };

  return pricing;
}