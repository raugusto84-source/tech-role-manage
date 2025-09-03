import { ReactNode, useState } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { ImprovedGeneralChat } from '@/components/chat/ImprovedGeneralChat';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

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
          
          {/* Chat Panel for all users except clients */}
          {profile?.role !== 'cliente' && (
            <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg"
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[95vw] max-w-[1200px] p-0">
                <div className="h-full p-2">
                  <ImprovedGeneralChat />
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}