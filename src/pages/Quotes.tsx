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
import { Plus, Search, ArrowLeft } from 'lucide-react';
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
 * Incluye filtros por estado y búsqueda
 */
export default function Quotes() {
  const { profile } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);

  // Mobile-first: Skip nueva solicitud and go directly to wizard
  const isClientRole = profile?.role === 'cliente';

  // Cargar cotizaciones
  const loadQuotes = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      // Filtrar por rol
      if (profile?.role === 'cliente') {
        query = query.eq('client_email', profile.email);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading quotes:', error);
        toast({
          title: "Error",
          description: `Error al cargar cotizaciones: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Get salesperson names
      const userIds = [...new Set([...data.map(q => q.assigned_to), ...data.map(q => q.created_by)].filter(Boolean))];
      
      let salespersonData: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        
        salespersonData = profilesData || [];
      }
      
      // Transform the data to include salesperson name
      const transformedData = (data || []).map(quote => {
        const salesperson = salespersonData.find(p => p.user_id === (quote.assigned_to || quote.created_by));
        return {
          ...quote,
          salesperson_name: salesperson?.full_name || ''
        };
      });
      
      setQuotes(transformedData);
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

  useEffect(() => {
    if (profile) {
      loadQuotes();
    }
  }, [profile]);

  // Abrir wizard automáticamente si viene con ?new=1 (flujo rápido desde Panel Cliente)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      const canCreate = profile?.role === 'administrador' || profile?.role === 'vendedor' || profile?.role === 'cliente';
      if (canCreate) setShowWizard(true);
    }
    // Solo en montaje
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtrar cotizaciones solo por búsqueda (sin filtro de estado)
  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = quote.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quote.service_description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Separar cotizaciones por estado
  const quotesByStatus = {
    pendiente_aprobacion: filteredQuotes.filter(q => q.status === 'pendiente_aprobacion'),
    solicitud: filteredQuotes.filter(q => q.status === 'solicitud'),
    enviada: filteredQuotes.filter(q => q.status === 'enviada'),
    aceptada: filteredQuotes.filter(q => q.status === 'aceptada'),
    rechazada: filteredQuotes.filter(q => q.status === 'rechazada'),
  };

  // Obtener información del estado
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

      setQuotes(quotes.filter(q => q.id !== deleteQuoteId));
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

  const canCreateQuotes = profile?.role === 'administrador' || profile?.role === 'vendedor' || profile?.role === 'cliente';
  const canManageQuotes = profile?.role === 'administrador' || profile?.role === 'vendedor';

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Cargando cotizaciones...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Vista de detalle de cotización
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
      <div className={`space-y-4 ${isClientRole ? 'px-4 py-6' : 'space-y-6'}`}>
        {/* Mobile-first Header for clients */}
        {isClientRole ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.history.back()}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              {canCreateQuotes && (
                <Button 
                  onClick={() => setShowWizard(true)}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nueva
                </Button>
              )}
            </div>
            <h1 className="text-2xl font-bold">Mis Cotizaciones</h1>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Cotizaciones</h1>
              <p className="text-muted-foreground">
                Gestiona las cotizaciones del sistema
              </p>
            </div>
            {canCreateQuotes && (
              <Button 
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Nueva Cotización
              </Button>
            )}
          </div>
        )}

        {/* Search filter - simplified for mobile */}
        <div className={`flex gap-4 ${isClientRole ? 'px-0' : ''}`}>
          <div className={`flex-1 ${isClientRole ? 'max-w-full' : 'max-w-sm'}`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar cotizaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Mobile-first quotes view */}
        {filteredQuotes.length === 0 ? (
          <div className={`text-center ${isClientRole ? 'py-8' : 'py-12'}`}>
            <div className={`mx-auto ${isClientRole ? 'w-16 h-16' : 'w-24 h-24'} bg-muted rounded-full flex items-center justify-center mb-4`}>
              <Plus className={`${isClientRole ? 'h-6 w-6' : 'h-8 w-8'} text-muted-foreground`} />
            </div>
            <h3 className={`${isClientRole ? 'text-base' : 'text-lg'} font-medium mb-2`}>No hay cotizaciones</h3>
            <p className={`text-muted-foreground mb-4 ${isClientRole ? 'text-sm' : ''}`}>
              {searchTerm 
                ? 'No se encontraron cotizaciones con los filtros aplicados'
                : 'Aún no tienes cotizaciones registradas'}
            </p>
            {canCreateQuotes && (
              <Button onClick={() => setShowWizard(true)} size={isClientRole ? "sm" : "default"}>
                <Plus className="h-4 w-4 mr-2" />
                {isClientRole ? 'Crear Cotización' : 'Crear Primera Cotización'}
              </Button>
            )}
          </div>
        ) : isClientRole ? (
          // Simplified mobile view for clients
          <div className="space-y-3">
            {filteredQuotes.map((quote) => (
              <div key={quote.id} className="bg-card rounded-lg border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{quote.quote_number}</h3>
                    <p className="text-xs text-muted-foreground">{quote.service_description}</p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusInfo(quote.status).color}`}>
                    {getStatusInfo(quote.status).label}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {new Intl.NumberFormat('es-CO', {
                      style: 'currency',
                      currency: 'COP',
                      minimumFractionDigits: 0,
                    }).format(quote.estimated_amount)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedQuote(quote)}
                  >
                    Ver detalles
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Desktop admin view
          <div className="space-y-8">
            {Object.entries(quotesByStatus).map(([status, statusQuotes]) => {
              const statusInfo = getStatusInfo(status);
              
              if (statusQuotes.length === 0) return null;
              
              return (
                <div key={status} className={`rounded-lg border p-6 ${statusInfo.bgColor}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{statusInfo.icon}</span>
                      <div>
                        <h2 className="text-xl font-semibold">{statusInfo.label}</h2>
                        <p className="text-sm text-muted-foreground">
                          {statusQuotes.length} {statusQuotes.length === 1 ? 'cotización' : 'cotizaciones'}
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full border text-sm font-medium ${statusInfo.color}`}>
                      {statusQuotes.length}
                    </div>
                  </div>
                  
                  <div className="grid gap-4">
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