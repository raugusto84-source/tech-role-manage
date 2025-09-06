import { usePricingCalculation } from '@/hooks/usePricingCalculation';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

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
  clientEmail?: string;
  onCashbackChange?: (applied: boolean, amount: number) => void;
}

export function QuoteTotalsSummary({ selectedItems, clientId = '', clientEmail = '', onCashbackChange }: QuoteTotalsSummaryProps) {
  const [availableCashback, setAvailableCashback] = useState(0);
  const [applyCashback, setApplyCashback] = useState(false);
  const [cashbackLoading, setCashbackLoading] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

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

  // Calculate totals from selectedItems directly
  console.log('QuoteTotalsSummary - Calculating totals for items:', selectedItems);
  
  const totalFinal = selectedItems.reduce((sum, item) => {
    const unitPrice = item.unit_price || 0;
    const quantity = item.quantity || 1;
    const itemTotal = unitPrice * quantity;
    
    console.log(`Item ${item.name} - Unit price: ${unitPrice}, Quantity: ${quantity}, Item total: ${itemTotal}`);
    return sum + itemTotal;
  }, 0);
  const cashbackAmount = applyCashback ? Math.min(availableCashback, totalFinal) : 0;
  const finalTotal = totalFinal - cashbackAmount;

  return (
    <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
      <div className="flex justify-between items-center">
        <span>Total antes de descuentos:</span>
        <span>{formatCurrency(totalFinal)}</span>
      </div>
      
      {/* Cashback Section */}
      {(clientEmail || clientId) && (
        <div className="border-t pt-2">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Cashback disponible: {formatCurrency(availableCashback)}
            </div>
            
            {availableCashback > 0 && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="apply-cashback"
                  checked={applyCashback}
                  onCheckedChange={handleCashbackToggle}
                  disabled={cashbackLoading}
                />
                <label 
                  htmlFor="apply-cashback" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Aplicar cashback (-{formatCurrency(cashbackAmount)})
                </label>
              </div>
            )}
          </div>
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