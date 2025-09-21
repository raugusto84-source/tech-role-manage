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
  const formatCashback = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  const formatCashbackExact = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

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
          // Calcular cashback actual real desde el historial de transacciones
          let actualCashback = 0;

          // Cashback ganado (no expirado)
          const { data: earnedTransactions } = await supabase
            .from('reward_transactions')
            .select('amount')
            .eq('client_id', clientData.id)
            .in('transaction_type', ['earned', 'cashback_earned', 'referral_bonus'])
            .or('expires_at.is.null,expires_at.gt.now()'); // No expiradas

          const totalEarned = earnedTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

          // Cashback usado
          const { data: usedTransactions } = await supabase
            .from('reward_transactions')
            .select('amount')
            .eq('client_id', clientData.id)
            .in('transaction_type', ['used', 'redeemed', 'cashback_used']);

          const totalUsed = usedTransactions?.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;

          // Calcular saldo actual
          actualCashback = Math.max(0, totalEarned - totalUsed);

          setAvailableCashback(actualCashback);
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
              Disponible: {formatCashbackExact(availableCashback)}
              {applyCashback && (
                <span className="text-green-600 font-medium ml-2">
                  → Aplicando: {formatCashbackExact(cashbackAmount)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cashback Earning Section */}
      {(clientEmail || clientId) && rewardSettings?.general_cashback_percent && rewardSettings.general_cashback_percent > 0 && !applyCashback && (
        <div className="border-t pt-2">
          <div className="space-y-2">
            <div className="text-sm text-green-600 font-medium">
              🎉 Ganarás {formatCashback(totalFinal * (rewardSettings.general_cashback_percent / 100))} en cashback con esta cotización
            </div>
          </div>
        </div>
      )}
      
      <div className="border-t pt-2">
        <div className="flex justify-between items-center text-lg font-bold text-primary">
          <span>Total:</span>
          <span>{applyCashback ? formatCashbackExact(finalTotal) : formatCurrency(totalFinal)}</span>
        </div>
      </div>
    </div>
  );
}