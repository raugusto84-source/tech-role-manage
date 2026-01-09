import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PolicyPaymentDialog } from "./PolicyPaymentDialog";
import { PaymentCollectionDialog } from "./PaymentCollectionDialog";
import { PaymentCollectionDialog as OrderPaymentCollectionDialog } from "../orders/PaymentCollectionDialog";
import { DollarSign, Monitor, Shield, Building2, RefreshCw, Calendar, AlertCircle, CheckCircle } from "lucide-react";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const [y, m, d] = dateString.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};

interface PolicyPayment {
  id: string;
  amount: number;
  due_date: string;
  client_name: string;
  policy_name: string;
  payment_month: number;
  payment_year: number;
}

interface OrderPayment {
  id: string;
  order_id: string;
  order_number: string;
  client_name: string;
  balance: number;
  due_date: string;
}

interface DevelopmentPayment {
  id: string;
  development_name: string;
  amount: number;
  due_date: string;
  payment_period: string;
}

export function CollectionsManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // Data states
  const [policyPayments, setPolicyPayments] = useState<PolicyPayment[]>([]);
  const [orderPayments, setOrderPayments] = useState<OrderPayment[]>([]);
  const [devPayments, setDevPayments] = useState<DevelopmentPayment[]>([]);
  
  // Dialog states
  const [selectedPolicyPayment, setSelectedPolicyPayment] = useState<any>(null);
  const [selectedOrderPayment, setSelectedOrderPayment] = useState<any>(null);
  const [selectedDevPayment, setSelectedDevPayment] = useState<any>(null);
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [devDialogOpen, setDevDialogOpen] = useState(false);

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  useEffect(() => {
    loadAllCollections();
  }, []);

  const isCurrentOrOverdue = (dueDateStr: string) => {
    if (!dueDateStr) return true;
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const dueDate = new Date(dueDateStr + 'T00:00:00');
    const dueYear = dueDate.getFullYear();
    const dueMonth = dueDate.getMonth();
    if (dueYear < currentYear) return true;
    if (dueYear === currentYear && dueMonth <= currentMonth) return true;
    return false;
  };

  const isOverdue = (dueDateStr: string) => {
    if (!dueDateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return dueDateStr < today;
  };

  const loadAllCollections = async () => {
    try {
      setLoading(true);

      // ========== SISTEMAS: Policy Payments ==========
      const { data: policyData } = await (supabase
        .from('policy_payments') as any)
        .select(`
          id, amount, due_date, payment_month, payment_year,
          policy_clients(
            clients(name),
            insurance_policies(policy_name)
          )
        `)
        .eq('is_paid', false);

      const filteredPolicyPayments = (policyData || [])
        .filter((p: any) => isCurrentOrOverdue(p.due_date))
        .map((p: any) => ({
          id: p.id,
          amount: p.amount,
          due_date: p.due_date,
          client_name: p.policy_clients?.clients?.name || 'Desconocido',
          policy_name: p.policy_clients?.insurance_policies?.policy_name || 'Sin póliza',
          payment_month: p.payment_month,
          payment_year: p.payment_year
        }));
      setPolicyPayments(filteredPolicyPayments);

      // ========== SEGURIDAD: Order Payments ==========
      const { data: orderData } = await supabase
        .from('pending_collections')
        .select('*')
        .eq('collection_type', 'order_payment')
        .eq('status', 'pending');

      const filteredOrderPayments = (orderData || [])
        .filter((p: any) => isCurrentOrOverdue(p.due_date))
        .map((p: any) => ({
          id: p.id,
          order_id: p.order_id,
          order_number: p.order_number,
          client_name: p.client_name,
          balance: p.amount,
          due_date: p.due_date
        }));
      setOrderPayments(filteredOrderPayments);

      // ========== FRACCIONAMIENTOS: Development Payments ==========
      const { data: devData } = await supabase
        .from('access_development_payments')
        .select(`
          id, amount, due_date, payment_period,
          access_developments(name)
        `)
        .in('status', ['pending', 'overdue']);

      const filteredDevPayments = (devData || [])
        .filter((p: any) => isCurrentOrOverdue(p.due_date))
        .map((p: any) => ({
          id: p.id,
          development_name: p.access_developments?.name || 'Desconocido',
          amount: p.amount,
          due_date: p.due_date,
          payment_period: p.payment_period
        }));
      setDevPayments(filteredDevPayments);

    } catch (error: any) {
      console.error('Error loading collections:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las cobranzas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setUpdating(true);
    await loadAllCollections();
    setUpdating(false);
    toast({ title: "Actualizado", description: "Datos de cobranza actualizados" });
  };

  // Policy payment handlers
  const handlePolicyPaymentClick = async (payment: PolicyPayment) => {
    const { data } = await (supabase.from('policy_payments') as any)
      .select(`*, policy_clients(clients(name, email), insurance_policies(policy_name, policy_number))`)
      .eq('id', payment.id)
      .single();
    if (data) {
      setSelectedPolicyPayment(data);
      setPolicyDialogOpen(true);
    }
  };

  // Order payment handlers
  const handleOrderPaymentClick = async (payment: OrderPayment) => {
    const { data } = await supabase
      .from('orders')
      .select(`*, clients(name, email, phone, address), order_items(*)`)
      .eq('id', payment.order_id)
      .single();
    if (data) {
      setSelectedOrderPayment({ ...data, totalAmount: payment.balance, remainingBalance: payment.balance });
      setOrderDialogOpen(true);
    }
  };

  // Development payment handlers
  const handleDevPaymentClick = (payment: DevelopmentPayment) => {
    setSelectedDevPayment(payment);
    setDevDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    loadAllCollections();
  };

  // Calculate totals
  const sistemasTotal = policyPayments.reduce((sum, p) => sum + p.amount, 0);
  const seguridadTotal = orderPayments.reduce((sum, p) => sum + p.balance, 0);
  const fraccionamientosTotal = devPayments.reduce((sum, p) => sum + p.amount, 0);
  const grandTotal = sistemasTotal + seguridadTotal + fraccionamientosTotal;

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando cobranzas...</div>;
  }

  const StatusBadge = ({ dueDate }: { dueDate: string }) => {
    if (isOverdue(dueDate)) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Vencido</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><Calendar className="h-3 w-3" />Pendiente</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Cobranza</h2>
          <p className="text-muted-foreground">
            {policyPayments.length + orderPayments.length + devPayments.length} cobros pendientes
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={updating} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total General</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {policyPayments.length + orderPayments.length + devPayments.length} pagos
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistemas</CardTitle>
            <Monitor className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(sistemasTotal)}</div>
            <p className="text-xs text-muted-foreground">{policyPayments.length} pagos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seguridad</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(seguridadTotal)}</div>
            <p className="text-xs text-muted-foreground">{orderPayments.length} pagos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraccionamientos</CardTitle>
            <Building2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(fraccionamientosTotal)}</div>
            <p className="text-xs text-muted-foreground">{devPayments.length} pagos</p>
          </CardContent>
        </Card>
      </div>

      {/* Sistemas - Policy Payments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Monitor className="h-5 w-5 text-blue-600" />
            Sistemas - Pólizas
            <Badge variant="secondary">{policyPayments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {policyPayments.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Sin cobros pendientes
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policyPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.client_name}</TableCell>
                    <TableCell>{p.policy_name}</TableCell>
                    <TableCell>{months[p.payment_month - 1]} {p.payment_year}</TableCell>
                    <TableCell>{formatDate(p.due_date)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(p.amount)}</TableCell>
                    <TableCell><StatusBadge dueDate={p.due_date} /></TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handlePolicyPaymentClick(p)}>Cobrar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Seguridad - Order Payments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-green-600" />
            Seguridad - Órdenes
            <Badge variant="secondary">{orderPayments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orderPayments.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Sin cobros pendientes
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.order_number}</TableCell>
                    <TableCell>{p.client_name}</TableCell>
                    <TableCell>{formatDate(p.due_date)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(p.balance)}</TableCell>
                    <TableCell><StatusBadge dueDate={p.due_date} /></TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleOrderPaymentClick(p)}>Cobrar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fraccionamientos - Development Payments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-purple-600" />
            Fraccionamientos
            <Badge variant="secondary">{devPayments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devPayments.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Sin cobros pendientes
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fraccionamiento</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.development_name}</TableCell>
                    <TableCell>
                      {new Date(p.payment_period).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                    </TableCell>
                    <TableCell>{formatDate(p.due_date)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(p.amount)}</TableCell>
                    <TableCell><StatusBadge dueDate={p.due_date} /></TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleDevPaymentClick(p)}>Cobrar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedPolicyPayment && (
        <PolicyPaymentDialog
          open={policyDialogOpen}
          onOpenChange={setPolicyDialogOpen}
          payment={selectedPolicyPayment}
          onPaymentProcessed={handlePaymentSuccess}
        />
      )}

      {selectedOrderPayment && (
        <OrderPaymentCollectionDialog
          open={orderDialogOpen}
          onOpenChange={(open) => {
            setOrderDialogOpen(open);
            if (!open) handlePaymentSuccess();
          }}
          order={{
            id: selectedOrderPayment.id,
            order_number: selectedOrderPayment.order_number,
            clients: selectedOrderPayment.clients
          }}
          totalAmount={selectedOrderPayment.totalAmount || 0}
        />
      )}

      {selectedDevPayment && (
        <PaymentCollectionDialog
          open={devDialogOpen}
          onOpenChange={setDevDialogOpen}
          payment={selectedDevPayment}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
