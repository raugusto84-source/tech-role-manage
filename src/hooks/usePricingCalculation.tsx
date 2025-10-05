import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSalesPricingCalculation } from './useSalesPricingCalculation';
import { ceilToTen } from '@/utils/currency';

interface OrderItem {
  subtotal: number;
  vat_amount: number;
  vat_rate: number;
  item_type?: string;
  cost_price?: number;
  base_price?: number;
  profit_margin_rate?: number;
  quantity?: number;
  total_amount?: number;
  pricing_locked?: boolean;
}

interface PricingTotals {
  totalCostPrice: number;
  totalVATAmount: number;
  totalAmount: number;
  hasCashbackAdjustment: boolean;
  isNewClient: boolean;
}

export function usePricingCalculation(orderItems: OrderItem[], clientId: string) {
  const { getDisplayPrice: getSalesPrice } = useSalesPricingCalculation();
  const [pricing, setPricing] = useState<PricingTotals>({
    totalCostPrice: 0,
    totalVATAmount: 0,
    totalAmount: 0,
    hasCashbackAdjustment: false,
    isNewClient: false
  });

  useEffect(() => {
    calculatePricing();
  }, [orderItems, clientId]);

  // Calculate correct price for an item using the same logic as Sales page
  const calculateItemCorrectPrice = (item: OrderItem): { subtotal: number; vat_amount: number; total: number } => {
    // CRITICAL: Para items manuales, usar directamente los valores calculados
    const itemWithServiceId = item as any;
    if (itemWithServiceId.service_type_id === 'manual') {
      return {
        subtotal: Number(item.subtotal) || 0,
        vat_amount: Number(item.vat_amount) || 0,
        total: Number(item.total_amount || ((item as any).total)) || 0
      };
    }

    // CRITICAL: Si el item tiene pricing_locked=true, usar los valores guardados directamente
    const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
    const hasStoredSubtotal = typeof item.subtotal === 'number' && item.subtotal > 0;
    const hasStoredVat = typeof item.vat_amount === 'number' && item.vat_amount >= 0;
    const isLocked = Boolean(item.pricing_locked);
    
    if (isLocked && hasStoredTotal && hasStoredSubtotal && hasStoredVat) {
      // Para items bloqueados, usar directamente los valores guardados
      return {
        subtotal: Number(item.subtotal),
        vat_amount: Number(item.vat_amount),
        total: Number(item.total_amount)
      };
    }

    // Para items no bloqueados, recalcular usando la lógica de ventas
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
    const salesVatRate = item.vat_rate ?? 16;
    
    let totalPrice = 0;
    if (item.item_type === 'servicio') {
      const basePrice = (item.base_price || 0) * quantity;
      totalPrice = basePrice * (1 + salesVatRate / 100);
    } else {
      const purchaseVatRate = 16;
      const baseCost = (item.cost_price || 0) * quantity;
      const profitMargin = item.profit_margin_rate || 20;
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      totalPrice = afterMargin * (1 + salesVatRate / 100);
    }
    
    // Aplicar redondeo a cada item individualmente
    const roundedTotal = ceilToTen(totalPrice);
    const subtotalWithoutVat = roundedTotal / (1 + salesVatRate / 100);
    const vatAmount = roundedTotal - subtotalWithoutVat;
    
    return {
      subtotal: subtotalWithoutVat,
      vat_amount: vatAmount,
      total: roundedTotal
    };
  };

  const calculatePricing = async () => {
    console.log('usePricingCalculation - calculatePricing called with:', {
      orderItems: orderItems,
      clientId: clientId,
      orderItemsLength: orderItems.length
    });

    let totalCostPrice = 0;
    let totalVATAmount = 0;
    let hasCashbackAdjustment = false;
    let isNewClient = false;

    // Calculate totals using correct pricing logic for each item
    let totalAmount = 0;
    orderItems.forEach((item, index) => {
      console.log(`Processing item ${index}:`, item);
      const itemPricing = calculateItemCorrectPrice(item);
      console.log(`Item ${index} pricing:`, itemPricing);
      totalCostPrice += itemPricing.subtotal;
      totalVATAmount += itemPricing.vat_amount;
      totalAmount += itemPricing.total;
    });

    console.log('Final pricing calculation:', {
      totalCostPrice,
      totalVATAmount,
      totalAmount
    });

    // Check if client is new (removed cashback logic)
    // if (clientId) {
    //   try {
    //     const { data: clientOrders } = await supabase
    //       .from('orders')
    //       .select('id')
    //       .eq('client_id', clientId)
    //       .eq('status', 'finalizada');
    //     
    //     isNewClient = !clientOrders || clientOrders.length === 0;
    //   } catch (error) {
    //     console.error('Error checking client status:', error);
    //   }
    // }

      setPricing({
        totalCostPrice,
        totalVATAmount,
        totalAmount, // Usar el total calculado directamente de los items
        hasCashbackAdjustment,
        isNewClient
      });
  };

  return pricing;
}