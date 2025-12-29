import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Calendar, AlertCircle, CheckCircle, Building2 } from "lucide-react";
import { PaymentCollectionDialog } from "./PaymentCollectionDialog";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};

interface DevelopmentPayment {
  id: string;
  development_id: string;
  development_name: string;
  amount: number;
  due_date: string;
  payment_period: string;
  status: string;
  investor_portion: number;
  company_portion: number;
  is_recovery_period: boolean;
}

export function DevelopmentPaymentsPending() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<DevelopmentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<DevelopmentPayment | null>(null);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [stats, setStats] = useState({
    total_pending: 0,
    total_amount: 0,
    overdue_count: 0,
    overdue_amount: 0,
  });

  useEffect(() => {
    loadPendingPayments();
  }, []);

  const loadPendingPayments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('access_development_payments')
        .select(`
          *,
          access_developments (name)
        `)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true });

      if (error) throw error;

      const formattedPayments: DevelopmentPayment[] = (data || []).map((p: any) => ({
        id: p.id,
        development_id: p.development_id,
        development_name: p.access_developments?.name || 'Desconocido',
        amount: p.amount,
        due_date: p.due_date,
        payment_period: p.payment_period,
        status: p.status,
        investor_portion: p.investor_portion || 0,
        company_portion: p.company_portion || 0,
        is_recovery_period: p.is_recovery_period || false
      }));

      setPayments(formattedPayments);

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const overduePayments = formattedPayments.filter(p => p.due_date < today);
      
      setStats({
        total_pending: formattedPayments.length,
        total_amount: formattedPayments.reduce((sum, p) => sum + p.amount, 0),
        overdue_count: overduePayments.length,
        overdue_amount: overduePayments.reduce((sum, p) => sum + p.amount, 0)
      });

    } catch (error: any) {
      console.error('Error loading payments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pagos pendientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCollectionDialog = (payment: DevelopmentPayment) => {
    setSelectedPayment(payment);
    setShowCollectionDialog(true);
  };

  const handleCollectionSuccess = () => {
    toast({
      title: "Pago registrado",
      description: "El pago ha sido registrado correctamente",
    });
    loadPendingPayments();
  };

  const getStatusBadge = (payment: DevelopmentPayment) => {
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = payment.due_date < today;
    
    if (isOverdue) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Vencido
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        Pendiente
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const [y, m, d] = dateString.split('-').map(Number);
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  };

  if (loading) {
    return <div>Cargando pagos pendientes de fraccionamientos...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Cobros Pendientes - Fraccionamientos
        </h3>
        <p className="text-muted-foreground">
          Gestión de cobranza de contratos de acceso mensuales
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.total_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.total_pending} pagos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(stats.overdue_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.overdue_count} pagos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Al Día</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.total_amount - stats.overdue_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.total_pending - stats.overdue_count} pagos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.total_pending > 0 ? stats.total_amount / stats.total_pending : 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Por pago
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos Pendientes de Fraccionamientos</CardTitle>
          <CardDescription>
            Click en "Cobrar" para registrar el pago de un fraccionamiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">¡Excelente!</h3>
              <p className="text-muted-foreground">
                No hay pagos pendientes de fraccionamientos
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fraccionamiento</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Monto Total</TableHead>
                    <TableHead>Porción Empresa</TableHead>
                    <TableHead>Porción Inversionista</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {payment.development_name}
                        </div>
                        {payment.is_recovery_period && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Período de recuperación
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(payment.payment_period).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                      </TableCell>
                      <TableCell>{formatDate(payment.due_date)}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-green-600">
                        {formatCurrency(payment.company_portion)}
                      </TableCell>
                      <TableCell className="text-blue-600">
                        {formatCurrency(payment.investor_portion)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payment)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleOpenCollectionDialog(payment)}
                          className="flex items-center gap-2"
                        >
                          <DollarSign className="h-4 w-4" />
                          Cobrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collection Dialog */}
      <PaymentCollectionDialog
        open={showCollectionDialog}
        onOpenChange={setShowCollectionDialog}
        payment={selectedPayment}
        onSuccess={handleCollectionSuccess}
      />
    </div>
  );
}
