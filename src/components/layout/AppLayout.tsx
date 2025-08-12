import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Layout principal de la aplicación con sidebar y header
 * Componente reutilizable para todas las páginas autenticadas
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col max-w-full overflow-hidden">
          <Header />
          <main className="flex-1 p-3 md:p-6 overflow-y-auto bg-gradient-to-br from-background to-muted/20">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}