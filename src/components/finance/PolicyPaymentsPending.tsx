import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, DollarSign, Calendar, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { PolicyPaymentDialog } from "./PolicyPaymentDialog";
import { DeletePaymentDialog } from "./DeletePaymentDialog";
import { useSoftDelete } from "@/hooks/useSoftDelete";
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};

interface PolicyPayment {
  id: string;
  policy_client_id: string;
  amount: number;
  payment_month: number;
  payment_year: number;
  due_date: string;
  payment_status: string;
  is_paid: boolean;
  account_type: string;
  created_at: string;
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
}

export function PolicyPaymentsPending() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<PolicyPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_pending: 0,
    total_amount: 0,
    overdue_count: 0,
    overdue_amount: 0,
  });
  const [selectedPayment, setSelectedPayment] = useState<PolicyPayment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PolicyPayment | null>(null);
  const { canDeletePayments } = useSoftDelete();

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    const init = async () => {
      // First, generate any missing payments for all active policy clients
      try {
        await supabase.functions.invoke('generate-policy-payments', { 
          body: { generate_immediate: true } 
        });
      } catch (e) {
        console.warn('Payment generation function failed or unavailable:', e);
      }
      
      // Then normalize due dates to day 5
      try {
        await supabase.functions.invoke('normalize-policy-payment-due-dates', { body: { dry_run: false } });
      } catch (e) {
        console.warn('Normalization function failed or unavailable:', e);
      }
      
      await loadPendingPayments();

      // Real-time subscription
      const channel = supabase
        .channel('policy-payments-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'policy_payments' },
          () => { loadPendingPayments(); }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    init();
  }, []);

  const loadPendingPayments = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('policy_payments')
        .select(`
          *,
          policy_clients(
            clients(name, email),
            insurance_policies(policy_name, policy_number)
          )
        `)
        .eq('is_paid', false)
        .order('due_date', { ascending: false });

      if (error) throw error;

      setPayments(data || []);

      // Calcular estadísticas
      const pendingPayments = data || [];
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

      const totalAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
      const overduePayments = pendingPayments.filter(p => p.due_date < todayKey);
      const overdueAmount = overduePayments.reduce((sum, p) => sum + p.amount, 0);

      setStats({
        total_pending: pendingPayments.length,
        total_amount: totalAmount,
        overdue_count: overduePayments.length,
        overdue_amount: overdueAmount,
      });

    } catch (error: any) {
      console.error('Error loading pending payments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pagos pendientes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentClick = (payment: PolicyPayment) => {
    setSelectedPayment(payment);
    setDialogOpen(true);
  };

  const handlePaymentProcessed = () => {
    loadPendingPayments();
  };

  const handleDeleteClick = (payment: PolicyPayment) => {
    setPaymentToDelete(payment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = () => {
    loadPendingPayments();
  };

  const getPaymentStatusBadge = (payment: PolicyPayment) => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const isOverdue = payment.due_date < todayKey;
    
    if (payment.is_paid) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Pagado</Badge>;
    } else if (isOverdue) {
      return <Badge variant="destructive">Vencido</Badge>;
    } else if (payment.payment_status === 'pendiente') {
      return <Badge variant="secondary">Pendiente</Badge>;
    } else {
      return <Badge variant="secondary">{payment.payment_status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    // Safe formatting for YYYY-MM-DD without timezone shifts
    const [y, m, d] = dateString.split('-').map(Number);
    const dd = String(d).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const yy = String(y);
    return `${dd}/${mm}/${yy}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pagos Pendientes de Pólizas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Cargando pagos...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendientes</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_pending}</div>
            <p className="text-xs text-muted-foreground">
              pagos por cobrar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.total_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              por cobrar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Vencidos</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.overdue_count}</div>
            <p className="text-xs text-muted-foreground">
              requieren atención
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Vencido</CardTitle>
            <Calendar className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {formatCurrency(stats.overdue_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              en mora
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de pagos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pagos Pendientes de Pólizas
          </CardTitle>
          <CardDescription>
            Gestión de pagos pendientes de las pólizas de servicios
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-muted-foreground">
                ¡Excelente! No hay pagos pendientes de pólizas.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Fecha Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.policy_clients.clients.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.policy_clients.clients.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {payment.policy_clients.insurance_policies.policy_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.policy_clients.insurance_policies.policy_number}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {months[payment.payment_month - 1]} {payment.payment_year}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-primary">
                        {formatCurrency(payment.amount)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(payment.due_date)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getPaymentStatusBadge(payment)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {!payment.is_paid && (
                          <Button
                            size="sm"
                            onClick={() => handlePaymentClick(payment)}
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Cobrar
                          </Button>
                        )}
                         {canDeletePayments && (
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => handleDeleteClick(payment)}
                             className="flex items-center gap-2 text-destructive hover:text-destructive"
                           >
                             <Trash2 className="h-4 w-4" />
                             Eliminar
                           </Button>
                         )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Diálogo de cobro de pago */}
      {selectedPayment && (
        <PolicyPaymentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          payment={selectedPayment}
          onPaymentProcessed={handlePaymentProcessed}
        />
      )}

      {/* Diálogo de eliminación de pago */}
      {paymentToDelete && (
        <DeletePaymentDialog
          paymentId={paymentToDelete.id}
          paymentAmount={paymentToDelete.amount}
          isOpen={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onDeleted={handleDeleteSuccess}
        />
      )}
    </div>
  );
}