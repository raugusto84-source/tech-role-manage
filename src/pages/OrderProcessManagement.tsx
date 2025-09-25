import { AppLayout } from "@/components/layout/AppLayout";
import { OrderProcessSLAManager } from "@/components/admin/OrderProcessSLAManager";
import { OrderProcessDashboard } from "@/components/admin/OrderProcessDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Settings } from "lucide-react";

export default function OrderProcessManagement() {
  return (
    <AppLayout>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Gestión de Procesos de Órdenes</h2>
            <p className="text-muted-foreground">
              Sistema automatizado de seguimiento, SLA y notificaciones para el control de procesos
            </p>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Dashboard de Seguimiento
            </TabsTrigger>
            <TabsTrigger value="sla" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuración SLA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <OrderProcessDashboard />
          </TabsContent>

          <TabsContent value="sla">
            <OrderProcessSLAManager />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}