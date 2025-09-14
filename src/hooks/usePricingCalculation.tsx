import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRewardSettings } from './useRewardSettings';

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

  // Helper function to determine if item is a product
  const isProduct = (item: OrderItem): boolean => {
    return item.item_type === 'articulo' || (item.profit_margin_rate && item.profit_margin_rate > 0);
  };

  // Calculate correct price for an item using the same logic as catalog
  const calculateItemCorrectPrice = (item: OrderItem): { subtotal: number; vat_amount: number; total: number } => {
    const salesVatRate = item.vat_rate || 16;
    const cashbackPercent = rewardSettings?.apply_cashback_to_items
      ? (rewardSettings.general_cashback_percent || 0)
      : 0;
    const quantity = item.quantity || 1;

    if (!isProduct(item)) {
      // Para servicios: precio base + IVA + cashback
      const basePrice = (item.base_price || item.subtotal / quantity) || 0;
      const basePriceTotal = basePrice * quantity;
      const afterSalesVat = basePriceTotal * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      const vatAmount = (finalWithCashback - basePriceTotal * (1 + cashbackPercent / 100));
      
      return {
        subtotal: finalWithCashback - vatAmount,
        vat_amount: vatAmount,
        total: finalWithCashback
      };
    } else {
      // Para artículos: costo base + IVA compra + margen + IVA venta + cashback
      const purchaseVatRate = 16; // IVA de compra fijo 16%
      const baseCost = (item.cost_price || 0) * quantity;
      const profitMargin = item.profit_margin_rate || 30;
      
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      const vatAmount = (finalWithCashback - afterMargin * (1 + cashbackPercent / 100));
      
      return {
        subtotal: finalWithCashback - vatAmount,
        vat_amount: vatAmount,
        total: finalWithCashback
      };
    }
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