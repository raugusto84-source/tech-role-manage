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
      if (!clientEmail && !clientId) {
        console.log('QuoteTotalsSummary: No client email or ID provided');
        return;
      }
      
      setCashbackLoading(true);
      try {
        console.log('QuoteTotalsSummary: Loading cashback for', { clientEmail, clientId });
        
        // First try to find client by email, then by id
        let clientQuery = supabase
          .from('clients')
          .select('id, email');

        if (clientEmail) {
          clientQuery = clientQuery.eq('email', clientEmail);
        } else if (clientId) {
          clientQuery = clientQuery.eq('id', clientId);
        }

        const { data: clientData, error: clientError } = await clientQuery.maybeSingle();
        
        console.log('QuoteTotalsSummary: Client data found', { clientData, clientError });
        
        if (clientData) {
          // Get actual cashback from reward transactions (same logic as useClientRewards)
          const { data: cashbackTransactions } = await supabase
            .from('reward_transactions')
            .select('amount')
            .eq('client_id', clientData.id)
            .eq('transaction_type', 'earned');

          const actualCashback = cashbackTransactions?.reduce((total, t) => total + (t.amount || 0), 0) || 0;
          
          console.log('QuoteTotalsSummary: Cashback calculation', { 
            transactions: cashbackTransactions, 
            actualCashback 
          });

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
        <div className="border-t pt-3 mt-3">
          <div className="space-y-3">
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
                Aplicar cashback disponible
              </Label>
            </div>
            <div className="text-sm text-muted-foreground pl-6">
              Disponible: {formatCashbackExact(availableCashback)}
              {applyCashback && (
                <div className="text-green-600 font-medium mt-1">
                  → Aplicando: {formatCashbackExact(cashbackAmount)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="border-t pt-2 mt-2 text-xs text-gray-500">
          Debug: availableCashback={availableCashback}, clientEmail={clientEmail}, clientId={clientId}
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