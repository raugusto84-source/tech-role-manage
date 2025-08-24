import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FinanceMetrics } from './dashboard/FinanceMetrics';
import { PolicyMetrics } from './dashboard/PolicyMetrics';
import { SalesMetrics } from './dashboard/SalesMetrics';
import { TechnicianMetrics } from './dashboard/TechnicianMetrics';
import { TasksMetrics } from './dashboard/TasksMetrics';
import { AIRecommendations } from './dashboard/AIRecommendations';
import { FollowUpManager } from './FollowUpManager';
import { WarrantiesAndAchievements } from './WarrantiesAndAchievements';
import { TaskAssignmentManager } from './TaskAssignmentManager';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Panel de Administración
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestión completa del sistema y métricas en tiempo real
        </p>
        
        {/* Resumen ampliado del sistema */}
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-card p-4 rounded-lg border">
            <h3 className="font-semibold text-primary">Estado del Sistema</h3>
            <p className="text-sm text-muted-foreground">Operativo - Todos los servicios funcionando</p>
            <div className="flex items-center mt-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-xs">Última actualización: ahora</span>
            </div>
          </div>
          
          <div className="bg-card p-4 rounded-lg border">
            <h3 className="font-semibold text-primary">Rendimiento Hoy</h3>
            <p className="text-sm text-muted-foreground">15 órdenes procesadas</p>
            <div className="flex items-center mt-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-xs">+25% vs ayer</span>
            </div>
          </div>
          
          <div className="bg-card p-4 rounded-lg border">
            <h3 className="font-semibold text-primary">Equipo Activo</h3>
            <p className="text-sm text-muted-foreground">8 técnicos trabajando</p>
            <div className="flex items-center mt-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
              <span className="text-xs">3 en ruta, 5 en sitio</span>
            </div>
          </div>
          
          <div className="bg-card p-4 rounded-lg border">
            <h3 className="font-semibold text-primary">Alertas</h3>
            <p className="text-sm text-muted-foreground">2 tareas urgentes</p>
            <div className="flex items-center mt-2">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              <span className="text-xs">Requieren atención</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8 text-xs">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="finances">Finanzas</TabsTrigger>
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          <TabsTrigger value="technicians">Técnicos</TabsTrigger>
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
          <TabsTrigger value="followup">Seguimientos</TabsTrigger>
          <TabsTrigger value="warranties">Garantías</TabsTrigger>
          <TabsTrigger value="ai">IA</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FinanceMetrics compact />
            <PolicyMetrics compact />
            <SalesMetrics compact />
            <TechnicianMetrics compact />
            <TasksMetrics compact />
            <AIRecommendations compact />
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

        <TabsContent value="ai">
          <AIRecommendations />
        </TabsContent>
      </Tabs>
    </div>
  );
}