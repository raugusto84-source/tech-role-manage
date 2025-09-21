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
  Banknote,
  BarChart3,
  Shield,
  Gift,
  ShieldCheck,
  MessageSquare,
  ClipboardCheck,
  Truck,
  Bell,
  CheckCircle,
  Clock,
  AlertCircle
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
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { Badge } from '@/components/ui/badge';

/**
 * Sidebar de navegación principal
 * Muestra diferentes opciones según el rol del usuario
 * Componente reutilizable con estado colapsible
 */
export function AppSidebar() {
  const { state } = useSidebar();
  const { profile } = useAuth();
  const unreadCounts = useUnreadCounts();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';

  const isActive = (path: string) => currentPath === path;

  // Elementos de navegación por rol
  const getNavigationItems = () => {
    const commonItems = [
      { title: 'Panel Administrador', url: '/dashboard', icon: Home }
    ];

    switch (profile?.role) {
      case 'administrador':
        return [
          ...commonItems,
          { title: 'Usuarios', url: '/users', icon: Users },
          { title: 'Clientes', url: '/clientes', icon: UserCheck },
          { title: 'Pólizas', url: '/polizas', icon: Shield },
          { title: 'Órdenes', url: '/orders', icon: ClipboardList },
          { title: 'Garantías', url: '/garantias', icon: ShieldCheck },
          { title: 'Flotillas', url: '/flotillas', icon: Truck },
          { title: 'Cotizaciones', url: '/quotes', icon: FileText },
          { title: 'Ventas', url: '/ventas', icon: ShoppingCart },
          { title: 'Finanzas', url: '/finanzas', icon: Banknote },
          { title: 'Seguimiento', url: '/seguimiento', icon: Bell },
          { title: 'Encuestas', url: '/surveys', icon: BarChart3 },
          { title: 'Reportes', url: '/reports', icon: FileText },
          { title: 'Configuración', url: '/settings', icon: Settings },
        ];
      case 'vendedor':
        return [
          ...commonItems,
          { title: 'Pólizas', url: '/polizas', icon: Shield },
          { title: 'Órdenes', url: '/orders', icon: ClipboardList },
          { title: 'Garantías', url: '/garantias', icon: ShieldCheck },
          { title: 'Cotizaciones', url: '/quotes', icon: FileText },
          { title: 'Ventas', url: '/ventas', icon: ShoppingCart },
        ];
      case 'supervisor':
        return [
          ...commonItems,
          { title: 'Usuarios', url: '/users', icon: Users },
          
          { title: 'Pólizas', url: '/polizas', icon: Shield },
          { title: 'Órdenes', url: '/orders', icon: ClipboardList },
          { title: 'Garantías', url: '/garantias', icon: ShieldCheck },
          { title: 'Flotillas', url: '/flotillas', icon: Truck },
          { title: 'Cotizaciones', url: '/quotes', icon: FileText },
          { title: 'Ventas', url: '/ventas', icon: ShoppingCart },
          { title: 'Finanzas', url: '/finanzas', icon: Banknote },
          { title: 'Seguimiento', url: '/seguimiento', icon: Bell },
          { title: 'Encuestas', url: '/surveys', icon: BarChart3 },
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
          { title: 'Mis Cotizaciones', url: '/quotes', icon: FileText },
          
        ];
      case 'visor_tecnico':
        return [
          { title: 'Visor Técnico', url: '/technician-viewer', icon: Wrench },
          { title: 'Todas las Órdenes', url: '/orders', icon: ClipboardList },
        ];
      default:
        return commonItems;
    }
  };

  const items = getNavigationItems();

  return (
    <Sidebar className={`${collapsed ? "w-14" : "w-60"} border-r border-sidebar-border bg-sidebar`} collapsible="icon">
      <SidebarTrigger className="m-2 self-end text-sidebar-foreground hover:bg-sidebar-accent hidden md:flex" />
      
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 font-semibold">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-gradient-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-white">S</span>
                </div>
                <span>SYSLAG</span>
              </div>
            )}
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="touch-target">
                    <NavLink 
                      to={item.url} 
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-sidebar-accent group ${
                          isActive 
                            ? "bg-gradient-primary text-white shadow-md font-medium" 
                            : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
                        }`
                      }
                    >
                      <item.icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${
                        !collapsed ? '' : 'mx-auto'
                      }`} />
                      {!collapsed && (
                        <span className="font-medium transition-all duration-200 flex items-center gap-2">
                          {item.title}
                          {/* Show badges for unread counts */}
                          {item.url === '/orders' && (
                            <div className="flex items-center gap-1">
                              {unreadCounts.ordersPendingAuth > 0 && (
                                <div className="flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 text-orange-600" />
                                  <Badge variant="secondary" className="h-4 px-1 text-xs">
                                    {unreadCounts.ordersPendingAuth}
                                  </Badge>
                                </div>
                              )}
                              {unreadCounts.ordersInProcess > 0 && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-blue-600" />
                                  <Badge variant="secondary" className="h-4 px-1 text-xs">
                                    {unreadCounts.ordersInProcess}
                                  </Badge>
                                </div>
                              )}
                              {unreadCounts.ordersFinalized > 0 && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                  <Badge variant="secondary" className="h-4 px-1 text-xs">
                                    {unreadCounts.ordersFinalized}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          )}
                          {item.url === '/quotes' && unreadCounts.quotes > 0 && (
                            <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                              {unreadCounts.quotes > 99 ? '99+' : unreadCounts.quotes}
                            </Badge>
                          )}
                          {item.url === '/garantias' && unreadCounts.warranties > 0 && (
                            <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                              {unreadCounts.warranties > 99 ? '99+' : unreadCounts.warranties}
                            </Badge>
                          )}
                          {item.url === '/finanzas' && unreadCounts.collections > 0 && (
                            <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                              {unreadCounts.collections > 99 ? '99+' : unreadCounts.collections}
                            </Badge>
                          )}
                        </span>
                      )}
                      {/* Show dots for collapsed state */}
                      {collapsed && (
                        <>
                          {item.url === '/orders' && (unreadCounts.ordersPendingAuth > 0 || unreadCounts.ordersInProcess > 0 || unreadCounts.ordersFinalized > 0) && (
                            <div className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full"></div>
                          )}
                          {item.url === '/quotes' && unreadCounts.quotes > 0 && (
                            <div className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full"></div>
                          )}
                          {item.url === '/garantias' && unreadCounts.warranties > 0 && (
                            <div className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full"></div>
                          )}
                          {item.url === '/finanzas' && unreadCounts.collections > 0 && (
                            <div className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full"></div>
                          )}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Chat Panel for all users except clients */}
              {profile?.role !== 'cliente' && (
                <SidebarMenuItem key="chat">
                  <SidebarMenuButton asChild className="touch-target">
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-sidebar-accent group text-sidebar-foreground hover:text-sidebar-accent-foreground">
                      <MessageSquare className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${
                        !collapsed ? '' : 'mx-auto'
                      }`} />
                      {!collapsed && (
                        <span className="font-medium transition-all duration-200">
                          Chat General
                        </span>
                      )}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}