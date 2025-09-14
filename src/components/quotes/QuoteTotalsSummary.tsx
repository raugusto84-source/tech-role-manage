import { usePricingCalculation } from '@/hooks/usePricingCalculation';
import { useRewardSettings } from '@/hooks/useRewardSettings';
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
  onCashbackChange?: (applied: boolean, amount: number) => void;
}

export function QuoteTotalsSummary({ selectedItems, clientId = '', clientEmail = '', onCashbackChange }: QuoteTotalsSummaryProps) {
  const [availableCashback, setAvailableCashback] = useState(0);
  const [applyCashback, setApplyCashback] = useState(false);
  const [cashbackLoading, setCashbackLoading] = useState(false);
  const { settings: rewardSettings } = useRewardSettings();

  const formatCurrency = (amount: number) => formatCOPCeilToTen(amount);

  // Load available cashback for the client
  useEffect(() => {
    const loadCashback = async () => {
      if (!clientEmail && !clientId) return;
      
      setCashbackLoading(true);
      try {
        // First try to find client by email, then by id
        let clientQuery = supabase
          .from('clients')
          .select('id, email');

        if (clientEmail) {
          clientQuery = clientQuery.eq('email', clientEmail);
        } else if (clientId) {
          clientQuery = clientQuery.eq('id', clientId);
        }

        const { data: clientData } = await clientQuery.single();
        
        if (clientData) {
          // Get client rewards
          const { data: rewardsData } = await supabase
            .from('client_rewards')
            .select('total_cashback')
            .eq('client_id', clientData.id)
            .single();

          if (rewardsData) {
            setAvailableCashback(rewardsData.total_cashback || 0);
          }
        }
      } catch (error) {
        console.error('Error loading cashback:', error);
      } finally {
        setCashbackLoading(false);
      }
    };

    loadCashback();
  }, [clientEmail, clientId]);

  // Handle cashback toggle
  const handleCashbackToggle = (checked: boolean) => {
    setApplyCashback(checked);
    const cashbackAmount = checked ? Math.min(availableCashback, totalFinal) : 0;
    onCashbackChange?.(checked, cashbackAmount);
  };

  // Calculate totals from selectedItems with proper VAT breakdown
  console.log('QuoteTotalsSummary - Calculating totals for items:', selectedItems);
  
  // Calculate totals using the same logic as orders
  const calculateCorrectPricing = () => {
    let subtotalBeforeVat = 0;
    let totalVAT = 0;
    
    selectedItems.forEach(item => {
      const quantity = item.quantity || 1;
      const salesVatRate = item.vat_rate || 16;
      
      // Determine if item is a product or service
      const isProduct = item.is_custom || 
        (item.service_types?.item_type === 'articulo') || 
        (item.profit_margin_rate && item.profit_margin_rate > 0);

      if (!isProduct) {
        // Para servicios: usar unit_price como precio base
        const basePrice = item.unit_price || 0;
        const itemSubtotal = basePrice * quantity;
        const itemVAT = (itemSubtotal * salesVatRate / 100);
        
        subtotalBeforeVat += itemSubtotal;
        totalVAT += itemVAT;
      } else {
        // Para artículos: costo base + IVA compra + margen + IVA venta
        const purchaseVatRate = 16;
        const baseCost = item.service_types?.cost_price || item.cost_price || 0;
        const profitMargin = item.profit_margin_rate || 30;
        
        const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
        const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
        const itemSubtotal = afterMargin * quantity;
        const itemVAT = (itemSubtotal * salesVatRate / 100);
        
        subtotalBeforeVat += itemSubtotal;
        totalVAT += itemVAT;
      }
    });

    return { subtotalBeforeVat, totalVAT };
  };

  const { subtotalBeforeVat, totalVAT } = calculateCorrectPricing();

  const totalFinal = subtotalBeforeVat + totalVAT;
  const cashbackAmount = applyCashback ? Math.min(availableCashback, totalFinal) : 0;
  const finalTotal = totalFinal - cashbackAmount;

  return (
    <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
      <div className="flex justify-between items-center">
        <span>Subtotal:</span>
        <span>{formatCurrency(subtotalBeforeVat)}</span>
      </div>
      
      {totalVAT > 0 && (
        <div className="flex justify-between items-center">
          <span>IVA Total:</span>
          <span>{formatCurrency(totalVAT)}</span>
        </div>
      )}
      
      {/* Cashback Usage Section */}
      {availableCashback > 0 && (clientEmail || clientId) && (
        <div className="border-t pt-2">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-cashback"
                checked={applyCashback}
                onCheckedChange={handleCashbackToggle}
                disabled={cashbackLoading}
              />
              <Label 
                htmlFor="use-cashback" 
                className="text-sm font-medium cursor-pointer"
              >
                Usar cashback disponible
              </Label>
            </div>
            <div className="text-sm text-muted-foreground">
              Disponible: {formatCurrency(availableCashback)}
              {applyCashback && (
                <span className="text-green-600 font-medium ml-2">
                  → Aplicando: {formatCurrency(cashbackAmount)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cashback Earning Section */}
      {(clientEmail || clientId) && rewardSettings?.general_cashback_percent && rewardSettings.general_cashback_percent > 0 && (
        <div className="border-t pt-2">
          <div className="space-y-2">
            <div className="text-sm text-green-600 font-medium">
              🎉 Ganarás {formatCurrency(totalFinal * (rewardSettings.general_cashback_percent / 100))} en cashback con esta cotización
            </div>
          </div>
        </div>
      )}
      
      {cashbackAmount > 0 && (
        <div className="flex justify-between items-center text-orange-600">
          <span>Descuento por cashback:</span>
          <span>-{formatCurrency(cashbackAmount)}</span>
        </div>
      )}
      
      <div className="border-t pt-2">
        <div className="flex justify-between items-center text-lg font-bold text-primary">
          <span>Total Final:</span>
          <span>{formatCurrency(finalTotal)}</span>
        </div>
      </div>
    </div>
  );
}