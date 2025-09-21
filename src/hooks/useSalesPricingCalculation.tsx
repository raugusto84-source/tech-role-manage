import { ceilToTen } from '@/utils/currency';

interface ServiceType {
  id: string;
  name: string;
  description?: string | null;
  base_price?: number | null;
  cost_price?: number | null;
  profit_margin_tiers?: Array<{
    min_qty: number;
    max_qty: number;
    margin: number;
  }> | null;
  unit?: string | null;
  vat_rate?: number | null;
  category?: string | null;
  item_type?: string | null;
  subcategory?: string | null;
  service_category?: string | null;
  profit_margin_rate?: number; // For backwards compatibility
}

export function useSalesPricingCalculation() {
  // Helper function to determine if item is a product
  const isProduct = (service: ServiceType): boolean => {
    const hasTiers = Array.isArray(service.profit_margin_tiers) && service.profit_margin_tiers.length > 0;
    return hasTiers || service.item_type === 'articulo';
  };

  // Helper function to get margin from tiers
  const marginFromTiers = (service: ServiceType): number => {
    if (service.profit_margin_tiers && service.profit_margin_tiers.length > 0) {
      return service.profit_margin_tiers[0].margin;
    }
    // For backwards compatibility, check if there's a direct profit_margin_rate field
    if ((service as any).profit_margin_rate) {
      return (service as any).profit_margin_rate;
    }
    return 30; // Default margin
  };

  // Main pricing calculation function - simplified without cashback
  const getDisplayPrice = (service: ServiceType, quantity: number = 1): number => {
    const salesVatRate = service.vat_rate ?? 16; // Use ?? to preserve 0% VAT

    if (!isProduct(service)) {
      // Para servicios: precio base + IVA
      const basePrice = (service.base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      return afterSalesVat;
    } else {
      // Para artículos: costo base + IVA compra + margen + IVA venta
      const purchaseVatRate = 16; // IVA de compra fijo 16%
      const baseCost = (service.cost_price || 0) * quantity;
      const profitMargin = marginFromTiers(service); // Usar margen real del producto
      
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      
      return afterSalesVat;
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(ceilToTen(amount));
  };

  return {
    getDisplayPrice,
    formatCurrency,
    isProduct,
    marginFromTiers
  };
}