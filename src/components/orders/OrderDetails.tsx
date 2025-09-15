import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Calendar, DollarSign, Clock, Wrench, Shield, Plus, Signature, ChevronDown, ChevronUp, Home, MapPin, Star, CheckCircle, PenTool, Monitor } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { OrderServicesList } from '@/components/orders/OrderServicesList';
import { SatisfactionSurvey } from './SatisfactionSurvey';
import { SimpleOrderApproval } from './SimpleOrderApproval';
import { DeliverySignature } from './DeliverySignature';
import { WarrantyCard } from '@/components/warranty/WarrantyCard';
import { formatHoursAndMinutes } from '@/utils/timeUtils';
import { AddOrderItemsDialog } from './AddOrderItemsDialog';
import { useRewardSettings } from '@/hooks/useRewardSettings';
import { formatCOPCeilToTen, ceilToTen } from '@/utils/currency';
import { SignatureViewer } from './SignatureViewer';
import { EquipmentList } from './EquipmentList';
import { useSalesPricingCalculation } from '@/hooks/useSalesPricingCalculation';

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
    status: 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada' | 'en_camino' | 'pendiente_aprobacion' | 'pendiente_entrega' | 'pendiente_actualizacion';
    assigned_technician?: string;
    assignment_reason?: string;
    evidence_photos?: string[];
    created_at: string;
    is_home_service?: boolean;
    service_location?: any;
    travel_time_hours?: number;
    cashback_applied?: boolean;
    cashback_amount_used?: number;
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
  const navigate = useNavigate();
  const { settings: rewardSettings } = useRewardSettings();
  const { getDisplayPrice } = useSalesPricingCalculation();
  const [loading, setLoading] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [surveyData, setSurveyData] = useState<any>(null);
  const [assignedTechnician, setAssignedTechnician] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState(order.status);
  const [hasAuthorization, setHasAuthorization] = useState(false);
  const [showAddItemsDialog, setShowAddItemsDialog] = useState(false);
  const [showDeliverySignature, setShowDeliverySignature] = useState(false);
  const [authorizationSignatures, setAuthorizationSignatures] = useState<any[]>([]);
  const [signaturesLoading, setSignaturesLoading] = useState(false);
  const [orderEquipment, setOrderEquipment] = useState<any[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    details: false,
    services: true,
    equipment: false,
    chat: false,
    warranties: false,
    signatures: false
  });

  useEffect(() => {
    loadOrderItems();
    loadOrderEquipment();
    loadAssignedTechnician();
    checkExistingAuthorization();
    checkSurveyStatus();
    loadAuthorizationSignatures();
    
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
          if (payload.new.status !== orderStatus) {
            setOrderStatus(payload.new.status);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [order.id]);

  useEffect(() => {
    checkSurveyStatus();
    checkExistingAuthorization();
  }, [orderStatus]);

  const loadAuthorizationSignatures = async () => {
    try {
      setSignaturesLoading(true);
      const { data, error } = await supabase
        .from('order_authorization_signatures')
        .select('*')
        .eq('order_id', order.id)
        .order('signed_at', { ascending: false });

      if (error) throw error;
      setAuthorizationSignatures(data || []);
    } catch (error) {
      console.error('Error loading authorization signatures:', error);
    } finally {
      setSignaturesLoading(false);
    }
  };

  const checkExistingAuthorization = async () => {
    try {
      if (orderStatus === 'pendiente_actualizacion') {
        const { data: modificationData } = await supabase
          .from('order_modifications')
          .select('id')
          .eq('order_id', order.id)
          .is('client_approved', null)
          .limit(1)
          .maybeSingle();
        
        setHasAuthorization(!modificationData);
      } else if (orderStatus === 'pendiente_aprobacion') {
        const { data } = await supabase
          .from('order_authorization_signatures')
          .select('id')
          .eq('order_id', order.id)
          .limit(1)
          .maybeSingle();
        
        setHasAuthorization(!!data);
      } else {
        setHasAuthorization(true);
      }
    } catch (error) {
      console.error('Error checking authorization:', error);
      setHasAuthorization(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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
      setItemsLoading(true);
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          service_name,
          service_description,
          quantity,
          unit_cost_price,
          unit_base_price, 
          vat_rate,
          item_type,
          profit_margin_rate,
          pricing_locked,
          total_amount,
          status
        `)
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrderItems(data || []);
    } catch (error) {
      console.error('Error loading order items:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const loadOrderEquipment = async () => {
    try {
      setEquipmentLoading(true);
      const { data, error } = await supabase
        .from('order_equipment')
        .select(`
          *,
          equipment_categories (
            name,
            icon
          )
        `)
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrderEquipment(data || []);
    } catch (error) {
      console.error('Error loading order equipment:', error);
    } finally {
      setEquipmentLoading(false);
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
      
      if (!data && orderStatus === 'finalizada') {
        setShowSurvey(true);
      }
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

  const getEstimatedHours = () => {
    const totalHours = orderItems.reduce((sum, item) => {
      return sum + ((item.estimated_hours || 2) * (item.quantity || 1));
    }, 0);
    return totalHours > 0 ? totalHours : (order.average_service_time || 4);
  };

  // Calcula el precio correcto por item usando la lógica unificada de Ventas
  const calculateItemDisplayPrice = (item: any): number => {
    // Respetar total guardado solo si viene bloqueado o faltan datos clave
    const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
    const isLocked = Boolean(item.pricing_locked);
    const missingKeyData = (item.item_type === 'servicio')
      ? (!item.unit_base_price || item.unit_base_price <= 0)
      : (!item.unit_cost_price || item.unit_cost_price <= 0);

    if (hasStoredTotal && (isLocked || missingKeyData)) {
      return Number(item.total_amount);
    }

    const quantity = item.quantity || 1;
    const serviceForPricing = {
      id: item.service_type_id || item.id,
      name: item.service_name || '',
      base_price: item.unit_base_price,
      cost_price: item.unit_cost_price,
      vat_rate: item.vat_rate,
      item_type: item.item_type,
      profit_margin_tiers: item.profit_margin_tiers || (item as any).profit_margin_rate ? [{ min_qty: 1, max_qty: 999, margin: (item as any).profit_margin_rate }] : null
    } as any;

    return getDisplayPrice(serviceForPricing, quantity);
  };

  const calculateTotalAmount = () => {
    if (itemsLoading) {
      return 0; // No mostrar nada mientras carga
    }
    
    if (orderItems && orderItems.length > 0) {
      // Sumar el total de CADA tarjeta: redondear cada item a 10 y luego sumar
      return orderItems.reduce((sum, item) => {
        const itemTotal = calculateItemDisplayPrice(item);
        return sum + ceilToTen(itemTotal);
      }, 0);
    }
    
    // Solo usar estimated_cost como último recurso - aplicar IVA y redondear a 10
    const defaultVatRate = 16;
    const base = order.estimated_cost || 0;
    return ceilToTen(base * (1 + defaultVatRate / 100));
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'bg-warning/10 text-warning border-warning/20';
      case 'pendiente_actualizacion': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'pendiente': return 'bg-info/10 text-info border-info/20';
      case 'en_proceso': return 'bg-info/10 text-info border-info/20';
      case 'en_camino': return 'bg-info/10 text-info border-info/20';
      case 'pendiente_entrega': return 'bg-orange/10 text-orange border-orange/20';
      case 'finalizada': return 'bg-success/10 text-success border-success/20';
      case 'cancelada': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const isClient = profile?.role === 'cliente';
  const canModifyOrder = (profile?.role === 'administrador' || profile?.role === 'vendedor') && 
                         ['pendiente', 'en_proceso'].includes(orderStatus);
  
  // Only allow signing delivery when order is completely finished (all items completed and status is pendiente_entrega)
  const allItemsCompleted = orderItems.length > 0 && orderItems.every(item => item.status === 'finalizada');
  const canSignDelivery = ((isClient && orderStatus === 'pendiente_entrega' && allItemsCompleted) || 
                          (profile?.role === 'administrador' && ['pendiente_entrega', 'finalizada'].includes(orderStatus)));

  // Si es cliente y la orden está pendiente de aprobación/actualización sin autorización
  if (isClient && (orderStatus === 'pendiente_aprobacion' || orderStatus === 'pendiente_actualizacion') && !hasAuthorization) {
    return (
      <SimpleOrderApproval
        order={order}
        orderItems={orderItems}
        onBack={onBack}
        onApprovalComplete={() => {
          onBack();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto">
        {/* Header Compacto */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 z-10">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{order.order_number}</h1>
            </div>
            {canSignDelivery && (
              <Button size="sm" onClick={() => setShowDeliverySignature(true)}>
                <Signature className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <Badge className={getStatusColor(orderStatus)} variant="outline">
              {orderStatus === 'pendiente_actualizacion' ? 'PENDIENTE' 
               : orderStatus === 'pendiente_entrega' ? 'LISTO'
               : orderStatus === 'pendiente_aprobacion' ? 'PENDIENTE APROBACIÓN'
               : ['en_proceso', 'pendiente'].includes(orderStatus) ? 'EN PROCESO'
               : orderStatus.replace('_', ' ').toUpperCase()}
            </Badge>
            
            <div className="text-sm text-muted-foreground">
              {formatDate(order.created_at)}
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="p-4 space-y-4">
          {/* Cliente y Resumen */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <User className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {order.clients?.name || 'Cliente no especificado'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {order.clients?.client_number}
                  </div>
                  {order.is_home_service && (
                    <div className="flex items-center gap-1 mt-1">
                      <Home className="h-3 w-3 text-blue-600" />
                      <span className="text-xs text-blue-600">Domicilio</span>
                    </div>
                  )}
                </div>
                
                <div className="text-right text-sm">
                  <div className="text-xs text-muted-foreground mb-1">Total con IVA:</div>
                  <div className="font-bold text-primary">
                    {itemsLoading ? (
                      <Skeleton className="h-4 w-16 rounded" />
                    ) : (
                      formatCOPCeilToTen(calculateTotalAmount())
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getEstimatedHours()}h est.
                  </div>
                </div>
              </div>

              {/* Detalles colapsables */}
              <button 
                onClick={() => toggleSection('details')}
                className="flex items-center justify-between w-full text-left text-sm text-muted-foreground border-t border-border pt-3"
              >
                <span>Ver detalles</span>
                {expandedSections.details ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {expandedSections.details && (
                <div className="mt-3 space-y-2 text-sm border-l-2 border-border pl-3">
                  {order.clients?.email && (
                    <div>Email: {order.clients.email}</div>
                  )}
                  {order.clients?.phone && (
                    <div>Teléfono: {order.clients.phone}</div>
                  )}
                  {order.clients?.address && (
                    <div>Dirección: {order.clients.address}</div>
                  )}
                  {assignedTechnician && (
                    <div>Técnico: {assignedTechnician.full_name}</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Problema */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Wrench className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-sm mb-1">
                    {order.service_types?.name || 'Servicio no especificado'}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-3">
                    {order.failure_description}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Servicios y Productos */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  <span className="font-medium">Servicios</span>
                </div>
                {canModifyOrder && (
                  <Button
                    onClick={() => setShowAddItemsDialog(true)}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <button 
                onClick={() => toggleSection('services')}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-sm text-muted-foreground">
                  {orderItems.length} item{orderItems.length !== 1 ? 's' : ''}
                </span>
                {expandedSections.services ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {expandedSections.services && (
                <div className="mt-3">
                  <OrderServicesList 
                    orderItems={orderItems} 
                    canEdit={canModifyOrder || ['en_proceso', 'pendiente'].includes(orderStatus)}
                    onItemUpdate={loadOrderItems}
                    showReadyButtons={['en_proceso', 'pendiente'].includes(orderStatus)}
                    orderId={order.id}
                    onBack={onBack}
                  />
                  
                  {/* Total General */}
                  {orderItems.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-muted-foreground">Total General:</span>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                          {itemsLoading ? (
                            <Skeleton className="h-6 w-24 rounded" />
                          ) : (
                            <span className="text-lg font-bold text-primary">
                              {formatCOPCeilToTen(calculateTotalAmount())}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                </div>
              )}
              
              {/* Cashback aplicado */}
              {order.cashback_applied && order.cashback_amount_used && (
                <div className="mt-3 p-2 bg-success/10 border border-success/20 rounded text-xs text-success">
                  Descuento: -{formatCOPCeilToTen(order.cashback_amount_used)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Equipos */}
          <Card>
            <CardContent className="p-4">
              <button 
                onClick={() => toggleSection('equipment')}
                className="flex items-center justify-between w-full text-left mb-3"
              >
                <div className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  <span className="font-medium">Equipos</span>
                </div>
                {expandedSections.equipment ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {expandedSections.equipment && (
                <div className="mt-3">
                  <EquipmentList
                    orderId={order.id}
                    equipment={orderEquipment}
                    onUpdate={loadOrderEquipment}
                    canEdit={canModifyOrder || ['en_proceso', 'pendiente', 'pendiente_aprobacion'].includes(orderStatus)}
                  />
                </div>
              )}
            </CardContent>
          </Card>


          {/* Botón Terminar Todo - Hidden for clients */}
          {!isClient && ['en_proceso', 'pendiente'].includes(orderStatus) && orderItems.length > 0 && orderItems.some(item => item.status !== 'finalizada') && (
            <Card>
              <CardContent className="p-4">
                <Button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      // Mark all non-finished items as finished
                      const { error: itemsError } = await supabase
                        .from('order_items')
                        .update({ status: 'finalizada' })
                        .eq('order_id', order.id)
                        .neq('status', 'finalizada');

                      if (itemsError) throw itemsError;

                      // Update order status to pendiente_entrega
                      const { error: orderError } = await supabase
                        .from('orders')
                        .update({ status: 'pendiente_entrega' })
                        .eq('id', order.id);

                      if (orderError) throw orderError;

                      toast({
                        title: 'Orden terminada',
                        description: 'Todos los servicios han sido completados y la orden está lista para entrega.',
                      });

                      // Navigate back to all orders
                      onBack();
                    } catch (error) {
                      console.error('Error finishing all items:', error);
                      toast({
                        title: 'Error',
                        description: 'No se pudo finalizar todos los servicios.',
                        variant: 'destructive',
                      });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="w-full"
                  disabled={loading}
                  variant="default"
                  size="lg"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Terminar Todo
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Garantías */}
          {orderItems.length > 0 && orderStatus === 'finalizada' && (
            <Card>
              <CardContent className="p-4">
                <button 
                  onClick={() => toggleSection('warranties')}
                  className="flex items-center justify-between w-full text-left mb-3"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="font-medium">Garantías</span>
                  </div>
                  {expandedSections.warranties ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                
                {expandedSections.warranties && (
                  <div className="space-y-2">
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
                        showClaimButton={isClient}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Firmas de Autorización */}
          {authorizationSignatures.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <button 
                  onClick={() => toggleSection('signatures')}
                  className="flex items-center justify-between w-full text-left mb-3"
                >
                  <div className="flex items-center gap-2">
                    <PenTool className="h-5 w-5 text-primary" />
                    <span className="font-medium">Firmas de Autorización ({authorizationSignatures.length})</span>
                  </div>
                  {expandedSections.signatures ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                
                {expandedSections.signatures && (
                  <SignatureViewer 
                    signatures={authorizationSignatures} 
                    loading={signaturesLoading}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Encuesta de Satisfacción */}
          {surveyData && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-5 w-5 text-primary" />
                  <span className="font-medium">Evaluación</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Conocimientos:</span>
                    <span className="font-medium">{surveyData.technician_knowledge || 0}/5</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Atención:</span>
                    <span className="font-medium">{surveyData.technician_customer_service || 0}/5</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Actitud:</span>
                    <span className="font-medium">{surveyData.technician_attitude || 0}/5</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recomendación:</span>
                    <span className="font-medium">{surveyData.overall_recommendation || 0}/5</span>
                  </div>
                </div>
                
                {(surveyData.technician_comments || surveyData.general_comments) && (
                  <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                    {surveyData.technician_comments && (
                      <div>Técnico: {surveyData.technician_comments}</div>
                    )}
                    {surveyData.general_comments && (
                      <div>General: {surveyData.general_comments}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Botones de Finalizar y Firmar al final */}
      {(() => {
        const allItemsCompleted = orderItems.length > 0 && orderItems.every(item => item.status === 'finalizada');
        const canFinishOrder = !isClient && allItemsCompleted && ['en_proceso', 'pendiente'].includes(orderStatus);
        const canSignDelivery = ((isClient && orderStatus === 'pendiente_entrega' && allItemsCompleted) || 
                                (profile?.role === 'administrador' && ['pendiente_entrega', 'finalizada'].includes(orderStatus)));
        
        if (canFinishOrder || canSignDelivery) {
          return (
            <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 z-20">
              <div className="max-w-md mx-auto space-y-3">
                {canFinishOrder && (
                  <Button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const { error } = await supabase
                          .from('orders')
                          .update({ status: 'pendiente_entrega' })
                          .eq('id', order.id);

                        if (error) throw error;

                        toast({
                          title: 'Orden finalizada',
                          description: 'La orden ha sido marcada como lista para entrega.',
                        });

                        setOrderStatus('pendiente_entrega');
                        onUpdate();
                      } catch (error) {
                        console.error('Error finishing order:', error);
                        toast({
                          title: 'Error',
                          description: 'No se pudo finalizar la orden.',
                          variant: 'destructive',
                        });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full"
                    disabled={loading}
                    variant="default"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalizar Orden
                  </Button>
                )}
                
                {canSignDelivery && (
                  <Button
                    onClick={() => setShowDeliverySignature(true)}
                    className="w-full"
                    variant="default"
                  >
                    <Signature className="h-4 w-4 mr-2" />
                    Firmar Entrega
                  </Button>
                )}
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Espacio para botones fijos */}
      <div className="h-20"></div>

      {/* Encuesta de Satisfacción */}
      {isClient && orderStatus === 'finalizada' && !surveyCompleted && showSurvey && (
        <SatisfactionSurvey
          orderId={order.id}
          onComplete={() => {
            setSurveyCompleted(true);
            setShowSurvey(false);
            checkSurveyStatus();
          }}
          onCancel={() => setShowSurvey(false)}
        />
      )}

      {/* Modal para agregar items */}
      {showAddItemsDialog && (
        <AddOrderItemsDialog
          open={showAddItemsDialog}
          onOpenChange={setShowAddItemsDialog}
          orderId={order.id}
          orderNumber={order.order_number}
          onItemsAdded={() => {
            setShowAddItemsDialog(false);
            loadOrderItems();
            loadAuthorizationSignatures(); // Recargar firmas en caso de cambios
            onUpdate();
          }}
        />
      )}

      {/* Modal de firma de entrega */}
      {showDeliverySignature && (
        <DeliverySignature
          order={order}
          onClose={() => setShowDeliverySignature(false)}
          onComplete={() => {
            setShowDeliverySignature(false);
            loadAuthorizationSignatures(); // Recargar firmas después de firmar entrega
            // If client, redirect to orders list, otherwise just update
            if (isClient) {
              navigate('/orders');
            } else {
              onUpdate();
            }
          }}
        />
      )}
    </div>
  );
}