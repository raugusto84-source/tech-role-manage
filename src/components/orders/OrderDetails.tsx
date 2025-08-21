import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Camera, User, Calendar, DollarSign, Clock, Wrench, MessageSquare, Star, Trophy, CheckCircle2, Home, MapPin, Shield, Plus } from 'lucide-react';
import { TechnicianPhotoCapture } from './TechnicianPhotoCapture';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { OrderChat } from '@/components/orders/OrderChat';
import { OrderServicesList } from '@/components/orders/OrderServicesList';
import { SatisfactionSurvey } from './SatisfactionSurvey';
import { ClientOrderApproval } from './ClientOrderApproval';
import { AuthorizationSignature } from './AuthorizationSignature';
import { DeliverySignature } from './DeliverySignature';
import { SimpleSatisfactionSurvey } from './SimpleSatisfactionSurvey';
import { calculateAdvancedDeliveryDate } from '@/utils/workScheduleCalculator';
import { WarrantyCard } from '@/components/warranty/WarrantyCard';
import { AddItemsToOrder } from './AddItemsToOrder';
import { OrderModificationApproval } from './OrderModificationApproval';

interface OrderDetailsProps {
  order: {
    id: string;
    order_number: string;
    client_id: string;
    service_type: string;
    failure_description: string;
    requested_date?: string;
    delivery_date: string;
    estimated_delivery_date?: string | null;
    estimated_cost?: number;
    average_service_time?: number;
    status: 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada' | 'en_camino' | 'pendiente_aprobacion' | 'pendiente_entrega';
    assigned_technician?: string;
    assignment_reason?: string;
    evidence_photos?: string[];
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
  onBack: () => void;
  onUpdate: () => void;
}

export function OrderDetails({ order, onBack, onUpdate }: OrderDetailsProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [orderNotes, setOrderNotes] = useState<any[]>([]);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [surveyData, setSurveyData] = useState<any>(null);
  const [assignedTechnician, setAssignedTechnician] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [orderStatus, setOrderStatus] = useState(order.status);
  const [currentUnreadCount, setCurrentUnreadCount] = useState(0);
  const [deliveryPhase, setDeliveryPhase] = useState<'signature' | 'survey' | 'completed'>('signature');
  const [hasDeliverySignature, setHasDeliverySignature] = useState(false);
  const [hasCompletedSurvey, setHasCompletedSurvey] = useState(false);
  const [deliveryStatusChecked, setDeliveryStatusChecked] = useState(false);
  const [authorizationSignature, setAuthorizationSignature] = useState<any>(null);
  const [showAddItems, setShowAddItems] = useState(false);
  const [pendingModifications, setPendingModifications] = useState<any[]>([]);

  // Función para actualizar el contador de mensajes no leídos localmente
  const handleMessagesRead = () => {
    console.log('Messages read callback triggered');
    setCurrentUnreadCount(0);
    // Esperar un momento y luego actualizar la lista de órdenes
    setTimeout(() => {
      console.log('Calling onUpdate after messages read');
      onUpdate();
    }, 1000);
  };
  useEffect(() => {
    loadOrderItems();
    loadAssignedTechnician();
    loadAuthorizationSignature();
    loadPendingModifications();
    
    // Solo verificar estado de entrega si es cliente y está pendiente de entrega
    if (profile?.role === 'cliente' && orderStatus === 'pendiente_entrega') {
      checkDeliveryStatus();
    }
    
    // Suscribirse a cambios en tiempo real en la orden
    const channel = supabase
      .channel('order-changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'orders', 
          filter: `id=eq.${order.id}` 
        },
        (payload) => {
          console.log('Order status changed via realtime:', payload);
          if (payload.new.status !== orderStatus) {
            setOrderStatus(payload.new.status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id, profile?.role]); // Agregar profile?.role como dependencia

  // Verificar estado de encuesta cuando cambia el estado de la orden
  useEffect(() => {
    checkSurveyStatus();
  }, [orderStatus, profile?.role, user?.id]);

  // Verificar estado de entrega cuando cambia el estado de la orden a pendiente_entrega
  useEffect(() => {
    if (profile?.role === 'cliente' && orderStatus === 'pendiente_entrega') {
      setDeliveryStatusChecked(false); // Reset para permitir nueva verificación
      checkDeliveryStatus();
    }
  }, [orderStatus, profile?.role]);

  const loadAssignedTechnician = async () => {
    if (order.assigned_technician) {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', order.assigned_technician)
        .maybeSingle();
      
      setAssignedTechnician(data);
    }
  };

  const loadAuthorizationSignature = async () => {
    try {
      const { data, error } = await supabase
        .from('order_authorization_signatures')
        .select('*')
        .eq('order_id', order.id)
        .maybeSingle();

      if (error) throw error;
      setAuthorizationSignature(data);
    } catch (error) {
      console.error('Error loading authorization signature:', error);
    }
  };

  const loadPendingModifications = async () => {
    if (!order?.id) return;
    
    const { data } = await supabase
      .from('order_modifications')
      .select('*')
      .eq('order_id', order.id)
      .is('client_approved', null)
      .order('created_at', { ascending: false });
    
    setPendingModifications(data || []);
  };

  const loadOrderItems = async () => {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrderItems(data || []);
    } catch (error) {
      console.error('Error loading order items:', error);
    }
  };

  const checkSurveyStatus = async () => {
    if (profile?.role === 'cliente' && orderStatus === 'finalizada') {
      const { data } = await supabase
        .from('order_satisfaction_surveys')
        .select('*')
        .eq('order_id', order.id)
        .eq('client_id', user?.id)
        .maybeSingle();
      
      setSurveyCompleted(!!data);
      setSurveyData(data);
      
      // Mostrar automáticamente la encuesta si no existe y la orden está finalizada
      if (!data && orderStatus === 'finalizada') {
        setShowSurvey(true);
      }
    }
  };

  const checkDeliveryStatus = async () => {
    if (orderStatus === 'pendiente_entrega' && profile?.role === 'cliente' && !deliveryStatusChecked) {
      try {
        console.log('Checking delivery status for order:', order.id);
        setDeliveryStatusChecked(true);
        
        // Check if delivery signature exists
        const { data: signature } = await supabase
          .from('delivery_signatures')
          .select('id')
          .eq('order_id', order.id)
          .maybeSingle();

        // Check if survey exists
        const { data: survey } = await supabase
          .from('order_satisfaction_surveys')
          .select('id')
          .eq('order_id', order.id)
          .maybeSingle();

        console.log('Signature exists:', !!signature, 'Survey exists:', !!survey);

        const signatureExists = !!signature;
        const surveyExists = !!survey;

        setHasDeliverySignature(signatureExists);
        setHasCompletedSurvey(surveyExists);

        // Determinar la fase actual
        if (!signatureExists) {
          console.log('Setting delivery phase to signature');
          setDeliveryPhase('signature');
        } else if (!surveyExists) {
          console.log('Setting delivery phase to survey');
          setDeliveryPhase('survey');
        } else {
          console.log('Setting delivery phase to completed');
          setDeliveryPhase('completed');
        }
      } catch (error) {
        console.error('Error checking delivery status:', error);
        setDeliveryStatusChecked(false); // Reset on error
      }
    }
  };

  const loadOrderNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('order_notes')
        .select(`
          *,
          profiles(full_name)
        `)
        .eq('order_id', order.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrderNotes(data || []);
    } catch (error) {
      console.error('Error loading order notes:', error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatTime = (hours?: number) => {
    if (!hours) return 'No estimado';
    return hours % 1 === 0 ? `${hours}h` : `${hours}h`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'bg-warning/10 text-warning border-warning/20';
      case 'pendiente': return 'bg-info/10 text-info border-info/20';
      case 'en_proceso': return 'bg-info/10 text-info border-info/20';
      case 'en_camino': return 'bg-info/10 text-info border-info/20';
      case 'pendiente_entrega': return 'bg-orange/10 text-orange border-orange/20';
      case 'finalizada': return 'bg-success/10 text-success border-success/20';
      case 'cancelada': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const canEdit = profile?.role === 'administrador' || 
                  profile?.role === 'tecnico';

  const canUpdateStatus = profile?.role === 'administrador' || 
                          (profile?.role === 'tecnico' && order.assigned_technician === user?.id);

  const isClient = profile?.role === 'cliente';
  const canSeeSurvey = isClient && orderStatus === 'finalizada' && !surveyCompleted;
  
  // Check if service was completed before estimated time
  const isEarlyCompletion = orderStatus === 'finalizada' && 
    order.average_service_time && 
    order.delivery_date && 
    order.created_at && (() => {
      const startTime = new Date(order.created_at).getTime();
      const endTime = new Date(order.delivery_date).getTime();
      const actualDurationHours = (endTime - startTime) / (1000 * 60 * 60);
      return actualDurationHours < order.average_service_time;
    })();


  // Si es cliente y la orden está pendiente de aprobación inicial, mostrar aprobación de orden completa (PRIORIDAD ALTA)
  if (profile?.role === 'cliente' && orderStatus === 'pendiente_aprobacion' && !authorizationSignature) {
    return (
      <ClientOrderApproval
        order={order}
        onApprovalChange={() => {
          // Solo recargar datos, el trigger de DB se encarga del cambio de estado
          loadAuthorizationSignature();
          onUpdate();
        }}
      />
    );
  }

  // Si es cliente y la orden YA FUE APROBADA inicialmente pero tiene modificaciones pendientes
  if (profile?.role === 'cliente' && orderStatus === 'pendiente_aprobacion' && authorizationSignature && pendingModifications.length > 0) {
    return (
      <OrderModificationApproval
        orderId={order.id}
        clientName={order.clients?.name || ''}
        onApprovalComplete={() => {
          loadPendingModifications();
          onUpdate();
        }}
      />
    );
  }

  // Si es cliente y la orden está pendiente de entrega, mostrar solo firma
  if (profile?.role === 'cliente' && orderStatus === 'pendiente_entrega') {
    if (deliveryPhase === 'signature' && !hasDeliverySignature) {
      return (
        <DeliverySignature
          orderId={order.id}
          clientName={order.clients?.name || ''}
          onSignatureComplete={() => {
            setHasDeliverySignature(true);
            setDeliveryPhase('completed');
            setOrderStatus('finalizada');
            onUpdate();
          }}
        />
      );
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>

            {/* Botón para agregar artículos (para staff y técnicos asignados en órdenes activas) */}
            {profile && (
              (['administrador', 'vendedor'].includes(profile.role) || 
               (profile.role === 'tecnico' && order.assigned_technician === profile.user_id)) && 
              ['pendiente', 'en_proceso', 'en_camino'].includes(orderStatus)
            ) && (
              <Button 
                onClick={() => setShowAddItems(true)} 
                variant="outline" 
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar artículos
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{order.order_number}</h1>
              <p className="text-muted-foreground">Orden de Servicio</p>
            </div>
          
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(orderStatus)} variant="outline">
                {orderStatus.replace('_', ' ').toUpperCase()}
              </Badge>
              
              
              {isEarlyCompletion && (
                <div className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-2 rounded-md animate-bounce">
                  <Clock size={16} className="text-green-600" />
                  <span className="text-sm font-medium">¡Completado antes de tiempo!</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Componente para agregar artículos */}
        {showAddItems && (
          <div className="mb-6">
            <AddItemsToOrder
              orderId={order.id}
              onItemsAdded={() => {
                setShowAddItems(false);
                onUpdate();
                loadPendingModifications();
              }}
              onCancel={() => setShowAddItems(false)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Información Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Información del Cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2 text-primary" />
                  Información del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                    <p className="text-foreground font-medium">
                      {order.clients?.client_number} - {order.clients?.name || 'Cliente no especificado'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <p className="text-foreground">{order.clients?.email || 'No disponible'}</p>
                  </div>
                </div>
                {order.clients?.phone && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Teléfono</Label>
                    <p className="text-foreground">{order.clients.phone}</p>
                  </div>
                )}
                {order.clients?.address && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Dirección</Label>
                    <p className="text-foreground">{order.clients.address}</p>
                  </div>
                 )}
                 
                 {/* Información de servicio a domicilio */}
                 {order.is_home_service && (
                   <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                     <div className="flex items-center gap-2 mb-2">
                       <Home className="h-4 w-4 text-blue-600" />
                       <span className="text-sm font-medium text-blue-800">Servicio a Domicilio</span>
                       {order.travel_time_hours && (
                         <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                           +{order.travel_time_hours}h traslado
                         </Badge>
                       )}
                     </div>
                     {order.service_location && (
                       <div className="text-sm text-blue-700">
                         <div className="flex items-start gap-2">
                           <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                           <div>
                             <span className="font-medium">Ubicación: </span>
                             <span>{order.service_location.address}</span>
                             {order.service_location.latitude && order.service_location.longitude && (
                               <div className="text-xs text-blue-600 mt-1">
                                 GPS: {order.service_location.latitude.toFixed(6)}, {order.service_location.longitude.toFixed(6)}
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                     )}
                   </div>
                 )}
               </CardContent>
            </Card>

            {/* Firma de Autorización */}
            {authorizationSignature && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-success" />
                    Orden Autorizada
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <span className="font-medium text-success">Autorizada por: {authorizationSignature.client_name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Fecha de autorización:</strong> {formatDateTime(authorizationSignature.signed_at)}</p>
                      {authorizationSignature.authorization_notes && (
                        <p><strong>Notas:</strong> {authorizationSignature.authorization_notes}</p>
                      )}
                    </div>
                    {authorizationSignature.client_signature_data && (
                      <div className="mt-4">
                        <Label className="text-sm font-medium">Firma de autorización:</Label>
                        <div className="mt-2 border rounded-lg bg-white p-2 inline-block">
                          <img 
                            src={authorizationSignature.client_signature_data} 
                            alt="Firma de autorización" 
                            className="max-h-24 max-w-48"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Descripción del Problema */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2 text-primary" />
                  Descripción del Problema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{order.failure_description}</p>
              </CardContent>
            </Card>

            {/* Servicios Solicitados */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wrench className="h-5 w-5 mr-2 text-primary" />
                  Servicios y Productos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Servicio Principal</Label>
                  <p className="text-foreground font-medium">
                    {order.service_types?.name || 'Servicio no especificado'}
                  </p>
                  {order.service_types?.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {order.service_types.description}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {order.estimated_cost && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        Costo Total Estimado
                      </Label>
                      <p className="text-foreground font-medium text-lg text-green-600">
                        ${order.estimated_cost.toLocaleString()}
                      </p>
                    </div>
                  )}

                  {order.average_service_time && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        Tiempo Total Estimado
                        {isEarlyCompletion && (
                          <Trophy className="h-4 w-4 ml-2 text-green-600 animate-pulse" />
                        )}
                      </Label>
                      <p className="text-foreground font-medium flex items-center gap-2 text-lg text-blue-600">
                        {formatTime(order.average_service_time)}
                        {isEarlyCompletion && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                            ¡Completado antes de tiempo!
                          </Badge>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Fecha de Entrega */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Fecha de Entrega Estimada
                  </Label>
                  <p className="text-foreground font-medium text-lg text-orange-600">
                    {order.estimated_delivery_date 
                      ? formatDateTime(order.estimated_delivery_date)
                      : formatDate(order.delivery_date)}
                  </p>
                  {order.estimated_delivery_date && (
                    <p className="text-sm text-muted-foreground">
                      Calculado automáticamente basado en servicios y disponibilidad de técnicos
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lista detallada de servicios individuales */}
            {orderItems.length > 0 && (
              <OrderServicesList 
                orderItems={orderItems} 
                canEdit={canUpdateStatus}
                onItemUpdate={loadOrderItems}
              />
            )}

            {/* Evidencia Fotográfica */}
            {order.evidence_photos && order.evidence_photos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Camera className="h-5 w-5 mr-2 text-primary" />
                    Evidencia Fotográfica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {order.evidence_photos.map((photo, index) => (
                      <div key={index} className="aspect-square bg-muted rounded-lg overflow-hidden">
                        <img 
                          src={photo} 
                          alt={`Evidencia ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Panel Lateral */}
          <div className="space-y-6">
            {/* Estado y Fechas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-primary" />
                  Estado y Fechas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Estado Actual</Label>
                  <Badge className={getStatusColor(orderStatus)} variant="outline">
                    {orderStatus.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Fecha Creada</Label>
                  <p className="text-foreground">{formatDateTime(order.created_at)}</p>
                </div>

                {order.requested_date && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Fecha Solicitada</Label>
                    <p className="text-foreground">{formatDate(order.requested_date)}</p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Fecha de Entrega Estimada</Label>
                  <p className="text-foreground">
                    {order.estimated_delivery_date 
                      ? formatDateTime(order.estimated_delivery_date)
                      : formatDate(order.delivery_date)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Técnico Asignado */}
            {(order.assigned_technician || order.assignment_reason) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2 text-primary" />
                    Técnico Asignado
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {assignedTechnician && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Técnico</Label>
                      <p className="text-foreground font-medium">{assignedTechnician.full_name}</p>
                      {assignedTechnician.email && (
                        <p className="text-sm text-muted-foreground">{assignedTechnician.email}</p>
                      )}
                    </div>
                  )}
                  
                  {order.assignment_reason && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Razón de Asignación</Label>
                      <p className="text-foreground text-sm bg-muted/50 p-3 rounded-lg">
                        {order.assignment_reason}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Documentación del Técnico - Fotos con Ubicación */}
            {profile?.role === 'tecnico' && order.assigned_technician === user?.id && (
              <TechnicianPhotoCapture
                orderId={order.id}
                orderNumber={order.order_number}
                onPhotosUpdate={onUpdate}
                onStatusUpdate={(newStatus) => {
                  setOrderStatus(newStatus as any);
                  onUpdate();
                }}
              />
            )}

            {/* Garantías de Servicios */}
            {orderItems.length > 0 && orderStatus === 'finalizada' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-primary" />
                    Garantías
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {orderItems.map((item) => (
                    <WarrantyCard
                      key={item.id}
                      orderItem={{
                        ...item,
                        orders: {
                          order_number: order.order_number,
                          client_id: order.client_id
                        }
                      }}
                      clientId={order.client_id}
                      showClaimButton={profile?.role === 'cliente'}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Chat de la Orden - visible solo cuando la orden está activa */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2 text-primary" />
                  Chat de la Orden
                  {currentUnreadCount > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {currentUnreadCount} nuevo{currentUnreadCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Se deshabilita cuando la orden NO está activa (finalizada/cancelada) */}
                <OrderChat 
                  orderId={order.id} 
                  disabled={!['pendiente','en_proceso'].includes(orderStatus)}
                  onMessagesRead={handleMessagesRead}
                />
              </CardContent>
            </Card>


            {/* Comentarios de la orden */}
            {orderNotes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2 text-primary" />
                    Comentarios
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {orderNotes.map((note) => (
                    <div key={note.id} className="border-l-4 border-l-primary pl-4 py-2">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">
                          {note.profiles?.full_name || 'Usuario desconocido'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(note.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {note.note}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Resultados de la Encuesta de Satisfacción */}
            {surveyData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Star className="h-5 w-5 mr-2 text-primary" />
                    Evaluación de Satisfacción
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Evaluación del Técnico */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">Evaluación del Técnico</h4>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span>Conocimiento Técnico:</span>
                        <div className="flex">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={`${
                                i < (surveyData.technician_knowledge || 0) 
                                  ? 'fill-yellow-400 text-yellow-400' 
                                  : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span>Atención al Cliente:</span>
                        <div className="flex">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={`${
                                i < (surveyData.technician_customer_service || 0) 
                                  ? 'fill-yellow-400 text-yellow-400' 
                                  : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span>Actitud:</span>
                        <div className="flex">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={`${
                                i < (surveyData.technician_attitude || 0) 
                                  ? 'fill-yellow-400 text-yellow-400' 
                                  : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span>¿Recomendarías SYSLAG?:</span>
                        <div className="flex">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={`${
                                i < (surveyData.overall_recommendation || 0) 
                                  ? 'fill-yellow-400 text-yellow-400' 
                                  : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {surveyData.technician_comments && (
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">Comentarios sobre el técnico:</span>
                        <p className="text-sm text-foreground mt-1">{surveyData.technician_comments}</p>
                      </div>
                    )}
                    
                    {surveyData.general_comments && (
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">Comentarios generales:</span>
                        <p className="text-sm text-foreground mt-1">{surveyData.general_comments}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}