import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatMXNExact } from '@/utils/currency';
import { DollarSign, Calculator, CalendarIcon } from 'lucide-react';
import { getCurrentDateTimeMexico, formatDateMexico } from '@/utils/dateUtils';
import { useOrderPayments } from '@/hooks/useOrderPayments';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PaymentCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    order_number: string;
    clients?: {
      name: string;
    } | null;
    remainingBalance?: number; // Optional pre-calculated balance
  };
  totalAmount: number;
}

export function PaymentCollectionDialog({
  open,
  onOpenChange,
  order,
  totalAmount
}: PaymentCollectionDialogProps) {
  // Use exact total amount (no rounding) to respect manual item prices
  const { paymentSummary, loading: paymentsLoading } = useOrderPayments(order.id, totalAmount);
  const [amount, setAmount] = useState('');
  const [accountType, setAccountType] = useState<'fiscal' | 'no_fiscal'>('no_fiscal');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [hasISRWithholding, setHasISRWithholding] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  // Set remaining balance as default amount when dialog opens
  useEffect(() => {
    console.log('PaymentCollectionDialog open state changed:', open);
    if (open && !paymentsLoading) {
      // Use pre-calculated balance if available, otherwise use hook calculation
      let remainingAmount = order.remainingBalance !== undefined 
        ? order.remainingBalance 
        : paymentSummary.remainingBalance;
      
      // Si hay ISR aplicado, recalcular el remaining balance con el monto exacto
      if (accountType === 'fiscal' && hasISRWithholding && order.remainingBalance === undefined) {
        const baseAmount = totalAmount / 1.16; // Base sin IVA
        const isrAmount = baseAmount * 0.0125; // ISR 1.25%
        const exactFinalAmount = totalAmount - isrAmount; // Total exacto después de ISR
        remainingAmount = Math.max(0, exactFinalAmount - paymentSummary.totalPaid);
      }
      
      console.log('Dialog opened for order:', order.order_number, 'remaining balance:', remainingAmount);
      setAmount(remainingAmount > 0 ? remainingAmount.toString() : '0');
      
      // Set account type to existing type if there are previous payments
      if (paymentSummary.existingAccountType) {
        setAccountType(paymentSummary.existingAccountType);
      }
    }
  }, [open, order.order_number, order.remainingBalance, paymentSummary.remainingBalance, paymentSummary.totalPaid, paymentSummary.existingAccountType, paymentsLoading, accountType, hasISRWithholding, totalAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    (e as any).stopPropagation?.();
    
    console.log('Payment form submitted with data:', {
      amount,
      paymentMethod,
      accountType,
      orderId: order.id,
      orderNumber: order.order_number
    });
    
    if (!amount || !paymentMethod) {
      console.log('Validation failed - missing required fields');
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    // Validate invoice number for fiscal accounts
    if (accountType === 'fiscal' && !invoiceNumber.trim()) {
      console.log('Validation failed - missing invoice number for fiscal account');
      toast({
        title: "Error",
        description: "El número de factura es requerido para cuentas fiscales",
        variant: "destructive"
      });
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      console.log('Validation failed - invalid amount:', paymentAmount);
      toast({
        title: "Error", 
        description: "El monto debe ser un número válido mayor a 0",
        variant: "destructive"
      });
      return;
    }

    // Validate payment amount doesn't exceed remaining balance
    let maxAllowedAmount = paymentSummary.remainingBalance;
    
    // Si hay ISR aplicado, usar el remaining balance exacto
    if (accountType === 'fiscal' && hasISRWithholding) {
      const baseAmount = totalAmount / 1.16; // Base sin IVA
      const isrAmount = baseAmount * 0.0125; // ISR 1.25%
      const exactFinalAmount = totalAmount - isrAmount; // Total exacto después de ISR
      maxAllowedAmount = Math.max(0, exactFinalAmount - paymentSummary.totalPaid);
    }
    
    if (paymentAmount > maxAllowedAmount) {
      console.log('Validation failed - amount exceeds remaining balance:', paymentAmount, 'vs', maxAllowedAmount);
      toast({
        title: "Error",
        description: `El monto no puede ser mayor al restante por cobrar: ${formatMXNExact(maxAllowedAmount)}`,
        variant: "destructive"
      });
      return;
    }

    console.log('Starting payment registration process...');
    setLoading(true);

    try {

      // Usar trigger handle_new_income() para generar income_number automáticamente

      // Calcular IVA y retención de ISR si es cuenta fiscal
      const vatRate = accountType === 'fiscal' ? 16 : 0;
      const isrWithholdingRate = accountType === 'fiscal' && hasISRWithholding ? 1.25 : 0;
      
      // Calcular montos: ISR se descuenta del total después de IVA
      let baseAmountBeforeVAT = paymentAmount;
      let isrWithholdingAmount = 0;
      let vatAmount = 0;
      let finalPaymentAmount = paymentAmount;
      
      if (accountType === 'fiscal') {
        // 1. Sacar el IVA del total para obtener la base
        baseAmountBeforeVAT = paymentAmount / (1 + vatRate / 100);
        vatAmount = paymentAmount - baseAmountBeforeVAT;
        
        if (hasISRWithholding) {
          // 2. Calcular ISR sobre la base (sin IVA)
          isrWithholdingAmount = baseAmountBeforeVAT * (isrWithholdingRate / 100);
          // 3. Con ISR, usar el monto exacto sin redondear
          finalPaymentAmount = paymentAmount - isrWithholdingAmount;
        } else {
          // Sin ISR, usar el monto redondeado original
          finalPaymentAmount = paymentAmount;
        }
      } else {
        // Para cuentas no fiscales
        finalPaymentAmount = paymentAmount;
        vatAmount = 0;
      }
      
      // Registrar ingreso (número se genera automáticamente con 5 dígitos por trigger)
      console.log('Inserting income (auto-number) with data:', {
        amount: paymentAmount,
        account_type: accountType,
        payment_method: paymentMethod
      });
      
      const { data: incomeInsert, error: incomeError } = await supabase
        .from('incomes')
        .insert({
          income_number: '', // Se genera automáticamente por trigger
          income_date: format(paymentDate, 'yyyy-MM-dd'),
          amount: finalPaymentAmount,
          account_type: accountType,
          category: 'cobranza',
          description: `Cobro orden ${order.order_number} - ${order.clients?.name || 'Cliente'}${hasISRWithholding ? ' (con retención ISR)' : ''}`,
          payment_method: paymentMethod,
          status: 'recibido',
          vat_rate: vatRate,
          vat_amount: vatAmount,
          taxable_amount: baseAmountBeforeVAT,
          ...(accountType === 'fiscal' && invoiceNumber.trim() && { invoice_number: invoiceNumber.trim() }),
          ...(hasISRWithholding && { 
            isr_withholding_rate: isrWithholdingRate,
            isr_withholding_amount: isrWithholdingAmount
          })
        })
        .select('id')
        .maybeSingle();

      if (incomeError) {
        console.error('Income insertion error:', incomeError);
        throw incomeError;
      }

      console.log('Income registered successfully, now inserting order payment...');

      // Registrar pago de orden
      const { error: paymentError } = await supabase
        .from('order_payments')
        .insert({
          order_id: order.id,
          order_number: order.order_number,
          client_name: order.clients?.name || 'Cliente',
          payment_amount: paymentAmount,
          payment_date: format(paymentDate, 'yyyy-MM-dd'),
          payment_method: paymentMethod,
          account_type: accountType,
          description: `Cobro orden ${order.order_number}${hasISRWithholding ? ' (con retención ISR)' : ''}`,
          income_id: incomeInsert?.id || null,
          ...(hasISRWithholding && {
            isr_withholding_applied: true,
            isr_withholding_amount: isrWithholdingAmount
          })
        });

      if (paymentError) {
        console.error('Order payment insertion error:', paymentError);
        throw paymentError;
      }

      console.log('Payment registered successfully!');

      toast({
        title: "Pago registrado",
        description: `Se registró el cobro de ${formatMXNExact(paymentAmount)} para la orden ${order.order_number}${hasISRWithholding ? ' (con retención ISR aplicada)' : ''}`,
      });

      console.log('Closing dialog and refreshing parent component...');
      onOpenChange(false);
      
      // Reset form
      setAmount('');
      setAccountType('no_fiscal');
      setPaymentMethod('');
      setInvoiceNumber('');
      setHasISRWithholding(false);
      setPaymentDate(new Date());

      // Trigger a small delay to ensure the dialog closes properly before potential refresh
      setTimeout(() => {
        console.log('Payment registration process completed');
        // Force a page refresh to ensure all data is updated
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Complete error registering payment:', error);
      toast({
        title: "Error",
        description: "No se pudo registrar el pago. Intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Cobrar Orden {order.order_number}
          </DialogTitle>
        </DialogHeader>
        
        {/* Mostrar total de la orden */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total de la Orden:</span>
            <span className="text-xl font-bold text-primary">{formatMXNExact(totalAmount)}</span>
          </div>
          {paymentSummary.totalPaid > 0 && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-primary/10">
              <span className="text-sm text-muted-foreground">Ya pagado:</span>
              <span className="text-sm font-medium text-green-600">{formatMXNExact(paymentSummary.totalPaid)}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">
              Monto a cobrar (Restante: {
                accountType === 'fiscal' && hasISRWithholding 
                  ? formatMXNExact(Math.max(0, (totalAmount - (totalAmount / 1.16) * 0.0125) - paymentSummary.totalPaid))
                  : formatMXNExact(paymentSummary.remainingBalance)
              })
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={
                accountType === 'fiscal' && hasISRWithholding 
                  ? (totalAmount - (totalAmount / 1.16) * 0.0125 - paymentSummary.totalPaid).toFixed(2)
                  : paymentSummary.remainingBalance.toFixed(2)
              }
              required
              className="text-lg font-semibold"
            />
            <div className="text-sm text-muted-foreground space-y-1">
              {paymentSummary.totalPaid > 0 && (
                <p>Ya cobrado: {formatMXNExact(paymentSummary.totalPaid)}</p>
              )}
              <p className="text-green-600 font-medium">
                Monto restante por cobrar: {
                  accountType === 'fiscal' && hasISRWithholding 
                    ? formatMXNExact(Math.max(0, (totalAmount - (totalAmount / 1.16) * 0.0125) - paymentSummary.totalPaid))
                    : formatMXNExact(paymentSummary.remainingBalance)
                }
              </p>
              
              {/* Mostrar cálculo de retención ISR */}
              {accountType === 'fiscal' && hasISRWithholding && amount && !isNaN(parseFloat(amount)) && (
                <div className="bg-amber-50/80 border border-amber-200/60 p-3 rounded-lg space-y-1">
                  <div className="flex items-center gap-1 text-amber-800 font-medium">
                    <Calculator className="h-4 w-4" />
                    Cálculo con retención ISR (1.25%)
                  </div>
                  <div className="text-xs space-y-1">
                    <p>1. Total con IVA: {formatMXNExact(totalAmount)}</p>
                    <p>2. Base (sin IVA): {formatMXNExact(totalAmount / 1.16)}</p>
                    <p>3. ISR sobre la base (1.25%): -{formatMXNExact((totalAmount / 1.16) * 0.0125)}</p>
                    <p className="font-semibold border-t border-amber-200 pt-1">
                      Total final exacto (a cobrar): {formatMXNExact(totalAmount - ((totalAmount / 1.16) * 0.0125))}
                    </p>
                    <p className="text-xs text-amber-700">
                      ⚠️ Con ISR se cobra el monto exacto, sin redondear
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Tipo de cuenta</Label>
            <RadioGroup
              value={accountType}
              onValueChange={(value: 'fiscal' | 'no_fiscal') => setAccountType(value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="no_fiscal" 
                  id="no_fiscal" 
                  disabled={paymentSummary.existingAccountType === 'fiscal'}
                />
                <Label 
                  htmlFor="no_fiscal" 
                  className={paymentSummary.existingAccountType === 'fiscal' ? 'opacity-50' : ''}
                >
                  Cuenta No Fiscal
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="fiscal" 
                  id="fiscal" 
                  disabled={paymentSummary.existingAccountType === 'no_fiscal'}
                />
                <Label 
                  htmlFor="fiscal" 
                  className={paymentSummary.existingAccountType === 'no_fiscal' ? 'opacity-50' : ''}
                >
                  Cuenta Fiscal (con IVA)
                </Label>
              </div>
            </RadioGroup>
            {paymentSummary.existingAccountType && (
              <p className="text-sm text-muted-foreground">
                Los pagos anteriores fueron realizados en cuenta {paymentSummary.existingAccountType === 'fiscal' ? 'fiscal' : 'no fiscal'}
              </p>
            )}
          </div>

          {accountType === 'fiscal' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-number">Número de factura *</Label>
                <Input
                  id="invoice-number"
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Número de factura"
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isr-withholding"
                  checked={hasISRWithholding}
                  onCheckedChange={(checked) => setHasISRWithholding(checked as boolean)}
                />
                <Label 
                  htmlFor="isr-withholding" 
                  className="text-sm font-medium cursor-pointer"
                >
                  Aplicar retención de ISR (1.25%)
                </Label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="payment-method">Método de pago</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona método de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="tarjeta_debito">Tarjeta de Débito</SelectItem>
                <SelectItem value="tarjeta_credito">Tarjeta de Crédito</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="nequi">Nequi</SelectItem>
                <SelectItem value="daviplata">Daviplata</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha de pago</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={(date) => date && setPaymentDate(date)}
                  initialFocus
                  disabled={(date) => date > new Date()}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Selecciona la fecha en que se realizó el pago (no puede ser futura)
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrar Cobro'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}