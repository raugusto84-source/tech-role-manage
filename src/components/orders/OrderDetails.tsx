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
import { ArrowLeft, Camera, User, Calendar, DollarSign, Clock, Wrench, MessageSquare, Star, Trophy, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { OrderChat } from '@/components/orders/OrderChat';
import { OrderServicesList } from '@/components/orders/OrderServicesList';
import { SatisfactionSurvey } from './SatisfactionSurvey';
import { calculateAdvancedDeliveryDate } from '@/utils/workScheduleCalculator';

interface OrderDetailsProps {
  order: {
    id: string;
    order_number: string;
    client_id: string;
    service_type: string;
    failure_description: string;
    requested_date?: string;
    delivery_date: string;
    estimated_cost?: number;
    average_service_time?: number;
    status: 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada' | 'en_camino';
    assigned_technician?: string;
    assignment_reason?: string;
    evidence_photos?: string[];
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

  useEffect(() => {
    loadOrderNotes();
    loadOrderItems();
    checkSurveyStatus();
    loadAssignedTechnician();
    updateOrderStatus();
  }, [order.id]);

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
      
      // NO mostrar automáticamente la encuesta, solo marcar si existe
      setShowSurvey(false);
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
      case 'pendiente': return 'bg-yellow-100 text-yellow-800';
      case 'en_proceso': return 'bg-blue-100 text-blue-800';
      case 'finalizada': return 'bg-green-100 text-green-800';
      case 'cancelada': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const updateOrderStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('status')
        .eq('id', order.id)
        .single();

      if (error) throw error;
      
      if (data && data.status !== orderStatus) {
        setOrderStatus(data.status);
        // Recargar los datos si el estado cambió
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  // Si se debe mostrar la encuesta, mostrarla en lugar del detalle
  if (showSurvey && canSeeSurvey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SatisfactionSurvey
          orderId={order.id}
          onComplete={() => {
            setSurveyCompleted(true);
            setShowSurvey(false);
          }}
          onCancel={() => setShowSurvey(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button variant="ghost" onClick={onBack} className="mr-4">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{order.order_number}</h1>
              <p className="text-muted-foreground">Orden de Servicio</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(orderStatus)} variant="outline">
              {orderStatus.replace('_', ' ').toUpperCase()}
            </Badge>
            
            {canSeeSurvey && (
              <Button 
                onClick={() => setShowSurvey(true)}
                className="flex items-center gap-2 animate-pulse bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/25"
                variant="default"
              >
                <Star size={16} className="animate-bounce" />
                Evaluar Servicio
              </Button>
            )}
            
            {isEarlyCompletion && (
              <div className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-2 rounded-md animate-bounce">
                <Clock size={16} className="text-green-600" />
                <span className="text-sm font-medium">¡Completado antes de tiempo!</span>
              </div>
            )}
            
          </div>
        </div>

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
              </CardContent>
            </Card>

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
                    {formatDate(order.delivery_date)}
                  </p>
                  {order.average_service_time && order.created_at && (
                    <p className="text-sm text-blue-600 font-medium flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Hora estimada: {(() => {
                        const primarySchedule = {
                          work_days: [1, 2, 3, 4, 5],
                          start_time: '08:00',
                          end_time: '17:00',
                          break_duration_minutes: 60
                        };
                        
                        // Simular items de orden para el cálculo
                        const mockOrderItems = [{
                          id: 'mock',
                          estimated_hours: order.average_service_time,
                          shared_time: false,
                          status: 'pendiente' as const
                        }];
                        
                        const { deliveryTime, breakdown } = calculateAdvancedDeliveryDate({
                          orderItems: mockOrderItems,
                          primaryTechnicianSchedule: primarySchedule,
                          creationDate: new Date(order.created_at)
                        });
                        return `${deliveryTime} (${breakdown})`;
                      })()}
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
                onItemUpdate={() => {
                  loadOrderItems();
                  setTimeout(updateOrderStatus, 1000); // Verificar estado después de un segundo
                }}
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
                  <Label className="text-sm font-medium text-muted-foreground">Fecha de Entrega</Label>
                  <p className="text-foreground">{formatDate(order.delivery_date)}</p>
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

            {/* Chat de la Orden - visible solo cuando la orden está activa */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2 text-primary" />
                  Chat de la Orden
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Se deshabilita cuando la orden NO está activa (finalizada/cancelada) */}
                <OrderChat orderId={order.id} disabled={!['pendiente','en_proceso'].includes(orderStatus)} />
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