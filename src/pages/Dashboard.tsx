import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthDebug } from '@/components/AuthDebug';
import { ClientPanelButton } from '@/components/client/ClientPanelButton';

/**
 * Dashboard principal personalizado por rol
 * Muestra información relevante según el tipo de usuario
 */
export default function Dashboard() {
  const { profile } = useAuth();

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
            'Configuración del sistema'
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
                  <p className="font-medium">Desarrollo Modular:</p>
                  <p className="text-xs mt-1">
                    Esta aplicación está diseñada para crecer módulo por módulo,
                    reutilizando componentes y manteniendo código limpio.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Acceso directo al panel del cliente */}
        <div className="mt-8">
          <ClientPanelButton />
        </div>
        
        {/* Componente de debug temporal */}
        <AuthDebug />
      </div>
    </AppLayout>
  );
}