import { ReactNode, useState } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { ImprovedGeneralChat } from '@/components/chat/ImprovedGeneralChat';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalUnreadCount } from '@/hooks/useGlobalUnreadCount';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Layout principal de la aplicación con sidebar y header
 * Componente reutilizable para todas las páginas autenticadas
 */
export function AppLayout({ children }: AppLayoutProps) {
  const { profile } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const unreadCount = useGlobalUnreadCount();

  // Para clientes, usar layout minimalista sin sidebar
  if (profile?.role === 'cliente') {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-3 md:p-4">
          {children}
        </main>
        
        {/* Chat Panel for clients */}
        <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg hover:scale-105 transition-transform bg-primary text-primary-foreground hover:bg-primary-hover"
                  >
                    <div className="relative">
                      <MessageSquare className="h-6 w-6" />
                      {unreadCount > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-2 -right-2 h-5 min-w-5 text-xs p-0 flex items-center justify-center"
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                      )}
                      {/* Attention sign for clients */}
                      {profile?.role === 'cliente' && (
                        <div className="absolute -top-1 -left-1 h-4 w-4 bg-warning text-warning-foreground rounded-full flex items-center justify-center animate-pulse">
                          <span className="text-xs font-bold">!</span>
                        </div>
                      )}
                    </div>
                  </Button>
                </SheetTrigger>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-primary text-primary-foreground">
                <p>¡Hola! Estamos aquí para ayudarte 👋</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <SheetContent side="right" className="w-[95vw] max-w-[1200px] p-0">
            <div className="h-full p-2">
              <ImprovedGeneralChat />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Layout normal con sidebar para otros roles
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
          
          {/* Chat Panel for all users */}
          <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg hover:scale-105 transition-transform bg-primary text-primary-foreground hover:bg-primary-hover"
                    >
                      <div className="relative">
                        <MessageSquare className="h-6 w-6" />
                        {unreadCount > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="absolute -top-2 -right-2 h-5 min-w-5 text-xs p-0 flex items-center justify-center"
                          >
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </Badge>
                        )}
                         {/* Attention sign for staff */}
                         <div className="absolute -top-1 -left-1 h-4 w-4 bg-info text-info-foreground rounded-full flex items-center justify-center animate-pulse">
                           <span className="text-xs font-bold">!</span>
                         </div>
                      </div>
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-primary text-primary-foreground">
                  <p>¡Hola! Estamos aquí para ayudarte 👋</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <SheetContent side="right" className="w-[95vw] max-w-[1200px] p-0">
              <div className="h-full p-2">
                <ImprovedGeneralChat />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </SidebarProvider>
  );
}