import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, FileText, Calendar, DollarSign, Eye } from 'lucide-react';
import { formatCOPCeilToTen } from '@/utils/currency';

interface QuoteWithClient {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  service_description: string;
  estimated_amount: number;
  status: string;
  marketing_channel: string;
  account_type: string;
  request_date: string;
  quote_sent_at: string | null;
  final_decision_date: string | null;
}

/**
 * Componente para mostrar el historial completo de cotizaciones de todos los clientes
 * Incluye filtros por estado, cliente y fechas
 */
export function ClientQuotesHistory() {
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('request_date', { ascending: false });

      if (error) throw error;

      setQuotes(data || []);
    } catch (error: any) {
      console.error('Error loading quotes:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las cotizaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'solicitud':
        return 'bg-purple-100 text-purple-800';
      case 'aceptada':
        return 'bg-green-100 text-green-800';
      case 'rechazada':
        return 'bg-red-100 text-red-800';
      case 'enviada':
        return 'bg-blue-100 text-blue-800';
      case 'seguimiento':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'solicitud': 'Solicitud',
      'enviada': 'Enviada',
      'seguimiento': 'Seguimiento',
      'aceptada': 'Aceptada',
      'rechazada': 'Rechazada'
    };
    return labels[status] || status;
  };

  const formatCurrency = (amount: number) => formatCOPCeilToTen(amount);

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = 
      quote.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.client_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.service_description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Cargando historial de cotizaciones...</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Historial de Cotizaciones ({quotes.length})
        </CardTitle>
        
        <div className="flex flex-col md:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, email, número o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            {['all', 'solicitud', 'enviada', 'seguimiento', 'aceptada', 'rechazada'].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? 'Todas' : getStatusLabel(status)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid gap-4">
          {filteredQuotes.map((quote) => (
            <Card key={quote.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">#{quote.quote_number}</h3>
                    <Badge className={getStatusColor(quote.status)}>
                      {getStatusLabel(quote.status)}
                    </Badge>
                    <Badge variant="outline">{quote.marketing_channel}</Badge>
                    <Badge variant="outline">{quote.account_type}</Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium text-primary">{quote.client_name}</p>
                    <p className="text-sm text-muted-foreground">{quote.client_email}</p>
                    <p className="text-sm">{quote.service_description}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Solicitada: {new Date(quote.request_date).toLocaleDateString()}
                    </div>
                    {quote.quote_sent_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Enviada: {new Date(quote.quote_sent_at).toLocaleDateString()}
                      </div>
                    )}
                    {quote.final_decision_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Decisión: {new Date(quote.final_decision_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right space-y-2">
                  {quote.estimated_amount && (
                    <div className="flex items-center gap-1 text-lg font-bold text-green-600">
                      <DollarSign className="h-4 w-4" />
                      {formatCurrency(quote.estimated_amount)}
                    </div>
                  )}
                  <Button size="sm" variant="outline">
                    <Eye className="h-4 w-4 mr-1" />
                    Ver detalles
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          
          {filteredQuotes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || statusFilter !== 'all' 
                ? 'No se encontraron cotizaciones con ese criterio' 
                : 'No hay cotizaciones registradas'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}