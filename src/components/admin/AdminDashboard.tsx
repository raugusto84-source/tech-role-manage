import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExecutiveSummary } from './dashboard/ExecutiveSummary';
import { FinanceMetrics } from './dashboard/FinanceMetrics';
import { PolicyMetrics } from './dashboard/PolicyMetrics';
import { SalesMetrics } from './dashboard/SalesMetrics';
import { TechnicianMetrics } from './dashboard/TechnicianMetrics';
import { TasksMetrics } from './dashboard/TasksMetrics';
import { AIRecommendations } from './dashboard/AIRecommendations';
import { FollowUpManager } from './FollowUpManager';
import { WarrantiesAndAchievements } from './WarrantiesAndAchievements';
import { TaskAssignmentManager } from './TaskAssignmentManager';
import { DeletionHistoryPanel } from './DeletionHistoryPanel';
import { ImprovedGeneralChat } from '@/components/chat/ImprovedGeneralChat';
import { DatabaseAdminPanel } from './DatabaseAdminPanel';
import { SystemEmailsManager } from './SystemEmailsManager';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Panel de Administración</h1>
        <p className="text-muted-foreground mt-2">
          Resumen ejecutivo y métricas en tiempo real
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-12 text-xs">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="finances">Finanzas</TabsTrigger>
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          <TabsTrigger value="technicians">Técnicos</TabsTrigger>
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
          <TabsTrigger value="followup">Seguimientos</TabsTrigger>
          <TabsTrigger value="warranties">Garantías</TabsTrigger>
          <TabsTrigger value="emails">Correos</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="backups">Respaldos</TabsTrigger>
          <TabsTrigger value="ai">IA</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ExecutiveSummary />
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <div className="h-[600px]">
            <ImprovedGeneralChat />
          </div>
        </TabsContent>

        <TabsContent value="finances">
          <FinanceMetrics />
        </TabsContent>

        <TabsContent value="sales">
          <div className="grid gap-4 md:grid-cols-2">
            <SalesMetrics />
            <PolicyMetrics />
          </div>
        </TabsContent>

        <TabsContent value="technicians">
          <TechnicianMetrics />
        </TabsContent>

        <TabsContent value="tasks">
          <TaskAssignmentManager />
        </TabsContent>

        <TabsContent value="followup">
          <FollowUpManager />
        </TabsContent>

        <TabsContent value="warranties">
          <WarrantiesAndAchievements />
        </TabsContent>

        <TabsContent value="emails">
          <SystemEmailsManager />
        </TabsContent>

        <TabsContent value="history">
          <DeletionHistoryPanel />
        </TabsContent>

        <TabsContent value="backups">
          <DatabaseAdminPanel />
        </TabsContent>

        <TabsContent value="ai">
          <AIRecommendations />
        </TabsContent>
      </Tabs>
    </div>
  );
}