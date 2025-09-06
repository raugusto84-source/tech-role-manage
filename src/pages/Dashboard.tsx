import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PersonalTimeClockPanel } from '@/components/timetracking/PersonalTimeClockPanel';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { PasswordChangeForm } from '@/components/auth/PasswordChangeForm';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Settings, LogOut } from 'lucide-react';

/**
 * Dashboard principal personalizado por rol
 * Muestra información relevante según el tipo de usuario
 * Incluye control de horarios para empleados
 */
export default function Dashboard() {
  const { profile, signOut } = useAuth();

  // Función para manejar el logout
  const handleLogout = async () => {
    await signOut();
    window.location.href = '/auth';
  };

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

  // Show admin dashboard for administrators with time clock
  if (profile?.role === 'administrador') {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header con botón de cerrar sesión */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Panel de Administración</h1>
              <p className="text-muted-foreground mt-1">Gestión completa del sistema</p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
          
          {/* Time clock personal para administradores también */}
          <PersonalTimeClockPanel />
          <AdminDashboard />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {roleInfo.title}
            </h1>
            <p className="text-muted-foreground mt-2">
              {roleInfo.description}
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>

        {/* Solo el widget personal de control de horarios */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Widget de control de horarios - Solo para empleados */}
          {showTimeTracking && (
            <div className="lg:col-span-3">
              <PersonalTimeClockPanel />
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
              <CardTitle>Configuración</CardTitle>
              <CardDescription>Ajustes de tu cuenta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h3 className="font-medium mb-2">Cambiar Contraseña</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Actualiza tu contraseña para mantener tu cuenta segura
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Cambiar Contraseña
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <PasswordChangeForm onClose={() => {}} />
                    </DialogContent>
                  </Dialog>
                </div>
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
      </div>
    </AppLayout>
  );
}