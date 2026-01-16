import { usePricingCalculation } from '@/hooks/usePricingCalculation';
// Removed useRewardSettings import - cashback system eliminated
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatCOPCeilToTen } from '@/utils/currency';

interface QuoteItem {
  id: string;
  service_type_id?: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  withholding_rate: number;
  withholding_amount: number;
  withholding_type: string;
  total: number;
  is_custom: boolean;
  image_url?: string | null;
  cost_price?: number;
  base_price?: number;
  profit_margin_rate?: number;
  item_type?: string;
  service_types?: {
    cost_price?: number;
    item_type?: string;
  };
}

interface QuoteTotalsSummaryProps {
  selectedItems: QuoteItem[];
  clientId?: string;
  clientEmail?: string;
}

export function QuoteTotalsSummary({ selectedItems, clientId = '', clientEmail = '' }: QuoteTotalsSummaryProps) {
  // Removed useRewardSettings - cashback system eliminated
  
  const formatCurrency = (amount: number) => formatCOPCeilToTen(amount);

  // Calculate totals from selectedItems with proper VAT breakdown
  console.log('QuoteTotalsSummary - Calculating totals for items:', selectedItems);
  
  // Calculate totals using unit_price * quantity, then extract VAT
  const calculateCorrectPricing = () => {
    // Sum all items using their unit_price (which is the final total including VAT)
    const totalWithVAT = selectedItems.reduce((sum, item) => {
      return sum + (item.unit_price || 0) * (item.quantity || 1);
    }, 0);
    
    // Extract VAT from the total - unit_price already includes VAT
    const vatRate = 16; // Standard VAT rate
    const subtotalBeforeVat = totalWithVAT / (1 + vatRate / 100);
    const totalVAT = totalWithVAT - subtotalBeforeVat;
    
    console.log('Total with VAT:', totalWithVAT, 'Subtotal before VAT:', subtotalBeforeVat, 'Total VAT:', totalVAT);
    return { subtotalBeforeVat, totalVAT, totalWithVAT };
  };

  const { subtotalBeforeVat, totalVAT, totalWithVAT } = calculateCorrectPricing();

  // Use the calculated total from the function
  const totalFinal = totalWithVAT;

  return (
    <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
      <div className="border-t pt-2">
        <div className="flex justify-between items-center text-lg font-bold text-primary">
          <span>Total:</span>
          <span>{formatCurrency(totalFinal)}</span>
        </div>
        <div className="text-xs text-muted-foreground text-right mt-1">
          Precio final (IVA incluido)
        </div>
      </div>
    </div>
  );
}