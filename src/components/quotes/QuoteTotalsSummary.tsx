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
  console.log('QuoteTotalsSummary - Calculating totals for items:', selectedItems);
  
  const subtotalGeneral = selectedItems.reduce((sum, item) => {
    const unitPrice = item.unit_price || 0;
    const quantity = item.quantity || 1;
    const vatRate = item.vat_rate || 0;
    
    // Calculate base price (without VAT)
    let basePriceWithoutVat;
    
    if (vatRate > 0) {
      // If there's VAT rate, assume unit_price includes VAT and extract base price
      basePriceWithoutVat = (unitPrice * quantity) / (1 + vatRate / 100);
    } else {
      // If no VAT, the unit price is the base price
      basePriceWithoutVat = unitPrice * quantity;
    }
    
    console.log(`Item ${item.name} - Unit price: ${unitPrice}, VAT rate: ${vatRate}%, Base without VAT: ${basePriceWithoutVat}`);
    return sum + basePriceWithoutVat;
  }, 0);

  const totalVAT = selectedItems.reduce((sum, item) => {
    const unitPrice = item.unit_price || 0;
    const quantity = item.quantity || 1;
    const vatRate = item.vat_rate || 0;
    
    let vatAmount = 0;
    
    if (vatRate > 0) {
      // Calculate VAT from the unit price
      const totalPrice = unitPrice * quantity;
      const basePriceWithoutVat = totalPrice / (1 + vatRate / 100);
      vatAmount = totalPrice - basePriceWithoutVat;
    }
    
    console.log(`Item ${item.name} - VAT amount: ${vatAmount}`);
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