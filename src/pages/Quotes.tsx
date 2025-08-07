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
import { Plus, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  service_description: string;
  estimated_amount: number;
  status: 'solicitud' | 'enviada' | 'aceptada' | 'rechazada' | 'seguimiento';
  request_date: string;
  created_by?: string;
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

  // Filtrar cotizaciones
  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = quote.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quote.service_description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Obtener color del estado
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'solicitud': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'enviada': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'aceptada': return 'bg-green-100 text-green-800 border-green-200';
      case 'rechazada': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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
      <div className="space-y-6">
        {/* Header */}
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

        {/* Filtros */}
        <div className="flex gap-4">
          <div className="flex-1 max-w-sm">
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="solicitud">Nueva</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="aceptada">Aceptada</SelectItem>
              <SelectItem value="rechazada">Rechazada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de cotizaciones */}
        <div className="grid gap-4">
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No hay cotizaciones</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No se encontraron cotizaciones con los filtros aplicados'
                  : 'Aún no tienes cotizaciones registradas'}
              </p>
              {canCreateQuotes && (
                <Button onClick={() => setShowWizard(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Cotización
                </Button>
              )}
            </div>
          ) : (
            filteredQuotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                getStatusColor={getStatusColor}
                onViewDetails={() => setSelectedQuote(quote)}
                onDelete={() => setDeleteQuoteId(quote.id)}
                canManage={canCreateQuotes}
              />
            ))
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