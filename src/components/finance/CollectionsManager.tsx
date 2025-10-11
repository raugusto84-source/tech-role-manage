import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PolicyPaymentsPending } from "./PolicyPaymentsPending";
import { OrderPaymentsPending } from "./OrderPaymentsPending";
import { DollarSign, FileText, ShoppingCart, TrendingUp, RefreshCw } from "lucide-react";

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
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadCollectionStats();
  }, []);

  const loadCollectionStats = async () => {
    try {
      setLoading(true);

      // Read from collections_cache for orders
      const { data: cacheData, error: cacheError } = await supabase
        .from('collections_cache')
        .select('*');

      if (cacheError) throw cacheError;

      // Get policy payments pending
      const { data: policyPayments, error: policyError } = await supabase
        .from('policy_payments')
        .select('amount, due_date')
        .eq('is_paid', false);

      if (policyError) throw policyError;

      const cachedCollections = cacheData || [];
      const policies = policyPayments || [];

      // Calculate totals from cache
      const orderPending = cachedCollections
        .filter(c => c.source_type === 'order')
        .reduce((sum, c) => sum + (c.amount_pending || 0), 0);

      const policyPending = policies.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalPending = policyPending + orderPending;

      // Calculate overdue amounts
      const overdueOrder = cachedCollections
        .filter(c => c.source_type === 'order' && c.is_overdue)
        .reduce((sum, c) => sum + (c.amount_pending || 0), 0);

      const today = new Date().toISOString().split('T')[0];
      const overduePolicy = policies
        .filter(p => p.due_date < today)
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

  const updateCache = async () => {
    try {
      setUpdating(true);
      const { error } = await supabase.functions.invoke('update-collections-cache');
      
      if (error) throw error;
      
      toast({
        title: "Cache actualizado",
        description: "Las estadísticas de cobranza se han actualizado",
      });
      
      // Reload stats after update
      await loadCollectionStats();
    } catch (error: any) {
      console.error('Error updating cache:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el cache",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Cobranza Centralizada</h2>
          <p className="text-muted-foreground">
            Gestión integral de cobranza para pólizas y órdenes de servicio
          </p>
        </div>
        <Button 
          onClick={updateCache} 
          disabled={updating}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
          Actualizar Cache
        </Button>
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