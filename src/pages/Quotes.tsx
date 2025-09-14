import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { QuoteCard } from '@/components/quotes/QuoteCard';
import { QuoteWizard } from '@/components/quotes/QuoteWizard';
import { QuoteDetails } from '@/components/quotes/QuoteDetails';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Search, LogOut, Home } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  service_description: string;
  estimated_amount: number;
  status: 'solicitud' | 'enviada' | 'aceptada' | 'rechazada' | 'seguimiento' | 'pendiente_aprobacion';
  request_date: string;
  created_by?: string;
  assigned_to?: string;
  created_at: string;
  salesperson_name?: string;
}

/**
 * Página principal del módulo de cotizaciones
 * Permite crear, visualizar, editar y convertir cotizaciones a órdenes
 * Interfaz completa para todos los usuarios incluyendo clientes
 */
export default function Quotes() {
  const { profile, signOut } = useAuth();
  
  // Función para obtener la ruta del dashboard según el rol
  const getDashboardRoute = () => {
    if (!profile) return '/dashboard';
    
    const roleDashboards = {
      'cliente': '/client',
      'tecnico': '/technician',
      'vendedor': '/dashboard',
      'supervisor': '/dashboard',
      'administrador': '/dashboard',
      'visor_tecnico': '/technician-viewer'
    };
    
    return roleDashboards[profile.role] || '/dashboard';
  };

  // Función para manejar el logout
  const handleLogout = async () => {
    await signOut();
    window.location.href = '/auth';
  };

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);

  // Cargar cotizaciones
  const loadQuotes = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('quotes')
        .select('*');

      // Filtrar por cliente si el usuario es un cliente
      if (profile?.role === 'cliente') {
        query = query.eq('client_email', profile?.email || '');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading quotes:', error);
        toast({
          title: "Error",
          description: `Error al cargar cotizaciones: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      setQuotes(data || []);
    } catch (error) {
      console.error('Unexpected error loading quotes:', error);
      toast({
        title: "Error inesperado",
        description: "No se pudieron cargar las cotizaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Verificar si puede crear cotizaciones según el rol
  const canCreateQuotes = profile?.role === 'cliente' || 
    profile?.role === 'vendedor' || 
    profile?.role === 'administrador' || 
    profile?.role === 'supervisor';

  useEffect(() => {
    loadQuotes();

    // Auto-open wizard if coming from client dashboard
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('new') === '1') {
      setShowWizard(true);
      window.history.replaceState({}, '', '/quotes');
    }
  }, []);

  // Filtrar cotizaciones solo por búsqueda (sin filtro de estado)
  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = quote.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.service_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Separar cotizaciones por estado
  const quotesByStatus = {
    pendiente_aprobacion: filteredQuotes.filter(q => q.status === 'pendiente_aprobacion'),
    solicitud: filteredQuotes.filter(q => q.status === 'solicitud'),
    enviada: filteredQuotes.filter(q => q.status === 'enviada'),
    aceptada: filteredQuotes.filter(q => q.status === 'aceptada'),
    rechazada: filteredQuotes.filter(q => q.status === 'rechazada')
  };

  // Función para obtener información de estilo de cada estado
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': 
        return { 
          label: 'Pendientes de Aprobación', 
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          bgColor: 'bg-orange-50',
          icon: '⏳'
        };
      case 'solicitud': 
        return { 
          label: 'Nuevas', 
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          bgColor: 'bg-yellow-50',
          icon: '📝'
        };
      case 'enviada': 
        return { 
          label: 'Enviadas', 
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          bgColor: 'bg-blue-50',
          icon: '📤'
        };
      case 'aceptada': 
        return { 
          label: 'Aceptadas', 
          color: 'bg-green-100 text-green-800 border-green-200',
          bgColor: 'bg-green-50',
          icon: '✅'
        };
      case 'rechazada': 
        return { 
          label: 'No Aceptadas', 
          color: 'bg-red-100 text-red-800 border-red-200',
          bgColor: 'bg-red-50',
          icon: '❌'
        };
      default: 
        return { 
          label: status, 
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          bgColor: 'bg-gray-50',
          icon: '📄'
        };
    }
  };

  // Manejar eliminación de cotización
  const handleDeleteQuote = async () => {
    if (!deleteQuoteId) return;

    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', deleteQuoteId);

      if (error) {
        toast({
          title: "Error",
          description: `Error al eliminar cotización: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Cotización eliminada",
        description: "La cotización ha sido eliminada exitosamente",
      });

      loadQuotes();
      setDeleteQuoteId(null);
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast({
        title: "Error inesperado",
        description: "No se pudo eliminar la cotización",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando cotizaciones...</p>
        </div>
      </div>
    );
  }

  // Vista de detalles
  if (selectedQuote) {
    return (
      <AppLayout>
        <QuoteDetails 
          quote={selectedQuote}
          onBack={() => setSelectedQuote(null)}
          onQuoteUpdated={() => {
            loadQuotes();
            setSelectedQuote(null);
          }}
        />
      </AppLayout>
    );
  }

  // Vista del wizard
  if (showWizard) {
    return (
      <AppLayout>
        <QuoteWizard 
          onSuccess={() => {
            setShowWizard(false);
            loadQuotes();
          }}
          onCancel={() => setShowWizard(false)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        {/* Header - Mobile First */}
        <div className="mb-4 sm:mb-6">
          <div className="mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Cotizaciones</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {profile?.role === 'cliente' ? 'Mis cotizaciones' : 'Gestiona las cotizaciones del sistema'}
            </p>
          </div>
          
          {/* Mobile-first action buttons */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex gap-2 flex-1">
              {/* Botón volver al dashboard */}
              <Button 
                variant="outline" 
                onClick={() => window.location.href = getDashboardRoute()}
                className="gap-1 sm:gap-2 flex-1 sm:flex-initial text-xs sm:text-sm"
                size="sm"
              >
                <Home className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Dashboard</span>
                <span className="xs:hidden">Panel</span>
              </Button>
              
              {/* Botón cerrar sesión */}
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="gap-1 sm:gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground text-xs sm:text-sm"
                size="sm"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Cerrar Sesión</span>
                <span className="xs:hidden">Salir</span>
              </Button>
            </div>
            
            {canCreateQuotes && (
              <Button 
                onClick={() => setShowWizard(true)}
                className="text-xs sm:text-sm"
                size="sm"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Nueva Cotización</span>
                <span className="xs:hidden">Nueva</span>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile-first Search filter */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3 sm:h-4 sm:w-4" />
            <Input
              placeholder="Buscar cotizaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 sm:pl-10 text-sm h-8 sm:h-10"
            />
          </div>
        </div>

        {/* Content Area - Mobile First */}
        <div className="space-y-4 sm:space-y-6">
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-8 sm:py-12 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/25 mx-2 sm:mx-0">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-3 sm:mb-4">
                <Plus className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base sm:text-lg font-medium mb-2">No hay cotizaciones</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4 px-4">
                {searchTerm 
                  ? 'No se encontraron cotizaciones con los filtros aplicados'
                  : 'Aún no tienes cotizaciones registradas'}
              </p>
              {canCreateQuotes && (
                <Button onClick={() => setShowWizard(true)} size="sm">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Crear primera cotización
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8">
              {Object.entries(quotesByStatus).map(([status, statusQuotes]) => {
                const statusInfo = getStatusInfo(status);
                
                if (statusQuotes.length === 0) return null;
                
                return (
                  <div key={status} className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 sm:gap-3 pb-2 border-b mx-2 sm:mx-0">
                      <span className="text-xl sm:text-2xl">{statusInfo.icon}</span>
                      <div>
                        <h2 className="text-lg sm:text-xl font-semibold">{statusInfo.label}</h2>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {statusQuotes.length} {statusQuotes.length === 1 ? 'cotización' : 'cotizaciones'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 px-2 sm:px-0">
                      {statusQuotes.map((quote) => (
                        <QuoteCard
                          key={quote.id}
                          quote={quote}
                          getStatusColor={() => statusInfo.color}
                          onViewDetails={() => setSelectedQuote(quote)}
                          onDelete={() => setDeleteQuoteId(quote.id)}
                          canManage={canCreateQuotes}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={!!deleteQuoteId} onOpenChange={() => setDeleteQuoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La cotización será eliminada permanentemente del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuote} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}