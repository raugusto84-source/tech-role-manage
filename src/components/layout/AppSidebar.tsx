import { Home, Users, ShoppingCart, ClipboardList, UserCheck, FileText, Calendar, Wrench, Banknote, BarChart3, Shield, Gift, ShieldCheck, MessageSquare, ClipboardCheck, Truck, Bell, CheckCircle, Clock, AlertCircle, Activity, Building2 } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { Badge } from '@/components/ui/badge';

/**
 * Sidebar de navegación principal
 * Muestra diferentes opciones según el rol del usuario
 * Componente reutilizable con estado colapsible
 */
export function AppSidebar() {
  const {
    state
  } = useSidebar();
  const {
    profile
  } = useAuth();
  const unreadCounts = useUnreadCounts();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';
  const isActive = (path: string) => currentPath === path;

  // Elementos de navegación por rol organizados en secciones
  const getNavigationSections = () => {
    switch (profile?.role) {
      case 'administrador':
        return {
          administracion: [{
            title: 'Panel Administrador',
            url: '/dashboard',
            icon: Home
          }, {
            title: 'Finanzas',
            url: '/finanzas',
            icon: Banknote
          }, {
            title: 'Clientes',
            url: '/clientes',
            icon: UserCheck
          }, {
            title: 'Usuarios',
            url: '/users',
            icon: Users
          }],
          operativa: [{
            title: 'Ventas',
            url: '/ventas',
            icon: ShoppingCart
          }, {
            title: 'Cotizaciones',
            url: '/quotes',
            icon: FileText
          }, {
            title: 'Órdenes',
            url: '/orders',
            icon: ClipboardList
          }, {
            title: 'Garantías',
            url: '/garantias',
            icon: ShieldCheck
          }, {
            title: 'Acceso by Syslag',
            url: '/acceso',
            icon: Building2
          }],
          configuracion: [{
            title: 'Pólizas',
            url: '/polizas',
            icon: Shield
          }, {
            title: 'Flotillas',
            url: '/flotillas',
            icon: Truck
          }, {
            title: 'Encuestas',
            url: '/surveys',
            icon: BarChart3
          }, {
            title: 'Seguimiento',
            url: '/seguimiento',
            icon: Bell
          }]
        };
      case 'supervisor':
        return {
          administracion: [{
            title: 'Panel Administrador',
            url: '/dashboard',
            icon: Home
          }, {
            title: 'Finanzas',
            url: '/finanzas',
            icon: Banknote
          }, {
            title: 'Usuarios',
            url: '/users',
            icon: Users
          }],
          operativa: [{
            title: 'Ventas',
            url: '/ventas',
            icon: ShoppingCart
          }, {
            title: 'Cotizaciones',
            url: '/quotes',
            icon: FileText
          }, {
            title: 'Órdenes',
            url: '/orders',
            icon: ClipboardList
          }, {
            title: 'Garantías',
            url: '/garantias',
            icon: ShieldCheck
          }, {
            title: 'Acceso by Syslag',
            url: '/acceso',
            icon: Building2
          }],
          configuracion: [{
            title: 'Pólizas',
            url: '/polizas',
            icon: Shield
          }, {
            title: 'Flotillas',
            url: '/flotillas',
            icon: Truck
          }, {
            title: 'Encuestas',
            url: '/surveys',
            icon: BarChart3
          }, {
            title: 'Seguimiento',
            url: '/seguimiento',
            icon: Bell
          }]
        };
      case 'vendedor':
        return {
          operativa: [{
            title: 'Panel Administrador',
            url: '/dashboard',
            icon: Home
          }, {
            title: 'Ventas',
            url: '/ventas',
            icon: ShoppingCart
          }, {
            title: 'Cotizaciones',
            url: '/quotes',
            icon: FileText
          }, {
            title: 'Órdenes',
            url: '/orders',
            icon: ClipboardList
          }, {
            title: 'Garantías',
            url: '/garantias',
            icon: ShieldCheck
          }],
          configuracion: [{
            title: 'Pólizas',
            url: '/polizas',
            icon: Shield
          }]
        };
      case 'tecnico':
        return {
          operativa: [{
            title: 'Panel Técnico',
            url: '/technician',
            icon: Wrench
          }, {
            title: 'Mis Órdenes',
            url: '/orders',
            icon: ClipboardList
          }, {
            title: 'Cotizaciones',
            url: '/quotes',
            icon: FileText
          }]
        };
      case 'cliente':
        return {
          operativa: [{
            title: 'Panel Cliente',
            url: '/client',
            icon: Home
          }, {
            title: 'Mis Órdenes',
            url: '/orders',
            icon: ClipboardList
          }, {
            title: 'Mis Cotizaciones',
            url: '/quotes',
            icon: FileText
          }]
        };
      case 'visor_tecnico':
        return {
          operativa: [{
            title: 'Visor Técnico',
            url: '/technician-viewer',
            icon: Wrench
          }, {
            title: 'Todas las Órdenes',
            url: '/orders',
            icon: ClipboardList
          }]
        };
      default:
        return {
          operativa: [{
            title: 'Panel Administrador',
            url: '/dashboard',
            icon: Home
          }]
        };
    }
  };
  const sections = getNavigationSections();
  const renderMenuItem = (item: any) => {
    const hasQuoteNotifications = item.url === '/quotes' && unreadCounts.quotes > 0;
    const hasOrderNotifications = item.url === '/orders' && (unreadCounts.ordersPendingAuth > 0 || unreadCounts.ordersInProcess > 0 || unreadCounts.ordersPendingDelivery > 0);
    const hasFinanceNotifications = item.url === '/finanzas' && unreadCounts.collections > 0;
    
    const getNotificationStyles = () => {
      if (hasQuoteNotifications) return { bg: "!bg-pink-200 hover:!bg-pink-300", text: "!text-gray-900" };
      if (hasOrderNotifications) return { bg: "!bg-blue-200 hover:!bg-blue-300", text: "!text-gray-900" };
      if (hasFinanceNotifications) return { bg: "!bg-red-200 hover:!bg-red-300", text: "!text-gray-900" };
      return null;
    };
    
    const notifStyles = getNotificationStyles();
    
    return <SidebarMenuItem key={item.title} className={notifStyles ? `${notifStyles.bg.replace('!', '')} rounded-lg` : ""}>
        <SidebarMenuButton asChild className={`touch-target ${notifStyles ? notifStyles.bg : ""}`}>
          <NavLink to={item.url} className={({
          isActive: active
        }) => {
          return `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-sidebar-accent group ${active ? "bg-gradient-primary text-white shadow-md font-medium" : notifStyles ? `${notifStyles.bg} ${notifStyles.text}` : "text-white hover:text-white"}`;
        }}>
          <item.icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${!collapsed ? '' : 'mx-auto'}`} />
          {!collapsed && <span className="font-medium transition-all duration-200 flex items-center gap-2 text-sidebar-foreground">
              {item.title}
              {/* Show badges for unread counts */}
              {item.url === '/orders' && <div className="flex items-center gap-1">
                  {unreadCounts.ordersPendingAuth > 0 && <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-orange-600" />
                      <Badge variant="secondary" className="h-4 px-1 text-xs">
                        {unreadCounts.ordersPendingAuth}
                      </Badge>
                    </div>}
                  {unreadCounts.ordersInProcess > 0 && <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-blue-600" />
                      <Badge variant="secondary" className="h-4 px-1 text-xs">
                        {unreadCounts.ordersInProcess}
                      </Badge>
                    </div>}
                  {unreadCounts.ordersPendingDelivery > 0 && <div className="flex items-center gap-1">
                      <Truck className="h-3 w-3 text-purple-600" />
                      <Badge variant="secondary" className="h-4 px-1 text-xs">
                        {unreadCounts.ordersPendingDelivery}
                      </Badge>
                    </div>}
                </div>}
              {item.url === '/quotes' && unreadCounts.quotes > 0 && <Badge className="h-5 px-1.5 flex items-center justify-center text-xs bg-pink-200 text-pink-800 hover:bg-pink-200">
                  {unreadCounts.quotes > 99 ? '99+' : unreadCounts.quotes}
                </Badge>}
              {item.url === '/garantias' && unreadCounts.warranties > 0 && <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {unreadCounts.warranties > 99 ? '99+' : unreadCounts.warranties}
                </Badge>}
              {item.url === '/finanzas' && unreadCounts.collections > 0 && <Badge variant="destructive" className="h-5 px-1.5 flex items-center justify-center text-xs">
                  {unreadCounts.collections > 99 ? '99+' : unreadCounts.collections}
                </Badge>}
            </span>}
          {/* Show dots for collapsed state */}
          {collapsed && <>
              {item.url === '/orders' && (unreadCounts.ordersPendingAuth > 0 || unreadCounts.ordersInProcess > 0 || unreadCounts.ordersPendingDelivery > 0) && <div className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full"></div>}
              {item.url === '/quotes' && unreadCounts.quotes > 0 && <div className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full"></div>}
              {item.url === '/garantias' && unreadCounts.warranties > 0 && <div className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full"></div>}
              {item.url === '/finanzas' && unreadCounts.collections > 0 && <div className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full"></div>}
            </>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>;
  };
  return <Sidebar className={`${collapsed ? "w-14" : "w-60"} border-r border-sidebar-border bg-sidebar`} collapsible="icon">
      {/* Header con logo y trigger */}
      <div className="flex items-center justify-between p-2 border-b border-sidebar-border">
        {!collapsed ? <div className="flex items-center gap-2 pl-1">
            <div className="w-6 h-6 rounded bg-gradient-primary flex items-center justify-center">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="font-semibold text-sidebar-foreground">SYSLAG</span>
          </div> : <div className="w-6 h-6 rounded bg-gradient-primary flex items-center justify-center mx-auto">
            <span className="text-xs font-bold text-white">S</span>
          </div>}
        <SidebarTrigger className="text-sidebar-foreground hover:bg-sidebar-accent hidden md:flex" />
      </div>
      
      <SidebarContent className="bg-sidebar">

        {/* Administración */}
        {sections.administracion && <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70 font-semibold px-3">
              {!collapsed && 'Administración'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {sections.administracion.map(renderMenuItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>}

        {/* Operativa */}
        {sections.operativa && <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70 font-semibold px-3">
              {!collapsed && 'Operativa'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {sections.operativa.map(renderMenuItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>}

        {/* Configuración */}
        {sections.configuracion && <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70 font-semibold px-3">
              {!collapsed && 'Configuración'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {sections.configuracion.map(renderMenuItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>}
      </SidebarContent>
    </Sidebar>;
}