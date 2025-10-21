import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PaymentCollectionDialog } from "../orders/PaymentCollectionDialog";
import { DeletePaymentDialog } from "./DeletePaymentDialog";
import { DollarSign, Calendar, AlertCircle, CheckCircle, Trash2 } from "lucide-react";
import { formatDateMexico } from '@/utils/dateUtils';
import { useSoftDelete } from "@/hooks/useSoftDelete";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};

interface OrderPayment {
  id: string;
  order_id: string;
  order_number: string;
  client_name: string;
  client_email: string;
  amount: number;
  balance: number;
  due_date: string;
  created_at: string;
  updated_at: string;
  completion_date: string | null;
  services_description: string;
}

export function OrderPaymentsPending() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_pending: 0,
    total_amount: 0,
    overdue_count: 0,
    overdue_amount: 0,
  });
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<OrderPayment | null>(null);
  const { canDeletePayments } = useSoftDelete();

  useEffect(() => {
    loadPendingOrderPayments();
  }, []);

  const loadPendingOrderPayments = async () => {
    try {
      setLoading(true);
      
      // Get pending collections for orders
      const { data: pendingCollections, error: collectionsError } = await supabase
        .from('pending_collections')
        .select('*')
        .eq('collection_type', 'order_payment')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (collectionsError) throw collectionsError;

      // Fetch actual order totals and calculate remaining balance for each pending collection
      const formattedPaymentsPromises = (pendingCollections || []).map(async (pc: any) => {
        // Get order details including completion date
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('client_approved_at, updated_at')
          .eq('id', pc.order_id)
          .single();

        if (orderError) {
          console.error('Error fetching order details:', orderError);
        }

        // Get order items to calculate real total
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('total_amount, service_name, service_description, item_type')
          .eq('order_id', pc.order_id);

        if (itemsError) {
          console.error('Error fetching order items:', itemsError);
        }

        // Build services description
        const servicesDescription = (orderItems || [])
          .map((item: any) => {
            const type = item.item_type === 'service' ? 'Servicio' : 'Producto';
            return `${type}: ${item.service_name}`;
          })
          .join(', ') || 'Sin descripción';

        // Calculate the actual order total from items
        const actualTotal = (orderItems || []).reduce((sum: number, item: any) => {
          return sum + (item.total_amount || 0);
        }, 0);

        // Get payments made for this order
        const { data: payments, error: paymentsError } = await supabase
          .from('order_payments')
          .select('payment_amount, isr_withholding_applied')
          .eq('order_id', pc.order_id);

        if (paymentsError) {
          console.error('Error fetching order payments:', paymentsError);
        }

        // Calculate total paid
        const totalPaid = (payments || []).reduce((sum: number, payment: any) => {
          return sum + (payment.payment_amount || 0);
        }, 0);

        // Apply ISR rule if any payment had ISR withholding like the dialog does
        const hasISR = (payments || []).some((p: any) => p.isr_withholding_applied);
        const finalExactTotal = hasISR
          ? actualTotal - (actualTotal / 1.16) * 0.0125
          : actualTotal;

        // Calculate remaining balance consistent with dialog
        const remainingBalance = Math.max(0, finalExactTotal - totalPaid);

        // Use client_approved_at as completion date if available, otherwise updated_at
        const completionDate = orderData?.client_approved_at || orderData?.updated_at || null;

        return {
          id: pc.id,
          order_id: pc.order_id,
          order_number: pc.order_number,
          client_name: pc.client_name,
          client_email: pc.client_email,
          amount: actualTotal, // Use the actual order total
          balance: remainingBalance, // Use calculated remaining balance
          created_at: pc.created_at,
          updated_at: pc.updated_at,
          due_date: pc.due_date,
          completion_date: completionDate,
          services_description: servicesDescription
        };
      });

      const formattedPayments = await Promise.all(formattedPaymentsPromises);
      
      // Filter out payments that are fully paid (balance <= 0)
      const pendingPayments = formattedPayments.filter(p => p.balance > 0);
      setPayments(pendingPayments);

      // Calculate stats from filtered pending payments only
      const totalAmount = pendingPayments.reduce((sum, p) => sum + p.balance, 0);
      const today = new Date();
      const overdue = pendingPayments.filter((p: any) => new Date(p.due_date) < today);
      const overdueAmount = overdue.reduce((sum, p) => sum + p.balance, 0);

      setStats({
        total_pending: pendingPayments.length,
        total_amount: totalAmount,
        overdue_count: overdue.length,
        overdue_amount: overdueAmount
      });

    } catch (error: any) {
      console.error('Error loading pending order payments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pagos pendientes de órdenes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentClick = async (payment: OrderPayment) => {
    try {
      // Get full order details for payment collection
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          clients(name, email, phone, address),
          order_items(*)
        `)
        .eq('id', payment.order_id)
        .single();

      if (orderError) throw orderError;

      // Use the same total and balance calculated in the table
      const orderWithTotal = {
        ...orderData,
        totalAmount: payment.amount, // Use the calculated total from the table
        remainingBalance: payment.balance // Pass the calculated balance
      };

      setSelectedOrder(orderWithTotal);
      setDialogOpen(true);
    } catch (error: any) {
      console.error('Error loading order details:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles de la orden",
        variant: "destructive",
      });
    }
  };

  const handlePaymentProcessed = () => {
    setDialogOpen(false);
    setSelectedOrder(null);
    loadPendingOrderPayments();
  };

  const handleDeleteClick = (payment: OrderPayment) => {
    setPaymentToDelete(payment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = () => {
    loadPendingOrderPayments();
  };

  const getPaymentStatusBadge = (payment: OrderPayment) => {
    const isOverdue = new Date(payment.due_date || payment.created_at) < new Date();
    
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

  if (loading) {
    return <div>Cargando pagos pendientes de órdenes...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Cobros Pendientes - Órdenes de Servicio</h3>
        <p className="text-muted-foreground">
          Gestión de cobranza de órdenes de servicio con pagos pendientes
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
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.total_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.total_pending} órdenes
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
              {stats.overdue_count} órdenes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Al Día</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(stats.total_amount - stats.overdue_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.total_pending - stats.overdue_count} órdenes
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
              Por orden
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Órdenes con Pagos Pendientes</CardTitle>
          <CardDescription>
            Click en "Cobrar" para procesar el pago de una orden
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">¡Excelente!</h3>
              <p className="text-muted-foreground">
                No hay órdenes con pagos pendientes
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicios</TableHead>
                    <TableHead>Fecha Finalización</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.order_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{payment.client_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {payment.client_email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs">
                        <div className="truncate" title={payment.services_description}>
                          {payment.services_description}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.completion_date 
                          ? formatDateMexico(payment.completion_date, 'dd/MM/yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(payment.balance)}
                      </TableCell>
                      <TableCell>
                        {getPaymentStatusBadge(payment)}
                      </TableCell>
                       <TableCell>
                         <div className="flex items-center gap-2">
                           <Button
                             size="sm"
                             onClick={() => handlePaymentClick(payment)}
                             className="flex items-center gap-2"
                           >
                             <DollarSign className="h-4 w-4" />
                             Cobrar
                           </Button>
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Collection Dialog */}
      {selectedOrder && (
        <PaymentCollectionDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              handlePaymentProcessed();
            }
          }}
          order={{
            id: selectedOrder.id,
            order_number: selectedOrder.order_number,
            clients: selectedOrder.clients
          }}
          totalAmount={selectedOrder.totalAmount || 0}
        />
      )}

      {/* Diálogo de eliminación de pago */}
      {paymentToDelete && (
        <DeletePaymentDialog
          paymentId={paymentToDelete.id}
          paymentAmount={paymentToDelete.amount}
          orderNumber={paymentToDelete.order_number}
          isOpen={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onDeleted={handleDeleteSuccess}
        />
      )}
    </div>
  );
}