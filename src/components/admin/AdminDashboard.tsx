import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FinanceMetrics } from './dashboard/FinanceMetrics';
import { PolicyMetrics } from './dashboard/PolicyMetrics';
import { SalesMetrics } from './dashboard/SalesMetrics';
import { TechnicianMetrics } from './dashboard/TechnicianMetrics';
import { TasksMetrics } from './dashboard/TasksMetrics';
import { AIRecommendations } from './dashboard/AIRecommendations';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Panel de Administración
        </h1>
        <p className="text-muted-foreground mt-2">
          Resumen ejecutivo y métricas de desempeño
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="finances">Finanzas</TabsTrigger>
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          <TabsTrigger value="technicians">Técnicos</TabsTrigger>
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
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
          <TasksMetrics />
        </TabsContent>

        <TabsContent value="ai">
          <AIRecommendations />
        </TabsContent>
      </Tabs>
    </div>
  );
}