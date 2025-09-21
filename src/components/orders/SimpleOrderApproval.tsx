import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PenTool, CheckCircle2, ArrowLeft, Clock, FileCheck, FileEdit, AlertTriangle } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { formatHoursAndMinutes } from '@/utils/timeUtils';
import { useRewardSettings } from '@/hooks/useRewardSettings';
import { ceilToTen } from '@/utils/currency';

interface SimpleOrderApprovalProps {
  order: {
    id: string;
    order_number: string;
    assigned_technician?: string;
    status: string;
    clients?: {
      name: string;
      email: string;
    } | null;
  };
  orderItems: any[];
  onBack: () => void;
  onApprovalComplete: () => void;
}

export function SimpleOrderApproval({ order, orderItems, onBack, onApprovalComplete }: SimpleOrderApprovalProps) {
  const { toast } = useToast();
  const { settings: rewardSettings } = useRewardSettings();
  const signatureRef = useRef<SignatureCanvas>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState<{
    date: string;
    time: string;
    totalHours: number;
  } | null>(null);
  const [modifications, setModifications] = useState<any[]>([]);
  const [authorizationType, setAuthorizationType] = useState<'initial_approval' | 'modification_approval'>('initial_approval');

  const isOrderUpdate = order.status === 'pendiente_actualizacion';
  const isInitialApproval = order.status === 'pendiente_aprobacion';

  // Formateo exacto sin redondear a múltiplos de 10 (para mostrar cashback exacto)
  const formatCOPExact = (amount: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  // Debug logging del estado del componente
  console.log('=== SimpleOrderApproval DEBUG ===');
  console.log('Order:', order);
  console.log('Order status:', order.status);
  console.log('isOrderUpdate:', isOrderUpdate);
  console.log('isInitialApproval:', isInitialApproval);
  console.log('OrderItems count:', orderItems.length);

  useEffect(() => {
    // Determinar el tipo de autorización según el estado
    if (isOrderUpdate) {
      setAuthorizationType('modification_approval');
    } else if (isInitialApproval) {
      setAuthorizationType('initial_approval');
    }
  }, [isOrderUpdate, isInitialApproval]);

  // Calcular precio correcto para un item individual - SIEMPRE respetar total_amount cuando existe
  const calculateItemCorrectPrice = (item: any): number => {
    // CRÍTICO: Si el item tiene total_amount (viene de cotización convertida), usarlo SIEMPRE
    if (typeof item.total_amount === 'number' && item.total_amount > 0) {
      return item.total_amount;
    }

    // Si tiene pricing_locked, usar el total_amount directamente
    if (item.pricing_locked && item.total_amount) {
      return item.total_amount;
    }

    const quantity = item.quantity || 1;
    const salesVatRate = item.vat_rate ?? 16;
    const cashbackPercent = rewardSettings?.apply_cashback_to_items ? (rewardSettings.general_cashback_percent || 0) : 0;

    // Determinar si es producto
    const isProduct = item.item_type === 'articulo' || item.item_type === 'producto';

    if (!isProduct) {
      // Para servicios: precio base + IVA + cashback
      const basePrice = (item.unit_base_price || item.base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      return finalWithCashback;
    } else {
      // Para productos: costo base + IVA compra + margen + IVA venta + cashback
      const purchaseVatRate = 16; // IVA de compra fijo 16%
      const baseCost = (item.unit_cost_price || item.cost_price || 0) * quantity;
      const profitMargin = item.profit_margin_rate || 30;
      
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      
      return finalWithCashback;
    }
  };

  const calculateTotals = () => {
    // Usar la misma lógica unificada que otros componentes
    let subtotalSum = 0;
    let vatSum = 0;
    
    let total = orderItems.reduce((sum, item) => {
      // CRÍTICO: Para items de cotizaciones convertidas, usar total_amount directamente
      let finalItemTotal;
      
      if (typeof item.total_amount === 'number' && item.total_amount > 0) {
        // Item tiene total_amount guardado (viene de cotización) - usar EXACTAMENTE este valor
        finalItemTotal = item.total_amount;
      } else {
        // Item calculado dinámicamente - aplicar lógica normal con redondeo
        const itemTotal = calculateItemCorrectPrice(item);
        finalItemTotal = ceilToTen(itemTotal);
      }
      
      // Calcular subtotal y IVA para cada item
      const salesVatRate = (item.vat_rate ?? 16);
      const subtotal = finalItemTotal / (1 + salesVatRate / 100);
      const vatAmount = finalItemTotal - subtotal;
      
      subtotalSum += subtotal;
      vatSum += vatAmount;
      
      return sum + finalItemTotal;
    }, 0);
    
    // El total es la suma exacta de los items (sin redondeo adicional)
    return { 
      subtotal: subtotalSum, 
      vatTotal: vatSum, 
      total: total 
    };
  };

  const { subtotal, vatTotal, total } = calculateTotals();

  useEffect(() => {
    if (order.assigned_technician && orderItems.length > 0) {
      calculateDeliveryTime();
    }
    
    if (isOrderUpdate) {
      loadOrderModifications();
    }
  }, [order.assigned_technician, orderItems, isOrderUpdate]);

  const loadOrderModifications = async () => {
    console.log('Loading modifications for order:', order.id);
    try {
      const { data, error } = await supabase
        .from('order_modifications')
        .select('*')
        .eq('order_id', order.id)
        .is('client_approved', null)
        .not('modification_reason', 'is', null) // Solo modificaciones con razón válida
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('Modifications query result:', { data, error });
      
      if (error) throw error;
      
      console.log('Setting modifications:', data || []);
      setModifications(data || []);
      
      // Verificar si no hay modificaciones pendientes
      if (isOrderUpdate && (!data || data.length === 0)) {
        console.log('WARNING: Order is in pendiente_actualizacion but no pending modifications found!');
        toast({
          title: "Aviso",
          description: "No se encontraron modificaciones pendientes para esta orden.",
          variant: "destructive"
        });
      } else if (data && data.length > 0) {
        // Debug: Mostrar todos los campos de la modificación
        console.log('Modification details:', {
          reason: data[0].modification_reason,
          previousTotal: data[0].previous_total,
          newTotal: data[0].new_total,
          createdByName: data[0].created_by_name,
          itemsAdded: data[0].items_added
        });
      }
    } catch (error) {
      console.error('Error loading modifications:', error);
    }
  };

  const calculateDeliveryTime = () => {
    try {
      // Calcular horas totales estimadas
      const totalHours = orderItems.reduce((sum, item) => {
        return sum + ((item.estimated_hours || 2) * (item.quantity || 1));
      }, 0);

      // Calcular fecha de entrega simple
      const startDate = new Date();
      const workHoursPerDay = 8; // Horario estándar de trabajo
      const daysNeeded = Math.ceil(totalHours / workHoursPerDay);
      
      const deliveryDate = new Date(startDate);
      deliveryDate.setDate(startDate.getDate() + daysNeeded);
      
      // Formatear fecha y hora
      const dateStr = deliveryDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const timeStr = '16:00'; // Hora estándar de finalización
      
      setDeliveryInfo({
        date: dateStr,
        time: timeStr,
        totalHours
      });
    } catch (error) {
      console.error('Error calculating delivery time:', error);
    }
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
  };

  const handleApproval = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: "Firma requerida",
        description: "Por favor, proporcione su firma para aprobar la orden",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const signatureData = signatureRef.current.toDataURL();

      if (isOrderUpdate) {
        // Aprobar modificaciones
        const latestModification = modifications[0];
        if (latestModification) {
          const { error: modError } = await supabase
            .from('order_modifications')
            .update({
              client_approved: true,
              approved_at: new Date().toISOString()
            })
            .eq('id', latestModification.id);

          if (modError) throw modError;
        }

        // Guardar nueva firma de autorización para la modificación
        const { error: signatureError } = await supabase
          .from('order_authorization_signatures')
          .insert({
            order_id: order.id,
            client_signature_data: signatureData,
            client_name: order.clients?.name || '',
            signed_at: new Date().toISOString(),
            modification_reason: latestModification?.modification_reason || 'Modificación de orden',
            new_amount: calculateTotals().total
          });

        if (signatureError) throw signatureError;

        // Actualizar el estado de la orden a 'en_proceso' y el nuevo total para modificaciones
        const newStatus = 'en_proceso';
        const updateData: any = {
          status: newStatus,
          client_approval: true,
          client_approved_at: new Date().toISOString()
        };
        
        // Solo actualizar estimated_cost cuando hay modificaciones aprobadas
        if (modifications.length > 0) {
          const latestModification = modifications[0];
          updateData.estimated_cost = latestModification.new_total;
        }
        
        const { error: orderError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order.id);

        console.log(`Updated order status to: ${newStatus} for order ${order.id}`);

        if (orderError) throw orderError;

        toast({
          title: "Modificación aprobada",
          description: "Los cambios en la orden han sido aprobados exitosamente.",
          variant: "default"
        });
      } else {
        // Aprobación original
        const { error: signatureError } = await supabase
          .from('order_authorization_signatures')
          .insert({
            order_id: order.id,
            client_signature_data: signatureData,
            client_name: order.clients?.name || '',
            signed_at: new Date().toISOString(),
            modification_reason: 'Aprobación inicial de orden',
            new_amount: calculateTotals().total
          });

        if (signatureError) throw signatureError;

        // Actualizar el estado de la orden a 'en_proceso'
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: 'en_proceso',
            client_approval: true,
            client_approved_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (orderError) throw orderError;

        toast({
          title: "Orden aprobada",
          description: "La orden ha sido aprobada exitosamente y está en proceso.",
          variant: "default"
        });
      }

      onApprovalComplete();
    } catch (error) {
      console.error('Error approving order:', error);
      toast({
        title: "Error",
        description: "No se pudo aprobar la orden. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    console.log('=== HANDLE REJECT VIA EDGE FUNCTION ===');
    setLoading(true);

    try {
      if (!isOrderUpdate) {
        toast({ title: 'Nada que rechazar', description: 'Esta orden no está en actualización.', variant: 'destructive' });
        return;
      }

      const latestModification = modifications[0];
      const { data, error } = await supabase.functions.invoke('reject-order-modification', {
        body: {
          orderId: order.id,
          modificationId: latestModification?.id,
        },
      });

      if (error) throw error;
      console.log('Edge reject result:', data);

      toast({
        title: 'Modificación rechazada',
        description: 'Se eliminaron los items agregados y se restauró el total anterior.',
        variant: 'default',
      });

      onApprovalComplete();
    } catch (error) {
      console.error('Error rejecting via edge function:', error);
      const message = (error as any)?.message || (error as any)?.error || 'Error desconocido';
      toast({ title: 'Error', description: `No se pudo rechazar la modificación: ${message}` , variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col h-screen">
        {/* Mobile-first Header */}
        <div className="sticky top-0 bg-background border-b px-4 py-3 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} size="sm" className="p-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {authorizationType === 'initial_approval' ? (
                  <FileCheck className="h-5 w-5 text-blue-600 flex-shrink-0" />
                ) : (
                  <FileEdit className="h-5 w-5 text-orange-600 flex-shrink-0" />
                )}
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {authorizationType === 'initial_approval' ? 'Aprobación Inicial' : 'Aprobación de Modificación'}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground truncate">{order.order_number}</p>
              <div className="mt-1">
                {authorizationType === 'initial_approval' ? (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    PRIMERA AUTORIZACIÓN
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                    AUTORIZACIÓN DE CAMBIOS
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Authorization Type Warning */}
            {authorizationType === 'initial_approval' && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-blue-800 text-base">
                    <FileCheck className="h-4 w-4 mr-2" />
                    Autorización Inicial de Orden
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-blue-700">
                    Esta es la <strong>primera autorización</strong> de esta orden. Al firmar, autoriza el inicio de los trabajos según los servicios y costos detallados.
                  </p>
                </CardContent>
              </Card>
            )}

            {authorizationType === 'modification_approval' && modifications.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-orange-800 text-base">
                    <FileEdit className="h-4 w-4 mr-2" />
                    Aprobación de Modificaciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <p className="text-sm text-orange-700">
                      Se han realizado <strong>modificaciones</strong> a esta orden. Revise los cambios y proporcione su autorización.
                    </p>
                    {modifications[0] && (
                      <div className="bg-white p-3 rounded-lg border">
                        <h4 className="font-semibold text-gray-900 mb-2 text-sm">Detalles de la Modificación:</h4>
                        <div className="space-y-3 text-sm">
                          {modifications[0].modification_reason && (
                            <div>
                              <span className="font-medium text-gray-700">Razón:</span>
                              <p className="text-gray-600 mt-1">{modifications[0].modification_reason}</p>
                            </div>
                          )}
                          {modifications[0].created_by_name && (
                            <div>
                              <span className="font-medium text-gray-700">Modificado por:</span>
                              <p className="text-gray-600 mt-1">{modifications[0].created_by_name}</p>
                            </div>
                          )}
                          {modifications[0].previous_total && modifications[0].new_total && (
                            <div>
                              <span className="font-medium text-gray-700">Cambio de costo:</span>
                              <div className="space-y-1 mt-1">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Anterior:</span>
                                  <span className="text-red-600">{formatCOPExact(Number(modifications[0].previous_total))}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Nuevo:</span>
                                  <span className="text-green-600">{formatCOPExact(Number(modifications[0].new_total))}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1">
                                  <span className="font-medium text-gray-700">Diferencia:</span>
                                  <span className={`font-semibold ${Number(modifications[0].new_total) > Number(modifications[0].previous_total) ? 'text-red-600' : 'text-green-600'}`}>
                                    {Number(modifications[0].new_total) > Number(modifications[0].previous_total) ? '+' : ''}{formatCOPExact(Number(modifications[0].new_total) - Number(modifications[0].previous_total))}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Details - Mobile First */}
            <div className="space-y-4">
              {/* Services/Products */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-base">
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    {orderItems.filter(item => item.item_type === 'servicio').length > 0 && 
                     orderItems.filter(item => item.item_type === 'articulo').length > 0 
                      ? 'Servicios y Productos' 
                      : orderItems.filter(item => item.item_type === 'servicio').length > 0 
                        ? 'Servicios' 
                        : 'Productos'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {orderItems.map((item, index) => (
                      <div key={index} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 pr-2">
                              <h4 className="font-medium text-foreground text-sm">{item.service_name}</h4>
                              {item.service_description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.service_description}</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-foreground">
                                {formatCOPExact(calculateItemCorrectPrice(item))}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Cant: {item.quantity || 1}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                item.item_type === 'servicio' 
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                                  : 'bg-green-100 text-green-800 border border-green-300'
                              }`}>
                                {item.item_type === 'servicio' ? '🔧 Servicio' : '📦 Producto'}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">Total c/IVA</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Cost Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-base">
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    Resumen de Costos
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">{formatCOPExact(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">IVA (16%):</span>
                      <span className="font-medium">{formatCOPExact(vatTotal)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-foreground">Total:</span>
                        <span className="text-lg font-bold text-primary">{formatCOPExact(total)}</span>
                      </div>
                    </div>
                    
                    {rewardSettings?.general_cashback_percent > 0 && (
                      <div className="bg-green-50 p-2 rounded-lg mt-3">
                        <p className="text-xs text-green-800">
                          🎉 <strong>Ganarás {formatCOPExact(total * (rewardSettings.general_cashback_percent / 100))} en cashback</strong> al completar este servicio.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Estimated Delivery */}
              {deliveryInfo && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-base">
                      <Clock className="h-4 w-4 mr-2 text-blue-600" />
                      Tiempo Estimado de Entrega
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-600 font-medium">Fecha Estimada</p>
                        <p className="text-sm text-blue-900 font-bold capitalize mt-1">{deliveryInfo.date}</p>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-600 font-medium">Hora Estimada</p>
                        <p className="text-sm text-blue-900 font-bold mt-1">{deliveryInfo.time}</p>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-600 font-medium">Tiempo Total</p>
                        <p className="text-sm text-blue-900 font-bold mt-1">{formatHoursAndMinutes(deliveryInfo.totalHours)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Signature Section - At the end of content */}
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-base">
                  <PenTool className="h-4 w-4 mr-2 text-primary" />
                  Firma de {authorizationType === 'initial_approval' ? 'Autorización' : 'Aprobación de Cambios'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {authorizationType === 'initial_approval' 
                      ? 'Para autorizar esta orden, proporcione su firma:'
                      : 'Para aprobar las modificaciones, proporcione su firma:'
                    }
                  </p>

                  <div className="border-2 border-dashed border-border rounded-lg p-2 bg-white">
                    <SignatureCanvas
                      ref={signatureRef}
                      canvasProps={{
                        className: 'signature-canvas w-full h-32 bg-white rounded touch-action-none'
                      }}
                      backgroundColor="white"
                      penColor="black"
                      minWidth={1}
                      maxWidth={2}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearSignature}
                    disabled={loading}
                    size="sm"
                    className="w-full"
                  >
                    Limpiar Firma
                  </Button>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 pt-2">
                    {isOrderUpdate && (
                      <Button
                        onClick={handleReject}
                        disabled={loading}
                        variant="destructive"
                        className="h-11"
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Procesando...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Rechazar Modificación
                          </div>
                        )}
                      </Button>
                    )}
                    
                    <Button
                      onClick={handleApproval}
                      disabled={loading}
                      className="h-11 bg-green-600 hover:bg-green-700"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Procesando...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {authorizationType === 'initial_approval' ? 'Autorizar Orden' : 'Aprobar Modificaciones'}
                        </div>
                      )}
                    </Button>
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onBack}
                      disabled={loading}
                      className="h-11"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}