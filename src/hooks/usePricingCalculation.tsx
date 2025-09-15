import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSalesPricingCalculation } from './useSalesPricingCalculation';

interface OrderItem {
  subtotal: number;
  vat_amount: number;
  vat_rate: number;
  item_type?: string;
  cost_price?: number;
  base_price?: number;
  profit_margin_rate?: number;
  quantity?: number;
}

interface PricingTotals {
  totalCostPrice: number;
  totalVATAmount: number;
  totalAmount: number;
  hasCashbackAdjustment: boolean;
  isNewClient: boolean;
}

export function usePricingCalculation(orderItems: OrderItem[], clientId: string) {
  const { getDisplayPrice: getSalesPrice, rewardSettings } = useSalesPricingCalculation();
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

  // Calculate correct price for an item using the same logic as Sales page
  const calculateItemCorrectPrice = (item: OrderItem): { subtotal: number; vat_amount: number; total: number } => {
    // Convert OrderItem to ServiceType format for compatibility with sales pricing
    const serviceForPricing = {
      id: item.item_type || 'item',
      name: 'Order Item',
      base_price: item.base_price,
      cost_price: item.cost_price,
      vat_rate: item.vat_rate,
      item_type: item.item_type || 'servicio',
      profit_margin_tiers: item.profit_margin_rate ? [{ min_qty: 1, max_qty: 999, margin: item.profit_margin_rate }] : null
    };

    const quantity = item.quantity || 1;
    const totalPrice = getSalesPrice(serviceForPricing, quantity);
    
    // Calculate VAT component
    const salesVatRate = item.vat_rate ?? 16;
    const subtotalWithoutVat = totalPrice / (1 + salesVatRate / 100);
    const vatAmount = totalPrice - subtotalWithoutVat;
    
    return {
      subtotal: subtotalWithoutVat,
      vat_amount: vatAmount,
      total: totalPrice
    };
  };

  const calculatePricing = async () => {
    let totalCostPrice = 0;
    let totalVATAmount = 0;
    let hasCashbackAdjustment = false;
    let isNewClient = false;

    // Calculate totals using correct pricing logic for each item
    orderItems.forEach(item => {
      const itemPricing = calculateItemCorrectPrice(item);
      totalCostPrice += itemPricing.subtotal;
      totalVATAmount += itemPricing.vat_amount;
    });

    // Check if client is new
    if (rewardSettings?.apply_cashback_to_items && clientId) {
      try {
        const { data: clientOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('client_id', clientId)
          .eq('status', 'finalizada');
        
        isNewClient = !clientOrders || clientOrders.length === 0;
        hasCashbackAdjustment = rewardSettings.general_cashback_percent > 0;
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