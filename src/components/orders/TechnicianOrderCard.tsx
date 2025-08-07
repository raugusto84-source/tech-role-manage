/**
 * TARJETA DE ORDEN PARA TÉCNICO - COMPONENTE REUTILIZABLE
 * 
 * Características:
 * - Optimizada para móviles (touch-friendly)
 * - Información esencial visible de inmediato
 * - Indicadores visuales de estado claros
 * - Diseño compacto para listas largas
 * 
 * Reutilización:
 * - Puede usarse en cualquier vista de técnico
 * - Fácil de extender con nuevas funcionalidades
 * - Consistente con el design system
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, User, Wrench, ChevronRight, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TechnicianOrderCardProps {
  order: {
    id: string;
    order_number: string;
    client_id: string;
    service_type: string;
    failure_description: string;
    delivery_date: string;
    status: 'pendiente' | 'en_camino' | 'en_proceso' | 'finalizada' | 'cancelada';
    created_at: string;
    service_types?: {
      name: string;
      description?: string;
    } | null;
    clients?: {
      name: string;
      client_number: string;
      email: string;
      phone?: string;
      address: string;
    } | null;
  };
  onClick: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export function TechnicianOrderCard({ order, onClick, onAccept, showAcceptButton = false }: TechnicianOrderCardProps) {
  /**
   * Formatea fecha para visualización compacta
   */
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yy', { locale: es });
    } catch {
      return dateString;
    }
  };

  /**
   * Obtiene color del estado - misma lógica que el dashboard
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'en_camino': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'en_proceso': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'finalizada': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelada': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  /**
   * Obtiene etiqueta del estado en español
   */
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pendiente': return 'Pendiente';
      case 'en_camino': return 'En Camino';
      case 'en_proceso': return 'En Proceso';
      case 'finalizada': return 'Terminado';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  /**
   * Trunca descripción para tarjetas compactas
   */
  const truncateText = (text: string, maxLength: number = 80) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  /**
   * Maneja el clic en aceptar orden
   */
  const handleAcceptClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAccept) {
      onAccept();
    }
  };

  return (
    <Card 
      className="hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98] border-l-4 border-l-primary"
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header con número de orden y estado */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">
              {order.order_number}
            </h3>
            <p className="text-sm text-muted-foreground">
              Creada: {formatDate(order.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Badge 
              className={`text-xs px-2 py-1 ${getStatusColor(order.status)}`}
              variant="outline"
            >
              {getStatusLabel(order.status)}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Información del cliente */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center text-sm">
            <User className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
            <span className="font-medium truncate">
              {order.clients?.name || 'Cliente no especificado'}
            </span>
          </div>
          
          <div className="flex items-start text-sm">
            <MapPin className="h-4 w-4 mr-2 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground line-clamp-2 leading-tight">
              {order.clients?.address || 'Dirección no especificada'}
            </span>
          </div>

          <div className="flex items-center text-sm">
            <Wrench className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
            <span className="text-muted-foreground truncate">
              {order.service_types?.name || 'Servicio no especificado'}
            </span>
          </div>
        </div>

        {/* Descripción del problema */}
        <div className="bg-muted/50 rounded-md p-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {truncateText(order.failure_description)}
          </p>
        </div>

        {/* Fecha de entrega y botón aceptar */}
        <div className="flex justify-between items-center mt-3 pt-2 border-t border-border">
          <div>
            <span className="text-xs text-muted-foreground">
              Entrega programada:
            </span>
            <span className="text-xs font-medium block">
              {formatDate(order.delivery_date)}
            </span>
          </div>
          
          {showAcceptButton && (
            <Button
              size="sm"
              onClick={handleAcceptClick}
              className="bg-green-600 hover:bg-green-700 text-white gap-1 h-8 px-3"
            >
              <CheckCircle className="h-3 w-3" />
              Aceptar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}