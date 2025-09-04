import { usePricingCalculation } from '@/hooks/usePricingCalculation';

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
}

interface QuoteTotalsSummaryProps {
  selectedItems: QuoteItem[];
  clientId?: string;
}

export function QuoteTotalsSummary({ selectedItems, clientId = '' }: QuoteTotalsSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate total final from selectedItems directly
  const totalFinal = selectedItems.reduce((sum, item) => {
    const totalPrice = item.unit_price * item.quantity;
    return sum + totalPrice;
  }, 0);

  return (
    <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
      <div className="flex justify-between items-center text-lg font-bold text-primary">
        <span>Total Final:</span>
        <span>{formatCurrency(totalFinal)}</span>
      </div>
    </div>
  );
}