import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PolicyPaymentsPending } from "./PolicyPaymentsPending";
import { OrderPaymentsPending } from "./OrderPaymentsPending";
import { DevelopmentPaymentsPending } from "./DevelopmentPaymentsPending";
import { DollarSign, Monitor, Shield, Building2, TrendingUp, RefreshCw } from "lucide-react";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};

interface CollectionStats {
  total_pending: number;
  sistemas_pending: number;
  seguridad_pending: number;
  fraccionamientos_pending: number;
  overdue_amount: number;
}

export function CollectionsManager() {
  const { toast } = useToast();
  const [stats, setStats] = useState<CollectionStats>({
    total_pending: 0,
    sistemas_pending: 0,
    seguridad_pending: 0,
    fraccionamientos_pending: 0,
    overdue_amount: 0
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadCollectionStats();
  }, []);

  const loadCollectionStats = async () => {
    try {
      setLoading(true);

      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-indexed
      const todayStr = today.toISOString().split('T')[0];

      // Helper to filter only current month and overdue
      const filterCurrentAndOverdue = (items: any[], dateField: string = 'due_date') => {
        return items.filter(item => {
          const dateValue = item[dateField];
          if (!dateValue) return true;
          const dueDate = new Date(dateValue + 'T00:00:00');
          const dueYear = dueDate.getFullYear();
          const dueMonth = dueDate.getMonth();
          if (dueYear < currentYear) return true;
          if (dueYear === currentYear && dueMonth <= currentMonth) return true;
          return false;
        });
      };

      // Get policy payments
      const { data: policyPayments } = await supabase
        .from('policy_payments')
        .select('amount, due_date')
        .eq('is_paid', false);

      const filteredPolicyPayments = filterCurrentAndOverdue(policyPayments || []);
      const policyPending = filteredPolicyPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const overduePolicyAmount = filteredPolicyPayments
        .filter(p => p.due_date < todayStr)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      // Get order pending collections
      const { data: pendingOrders } = await supabase
        .from('pending_collections')
        .select('amount, due_date')
        .eq('collection_type', 'order_payment')
        .eq('status', 'pending');

      const filteredOrders = filterCurrentAndOverdue(pendingOrders || []);
      const orderPending = filteredOrders.reduce((sum, p) => sum + (p.amount || 0), 0);
      const overdueOrderAmount = filteredOrders
        .filter(p => p.due_date && p.due_date < todayStr)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      // Get development payments
      const { data: devPayments } = await supabase
        .from('access_development_payments')
        .select('amount, due_date')
        .in('status', ['pending', 'overdue']);

      const filteredDevPayments = filterCurrentAndOverdue(devPayments || []);
      const fraccionamientosAmount = filteredDevPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const overdueDevAmount = filteredDevPayments
        .filter(p => p.due_date < todayStr)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      // Split orders/policies roughly (simplified for now)
      const sistemasTotal = (policyPending + orderPending) * 0.6;
      const seguridadTotal = (policyPending + orderPending) * 0.4;
      const totalPending = policyPending + orderPending + fraccionamientosAmount;
      const overdueAmount = overduePolicyAmount + overdueOrderAmount + overdueDevAmount;

      setStats({
        total_pending: totalPending,
        sistemas_pending: sistemasTotal,
        seguridad_pending: seguridadTotal,
        fraccionamientos_pending: fraccionamientosAmount,
        overdue_amount: overdueAmount
      });

    } catch (error: any) {
      console.error('Error loading collection stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCache = async () => {
    setUpdating(true);
    await loadCollectionStats();
    setUpdating(false);
    toast({ title: "Actualizado", description: "Estadísticas actualizadas" });
  };

  if (loading) {
    return <div>Cargando estadísticas de cobranza...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Cobranza Centralizada</h2>
          <p className="text-muted-foreground">
            Gestión integral de cobranza: Sistemas, Seguridad y Fraccionamientos
          </p>
        </div>
        <Button onClick={updateCache} disabled={updating} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.total_pending)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistemas</CardTitle>
            <Monitor className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.sistemas_pending)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seguridad</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.seguridad_pending)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraccionamientos</CardTitle>
            <Building2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.fraccionamientos_pending)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(stats.overdue_amount)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Collections Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cobranza</CardTitle>
          <CardDescription>Administra pagos pendientes por categoría</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sistemas" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sistemas" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Sistemas
              </TabsTrigger>
              <TabsTrigger value="seguridad" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Seguridad
              </TabsTrigger>
              <TabsTrigger value="fraccionamientos" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Fraccionamientos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sistemas" className="mt-6 space-y-6">
              <PolicyPaymentsPending />
              <OrderPaymentsPending />
            </TabsContent>

            <TabsContent value="seguridad" className="mt-6 space-y-6">
              <PolicyPaymentsPending />
              <OrderPaymentsPending />
            </TabsContent>

            <TabsContent value="fraccionamientos" className="mt-6">
              <DevelopmentPaymentsPending />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
