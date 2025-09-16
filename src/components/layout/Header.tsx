import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { OrderNotifications } from '@/components/notifications/OrderNotifications';

/**
 * Header de la aplicación con información del usuario y logout
 * Componente reutilizable que muestra datos del perfil
 */
export function Header() {
  const { profile, signOut } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    const roleLabels = {
      administrador: 'Administrador',
      vendedor: 'Vendedor',
      tecnico: 'Técnico',
      cliente: 'Cliente'
    };
    return roleLabels[role as keyof typeof roleLabels] || role;
  };

  return (
    <header className="h-16 border-b border-border bg-gradient-to-r from-card to-card/90 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <h1 className="text-xl font-bold text-primary">
            SYSLAG
          </h1>
        </div>
        <span className="text-sm text-muted-foreground hidden md:block">
          Sistema de Gestión de Servicios Técnicos
        </span>
      </div>

      <div className="flex items-center gap-4">
        <OrderNotifications />
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-accent">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarFallback className="bg-gradient-primary text-white font-semibold">
                {profile?.full_name ? getInitials(profile.full_name) : 'U'}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-card/95 backdrop-blur-md border-border/50" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none text-foreground">
                {profile?.full_name || 'Usuario'}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {profile?.email}
              </p>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  profile?.role === 'cliente' ? 'bg-info-light text-info-foreground' :
                  profile?.role === 'administrador' ? 'bg-primary-light text-primary-foreground' :
                  profile?.role === 'tecnico' ? 'bg-success-light text-success-foreground' :
                  profile?.role === 'vendedor' ? 'bg-warning-light text-warning-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {profile?.role ? getRoleLabel(profile.role) : ''}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="hover:bg-accent/50">
            <User className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="hover:bg-destructive/10 focus:bg-destructive/10 text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}