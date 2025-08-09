import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Trash2, Calendar, DollarSign, User } from 'lucide-react';

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  service_description: string;
  estimated_amount: number;
  status: 'solicitud' | 'enviada' | 'aceptada' | 'rechazada' | 'seguimiento';
  request_date: string;
  created_at: string;
  salesperson_name?: string;
}

interface QuoteCardProps {
  quote: Quote;
  getStatusColor: (status: string) => string;
  onViewDetails: () => void;
  onDelete: () => void;
  canManage: boolean;
}

/**
 * Tarjeta de cotización
 * Muestra información resumida de una cotización con acciones disponibles
 * Componente reutilizable para listas de cotizaciones
 */
export function QuoteCard({ quote, getStatusColor, onViewDetails, onDelete, canManage }: QuoteCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'solicitud': return 'Nueva';
      case 'enviada': return 'Enviada';
      case 'aceptada': return 'Aceptada';
      case 'rechazada': return 'Rechazada';
      default: return status;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg">{quote.quote_number}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <User className="h-4 w-4" />
              <span>{quote.client_name}</span>
            </div>
          </div>
          <Badge className={`${getStatusColor(quote.status)} border`}>
            {getStatusText(quote.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium mb-1">Descripción del Servicio</p>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {quote.service_description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Valor Estimado</p>
              <p className="text-sm font-medium">
                {quote.estimated_amount ? formatCurrency(quote.estimated_amount) : 'Por definir'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Fecha de Solicitud</p>
              <p className="text-sm font-medium">{formatDate(quote.request_date)}</p>
            </div>
          </div>
        </div>

        {quote.salesperson_name && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Vendedor: {quote.salesperson_name}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t">
        <div className="flex gap-2 w-full">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onViewDetails}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Detalles
          </Button>
          
          {canManage && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}