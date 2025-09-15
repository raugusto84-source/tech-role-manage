import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatCOPCeilToTen } from '@/utils/currency';
import { DollarSign } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);

  // Set remaining balance as default amount when dialog opens
  useEffect(() => {
    console.log('PaymentCollectionDialog open state changed:', open);
    if (open && !paymentsLoading) {
      const remainingAmount = paymentSummary.remainingBalance;
      console.log('Dialog opened for order:', order.order_number, 'remaining balance:', remainingAmount);
      setAmount(remainingAmount > 0 ? remainingAmount.toString() : '0');
    }
  }, [open, order.order_number, paymentSummary.remainingBalance, paymentsLoading]);

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

      // Calcular IVA si es cuenta fiscal
      const vatRate = accountType === 'fiscal' ? 19 : 0;
      const taxableAmount = accountType === 'fiscal' ? paymentAmount / (1 + vatRate / 100) : paymentAmount;
      const vatAmount = accountType === 'fiscal' ? paymentAmount - taxableAmount : 0;
      
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
          amount: paymentAmount,
          account_type: accountType,
          category: 'cobranza',
          description: `Cobro orden ${order.order_number} - ${order.clients?.name || 'Cliente'}`,
          payment_method: paymentMethod,
          status: 'recibido',
          vat_rate: vatRate,
          vat_amount: vatAmount,
          taxable_amount: taxableAmount
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
          description: `Cobro orden ${order.order_number}`,
          income_id: incomeInsert?.id || null
        });

      if (paymentError) {
        console.error('Order payment insertion error:', paymentError);
        throw paymentError;
      }

      console.log('Payment registered successfully!');

      toast({
        title: "Pago registrado",
        description: `Se registró el cobro de ${formatCOPCeilToTen(paymentAmount)} para la orden ${order.order_number}`,
      });

      console.log('Closing dialog and refreshing parent component...');
      onOpenChange(false);
      
      // Reset form
      setAmount('');
      setAccountType('no_fiscal');
      setPaymentMethod('');

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
            <Label htmlFor="amount">Monto a cobrar</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Restante por cobrar: {formatCOPCeilToTen(paymentSummary.remainingBalance)}</p>
              {paymentSummary.totalPaid > 0 && (
                <p>Ya cobrado: {formatCOPCeilToTen(paymentSummary.totalPaid)}</p>
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
                <RadioGroupItem value="no_fiscal" id="no_fiscal" />
                <Label htmlFor="no_fiscal">Cuenta No Fiscal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fiscal" id="fiscal" />
                <Label htmlFor="fiscal">Cuenta Fiscal (con IVA)</Label>
              </div>
            </RadioGroup>
          </div>

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