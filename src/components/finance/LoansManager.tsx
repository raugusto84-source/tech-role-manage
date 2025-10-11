import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, DollarSign, Calendar, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { formatMXNExact } from '@/utils/currency';
import { formatDateMexico } from '@/utils/dateUtils';

interface LoanPaymentDialogProps {
  payment: any;
  loan: any;
  onClose: () => void;
}

function LoanPaymentDialog({ payment, loan, onClose }: LoanPaymentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [accountType, setAccountType] = useState<'fiscal' | 'no_fiscal'>('fiscal');
  const [paymentMethod, setPaymentMethod] = useState('transferencia');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      // Actualizar el pago del préstamo
      const { error: paymentError } = await supabase
        .from('loan_payments')
        .update({
          status: 'pagado',
          paid_amount: payment.amount,
          paid_date: new Date().toISOString().split('T')[0],
          account_type: accountType,
          payment_method: paymentMethod,
          notes,
          paid_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', payment.id);

      if (paymentError) throw paymentError;

      // Crear el egreso correspondiente
      const { error: expenseError } = await supabase
        .from('expenses')
        .insert({
          expense_number: '', // Se genera automáticamente
          amount: payment.amount,
          description: `Pago préstamo ${loan.loan_number} - Mensualidad ${payment.payment_number}/${loan.total_months}`,
          category: 'prestamo',
          account_type: accountType,
          payment_method: paymentMethod,
          expense_date: new Date().toISOString().split('T')[0]
        });

      if (expenseError) throw expenseError;

      await queryClient.invalidateQueries({ queryKey: ['loans'] });
      await queryClient.invalidateQueries({ queryKey: ['loan_payments'] });

      toast({
        title: "Pago registrado",
        description: "El pago del préstamo ha sido registrado exitosamente",
      });

      onClose();
    } catch (error: any) {
      console.error('Error registering payment:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar el pago",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pago de Préstamo</DialogTitle>
          <DialogDescription>
            Préstamo {loan.loan_number} - Mensualidad {payment.payment_number}/{loan.total_months}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Monto a pagar</Label>
            <div className="text-2xl font-bold text-primary">
              {formatMXNExact(payment.amount)}
            </div>
          </div>

          <div>
            <Label htmlFor="account_type">¿De qué cuenta se paga? *</Label>
            <Select value={accountType} onValueChange={(v) => setAccountType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fiscal">Cuenta Fiscal</SelectItem>
                <SelectItem value="no_fiscal">Cuenta No Fiscal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="payment_method">Método de pago</Label>
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

          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales sobre el pago"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handlePayment} disabled={isLoading}>
            {isLoading ? 'Procesando...' : 'Registrar Pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LoansManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNewLoanDialog, setShowNewLoanDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<{ payment: any; loan: any } | null>(null);
  const [deleteLoanId, setDeleteLoanId] = useState<string | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [totalMonths, setTotalMonths] = useState('');
  const [startDate, setStartDate] = useState('');
  const [paymentDay, setPaymentDay] = useState('15');
  const [accountType, setAccountType] = useState<'fiscal' | 'no_fiscal' | 'ninguna'>('ninguna');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Queries
  const loansQuery = useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const loanPaymentsQuery = useQuery({
    queryKey: ['loan_payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_payments')
        .select('*, loans(*)')
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleCreateLoan = async () => {
    if (!amount || amount === '' || !monthlyPayment || monthlyPayment === '' || 
        !totalMonths || totalMonths === '' || !startDate || startDate === '' || 
        !paymentDay || paymentDay === '') {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      // Crear el préstamo (loan_number se genera automáticamente con el trigger)
      const { data: newLoan, error: loanError } = await supabase
        .from('loans')
        .insert({
          loan_number: '', // Se genera automáticamente
          amount: parseFloat(amount),
          monthly_payment: parseFloat(monthlyPayment),
          total_months: parseInt(totalMonths),
          start_date: startDate,
          payment_day: parseInt(paymentDay),
          account_type: accountType,
          description,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (loanError) throw loanError;

      // Generar las mensualidades automáticamente
      const { error: paymentsError } = await supabase.rpc('generate_loan_payments', {
        p_loan_id: newLoan.id,
      });

      if (paymentsError) throw paymentsError;

      // Si el préstamo tiene cuenta (fiscal o no fiscal), crear el ingreso correspondiente
      if (accountType !== 'ninguna') {
        const { error: incomeError } = await supabase
        .from('incomes')
          .insert({
            income_number: '', // Se genera automáticamente
            amount: parseFloat(amount),
            loan_id: newLoan.id,
            description: `Préstamo ${newLoan.loan_number} - ${description || 'Sin descripción'}`,
            category: 'prestamo',
            account_type: accountType,
            payment_method: 'transferencia',
            income_date: startDate,
            status: 'recibido'
          });

        if (incomeError) throw incomeError;
      }

      await queryClient.invalidateQueries({ queryKey: ['loans'] });
      await queryClient.invalidateQueries({ queryKey: ['loan_payments'] });

      toast({
        title: "Préstamo creado",
        description: `Se creó el préstamo ${newLoan.loan_number} con ${totalMonths} mensualidades`,
      });

      // Reset form
      setAmount('');
      setMonthlyPayment('');
      setTotalMonths('');
      setStartDate('');
      setPaymentDay('15');
      setAccountType('ninguna');
      setDescription('');
      setShowNewLoanDialog(false);
    } catch (error: any) {
      console.error('Error creating loan:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el préstamo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calcular estadísticas
  const stats = {
    totalActive: loansQuery.data?.filter(l => l.status === 'activo').length || 0,
    totalAmount: loansQuery.data?.reduce((sum, l) => sum + (l.status === 'activo' ? Number(l.remaining_amount || l.amount) : 0), 0) || 0,
    pendingPayments: loanPaymentsQuery.data?.filter(p => p.status === 'pendiente').length || 0,
    overduePayments: loanPaymentsQuery.data?.filter(p => p.status === 'vencido').length || 0,
  };

  // Marcar pagos vencidos
  const markOverduePayments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('loan_payments')
        .update({ status: 'vencido' })
        .eq('status', 'pendiente')
        .lt('due_date', today);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['loan_payments'] });
    } catch (error) {
      console.error('Error marking overdue payments:', error);
    }
  };

  // Marcar pagos vencidos al cargar
  useState(() => {
    markOverduePayments();
  });

  const handleDeleteLoan = async () => {
    if (!deleteLoanId) return;
    
    try {
      // Obtener el préstamo para saber su número y poder buscar el ingreso
      const { data: loan, error: fetchError } = await supabase
        .from('loans')
        .select('*')
        .eq('id', deleteLoanId)
        .single();

      if (fetchError) throw fetchError;

      // Eliminar el ingreso asociado si existe
      if (loan.account_type !== 'ninguna') {
        const { error: incomeError } = await supabase
          .from('incomes')
          .delete()
          .eq('description', `Préstamo ${loan.loan_number} - ${loan.description || 'Sin descripción'}`);

        if (incomeError) {
          console.error('Error deleting associated income:', incomeError);
        }
      }

      // Eliminar el préstamo
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', deleteLoanId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['loans'] });
      await queryClient.invalidateQueries({ queryKey: ['loan_payments'] });
      await queryClient.invalidateQueries({ queryKey: ['incomes'] });

      toast({
        title: "Préstamo eliminado",
        description: "El préstamo, sus pagos e ingreso asociado han sido eliminados",
      });

      setDeleteLoanId(null);
    } catch (error: any) {
      console.error('Error deleting loan:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el préstamo",
        variant: "destructive",
      });
    }
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return;
    
    try {
      const { error } = await supabase
        .from('loan_payments')
        .delete()
        .eq('id', deletePaymentId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['loan_payments'] });

      toast({
        title: "Pago eliminado",
        description: "El pago del préstamo ha sido eliminado",
      });

      setDeletePaymentId(null);
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el pago",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Préstamos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActive}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monto Total Activo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMXNExact(stats.totalAmount)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingPayments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pagos Vencidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overduePayments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Botón agregar */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestión de Préstamos</h2>
        <Button onClick={() => setShowNewLoanDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Préstamo
        </Button>
      </div>

      {/* Lista de préstamos */}
      <Card>
        <CardHeader>
          <CardTitle>Préstamos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Monto Original</TableHead>
                <TableHead>Restante</TableHead>
                <TableHead>Mensualidad</TableHead>
                <TableHead>Meses</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loansQuery.data?.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">{loan.loan_number}</TableCell>
                  <TableCell>{loan.description || '-'}</TableCell>
                  <TableCell>{formatMXNExact(loan.amount)}</TableCell>
                  <TableCell className="font-semibold text-orange-600">
                    {formatMXNExact(loan.remaining_amount || loan.amount)}
                  </TableCell>
                  <TableCell>{formatMXNExact(loan.monthly_payment)}</TableCell>
                  <TableCell>{loan.total_months}</TableCell>
                  <TableCell>{formatDateMexico(loan.start_date)}</TableCell>
                  <TableCell>
                    {loan.account_type === 'fiscal' && 'Fiscal'}
                    {loan.account_type === 'no_fiscal' && 'No Fiscal'}
                    {loan.account_type === 'ninguna' && 'Ninguna'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={loan.status === 'activo' ? 'default' : loan.status === 'pagado' ? 'secondary' : 'destructive'}>
                      {loan.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteLoanId(loan.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Lista de pagos pendientes */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos Pendientes y Vencidos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Préstamo</TableHead>
                <TableHead>Mensualidad</TableHead>
                <TableHead>Fecha Vencimiento</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loanPaymentsQuery.data
                ?.filter(p => p.status === 'pendiente' || p.status === 'vencido')
                .map((payment) => {
                  const isOverdue = payment.status === 'vencido';
                  return (
                    <TableRow key={payment.id} className={isOverdue ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">{payment.loans?.loan_number}</TableCell>
                      <TableCell>
                        {payment.payment_number} / {payment.loans?.total_months}
                      </TableCell>
                      <TableCell>{formatDateMexico(payment.due_date)}</TableCell>
                      <TableCell>{formatMXNExact(payment.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                          {isOverdue ? (
                            <>
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Vencido
                            </>
                          ) : (
                            'Pendiente'
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => setSelectedPayment({ payment, loan: payment.loans })}
                          >
                            <DollarSign className="mr-1 h-4 w-4" />
                            Pagar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletePaymentId(payment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Diálogo nuevo préstamo */}
      <Dialog open={showNewLoanDialog} onOpenChange={setShowNewLoanDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo Préstamo</DialogTitle>
            <DialogDescription>
              Registra un nuevo préstamo con sus mensualidades
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Monto del Préstamo *</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
              />
            </div>

            <div>
              <Label htmlFor="monthly_payment">Mensualidad *</Label>
              <Input
                id="monthly_payment"
                type="number"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)}
                placeholder="5000"
              />
            </div>

            <div>
              <Label htmlFor="total_months">Número de Meses *</Label>
              <Input
                id="total_months"
                type="number"
                value={totalMonths}
                onChange={(e) => setTotalMonths(e.target.value)}
                placeholder="12"
              />
            </div>

            {amount && monthlyPayment && totalMonths && (
              <div className="col-span-2 p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Monto del préstamo:</span>
                  <span className="text-sm">{formatMXNExact(parseFloat(amount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total a pagar:</span>
                  <span className="text-sm">{formatMXNExact(parseFloat(monthlyPayment) * parseInt(totalMonths))}</span>
                </div>
                <div className="flex justify-between text-primary">
                  <span className="text-sm font-bold">Intereses totales:</span>
                  <span className="text-sm font-bold">
                    {formatMXNExact((parseFloat(monthlyPayment) * parseInt(totalMonths)) - parseFloat(amount))}
                  </span>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="start_date">Fecha de Inicio *</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="payment_day">Día de Pago (1-31) *</Label>
              <Input
                id="payment_day"
                type="number"
                min="1"
                max="31"
                value={paymentDay}
                onChange={(e) => setPaymentDay(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="account_type">¿A qué cuenta entra el dinero? *</Label>
              <Select value={accountType} onValueChange={(v) => setAccountType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fiscal">Cuenta Fiscal</SelectItem>
                  <SelectItem value="no_fiscal">Cuenta No Fiscal</SelectItem>
                  <SelectItem value="ninguna">Ninguna (Crédito ya usado)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Selecciona "Ninguna" si el préstamo ya fue usado y no entra dinero a tus cuentas
              </p>
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Préstamo para equipamiento"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewLoanDialog(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLoan} disabled={isLoading}>
              {isLoading ? 'Creando...' : 'Crear Préstamo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de pago */}
      {selectedPayment && (
        <Dialog open={true} onOpenChange={() => setSelectedPayment(null)}>
          <LoanPaymentDialog
            payment={selectedPayment.payment}
            loan={selectedPayment.loan}
            onClose={() => setSelectedPayment(null)}
          />
        </Dialog>
      )}

      {/* Diálogo de confirmación para eliminar préstamo */}
      <AlertDialog open={!!deleteLoanId} onOpenChange={() => setDeleteLoanId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar préstamo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el préstamo y todos sus pagos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLoan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación para eliminar pago */}
      <AlertDialog open={!!deletePaymentId} onOpenChange={() => setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el registro de pago. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}