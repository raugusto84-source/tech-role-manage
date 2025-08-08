import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { UserManagement } from '@/components/admin/UserManagement';
import { ImprovedTechnicianSkillsPanel } from '@/components/admin/ImprovedTechnicianSkillsPanel';
import { SalesSkillsPanel } from '@/components/admin/SalesSkillsPanel';
import { WorkSchedulePanel } from '@/components/admin/WorkSchedulePanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users as UsersIcon, Wrench, Store, Clock } from 'lucide-react';

/**
 * Página principal de administración de usuarios
 * Solo accesible para administradores
 * 
 * Funcionalidades:
 * - Gestión completa de usuarios (CRUD)
 * - Asignación de habilidades a técnicos
 * - Asignación de conocimientos a vendedores
 * 
 * Componentes reutilizables:
 * - UserManagement: gestión CRUD de usuarios
 * - TechnicianSkillsPanel: gestión de habilidades técnicas
 * - SalesSkillsPanel: gestión de conocimientos de ventas
 */
export default function Users() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserRole, setSelectedUserRole] = useState<string | null>(null);

  /**
   * Maneja la selección de un usuario desde el componente UserManagement
   * Permite mostrar las habilidades específicas según el rol
   */
  const handleUserSelect = (userId: string, role: string) => {
    setSelectedUserId(userId);
    setSelectedUserRole(role);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Administración de Usuarios
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestiona usuarios, roles y habilidades del sistema
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="technician-skills" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Habilidades Técnicas
            </TabsTrigger>
            <TabsTrigger value="sales-skills" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Conocimientos de Ventas
            </TabsTrigger>
            <TabsTrigger value="work-schedules" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horarios de Trabajo
            </TabsTrigger>
          </TabsList>

          {/* Panel principal de gestión de usuarios */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Usuarios</CardTitle>
                <CardDescription>
                  Crear, editar y eliminar usuarios del sistema. Asignar roles y permisos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UserManagement onUserSelect={handleUserSelect} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Panel de habilidades técnicas */}
          <TabsContent value="technician-skills" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Habilidades Técnicas</CardTitle>
                <CardDescription>
                  Gestiona las habilidades y especializaciones de los técnicos.
                  Asigna niveles de competencia y experiencia por tipo de servicio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImprovedTechnicianSkillsPanel 
                  selectedUserId={selectedUserId}
                  selectedUserRole={selectedUserRole}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Panel de conocimientos de ventas */}
          <TabsContent value="sales-skills" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Conocimientos de Ventas</CardTitle>
                <CardDescription>
                  Gestiona los conocimientos y especializaciones de los vendedores.
                  Asigna productos, servicios y áreas de expertise.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SalesSkillsPanel 
                  selectedUserId={selectedUserId}
                  selectedUserRole={selectedUserRole}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Panel de horarios de trabajo */}
          <TabsContent value="work-schedules" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Horarios de Trabajo</CardTitle>
                <CardDescription>
                  Gestiona los horarios de trabajo de técnicos, vendedores y administradores.
                  Configura días, horas y tiempos de descanso.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkSchedulePanel 
                  selectedUserId={selectedUserId}
                  selectedUserRole={selectedUserRole}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}