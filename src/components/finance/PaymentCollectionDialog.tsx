import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatMXNExact } from '@/utils/currency';
import { DollarSign, Calculator, CalendarIcon, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PaymentCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    id: string;
    amount: number;
    company_portion?: number;
    development_name: string;
    development_id?: string;
    payment_period?: string;
  } | null;
  onSuccess: () => void;
}

export function PaymentCollectionDialog({ open, onOpenChange, payment, onSuccess }: PaymentCollectionDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transferencia');
  const [accountType, setAccountType] = useState<'fiscal' | 'no_fiscal'>('no_fiscal');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [hasISRWithholding, setHasISRWithholding] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open && payment) {
      const paymentAmount = payment.company_portion || payment.amount;
      setAmount(paymentAmount.toString());
      setPaymentMethod('transferencia');
      setAccountType('no_fiscal');
      setInvoiceNumber('');
      setHasISRWithholding(false);
      setPaymentDate(new Date());
    }
  }, [open, payment]);

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;

    if (!amount || !paymentMethod) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    if (accountType === 'fiscal' && !invoiceNumber.trim()) {
      toast({
        title: "Error",
        description: "El número de factura es requerido para cuentas fiscales",
        variant: "destructive"
      });
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser un número válido mayor a 0",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      // Calcular IVA y retención de ISR si es cuenta fiscal
      const vatRate = accountType === 'fiscal' ? 16 : 0;
      const isrWithholdingRate = accountType === 'fiscal' && hasISRWithholding ? 1.25 : 0;
      
      let baseAmountBeforeVAT = paymentAmount;
      let isrWithholdingAmount = 0;
      let vatAmount = 0;
      let finalPaymentAmount = paymentAmount;
      
      if (accountType === 'fiscal') {
        baseAmountBeforeVAT = paymentAmount / (1 + vatRate / 100);
        vatAmount = paymentAmount - baseAmountBeforeVAT;
        
        if (hasISRWithholding) {
          isrWithholdingAmount = baseAmountBeforeVAT * (isrWithholdingRate / 100);
          finalPaymentAmount = paymentAmount - isrWithholdingAmount;
        }
      }

      // Update payment status
      const { error: updateError } = await supabase
        .from('access_development_payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: paymentMethod
        })
        .eq('id', payment.id);

      if (updateError) throw updateError;

      // Create income record
      const { error: incomeError } = await supabase
        .from('incomes')
        .insert({
          income_number: '', // Se genera automáticamente por trigger
          income_date: format(paymentDate, 'yyyy-MM-dd'),
          amount: finalPaymentAmount,
          account_type: accountType,
          category: 'fraccionamiento',
          description: `Pago mensual fraccionamiento: ${payment.development_name}${payment.payment_period ? ` - ${payment.payment_period}` : ''}${hasISRWithholding ? ' (con retención ISR)' : ''}`,
          
          status: 'recibido',
          payment_method: paymentMethod,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          taxable_amount: baseAmountBeforeVAT,
          ...(accountType === 'fiscal' && invoiceNumber.trim() && { invoice_number: invoiceNumber.trim() }),
          ...(hasISRWithholding && { 
            isr_withholding_rate: isrWithholdingRate,
            isr_withholding_amount: isrWithholdingAmount
          })
        });

      if (incomeError) throw incomeError;

      // Remove from pending collections
      await (supabase
        .from('pending_collections') as any)
        .delete()
        .eq('related_id', payment.id)
        .eq('collection_type', 'development_payment');

      toast({
        title: "Pago registrado",
        description: `Pago de ${payment.development_name} registrado correctamente${hasISRWithholding ? ' (con retención ISR aplicada)' : ''}`,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error collecting payment:', error);
      toast({
        title: "Error",
        description: "Error al registrar el pago",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!payment) return null;

  const displayAmount = payment.company_portion || payment.amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Cobrar Fraccionamiento
          </DialogTitle>
        </DialogHeader>

        {/* Información del fraccionamiento */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Fraccionamiento:</span>
            <span>{payment.development_name}</span>
          </div>
          {payment.payment_period && (
            <div className="flex items-center gap-2 text-sm">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Período:</span>
              <span>{payment.payment_period}</span>
            </div>
          )}
          <div className="pt-2 border-t">
            <p className="text-2xl font-bold text-primary">
              {formatMXNExact(displayAmount)}
            </p>
          </div>
        </div>

        <form onSubmit={handleCollect} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto a cobrar</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="text-lg font-semibold"
            />
            
            {/* Mostrar cálculo de retención ISR */}
            {accountType === 'fiscal' && hasISRWithholding && amount && !isNaN(parseFloat(amount)) && (
              <div className="bg-amber-50/80 border border-amber-200/60 p-3 rounded-lg space-y-1">
                <div className="flex items-center gap-1 text-amber-800 font-medium">
                  <Calculator className="h-4 w-4" />
                  Cálculo con retención ISR (1.25%)
                </div>
                <div className="text-xs space-y-1">
                  <p>1. Total con IVA: {formatMXNExact(parseFloat(amount))}</p>
                  <p>2. Base (sin IVA): {formatMXNExact(parseFloat(amount) / 1.16)}</p>
                  <p>3. ISR sobre la base (1.25%): -{formatMXNExact((parseFloat(amount) / 1.16) * 0.0125)}</p>
                  <p className="font-semibold border-t border-amber-200 pt-1">
                    Total final exacto (a cobrar): {formatMXNExact(parseFloat(amount) - ((parseFloat(amount) / 1.16) * 0.0125))}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Fecha de cobro</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={(date) => date && setPaymentDate(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-3">
            <Label>Tipo de cuenta</Label>
            <RadioGroup
              value={accountType}
              onValueChange={(value: 'fiscal' | 'no_fiscal') => setAccountType(value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no_fiscal" id="dev_no_fiscal" />
                <Label htmlFor="dev_no_fiscal">Cuenta No Fiscal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fiscal" id="dev_fiscal" />
                <Label htmlFor="dev_fiscal">Cuenta Fiscal (con IVA)</Label>
              </div>
            </RadioGroup>
          </div>

          {accountType === 'fiscal' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dev-invoice-number">Número de factura *</Label>
                <Input
                  id="dev-invoice-number"
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Número de factura"
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dev-isr-withholding"
                  checked={hasISRWithholding}
                  onCheckedChange={(checked) => setHasISRWithholding(checked as boolean)}
                />
                <Label 
                  htmlFor="dev-isr-withholding" 
                  className="text-sm font-medium cursor-pointer"
                >
                  Aplicar retención de ISR (1.25%)
                </Label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Método de Pago</Label>
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
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrar Cobro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
