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

  // Calculate totals from selectedItems directly
  const subtotalGeneral = selectedItems.reduce((sum, item) => {
    // For the subtotal, we need the base price without VAT
    const basePrice = item.unit_price * item.quantity;
    const vatRate = item.vat_rate / 100;
    // Calculate the base price from the total price (removing VAT)
    const basePriceWithoutVat = basePrice / (1 + vatRate);
    return sum + basePriceWithoutVat;
  }, 0);

  const totalVAT = selectedItems.reduce((sum, item) => {
    const basePrice = item.unit_price * item.quantity;
    const vatRate = item.vat_rate / 100;
    const basePriceWithoutVat = basePrice / (1 + vatRate);
    const vatAmount = basePriceWithoutVat * vatRate;
    return sum + vatAmount;
  }, 0);

  const totalFinal = subtotalGeneral + totalVAT;

  return (
    <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
      <div className="flex justify-between items-center">
        <span>Subtotal General:</span>
        <span>{formatCurrency(subtotalGeneral)}</span>
      </div>
      
      <div className="flex justify-between items-center text-green-600">
        <span>Total IVAs:</span>
        <span>+{formatCurrency(totalVAT)}</span>
      </div>
      
      <div className="border-t pt-2">
        <div className="flex justify-between items-center text-lg font-bold text-primary">
          <span>Total Final:</span>
          <span>{formatCurrency(totalFinal)}</span>
        </div>
      </div>
    </div>
  );
}