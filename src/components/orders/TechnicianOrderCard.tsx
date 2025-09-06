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
import { MapPin, User, Wrench, ChevronRight, CheckCircle, RotateCcw, CheckCheck, Home } from 'lucide-react';
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
    is_home_service?: boolean;
    service_location?: any;
    travel_time_hours?: number;
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
  onMarkAsPending?: () => void;
  onMarkAsCompleted?: () => void;
  showQuickActions?: boolean;
}

export function TechnicianOrderCard({ 
  order, 
  onClick, 
  onAccept, 
  showAcceptButton = false,
  onMarkAsPending,
  onMarkAsCompleted,
  showQuickActions = false
}: TechnicianOrderCardProps) {
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

  /**
   * Maneja el clic en marcar como pendiente
   */
  const handleMarkAsPendingClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkAsPending) {
      onMarkAsPending();
    }
  };

  /**
   * Maneja el clic en marcar como terminada
   */
  const handleMarkAsCompletedClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkAsCompleted) {
      onMarkAsCompleted();
    }
  };

  return (
    <Card 
      className="hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98] border-l-4 border-l-primary"
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header móvil */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">
              {order.order_number}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatDate(order.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
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
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="font-medium text-base truncate">
              {order.clients?.name || 'Cliente no especificado'}
            </span>
          </div>
          
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {order.clients?.address || 'Dirección no especificada'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wrench className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {order.service_types?.name || 'Servicio no especificado'}
              </span>
            </div>
            {order.is_home_service && (
              <div className="flex items-center gap-1 text-blue-600 flex-shrink-0">
                <Home className="h-4 w-4" />
                <span className="text-sm font-medium">Domicilio</span>
              </div>
            )}
          </div>
        </div>

        {/* Descripción del problema */}
        <div className="bg-muted/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {truncateText(order.failure_description, 120)}
          </p>
        </div>

        {/* Fecha de entrega y botones de acción */}
        <div className="flex flex-col gap-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-muted-foreground block">
                Entrega programada
              </span>
              <span className="text-sm font-medium">
                {formatDate(order.delivery_date)}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2 w-full">
            {showAcceptButton && (
              <Button
                onClick={handleAcceptClick}
                className="bg-green-600 hover:bg-green-700 text-white gap-2 flex-1 h-10"
              >
                <CheckCircle className="h-4 w-4" />
                Aceptar
              </Button>
            )}

            {showQuickActions && (
              <>
                <Button
                  variant="outline"
                  onClick={handleMarkAsPendingClick}
                  className="gap-2 flex-1 h-10 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Pendiente
                </Button>
                <Button
                  onClick={handleMarkAsCompletedClick}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2 flex-1 h-10"
                >
                  <CheckCheck className="h-4 w-4" />
                  Terminar
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}