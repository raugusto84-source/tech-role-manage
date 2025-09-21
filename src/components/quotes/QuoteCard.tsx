import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Trash2, Calendar, DollarSign, User } from 'lucide-react';
import { formatCOPCeilToTen } from '@/utils/currency';
interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  service_description: string;
  estimated_amount: number;
  status: 'solicitud' | 'enviada' | 'aceptada' | 'rechazada' | 'seguimiento' | 'pendiente_aprobacion';
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
  const formatCurrency = (amount: number) => formatCOPCeilToTen(amount);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'Pendiente';
      case 'solicitud': return 'Nueva';
      case 'enviada': return 'Enviada';
      case 'aceptada': return 'Aceptada';
      case 'rechazada': return 'Rechazada';
      default: return status;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base truncate">{quote.quote_number}</h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{quote.client_name}</span>
            </div>
          </div>
          <Badge className={`${getStatusColor(quote.status)} border text-xs`}>
            {getStatusText(quote.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="py-2 space-y-2">
        <div>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {quote.service_description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-green-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">
                {quote.estimated_amount ? formatCurrency(quote.estimated_amount) : 'Por definir'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-blue-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{formatDate(quote.request_date)}</p>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-2 pb-2">
        <div className="flex gap-1 w-full">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onViewDetails}
            className="flex-1 h-7 text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            Ver
          </Button>
          
          {canManage && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onDelete}
              className="text-destructive hover:text-destructive h-7 px-2"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}