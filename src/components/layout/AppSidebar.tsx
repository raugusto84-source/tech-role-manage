import { 
  Home, 
  Users, 
  ShoppingCart, 
  Settings, 
  ClipboardList,
  UserCheck,
  FileText,
  Calendar,
  Wrench,
  Banknote
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';

/**
 * Sidebar de navegación principal
 * Muestra diferentes opciones según el rol del usuario
 * Componente reutilizable con estado colapsible
 */
export function AppSidebar() {
  const { state } = useSidebar();
  const { profile } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';

  const isActive = (path: string) => currentPath === path;

  // Elementos de navegación por rol
  const getNavigationItems = () => {
    const commonItems = [
      { title: 'Dashboard', url: '/dashboard', icon: Home }
    ];

    switch (profile?.role) {
      case 'administrador':
        return [
          ...commonItems,
          { title: 'Usuarios', url: '/users', icon: Users },
          { title: 'Órdenes', url: '/orders', icon: ClipboardList },
          { title: 'Cotizaciones', url: '/quotes', icon: FileText },
          { title: 'Ventas', url: '/sales', icon: ShoppingCart },
          { title: 'Finanzas', url: '/finanzas', icon: Banknote },
          { title: 'Técnicos', url: '/technicians', icon: UserCheck },
          { title: 'Reportes', url: '/reports', icon: FileText },
          { title: 'Configuración', url: '/settings', icon: Settings },
        ];
      case 'vendedor':
        return [
          ...commonItems,
          { title: 'Órdenes', url: '/orders', icon: ClipboardList },
          { title: 'Cotizaciones', url: '/quotes', icon: FileText },
          { title: 'Ventas', url: '/sales', icon: ShoppingCart },
          { title: 'Clientes', url: '/clients', icon: Users },
        ];
      case 'tecnico':
        return [
          { title: 'Panel Técnico', url: '/technician', icon: Wrench },
          { title: 'Mis Órdenes', url: '/orders', icon: ClipboardList },
        ];
      case 'cliente':
        return [
          { title: 'Panel Cliente', url: '/client', icon: Home },
          { title: 'Mis Órdenes', url: '/orders', icon: ClipboardList },
          { title: 'Historial', url: '/history', icon: FileText },
        ];
      default:
        return commonItems;
    }
  };

  const items = getNavigationItems();

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarTrigger className="m-2 self-end" />
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && 'SYSLAG - Sistema Técnico'}
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className={({ isActive }) =>
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}