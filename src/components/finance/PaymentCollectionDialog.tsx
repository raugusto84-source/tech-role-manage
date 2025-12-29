import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    id: string;
    amount: number;
    company_portion?: number;
    development_name: string;
    development_id?: string;
  } | null;
  onSuccess: () => void;
}

export function PaymentCollectionDialog({ open, onOpenChange, payment, onSuccess }: PaymentCollectionDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState('transferencia');
  const [accountType, setAccountType] = useState<'fiscal' | 'no_fiscal'>('no_fiscal');
  const [loading, setLoading] = useState(false);

  const handleCollect = async () => {
    if (!payment) return;

    try {
      setLoading(true);

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
      const incomeNumber = `INC-${Date.now()}`;
      const incomeData = {
        income_number: incomeNumber,
        amount: payment.company_portion || payment.amount,
        category: 'fraccionamiento',
        description: `Pago mensual fraccionamiento: ${payment.development_name}`,
        income_type: 'fraccionamiento',
        account_type: accountType,
        income_date: new Date().toISOString().split('T')[0],
        status: 'recibido',
        payment_method: paymentMethod
      };
      await supabase.from('incomes').insert([incomeData]);

      // Remove from pending collections
      await (supabase
        .from('pending_collections') as any)
        .delete()
        .eq('related_id', payment.id)
        .eq('collection_type', 'development_payment');

      toast.success(`Pago de ${payment.development_name} registrado correctamente`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error collecting payment:', error);
      toast.error('Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Cobro</DialogTitle>
        </DialogHeader>
        {payment && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-medium">{payment.development_name}</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(payment.company_portion || payment.amount)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cuenta Destino</Label>
              <Select value={accountType} onValueChange={(v) => setAccountType(v as 'fiscal' | 'no_fiscal')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fiscal">Cuenta Fiscal</SelectItem>
                  <SelectItem value="no_fiscal">Cuenta No Fiscal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleCollect} disabled={loading}>
            {loading ? 'Registrando...' : 'Registrar Cobro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
