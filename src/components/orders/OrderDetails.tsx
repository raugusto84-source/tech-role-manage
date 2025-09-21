import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Calendar, DollarSign, Clock, Wrench, Shield, Plus, Signature, ChevronDown, ChevronUp, Home, MapPin, CheckCircle, PenTool, Monitor } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { OrderServicesList } from '@/components/orders/OrderServicesList';
import { SimpleOrderApproval } from './SimpleOrderApproval';
import { DeliverySignature } from './DeliverySignature';
import { WarrantyCard } from '@/components/warranty/WarrantyCard';
import { formatHoursAndMinutes } from '@/utils/timeUtils';
import { AddOrderItemsDialog } from './AddOrderItemsDialog';
// Removed useRewardSettings and useOrderCashback imports - cashback system eliminated
import { useOrderPayments } from '@/hooks/useOrderPayments';
import { formatCOPCeilToTen, ceilToTen, formatMXNExact } from '@/utils/currency';
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
export function OrderDetails({
  order,
  onBack,
  onUpdate
}: OrderDetailsProps) {
  const {
    user,
    profile
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  // Removed rewardSettings and orderCashback - cashback system eliminated
  const [loading, setLoading] = useState(false);
  const [assignedTechnician, setAssignedTechnician] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState(order.status);
  const [hasAuthorization, setHasAuthorization] = useState(false);
  const [hasRejection, setHasRejection] = useState(false);
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
    loadAuthorizationSignatures();

    // Suscribirse a cambios en tiempo real en la orden
    const channel = supabase.channel('order-changes').on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${order.id}`
    }, payload => {
      if (payload.new.status !== orderStatus) {
        setOrderStatus(payload.new.status);
      }
    }).subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [order.id]);
  useEffect(() => {
    checkExistingAuthorization();
  }, [orderStatus]);
  const loadAuthorizationSignatures = async () => {
    try {
      setSignaturesLoading(true);
      const {
        data,
        error
      } = await supabase.from('order_authorization_signatures').select('*').eq('order_id', order.id).order('signed_at', {
        ascending: true
      }); // Cambiar a ascendente para que la primera firma sea #1

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
        const {
          data: modificationData
        } = await supabase.from('order_modifications').select('id, client_approved').eq('order_id', order.id).is('client_approved', null).limit(1).maybeSingle();
        setHasAuthorization(!modificationData);

        // Check for rejected modifications
        const {
          data: rejectedData
        } = await supabase.from('order_modifications').select('id').eq('order_id', order.id).eq('client_approved', false).limit(1).maybeSingle();
        setHasRejection(!!rejectedData);
      } else if (orderStatus === 'pendiente_aprobacion') {
        const {
          data
        } = await supabase.from('order_authorization_signatures').select('id').eq('order_id', order.id).limit(1).maybeSingle();
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
      const {
        data
      } = await supabase.from('profiles').select('full_name, email').eq('user_id', order.assigned_technician).maybeSingle();
      setAssignedTechnician(data);
    }
  };
  const loadOrderItems = async () => {
    try {
      setItemsLoading(true);
      const {
        data,
        error
      } = await supabase.from('order_items').select(`
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
        `).eq('order_id', order.id).order('created_at', {
        ascending: true
      });
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
      const {
        data,
        error
      } = await supabase.from('order_equipment').select(`
          *,
          equipment_categories (
            name,
            icon
          )
        `).eq('order_id', order.id).order('created_at', {
        ascending: true
      });
      if (error) throw error;
      setOrderEquipment(data || []);
    } catch (error) {
      console.error('Error loading order equipment:', error);
    } finally {
      setEquipmentLoading(false);
    }
  };
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', {
        locale: es
      });
    } catch {
      return dateString;
    }
  };
  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', {
        locale: es
      });
    } catch {
      return dateString;
    }
  };
  const getEstimatedHours = () => {
    const totalHours = orderItems.reduce((sum, item) => {
      return sum + (item.estimated_hours || 2) * (item.quantity || 1);
    }, 0);
    return totalHours > 0 ? totalHours : order.average_service_time || 4;
  };

  // SIEMPRE usar precio guardado de cotización - NO recalcular nunca
  const calculateItemDisplayPrice = (item: any): number => {
    // Si existe total_amount en BD, es la fuente de verdad SIEMPRE
    const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
    if (hasStoredTotal) {
      return Number(item.total_amount);
    }

    // Solo recalcular cuando NO hay total guardado (datos muy antiguos)
    const quantity = item.quantity || 1;
    const salesVatRate = item.vat_rate || 16;
    let basePrice = 0;
    if (item.item_type === 'servicio') {
      basePrice = (item.unit_base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      return ceilToTen(afterSalesVat); // Aplicar redondeo a cada item
    } else {
      const purchaseVatRate = 16;
      const baseCost = (item.unit_cost_price || 0) * quantity;
      const profitMargin = item.profit_margin_rate || 20;
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      return ceilToTen(afterSalesVat); // Aplicar redondeo a cada item
    }
  };
  const calculateCorrectTotal = () => {
    if (itemsLoading) {
      return 0;
    }
    const isPending = orderStatus === 'pendiente_aprobacion' || orderStatus === 'pendiente_actualizacion';

    // Si NO está en estados pendientes y existe estimated_cost, úsalo
    if (!isPending && order.estimated_cost && order.estimated_cost > 0) {
      return order.estimated_cost;
    }
    if (orderItems && orderItems.length > 0) {
      // Sumar items individuales ya redondeados
      return orderItems.reduce((sum, item) => {
        const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
        if (hasStoredTotal) return sum + Number(item.total_amount);
        // Cada item ya viene redondeado de calculateItemDisplayPrice
        return sum + calculateItemDisplayPrice(item);
      }, 0);
    }

    // Si no hay items, devolver 0
    return 0;
  };
  // Calculate payment summary after total calculation
  const totalAmount = calculateCorrectTotal();
  const hasStoredTotals = orderItems?.some((i: any) => typeof i.total_amount === 'number' && i.total_amount > 0) ?? false;
  const usingEstimated = Boolean(order.estimated_cost && order.estimated_cost > 0);
  const {
    paymentSummary
  } = useOrderPayments(order.id, totalAmount);
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'pendiente_actualizacion':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'pendiente':
        return 'bg-info/10 text-info border-info/20';
      case 'en_proceso':
        return 'bg-info/10 text-info border-info/20';
      case 'en_camino':
        return 'bg-info/10 text-info border-info/20';
      case 'pendiente_entrega':
        return 'bg-orange/10 text-orange border-orange/20';
      case 'finalizada':
        return 'bg-success/10 text-success border-success/20';
      case 'cancelada':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };
  const isClient = profile?.role === 'cliente';
  const canModifyOrder = (profile?.role === 'administrador' || profile?.role === 'vendedor') && ['pendiente', 'en_proceso'].includes(orderStatus);

  // Only allow signing delivery when order is completely finished (all items completed and status is pendiente_entrega)
  const allItemsCompleted = orderItems.length > 0 && orderItems.every(item => item.status === 'finalizada');
  const canSignDelivery = isClient && orderStatus === 'pendiente_entrega' && allItemsCompleted || profile?.role === 'administrador' && ['pendiente_entrega', 'finalizada'].includes(orderStatus);

  // Si es cliente y la orden está pendiente de aprobación/actualización sin autorización
  if (isClient && (orderStatus === 'pendiente_aprobacion' || orderStatus === 'pendiente_actualizacion') && !hasAuthorization) {
    return <SimpleOrderApproval order={order} orderItems={orderItems} onBack={onBack} onApprovalComplete={() => {
      onBack();
    }} />;
  }
  return <div className="min-h-screen bg-background">
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
            {canSignDelivery && <Button size="sm" onClick={() => setShowDeliverySignature(true)}>
                <Signature className="h-3 w-3" />
              </Button>}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(orderStatus)} variant="outline">
                {orderStatus === 'pendiente_actualizacion' ? 'PENDIENTE' : orderStatus === 'pendiente_entrega' ? 'LISTO' : orderStatus === 'pendiente_aprobacion' ? 'PENDIENTE APROBACIÓN' : ['en_proceso', 'pendiente'].includes(orderStatus) ? 'EN PROCESO' : orderStatus.replace('_', ' ').toUpperCase()}
              </Badge>
              
              {hasRejection && <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">
                  Actualización rechazada
                </Badge>}
            </div>
            
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
                  {order.is_home_service && <div className="flex items-center gap-1 mt-1">
                      <Home className="h-3 w-3 text-blue-600" />
                      <span className="text-xs text-blue-600">Domicilio</span>
                    </div>}
                </div>
                
                <div className="text-right text-sm">
                  <div className="text-xs text-muted-foreground mb-1">Total con IVA:</div>
                  <div className="font-bold text-primary">
                    {itemsLoading ? <Skeleton className="h-4 w-16 rounded" /> : formatCOPCeilToTen(totalAmount)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getEstimatedHours()}h est.
                  </div>
                  
                  {/* Payment summary when payments exist */}
                  {paymentSummary.paymentCount > 0 && <div className="text-xs space-y-1 mt-2 border-t border-border pt-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cobrado:</span>
                        <span className={paymentSummary.isFullyPaid ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>
                          {formatCOPCeilToTen(paymentSummary.totalPaid)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Restante:</span>
                        <span className={paymentSummary.isFullyPaid ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {formatCOPCeilToTen(paymentSummary.remainingBalance)}
                        </span>
                      </div>
                      
                      {/* Payment summary removed cashback display */}
                    </div>}
                </div>
              </div>

              {/* Detalles colapsables */}
              <button onClick={() => toggleSection('details')} className="flex items-center justify-between w-full text-left text-sm text-muted-foreground border-t border-border pt-3">
                <span>Ver detalles</span>
                {expandedSections.details ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {expandedSections.details && <div className="mt-3 space-y-2 text-sm border-l-2 border-border pl-3">
                  {order.clients?.email && <div>Email: {order.clients.email}</div>}
                  {order.clients?.phone && <div>Teléfono: {order.clients.phone}</div>}
                  {order.clients?.address && <div>Dirección: {order.clients.address}</div>}
                  {assignedTechnician && <div>Técnico: {assignedTechnician.full_name}</div>}
                </div>}
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
                {canModifyOrder && <Button onClick={() => setShowAddItemsDialog(true)} variant="outline" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>}
              </div>
              
              <button onClick={() => toggleSection('services')} className="flex items-center justify-between w-full text-left">
                <span className="text-sm text-muted-foreground">
                  {orderItems.length} item{orderItems.length !== 1 ? 's' : ''}
                </span>
                {expandedSections.services ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {expandedSections.services && <div className="mt-3">
                  <OrderServicesList orderItems={orderItems} canEdit={canModifyOrder || ['en_proceso', 'pendiente'].includes(orderStatus)} onItemUpdate={loadOrderItems} showReadyButtons={['en_proceso', 'pendiente'].includes(orderStatus)} orderId={order.id} onBack={onBack} orderStatus={orderStatus} />
                  
                  {/* Total General */}
                  {orderItems.length > 0 && <div className="mt-4 pt-3 border-t border-border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-muted-foreground">Total General:</span>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                            {itemsLoading ? <Skeleton className="h-6 w-24 rounded" /> : <span className="text-lg font-bold text-primary">
                                 {formatCOPCeilToTen(totalAmount)}
                               </span>}
                        </div>
                      </div>
                    </div>}
                  
                </div>}
              
            </CardContent>
          </Card>

          {/* Equipos */}
          <Card>
            <CardContent className="p-4">
              <button onClick={() => toggleSection('equipment')} className="flex items-center justify-between w-full text-left mb-3">
                <div className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  <span className="font-medium">Equipos</span>
                </div>
                {expandedSections.equipment ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {expandedSections.equipment && <div className="mt-3">
                  <EquipmentList orderId={order.id} equipment={orderEquipment} onUpdate={loadOrderEquipment} canEdit={!isClient && (canModifyOrder || ['en_proceso', 'pendiente', 'pendiente_aprobacion'].includes(orderStatus))} />
                </div>}
            </CardContent>
          </Card>


          {/* Botón Terminar Todo - Hidden for clients */}
          {!isClient && ['en_proceso', 'pendiente'].includes(orderStatus) && orderItems.length > 0 && orderItems.some(item => item.status !== 'finalizada') && <Card>
              
            </Card>}

          {/* Garantías */}
          {orderItems.length > 0 && orderStatus === 'finalizada' && <Card>
              <CardContent className="p-4">
                <button onClick={() => toggleSection('warranties')} className="flex items-center justify-between w-full text-left mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="font-medium">Garantías</span>
                  </div>
                  {expandedSections.warranties ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                
                {expandedSections.warranties && <div className="space-y-2">
                    {orderItems.map(item => <WarrantyCard key={item.id} orderItem={{
                ...item,
                orders: {
                  order_number: order.order_number,
                  client_id: order.client_id
                }
              }} clientId={order.client_id} showClaimButton={isClient} />)}
                  </div>}
              </CardContent>
            </Card>}

          {/* Firmas de Autorización */}
          {authorizationSignatures.length > 0 && <Card>
              <CardContent className="p-4">
                <button onClick={() => toggleSection('signatures')} className="flex items-center justify-between w-full text-left mb-3">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-5 w-5 text-primary" />
                    <span className="font-medium">Firmas de Autorización ({authorizationSignatures.length})</span>
                  </div>
                  {expandedSections.signatures ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                
                {expandedSections.signatures && <SignatureViewer signatures={authorizationSignatures} loading={signaturesLoading} />}
              </CardContent>
            </Card>}

        </div>
      </div>

      {/* Botones de Finalizar y Firmar al final */}
      {(() => {
      const allItemsCompleted = orderItems.length > 0 && orderItems.every(item => item.status === 'finalizada');
      const canFinishOrder = !isClient && allItemsCompleted && ['en_proceso', 'pendiente'].includes(orderStatus);
      const canSignDelivery = isClient && orderStatus === 'pendiente_entrega' && allItemsCompleted || profile?.role === 'administrador' && ['pendiente_entrega', 'finalizada'].includes(orderStatus);
      if (canFinishOrder || canSignDelivery) {
        return <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 z-20">
              <div className="max-w-md mx-auto space-y-3">
                {canFinishOrder && <Button onClick={async () => {
              setLoading(true);
              try {
                const {
                  error
                } = await supabase.from('orders').update({
                  status: 'pendiente_entrega'
                }).eq('id', order.id);
                if (error) throw error;
                toast({
                  title: 'Orden finalizada',
                  description: 'La orden ha sido marcada como lista para entrega.'
                });
                setOrderStatus('pendiente_entrega');
                onUpdate();
              } catch (error) {
                console.error('Error finishing order:', error);
                toast({
                  title: 'Error',
                  description: 'No se pudo finalizar la orden.',
                  variant: 'destructive'
                });
              } finally {
                setLoading(false);
              }
            }} className="w-full" disabled={loading} variant="default">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalizar Orden
                  </Button>}
                
                {canSignDelivery && <Button onClick={() => setShowDeliverySignature(true)} className="w-full" variant="default">
                    <Signature className="h-4 w-4 mr-2" />
                    Firmar Entrega
                  </Button>}
              </div>
            </div>;
      }
      return null;
    })()}

      {/* Espacio para botones fijos */}
      <div className="h-20"></div>


      {/* Modal para agregar items */}
      {showAddItemsDialog && <AddOrderItemsDialog open={showAddItemsDialog} onOpenChange={setShowAddItemsDialog} orderId={order.id} orderNumber={order.order_number} onItemsAdded={() => {
      setShowAddItemsDialog(false);
      loadOrderItems();
      loadAuthorizationSignatures(); // Recargar firmas en caso de cambios
      onUpdate();
    }} />}

      {/* Modal de firma de entrega */}
      {showDeliverySignature && <DeliverySignature order={order} onClose={() => setShowDeliverySignature(false)} onComplete={() => {
      setShowDeliverySignature(false);
      loadAuthorizationSignatures(); // Recargar firmas después de firmar entrega
      // If client, redirect to client dashboard, otherwise just update
      if (isClient) {
        navigate('/client');
      } else {
        onUpdate();
      }
    }} />}
    </div>;
}