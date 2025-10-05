import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCOPCeilToTen, formatMXNExact } from '@/utils/currency';
import { DollarSign, Calculator, CalendarIcon, User, Calendar as CalendarDaysIcon } from 'lucide-react';
import { getCurrentDateTimeMexico } from '@/utils/dateUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PolicyPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    id: string;
    amount: number;
    due_date: string;
    policy_clients: {
      clients: {
        name: string;
        email: string;
      };
      insurance_policies: {
        policy_name: string;
        policy_number: string;
      };
    };
  };
  onPaymentProcessed: () => void;
}

export function PolicyPaymentDialog({
  open,
  onOpenChange,
  payment,
  onPaymentProcessed
}: PolicyPaymentDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(payment.amount.toString());
  const [accountType, setAccountType] = useState<'fiscal' | 'no_fiscal'>('no_fiscal');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [hasISRWithholding, setHasISRWithholding] = useState(false);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

    setLoading(true);

    try {
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
      
      // Generar número de ingreso
      const incomeNumber = `ING-${Date.now()}`;
      
      // Formatear la fecha seleccionada para income_date (YYYY-MM-DD HH:mm:ss)
      const formattedIncomeDate = format(paymentDate, "yyyy-MM-dd HH:mm:ss");

      // Registrar ingreso
      const { data: incomeInsert, error: incomeError } = await supabase
        .from('incomes')
        .insert({
          income_number: incomeNumber,
          income_date: formattedIncomeDate,
          amount: finalPaymentAmount,
          account_type: accountType,
          category: 'cobranza',
          description: `Pago póliza ${payment.policy_clients.insurance_policies.policy_number} - ${format(new Date(payment.due_date), "MMMM yyyy", { locale: es })}${hasISRWithholding ? ' (con retención ISR)' : ''}`,
          payment_method: paymentMethod,
          status: 'recibido',
          vat_rate: vatRate,
          vat_amount: vatAmount,
          taxable_amount: baseAmountBeforeVAT,
          client_name: payment.policy_clients.clients.name,
          ...(accountType === 'fiscal' && invoiceNumber.trim() && { invoice_number: invoiceNumber.trim() }),
          ...(hasISRWithholding && { 
            isr_withholding_rate: isrWithholdingRate,
            isr_withholding_amount: isrWithholdingAmount
          })
        })
        .select('id')
        .maybeSingle();

      if (incomeError) {
        throw incomeError;
      }

      // Marcar el pago de póliza como pagado
      const { error: paymentError } = await supabase
        .from('policy_payments')
        .update({
          is_paid: true,
          payment_status: 'pagado',
          payment_date: format(paymentDate, 'yyyy-MM-dd'),
          account_type: accountType,
          payment_method: paymentMethod,
          ...(accountType === 'fiscal' && invoiceNumber.trim() && { invoice_number: invoiceNumber.trim() })
        })
        .eq('id', payment.id);

      if (paymentError) {
        throw paymentError;
      }

      toast({
        title: "Pago registrado",
        description: `Se registró el cobro de ${formatCOPCeilToTen(paymentAmount)} para la póliza ${payment.policy_clients.insurance_policies.policy_number}${hasISRWithholding ? ' (con retención ISR aplicada)' : ''}`,
      });

      onOpenChange(false);
      onPaymentProcessed();
      
      // Reset form
      setAmount('');
      setAccountType('no_fiscal');
      setPaymentMethod('');
      setInvoiceNumber('');
      setHasISRWithholding(false);
      setPaymentDate(new Date());

    } catch (error) {
      console.error('Error registering payment:', error);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Cobrar Póliza {payment.policy_clients.insurance_policies.policy_number}
          </DialogTitle>
        </DialogHeader>

        {/* Información del cliente y mes */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Cliente:</span>
            <span>{payment.policy_clients.clients.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CalendarDaysIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Mes de cobro:</span>
            <span className="capitalize">
              {format(new Date(payment.due_date), "MMMM yyyy", { locale: es })}
            </span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">
              Monto a cobrar
            </Label>
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
                  <p>1. Total con IVA: {formatCOPCeilToTen(parseFloat(amount))}</p>
                  <p>2. Base (sin IVA): {formatMXNExact(parseFloat(amount) / 1.16)}</p>
                  <p>3. ISR sobre la base (1.25%): -{formatMXNExact((parseFloat(amount) / 1.16) * 0.0125)}</p>
                  <p className="font-semibold border-t border-amber-200 pt-1">
                    Total final exacto (a cobrar): {formatMXNExact(parseFloat(amount) - ((parseFloat(amount) / 1.16) * 0.0125))}
                  </p>
                  <p className="text-xs text-amber-700">
                    ⚠️ Con ISR se cobra el monto exacto, sin redondear
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
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP") : <span>Selecciona fecha</span>}
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
                <RadioGroupItem value="no_fiscal" id="no_fiscal" />
                <Label htmlFor="no_fiscal">
                  Cuenta No Fiscal
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fiscal" id="fiscal" />
                <Label htmlFor="fiscal">
                  Cuenta Fiscal (con IVA)
                </Label>
              </div>
            </RadioGroup>
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
              {loading ? "Registrando..." : "Registrar Cobro"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}