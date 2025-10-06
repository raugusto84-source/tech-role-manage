// Service Contracts Management - Updated Interface
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonalTimeClockPanel } from "@/components/timetracking/PersonalTimeClockPanel";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { InsurancePolicyManager } from "@/components/policies/InsurancePolicyManager";
import { PolicyCalendar } from "@/components/policies/PolicyCalendar";
import { PolicyDashboardMetrics } from "@/components/policies/PolicyDashboardMetrics";
import { PolicyRealtimeProvider } from "@/components/policies/PolicyRealtimeProvider";
import { PolicyClientManager } from "@/components/policies/PolicyClientManager";
import { ScheduledServicesManager } from "@/components/policies/ScheduledServicesManager";
import { PolicyReportsManager } from "@/components/policies/PolicyReportsManager";
import { AutomationEngine } from "@/components/policies/AutomationEngine";

import { FileText, AlertCircle, Calendar } from "lucide-react";
interface ContractStats {
  active_contracts: number;
  pending_payments: number;
  scheduled_services: number;
}
export default function ServiceContracts() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("summary");
  const [stats, setStats] = useState<ContractStats>({
    active_contracts: 0,
    pending_payments: 0,
    scheduled_services: 0
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadStats();
  }, []);
  const loadStats = async () => {
    try {
      setLoading(true);

      // Load contract stats
      const {
        data: policies,
        error: policiesError
      } = await supabase.from('insurance_policies').select(`
          id,
          is_active,
          policy_clients!inner(
            id,
            is_active,
            policy_payments(
              id,
              payment_status
            ),
            scheduled_services(
              id,
              is_active
            )
          )
        `);
      if (policiesError) throw policiesError;
      
      const activePolicies = policies?.filter(p => p.is_active) || [];
      const allPayments = activePolicies.flatMap(p => p.policy_clients.flatMap(pc => pc.policy_payments));
      const allScheduledServices = activePolicies.flatMap(p => p.policy_clients.flatMap(pc => pc.scheduled_services));
      
      setStats({
        active_contracts: activePolicies.length,
        pending_payments: allPayments.filter(p => p.payment_status === 'pendiente').length,
        scheduled_services: allScheduledServices.filter(s => s.is_active).length
      });
    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const refreshStats = () => {
    loadStats();
  };
  if (!user) {
    return <div>Cargando...</div>;
  }
  return (
    <PolicyRealtimeProvider>
      <AppLayout>
        <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contratos de Servicios</h1>
          <p className="text-muted-foreground">
            Gestión integral de contratos de servicios tecnológicos
          </p>
        </div>
      </div>

      {/* Personal Time Clock for vendedor role */}
      {profile?.role === 'vendedor' && <PersonalTimeClockPanel />}

      {/* Essential Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Activos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.active_contracts}</div>
            <p className="text-xs text-muted-foreground">
              Servicios bajo contrato
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending_payments}</div>
            <p className="text-xs text-muted-foreground">Requieren cobro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Programados</CardTitle>
            <Calendar className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.scheduled_services}</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
          <TabsTrigger value="services">Servicios Periódicos</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <AutomationEngine />
          <PolicyDashboardMetrics onRefresh={refreshStats} />
          <PolicyCalendar />
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <InsurancePolicyManager onStatsUpdate={refreshStats} />
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <PolicyClientManager onStatsUpdate={refreshStats} />
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <ScheduledServicesManager onStatsUpdate={refreshStats} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <PolicyReportsManager />
        </TabsContent>
        </Tabs>
        </div>
      </AppLayout>
    </PolicyRealtimeProvider>
  );
}