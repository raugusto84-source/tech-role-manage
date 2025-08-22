import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PenTool, CheckCircle2, ArrowLeft, Clock, FileCheck, FileEdit, AlertTriangle } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { formatHoursAndMinutes } from '@/utils/timeUtils';

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

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const vatTotal = orderItems.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
    const total = orderItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    
    return { subtotal, vatTotal, total };
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
            signed_at: new Date().toISOString()
          });

        if (signatureError) throw signatureError;

        // Actualizar el estado de la orden según el tipo de aprobación
        const newStatus = isOrderUpdate ? 'en_proceso' : 'pendiente';
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: newStatus,
            client_approval: true,
            client_approved_at: new Date().toISOString()
          })
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
            signed_at: new Date().toISOString()
          });

        if (signatureError) throw signatureError;

        // Actualizar el estado de la orden a 'pendiente'
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: 'pendiente',
            client_approval: true,
            client_approved_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (orderError) throw orderError;

        toast({
          title: "Orden aprobada",
          description: "La orden ha sido aprobada exitosamente y está lista para ser procesada.",
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
    console.log('=== HANDLE REJECT DEBUG ===');
    console.log('Is order update:', isOrderUpdate);
    console.log('Modifications length:', modifications.length);
    console.log('Latest modification:', modifications[0]);
    
    setLoading(true);

    try {
      if (isOrderUpdate && modifications.length > 0) {
        const latestModification = modifications[0];
        console.log('Processing latest modification:', latestModification);
        
        // Obtener items agregados para eliminarlos
        if (latestModification.items_added) {
          console.log('Items added raw:', latestModification.items_added);
          
          let itemsAdded;
          
          // Manejar diferentes formatos de items_added
          if (typeof latestModification.items_added === 'string') {
            try {
              itemsAdded = JSON.parse(latestModification.items_added);
            } catch (e) {
              console.error('Error parsing items_added string:', e);
              throw new Error('Error al procesar los items agregados');
            }
          } else if (Array.isArray(latestModification.items_added)) {
            itemsAdded = latestModification.items_added;
          } else if (typeof latestModification.items_added === 'object' && latestModification.items_added !== null) {
            // Si es un objeto individual, convertir a array
            itemsAdded = [latestModification.items_added];
          } else {
            console.error('Unknown items_added format:', typeof latestModification.items_added);
            throw new Error('Formato de items agregados no válido');
          }
          
          console.log('Processed items added:', itemsAdded);
          
          // Eliminar cada item agregado
          for (const item of itemsAdded) {
            console.log('Deleting item:', item);
            const { error: deleteError } = await supabase
              .from('order_items')
              .delete()
              .eq('order_id', order.id)
              .eq('service_type_id', item.service_type_id);

            if (deleteError) {
              console.error('Error deleting item:', deleteError);
              throw deleteError;
            }
          }
        }

        // Eliminar el registro de modificación
        console.log('Deleting modification:', latestModification.id);
        const { error: deleteModError } = await supabase
          .from('order_modifications')
          .delete()
          .eq('id', latestModification.id);

        if (deleteModError) {
          console.error('Error deleting modification:', deleteModError);
          throw deleteModError;
        }

        // Revertir el estado de la orden a 'en_proceso'
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: 'en_proceso',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (orderError) {
          console.error('Error updating order status:', orderError);
          throw orderError;
        }

        console.log('Reject completed successfully');
        toast({
          title: "Modificación rechazada",
          description: "Los cambios han sido revertidos y la orden regresó a su estado anterior.",
          variant: "default"
        });
      }

      onApprovalComplete();
    } catch (error) {
      console.error('Error rejecting modifications:', error);
      toast({
        title: "Error",
        description: "No se pudo rechazar la modificación. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with Authorization Type */}
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={onBack} className="mr-4">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {authorizationType === 'initial_approval' ? (
                <FileCheck className="h-8 w-8 text-blue-600" />
              ) : (
                <FileEdit className="h-8 w-8 text-orange-600" />
              )}
              <h1 className="text-3xl font-bold text-foreground">
                {authorizationType === 'initial_approval' ? 'Aprobación Inicial' : 'Aprobación de Modificación'}
              </h1>
            </div>
            <p className="text-muted-foreground">{order.order_number}</p>
            <div className="mt-2 flex items-center gap-2">
              {authorizationType === 'initial_approval' ? (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  PRIMERA AUTORIZACIÓN
                </span>
              ) : (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full">
                  AUTORIZACIÓN DE CAMBIOS
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Authorization Type Warning */}
        {authorizationType === 'initial_approval' && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center text-blue-800">
                <FileCheck className="h-5 w-5 mr-2" />
                Autorización Inicial de Orden
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-blue-700">
                Esta es la <strong>primera autorización</strong> de esta orden. Al firmar, autoriza el inicio de los trabajos según los servicios y costos detallados.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Información de modificación */}
        {authorizationType === 'modification_approval' && modifications.length > 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center text-orange-800">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Modificación Realizada - Requiere Nueva Autorización
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <p className="text-orange-800 font-medium text-sm">
                    ⚠️ Esta orden ya fue autorizada previamente, pero se realizaron cambios que requieren su nueva aprobación.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-orange-700">
                    <strong>Razón de la modificación:</strong> {modifications[0].modification_reason}
                  </p>
                  <p className="text-orange-700">
                    <strong>Modificado por:</strong> {modifications[0].created_by_name}
                  </p>
                  {modifications[0].notes && (
                    <p className="text-orange-700">
                      <strong>Detalles adicionales:</strong> {modifications[0].notes}
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-orange-200">
                    <div className="text-center p-2 bg-white rounded-lg">
                      <p className="text-sm text-orange-600">Total Anterior</p>
                      <p className="text-lg font-bold text-orange-800">
                        ${modifications[0].previous_total?.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-white rounded-lg">
                      <p className="text-sm text-orange-600">Nuevo Total</p>
                      <p className="text-lg font-bold text-orange-800">
                        ${modifications[0].new_total?.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-600">Incremento</p>
                      <p className="text-lg font-bold text-green-700">
                        +${((modifications[0].new_total || 0) - (modifications[0].previous_total || 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Servicios y Productos */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Servicios y Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orderItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-border">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.service_name}</h4>
                    {item.service_description && (
                      <p className="text-sm text-muted-foreground">{item.service_description}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Cantidad: {item.quantity} | Precio unitario: ${(item.unit_base_price || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${(item.total_amount || 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Totales */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Resumen de Costos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA:</span>
                <span>${vatTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>${total.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hora Estimada de Entrega */}
        {deliveryInfo && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Fecha Estimada de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Fecha estimada:</span>
                  <span className="font-medium">{deliveryInfo.date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Hora aproximada:</span>
                  <span className="font-medium">{deliveryInfo.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tiempo estimado total:</span>
                  <span className="font-medium">{formatHoursAndMinutes(deliveryInfo.totalHours)}</span>
                </div>
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    *La fecha de entrega puede variar según la disponibilidad del técnico y la complejidad del trabajo.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!showSignature ? (
          <Card className={`${authorizationType === 'modification_approval' ? 'border-orange-200' : 'border-blue-200'}`}>
            <CardContent className="text-center py-8">
              {authorizationType === 'initial_approval' ? (
                <FileCheck className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              ) : (
                <FileEdit className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              )}
              <h3 className="text-xl font-semibold mb-2">
                {authorizationType === 'initial_approval' ? 'Autorización Inicial' : 'Autorización de Modificación'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {authorizationType === 'initial_approval' 
                  ? 'Al aprobar esta orden, autoriza el inicio de los trabajos según los servicios y costos detallados. Esta será su primera autorización para esta orden.'
                  : 'Al aprobar esta modificación, confirma que está de acuerdo con los cambios realizados y el nuevo costo total. Esta es una autorización adicional a la inicial.'
                }
              </p>
              <div className="flex gap-4 justify-center">
                {authorizationType === 'modification_approval' && (
                  <Button 
                    onClick={handleReject}
                    variant="destructive"
                    disabled={loading}
                    className="px-8 py-3 text-lg"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        Rechazar Modificación
                      </>
                    )}
                  </Button>
                )}
                <Button 
                  onClick={() => setShowSignature(true)}
                  className={`px-8 py-3 text-lg ${authorizationType === 'modification_approval' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  <PenTool className="h-5 w-5 mr-2" />
                  {authorizationType === 'initial_approval' ? 'Autorizar Orden' : 'Autorizar Cambios'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className={`${authorizationType === 'modification_approval' ? 'border-orange-200' : 'border-blue-200'}`}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PenTool className="h-5 w-5 mr-2" />
                {authorizationType === 'initial_approval' ? 'Firma de Autorización Inicial' : 'Firma de Autorización de Modificación'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`p-3 rounded-lg ${authorizationType === 'modification_approval' ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'}`}>
                <p className={`text-sm font-medium ${authorizationType === 'modification_approval' ? 'text-orange-800' : 'text-blue-800'}`}>
                  {authorizationType === 'initial_approval' 
                    ? '📄 PRIMERA AUTORIZACIÓN: Su firma autorizará el inicio de los trabajos según lo acordado.'
                    : '📝 NUEVA AUTORIZACIÓN: Su firma autorizará los cambios realizados a la orden original.'
                  }
                </p>
              </div>
              
              <div className="border border-border rounded-lg p-4 bg-muted/10">
                <SignatureCanvas
                  ref={signatureRef}
                  canvasProps={{
                    width: 600,
                    height: 200,
                    className: 'signature-canvas w-full h-48 bg-white rounded border border-border'
                  }}
                  backgroundColor="white"
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-muted-foreground">
                    Firme en el área de arriba para 
                    {authorizationType === 'initial_approval' ? ' autorizar la orden' : ' aprobar la modificación'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearSignature}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setShowSignature(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleApproval}
                  disabled={loading}
                  className={`flex-1 ${authorizationType === 'modification_approval' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {authorizationType === 'initial_approval' ? 'Confirmar Autorización' : 'Confirmar Modificación'}
                    </>
                  )}
                </Button>
              </div>

              <div className={`text-center text-sm p-3 rounded-lg ${authorizationType === 'modification_approval' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                {authorizationType === 'initial_approval' 
                  ? '🔒 Al firmar, confirma que autoriza la orden con los servicios y costos mostrados. Esta será su autorización inicial.'
                  : '🔄 Al firmar, confirma que aprueba la modificación con los cambios y costos actualizados. Esta es una autorización adicional.'
                }
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}