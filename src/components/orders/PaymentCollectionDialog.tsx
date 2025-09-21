import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatCOPCeilToTen } from '@/utils/currency';
import { DollarSign, Calculator } from 'lucide-react';
import { useOrderPayments } from '@/hooks/useOrderPayments';

interface PaymentCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    order_number: string;
    clients?: {
      name: string;
    } | null;
  };
  totalAmount: number;
}

export function PaymentCollectionDialog({
  open,
  onOpenChange,
  order,
  totalAmount
}: PaymentCollectionDialogProps) {
  const { paymentSummary, loading: paymentsLoading } = useOrderPayments(order.id, totalAmount);
  const [amount, setAmount] = useState('');
  const [accountType, setAccountType] = useState<'fiscal' | 'no_fiscal'>('no_fiscal');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [hasISRWithholding, setHasISRWithholding] = useState(false);
  const [loading, setLoading] = useState(false);

  // Set remaining balance as default amount when dialog opens
  useEffect(() => {
    console.log('PaymentCollectionDialog open state changed:', open);
    if (open && !paymentsLoading) {
      const remainingAmount = paymentSummary.remainingBalance;
      console.log('Dialog opened for order:', order.order_number, 'remaining balance:', remainingAmount);
      setAmount(remainingAmount > 0 ? remainingAmount.toString() : '0');
      
      // Set account type to existing type if there are previous payments
      if (paymentSummary.existingAccountType) {
        setAccountType(paymentSummary.existingAccountType);
      }
    }
  }, [open, order.order_number, paymentSummary.remainingBalance, paymentSummary.existingAccountType, paymentsLoading]);

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
    if (paymentAmount > paymentSummary.remainingBalance) {
      console.log('Validation failed - amount exceeds remaining balance:', paymentAmount, 'vs', paymentSummary.remainingBalance);
      toast({
        title: "Error",
        description: `El monto no puede ser mayor al restante por cobrar: ${formatCOPCeilToTen(paymentSummary.remainingBalance)}`,
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
      
      // Calcular montos
      let finalPaymentAmount = paymentAmount;
      let isrWithholdingAmount = 0;
      
      if (accountType === 'fiscal' && hasISRWithholding) {
        isrWithholdingAmount = paymentAmount * (isrWithholdingRate / 100);
        finalPaymentAmount = paymentAmount - isrWithholdingAmount;
      }
      
      const taxableAmount = accountType === 'fiscal' ? finalPaymentAmount / (1 + vatRate / 100) : finalPaymentAmount;
      const vatAmount = accountType === 'fiscal' ? finalPaymentAmount - taxableAmount : 0;
      
      // Generar número de ingreso (simple y único por timestamp)
      const incomeNumber = `ING-${Date.now()}`;

      // Registrar ingreso (el trigger handle_new_income genera income_number)
      console.log('Inserting income (auto-number) with data:', {
        amount: paymentAmount,
        account_type: accountType,
        payment_method: paymentMethod
      });
      
      const { data: incomeInsert, error: incomeError } = await supabase
        .from('incomes')
        .insert({
          income_number: incomeNumber,
          income_date: new Date().toISOString().split('T')[0],
          amount: finalPaymentAmount,
          account_type: accountType,
          category: 'cobranza',
          description: `Cobro orden ${order.order_number} - ${order.clients?.name || 'Cliente'}${hasISRWithholding ? ' (con retención ISR)' : ''}`,
          payment_method: paymentMethod,
          status: 'recibido',
          vat_rate: vatRate,
          vat_amount: vatAmount,
          taxable_amount: taxableAmount,
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
          payment_date: new Date().toISOString().split('T')[0],
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
        description: `Se registró el cobro de ${formatCOPCeilToTen(paymentAmount)} para la orden ${order.order_number}${hasISRWithholding ? ' (con retención ISR aplicada)' : ''}`,
      });

      console.log('Closing dialog and refreshing parent component...');
      onOpenChange(false);
      
      // Reset form
      setAmount('');
      setAccountType('no_fiscal');
      setPaymentMethod('');
      setInvoiceNumber('');
      setHasISRWithholding(false);

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
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto a cobrar (Restante: {formatCOPCeilToTen(paymentSummary.remainingBalance)})</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={paymentSummary.remainingBalance.toString()}
              required
              className="text-lg font-semibold"
            />
            <div className="text-sm text-muted-foreground space-y-1">
              {paymentSummary.totalPaid > 0 && (
                <p>Ya cobrado: {formatCOPCeilToTen(paymentSummary.totalPaid)}</p>
              )}
              <p className="text-green-600 font-medium">Monto restante por cobrar: {formatCOPCeilToTen(paymentSummary.remainingBalance)}</p>
              
              {/* Mostrar cálculo de retención ISR */}
              {accountType === 'fiscal' && hasISRWithholding && amount && !isNaN(parseFloat(amount)) && (
                <div className="bg-amber-50/80 border border-amber-200/60 p-3 rounded-lg space-y-1">
                  <div className="flex items-center gap-1 text-amber-800 font-medium">
                    <Calculator className="h-4 w-4" />
                    Cálculo con retención ISR (1.25%)
                  </div>
                  <div className="text-xs space-y-1">
                    <p>Monto factura: {formatCOPCeilToTen(parseFloat(amount))}</p>
                    <p>Retención ISR: -{formatCOPCeilToTen(parseFloat(amount) * 0.0125)}</p>
                    <p className="font-semibold border-t border-amber-200 pt-1">
                      Monto neto: {formatCOPCeilToTen(parseFloat(amount) - (parseFloat(amount) * 0.0125))}
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