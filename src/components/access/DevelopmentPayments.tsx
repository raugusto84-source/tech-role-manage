import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AccessDevelopment } from './AccessDevelopmentsManager';
import { CreditCard, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Payment {
  id: string;
  development_id: string;
  payment_period: string;
  due_date: string;
  amount: number;
  investor_portion: number;
  company_portion: number;
  is_recovery_period: boolean;
  status: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
}

interface Props {
  developments: AccessDevelopment[];
}

export function DevelopmentPayments({ developments }: Props) {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevelopment, setSelectedDevelopment] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [payingPayment, setPayingPayment] = useState<Payment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('access_development_payments')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Error al cargar pagos');
    } finally {
      setLoading(false);
    }
  };

  const getDevelopmentName = (id: string) => {
    return developments.find(d => d.id === id)?.name || 'Desconocido';
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status === 'pending';
    if (isOverdue) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      paid: 'default',
      cancelled: 'destructive'
    };
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      paid: 'Pagado',
      cancelled: 'Cancelado'
    };
    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
  };

  const filteredPayments = payments.filter(p => {
    if (selectedDevelopment !== 'all' && p.development_id !== selectedDevelopment) return false;
    if (statusFilter === 'overdue') {
      return p.status === 'pending' && new Date(p.due_date) < new Date();
    }
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  const totals = {
    pending: filteredPayments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
    paid: filteredPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
    overdue: filteredPayments.filter(p => p.status === 'pending' && new Date(p.due_date) < new Date()).reduce((s, p) => s + p.amount, 0)
  };

  const handlePayment = async () => {
    if (!payingPayment) return;
    
    setProcessing(true);
    try {
      // Update payment status
      const { error: paymentError } = await supabase
        .from('access_development_payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_by: user?.id,
          payment_method: paymentMethod,
          payment_reference: paymentReference
        })
        .eq('id', payingPayment.id);

      if (paymentError) throw paymentError;

      // Create income record for finance integration
      const dev = developments.find(d => d.id === payingPayment.development_id);
      const incomeNumber = `INC-${Date.now()}`;
      const { error: incomeError } = await supabase.from('incomes').insert([{
        income_number: incomeNumber,
        amount: payingPayment.amount,
        description: `Pago mensual - ${dev?.name || 'Fraccionamiento'} (${new Date(payingPayment.payment_period).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })})`,
        category: 'servicio',
        payment_method: paymentMethod,
        income_date: new Date().toISOString(),
        account_type: 'fiscal' as const,
        status: 'completado'
      }]);

      if (incomeError) console.error('Error creating income:', incomeError);

      // Update investor loan if applicable
      if (dev?.has_investor) {
        const { data: loanData } = await supabase
          .from('access_investor_loans')
          .select('*')
          .eq('development_id', payingPayment.development_id)
          .single();

        if (loanData) {
          const newRecovered = (loanData.amount_recovered || 0) + payingPayment.investor_portion;
          const newEarned = payingPayment.is_recovery_period 
            ? loanData.amount_earned 
            : (loanData.amount_earned || 0) + payingPayment.investor_portion;
          
          const newStatus = newRecovered >= loanData.amount 
            ? (payingPayment.is_recovery_period ? 'recovered' : 'earning')
            : 'active';

          await supabase
            .from('access_investor_loans')
            .update({
              amount_recovered: newRecovered,
              amount_earned: newEarned,
              status: newStatus
            })
            .eq('id', loanData.id);
        }
      }

      toast.success('Pago registrado correctamente');
      setPayingPayment(null);
      setPaymentMethod('');
      setPaymentReference('');
      loadPayments();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Error al procesar pago');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente Total</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totals.pending.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobrado</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totals.paid.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ${totals.overdue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={selectedDevelopment} onValueChange={setSelectedDevelopment}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Todos los fraccionamientos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los fraccionamientos</SelectItem>
            {developments.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="paid">Pagados</SelectItem>
            <SelectItem value="overdue">Vencidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fraccionamiento</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Inversionista</TableHead>
                <TableHead className="text-right">Empresa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay pagos para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{getDevelopmentName(payment.development_id)}</TableCell>
                    <TableCell>
                      {new Date(payment.payment_period).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                    </TableCell>
                    <TableCell>{new Date(payment.due_date).toLocaleDateString('es-MX')}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${payment.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      ${payment.investor_portion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      {payment.is_recovery_period && <span className="text-xs ml-1">(R)</span>}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ${payment.company_portion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status, payment.due_date)}</TableCell>
                    <TableCell>
                      {payment.status === 'pending' && (
                        <Button size="sm" onClick={() => setPayingPayment(payment)}>
                          <DollarSign className="h-4 w-4 mr-1" />
                          Cobrar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={!!payingPayment} onOpenChange={(open) => !open && setPayingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Cobro</DialogTitle>
          </DialogHeader>
          {payingPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p><strong>Fraccionamiento:</strong> {getDevelopmentName(payingPayment.development_id)}</p>
                <p><strong>Período:</strong> {new Date(payingPayment.payment_period).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</p>
                <p><strong>Monto:</strong> ${payingPayment.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <Label>Método de Pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Referencia (opcional)</Label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Número de referencia o folio"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingPayment(null)}>Cancelar</Button>
            <Button onClick={handlePayment} disabled={processing || !paymentMethod}>
              {processing ? 'Procesando...' : 'Confirmar Cobro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
