import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PolicyPaymentsPending } from "./PolicyPaymentsPending";
import { OrderPaymentsPending } from "./OrderPaymentsPending";
import { DollarSign, FileText, ShoppingCart, TrendingUp } from "lucide-react";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};

interface CollectionStats {
  total_pending: number;
  policy_pending: number;
  order_pending: number;
  overdue_amount: number;
}

export function CollectionsManager() {
  const { toast } = useToast();
  const [stats, setStats] = useState<CollectionStats>({
    total_pending: 0,
    policy_pending: 0,
    order_pending: 0,
    overdue_amount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCollectionStats();
  }, []);

  const loadCollectionStats = async () => {
    try {
      setLoading(true);

      // Get all pending collections
      const { data: pendingCollections, error: collectionsError } = await supabase
        .from('pending_collections')
        .select('collection_type, amount, due_date, status, order_id')
        .eq('status', 'pending');

      if (collectionsError) throw collectionsError;

      // Get policy payments pending (incluye pendientes y vencidos)
      const { data: policyPayments, error: policyError } = await supabase
        .from('policy_payments')
        .select('amount, due_date')
        .eq('is_paid', false);

      if (policyError) throw policyError;

      const collections = pendingCollections || [];
      const policies = policyPayments || [];

      // Calculate policy totals
      const policyPending = policies.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      // Calculate actual remaining balance for orders
      const orderCollections = collections.filter(c => c.collection_type === 'order_payment');
      let orderPending = 0;
      let overdueOrder = 0;
      
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

      for (const collection of orderCollections) {
        // Get order items to calculate actual total
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('total_amount')
          .eq('order_id', collection.order_id);

        const actualTotal = (orderItems || []).reduce((sum: number, item: any) => 
          sum + (item.total_amount || 0), 0);

        // Get payments made for this order
        const { data: payments } = await supabase
          .from('order_payments')
          .select('payment_amount')
          .eq('order_id', collection.order_id);

        const totalPaid = (payments || []).reduce((sum: number, payment: any) => 
          sum + (payment.payment_amount || 0), 0);

        // Calculate remaining balance
        const remainingBalance = actualTotal - totalPaid;
        orderPending += remainingBalance;

        // Add to overdue if past due date
        if ((collection as any).due_date < todayKey) {
          overdueOrder += remainingBalance;
        }
      }
      
      const totalPending = policyPending + orderPending;

      // Calculate overdue amounts for policies
      const overduePolicy = policies
        .filter(p => (p as any).due_date < todayKey)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const overdueAmount = overduePolicy + overdueOrder;

      setStats({
        total_pending: totalPending,
        policy_pending: policyPending,
        order_pending: orderPending,
        overdue_amount: overdueAmount
      });

    } catch (error: any) {
      console.error('Error loading collection stats:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas de cobranza",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatsUpdate = () => {
    loadCollectionStats();
  };

  if (loading) {
    return <div>Cargando estadísticas de cobranza...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Cobranza Centralizada</h2>
        <p className="text-muted-foreground">
          Gestión integral de cobranza para pólizas y órdenes de servicio
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.total_pending)}
            </div>
            <p className="text-xs text-muted-foreground">
              Cobranza total pendiente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pólizas</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.policy_pending)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pagos de pólizas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.order_pending)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pagos de órdenes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(stats.overdue_amount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Requiere atención
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Collections Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cobranza</CardTitle>
          <CardDescription>
            Administra todos los pagos pendientes desde una interfaz centralizada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="policies" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="policies" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Pólizas
                {stats.policy_pending > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {formatCurrency(stats.policy_pending)}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Órdenes
                {stats.order_pending > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {formatCurrency(stats.order_pending)}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="policies" className="mt-6">
              <PolicyPaymentsPending />
            </TabsContent>

            <TabsContent value="orders" className="mt-6">
              <OrderPaymentsPending />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}