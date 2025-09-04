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
  // Convert QuoteItem to the format expected by usePricingCalculation
  const orderItems = selectedItems.map(item => ({
    subtotal: item.subtotal,
    vat_amount: item.vat_amount,
    vat_rate: item.vat_rate,
    item_type: item.item_type || (item.is_custom ? 'servicio' : 'servicio'),
    cost_price: item.cost_price,
    base_price: item.base_price,
    profit_margin_rate: item.profit_margin_rate,
    quantity: item.quantity
  }));

  const pricing = usePricingCalculation(orderItems, clientId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
      <div className="flex justify-between items-center">
        <span>Subtotal General:</span>
        <span>{formatCurrency(pricing.totalCostPrice)}</span>
      </div>
      
      <div className="flex justify-between items-center text-green-600">
        <span>Total IVAs:</span>
        <span>+{formatCurrency(pricing.totalVATAmount)}</span>
      </div>
      
      <div className="border-t pt-2">
        <div className="flex justify-between items-center text-lg font-bold text-primary">
          <span>Total Final:</span>
          <span>{formatCurrency(pricing.totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}