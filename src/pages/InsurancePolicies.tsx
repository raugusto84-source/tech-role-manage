import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonalTimeClockPanel } from "@/components/timetracking/PersonalTimeClockPanel";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { InsurancePolicyManager } from "@/components/policies/InsurancePolicyManager";
import { PolicyClientManager } from "@/components/policies/PolicyClientManager";

import { PolicyReportsManager } from "@/components/policies/PolicyReportsManager";
import { ScheduledServicesManager } from "@/components/policies/ScheduledServicesManager";
import { Search, Plus, Shield, Users, CreditCard, Calendar, FileText } from "lucide-react";
interface PolicyStats {
  total_policies: number;
  active_policies: number;
  total_clients: number;
  pending_payments: number;
  overdue_payments: number;
  scheduled_services: number;
}
export default function InsurancePolicies() {
  const {
    user,
    profile
  } = useAuth();
  const {
    toast
  } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<PolicyStats>({
    total_policies: 0,
    active_policies: 0,
    total_clients: 0,
    pending_payments: 0,
    overdue_payments: 0,
    scheduled_services: 0
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadStats();
  }, []);
  const loadStats = async () => {
    try {
      setLoading(true);

      // Load policy stats
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
              is_paid,
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
      const totalClients = new Set(activePolicies.flatMap(p => p.policy_clients.filter(pc => pc.is_active).map(pc => pc.id))).size;
      const allPayments = activePolicies.flatMap(p => p.policy_clients.flatMap(pc => pc.policy_payments));
      const allScheduledServices = activePolicies.flatMap(p => p.policy_clients.flatMap(pc => pc.scheduled_services));
      setStats({
        total_policies: policies?.length || 0,
        active_policies: activePolicies.length,
        total_clients: totalClients,
        pending_payments: allPayments.filter(p => p.payment_status === 'pendiente').length,
        overdue_payments: allPayments.filter(p => p.payment_status === 'vencido').length,
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
  return <AppLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pólizas de Servicios</h1>
          <p className="text-muted-foreground">
            Gestión completa de pólizas, clientes y servicios programados
          </p>
        </div>
      </div>

      {/* Personal Time Clock for vendedor role */}
      {profile?.role === 'vendedor' && <PersonalTimeClockPanel />}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pólizas Totales</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_policies}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active_policies} activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_clients}</div>
            <p className="text-xs text-muted-foreground">Con pólizas activas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_payments}</div>
            <p className="text-xs text-muted-foreground">Por cobrar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Vencidos</CardTitle>
            <CreditCard className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdue_payments}</div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduled_services}</div>
            <p className="text-xs text-muted-foreground">Programados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reportes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">✓</div>
            <p className="text-xs text-muted-foreground">Mensuales</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="policies">Pólizas</TabsTrigger>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="services">Servicios</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Estado de Pólizas</CardTitle>
                <CardDescription>
                  Resumen del estado actual de todas las pólizas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Pólizas Activas</span>
                    <Badge variant="default">{stats.active_policies}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Clientes Asignados</span>
                    <Badge variant="secondary">{stats.total_clients}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Servicios Programados</span>
                    <Badge variant="outline">{stats.scheduled_services}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estado de Pagos</CardTitle>
                <CardDescription>
                  Control de pagos mensuales de pólizas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Pagos Pendientes</span>
                    <Badge variant="secondary">{stats.pending_payments}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Pagos Vencidos</span>
                    <Badge variant="destructive">{stats.overdue_payments}</Badge>
                  </div>
                  {stats.overdue_payments > 0 && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <p className="text-sm text-destructive">
                        ⚠️ Hay {stats.overdue_payments} pagos vencidos que requieren atención inmediata
                      </p>
                    </div>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="policies">
          <InsurancePolicyManager onStatsUpdate={refreshStats} />
        </TabsContent>

        <TabsContent value="clients">
          <PolicyClientManager onStatsUpdate={refreshStats} />
        </TabsContent>

        <TabsContent value="services">
          <ScheduledServicesManager onStatsUpdate={refreshStats} />
        </TabsContent>

        <TabsContent value="reports">
          <PolicyReportsManager />
        </TabsContent>
      </Tabs>
      </div>
    </AppLayout>;
}