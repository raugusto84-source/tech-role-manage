import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { TimeClockWidget } from '@/components/timetracking/TimeClockWidget';
import { TechnicianPresencePanel } from '@/components/timetracking/TechnicianPresencePanel';
import { WeeklyTimeReport } from '@/components/timetracking/WeeklyTimeReport';
import { RewardsAdminPanel } from '@/components/rewards/RewardsAdminPanel';

/**
 * Dashboard principal personalizado por rol
 * Muestra información relevante según el tipo de usuario
 * Incluye control de horarios para empleados
 */
export default function Dashboard() {
  const { profile } = useAuth();

  // Determinar si el usuario debe ver el control de horarios (todos excepto clientes)
  const showTimeTracking = profile && profile.role !== 'cliente';
  const showTimeReports = profile && ['administrador', 'supervisor'].includes(profile.role);

  const getRoleGreeting = () => {
    switch (profile?.role) {
      case 'administrador':
        return {
          title: '¡Hola, Administrador!',
          description: 'Bienvenido al panel de administración. Aquí puedes gestionar usuarios, órdenes, ventas y configurar el sistema.',
          features: [
            'Gestión completa de usuarios y roles',
            'Supervisión de todas las órdenes y servicios',
            'Reportes y análisis de rendimiento',
            'Control de horarios de empleados',
            'Configuración del sistema'
          ]
        };
      case 'supervisor':
        return {
          title: '¡Hola, Supervisor!',
          description: 'Panel de supervisión para gestionar equipos, órdenes, ventas y finanzas.',
          features: [
            'Gestión de usuarios del equipo',
            'Supervisión de órdenes y servicios',
            'Reportes de ventas y finanzas',
            'Control de horarios de empleados',
            'Gestión de encuestas'
          ]
        };
      case 'vendedor':
        return {
          title: '¡Hola, Vendedor!',
          description: 'Panel de ventas para gestionar cotizaciones, clientes y cerrar nuevos negocios.',
          features: [
            'Crear y gestionar cotizaciones',
            'Seguimiento de leads y clientes',
            'Registro de ventas',
            'Control de horarios personal',
            'Reportes de rendimiento'
          ]
        };
      case 'tecnico':
        return {
          title: '¡Hola, Técnico!',
          description: 'Tu área de trabajo para gestionar órdenes asignadas y programar servicios.',
          features: [
            'Órdenes asignadas a ti',
            'Calendario de servicios',
            'Registro de trabajo realizado',
            'Control de horarios personal',
            'Comunicación con clientes'
          ]
        };
      case 'cliente':
        return {
          title: '¡Hola, Cliente!',
          description: 'Portal del cliente para solicitar servicios y ver el progreso de tus órdenes.',
          features: [
            'Solicitar nuevos servicios',
            'Seguimiento de órdenes',
            'Historial de servicios',
            'Comunicación con técnicos'
          ]
        };
      default:
        return {
          title: '¡Bienvenido!',
          description: 'Sistema de gestión de servicios técnicos.',
          features: []
        };
    }
  };

  const roleInfo = getRoleGreeting();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {roleInfo.title}
          </h1>
          <p className="text-muted-foreground mt-2">
            {roleInfo.description}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Widget de control de horarios - Solo para empleados */}
          {showTimeTracking && (
            <div className="lg:col-span-1">
              <TimeClockWidget />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Perfil de Usuario</CardTitle>
              <CardDescription>Tu información personal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Nombre:</strong> {profile?.full_name}</p>
                <p><strong>Email:</strong> {profile?.email}</p>
                <p><strong>Rol:</strong> {profile?.role}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funcionalidades Disponibles</CardTitle>
              <CardDescription>Lo que puedes hacer en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {roleInfo.features.map((feature, index) => (
                  <li key={index} className="text-sm flex items-center">
                    <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Próximos Pasos</CardTitle>
              <CardDescription>Qué hacer ahora</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p>
                  El sistema está listo para expandirse con nuevas funcionalidades.
                  Usa el menú lateral para navegar por las diferentes secciones.
                </p>
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="font-medium">Sistema de Horarios:</p>
                  <p className="text-xs mt-1">
                    {showTimeTracking 
                      ? "Registra tu entrada y salida diaria usando el widget de control de horarios."
                      : "Los clientes no requieren registro de horarios."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Paneles administrativos con tabs - Solo para administradores */}
        {profile?.role === 'administrador' && (
          <div className="lg:col-span-full">
            <Tabs defaultValue="presence" className="w-full">
               <TabsList className="grid w-full grid-cols-3 gap-1 p-1">
                 <TabsTrigger value="presence" className="text-xs md:text-sm">
                   <span className="md:hidden">Presencia</span>
                   <span className="hidden md:inline">Presencia Empleados</span>
                 </TabsTrigger>
                 <TabsTrigger value="reports" className="text-xs md:text-sm">
                   <span className="md:hidden">Reportes</span>
                   <span className="hidden md:inline">Reportes de Tiempo</span>
                 </TabsTrigger>
                 <TabsTrigger value="rewards" className="text-xs md:text-sm">
                   <span className="md:hidden">Recompensas</span>
                   <span className="hidden md:inline">Sistema de Recompensas</span>
                 </TabsTrigger>
               </TabsList>
              
              <TabsContent value="presence">
                <TechnicianPresencePanel />
              </TabsContent>
              
              <TabsContent value="reports">
                <WeeklyTimeReport />
              </TabsContent>
              
              <TabsContent value="rewards">
                <RewardsAdminPanel />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Sección de reportes semanales - Para supervisores */}
        {profile?.role === 'supervisor' && (
          <div className="lg:col-span-full">
            <h2 className="text-2xl font-semibold mb-4">Reportes de Tiempo</h2>
            <WeeklyTimeReport />
          </div>
        )}
      </div>
    </AppLayout>
  );
}