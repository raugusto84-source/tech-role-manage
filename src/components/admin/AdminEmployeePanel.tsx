import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, History, BarChart3, DollarSign, Clock } from 'lucide-react';
import { TechnicianPresencePanel } from '@/components/timetracking/TechnicianPresencePanel';
import { EmployeeHistoryPanel } from './EmployeeHistoryPanel';
import { AdvancedAttendanceReports } from './AdvancedAttendanceReports';
import { PayrollDashboard } from './PayrollDashboard';

/**
 * Panel administrativo unificado para la gestión completa de empleados
 * Incluye presencia en tiempo real, historial con fotos, reportes avanzados y nómina
 */
export function AdminEmployeePanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Panel Administrativo de Empleados
        </CardTitle>
        <p className="text-muted-foreground">
          Gestión completa de empleados: presencia, historial, reportes y nómina
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="presence" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="presence" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Presencia
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Reportes
            </TabsTrigger>
            <TabsTrigger value="payroll" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Nómina
            </TabsTrigger>
          </TabsList>

          {/* Presencia en Tiempo Real */}
          <TabsContent value="presence" className="space-y-6">
            <TechnicianPresencePanel />
          </TabsContent>

          {/* Historial Completo con Fotos */}
          <TabsContent value="history" className="space-y-6">
            <EmployeeHistoryPanel />
          </TabsContent>

          {/* Reportes Avanzados de Asistencia */}
          <TabsContent value="reports" className="space-y-6">
            <AdvancedAttendanceReports />
          </TabsContent>

          {/* Dashboard de Nómina Semanal */}
          <TabsContent value="payroll" className="space-y-6">
            <PayrollDashboard />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}