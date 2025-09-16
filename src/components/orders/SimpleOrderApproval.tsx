import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PenTool, CheckCircle2, ArrowLeft, Clock, FileCheck, FileEdit, AlertTriangle } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { formatHoursAndMinutes } from '@/utils/timeUtils';
import { useRewardSettings } from '@/hooks/useRewardSettings';
import { formatCOPCeilToTen, ceilToTen } from '@/utils/currency';
import { useSalesPricingCalculation } from '@/hooks/useSalesPricingCalculation';

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
  const { getDisplayPrice, formatCurrency } = useSalesPricingCalculation();
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
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
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

  // Calcular precio correcto para un item individual usando la misma lógica unificada
  const calculateItemCorrectPrice = (item: any): number => {
    const quantity = item.quantity || 1;
    
    // Convertir el item al formato esperado por useSalesPricingCalculation
    const serviceForPricing = {
      id: item.service_type_id || item.id,
      name: item.name || '',
      base_price: item.unit_base_price || item.unit_price || 0,
      cost_price: item.unit_cost_price || item.cost_price || 0,
      vat_rate: item.vat_rate,
      item_type: item.item_type,
      profit_margin_rate: item.profit_margin_rate || 30,
      profit_margin_tiers: item.profit_margin_tiers
    };

    return getDisplayPrice(serviceForPricing, quantity);
  };

  const calculateTotals = () => {
    // Usar la misma lógica unificada que otros componentes
    let subtotalSum = 0;
    let vatSum = 0;
    
    const total = orderItems.reduce((sum, item) => {
      const itemTotal = calculateItemCorrectPrice(item);
      const roundedItemTotal = ceilToTen(itemTotal);
      
      // Calcular subtotal y IVA para cada item
      const salesVatRate = (item.vat_rate ?? 16);
      const subtotal = roundedItemTotal / (1 + salesVatRate / 100);
      const vatAmount = roundedItemTotal - subtotal;
      
      subtotalSum += subtotal;
      vatSum += vatAmount;
      
      return sum + roundedItemTotal;
    }, 0);
    
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
    console.log('=== HANDLE REJECT DEBUG ===');
    console.log('Is order update:', isOrderUpdate);
    console.log('Modifications length:', modifications.length);
    console.log('Latest modification:', modifications[0]);
    
    setLoading(true);

    try {
      if (isOrderUpdate && modifications.length > 0) {
        const latestModification = modifications[0];
        console.log('Processing latest modification:', latestModification);
        
        // STEP 1: Obtener el total de items antes de la eliminación para validación
        const { data: preDeleteItems, error: preDeleteError } = await supabase
          .from('order_items')
          .select('id, total_amount')
          .eq('order_id', order.id);

        if (preDeleteError) {
          console.error('Error fetching items before deletion:', preDeleteError);
          throw preDeleteError;
        }

        const originalItemsCount = preDeleteItems?.length || 0;
        const originalTotal = preDeleteItems?.reduce((sum, item) => sum + Number(item.total_amount), 0) || 0;
        console.log('Original items count:', originalItemsCount, 'Original total:', originalTotal);
        
        // STEP 2: Procesar items agregados para eliminarlos
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
          console.log('Expected items to delete:', itemsAdded.length);
          
          // STEP 3: Cargar items actuales de la orden con información completa
          const { data: existingItems, error: fetchItemsError } = await supabase
            .from('order_items')
            .select('id, service_type_id, service_name, quantity, unit_cost_price, unit_base_price, vat_rate, profit_margin_rate, total_amount, status, pricing_locked, created_at')
            .eq('order_id', order.id);

          if (fetchItemsError) {
            console.error('Error fetching order items for deletion:', fetchItemsError);
            throw fetchItemsError;
          }

          console.log('Current order items:', existingItems?.length || 0);

          const modCreatedAt = latestModification.created_at ? new Date(latestModification.created_at) : null;

          // STEP 4: Algoritmo mejorado de coincidencias con scoring
          const idsToDelete = new Set<string>();
          const deletionLog: Array<{item: any, candidate: any, reason: string}> = [];

          for (const item of itemsAdded) {
            const name = item.service_name || item.name;
            const qty = item.quantity || 1;

            // Buscar candidatos y calcular un score de coincidencia
            const candidates = (existingItems || []).map(row => {
              let score = 0;
              const reasons: string[] = [];

              // Filtros básicos (requeridos)
              const createdAfter = !modCreatedAt || new Date(row.created_at) >= modCreatedAt;
              const notLocked = row.pricing_locked === false || row.pricing_locked == null;
              const statusPend = row.status === 'pendiente' || row.status == null;

              if (!createdAfter || !notLocked || !statusPend) {
                return { row, score: -1, reasons: ['Filtros básicos no cumplidos'] };
              }

              // Coincidencia exacta de nombre de servicio (crítico)
              if (row.service_name === name) {
                score += 50;
                reasons.push('Nombre exacto');
              } else {
                return { row, score: -1, reasons: ['Nombre no coincide'] };
              }

              // Coincidencia de cantidad (crítico)
              if (row.quantity === qty) {
                score += 30;
                reasons.push('Cantidad exacta');
              } else {
                return { row, score: -1, reasons: ['Cantidad no coincide'] };
              }

              // Coincidencia de service_type_id (importante)
              if (item.service_type_id && row.service_type_id === item.service_type_id) {
                score += 15;
                reasons.push('Service type ID');
              }

              // Coincidencia de total amount (muy importante)
              if (typeof item.total_amount === 'number' && Math.abs(Number(row.total_amount) - Number(item.total_amount)) < 0.01) {
                score += 20;
                reasons.push('Total exacto');
              }

              // Coincidencias de precios unitarios (importantes)
              if (item.unit_base_price != null && Math.abs(Number(row.unit_base_price) - Number(item.unit_base_price)) < 0.01) {
                score += 10;
                reasons.push('Precio base exacto');
              }

              if (item.vat_rate != null && Math.abs(Number(row.vat_rate) - Number(item.vat_rate)) < 0.01) {
                score += 5;
                reasons.push('VAT rate exacto');
              }

              return { row, score, reasons };
            }).filter(c => c.score > 0).sort((a, b) => b.score - a.score);

            // Seleccionar el mejor candidato si tiene un score suficiente
            if (candidates.length > 0 && candidates[0].score >= 95) { // Score mínimo alto para evitar falsos positivos
              const bestMatch = candidates[0];
              idsToDelete.add(bestMatch.row.id);
              deletionLog.push({
                item,
                candidate: bestMatch.row,
                reason: `Score: ${bestMatch.score}, Motivos: ${bestMatch.reasons.join(', ')}`
              });
              console.log(`✅ Match found for "${name}": Score ${bestMatch.score}, Motivos: ${bestMatch.reasons.join(', ')}`);
            } else {
              console.warn(`❌ No reliable match found for "${name}". Best score: ${candidates[0]?.score || 0}`);
              deletionLog.push({
                item,
                candidate: null,
                reason: `No match - Best score: ${candidates[0]?.score || 0}`
              });
            }
          }

          console.log('Deletion log:', deletionLog);
          console.log('Final IDs to delete:', Array.from(idsToDelete));

          // STEP 5: Eliminar items identificados y validar resultado
          let deletedCount = 0;
          if (idsToDelete.size > 0) {
            const { error: batchDeleteError, count } = await supabase
              .from('order_items')
              .delete({ count: 'exact' })
              .in('id', Array.from(idsToDelete));

            if (batchDeleteError) {
              console.error('Error batch-deleting items:', batchDeleteError);
              throw batchDeleteError;
            }

            deletedCount = count || 0;
            console.log('Successfully deleted items count:', deletedCount);

            // Validar que se eliminaron todos los items esperados
            if (deletedCount !== itemsAdded.length) {
              console.warn(`⚠️ Expected to delete ${itemsAdded.length} items, but deleted ${deletedCount}`);
            }
          } else {
            console.log('No items matched for deletion. This may indicate a problem with the matching logic.');
          }

          // STEP 6: Verificación posterior - confirmar eliminación
          const { data: postDeleteItems, error: postDeleteError } = await supabase
            .from('order_items')
            .select('id, service_name, total_amount')
            .eq('order_id', order.id);

          if (postDeleteError) {
            console.error('Error fetching items after deletion:', postDeleteError);
            throw postDeleteError;
          }

          const finalItemsCount = postDeleteItems?.length || 0;
          const finalTotal = postDeleteItems?.reduce((sum, item) => sum + Number(item.total_amount), 0) || 0;
          
          console.log(`Verification: Items before: ${originalItemsCount}, after: ${finalItemsCount}, deleted: ${originalItemsCount - finalItemsCount}`);
          console.log(`Verification: Total before: ${originalTotal}, after: ${finalTotal}, difference: ${originalTotal - finalTotal}`);

          // Validar que la eliminación fue exitosa
          const expectedFinalCount = originalItemsCount - itemsAdded.length;
          if (finalItemsCount !== expectedFinalCount) {
            throw new Error(`Error en eliminación: se esperaban ${expectedFinalCount} items, pero hay ${finalItemsCount}`);
          }
        }

        // STEP 7: Eliminar el registro de modificación
        console.log('Deleting modification:', latestModification.id);
        const { error: deleteModError } = await supabase
          .from('order_modifications')
          .delete()
          .eq('id', latestModification.id);

        if (deleteModError) {
          console.error('Error deleting modification:', deleteModError);
          throw deleteModError;
        }

        // STEP 8: Revertir el estado de la orden y restaurar el total original
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: 'en_proceso',
            estimated_cost: latestModification.previous_total, // Restaurar el total anterior
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (orderError) {
          console.error('Error updating order status:', orderError);
          throw orderError;
        }

        // STEP 9: Validación final - verificar que el total de la orden coincide con el esperado
        const { data: updatedOrder, error: checkOrderError } = await supabase
          .from('orders')
          .select('estimated_cost')
          .eq('id', order.id)
          .single();

        if (checkOrderError) {
          console.error('Error checking updated order:', checkOrderError);
        } else {
          const restoredTotal = Number(updatedOrder.estimated_cost);
          const expectedTotal = Number(latestModification.previous_total);
          
          if (Math.abs(restoredTotal - expectedTotal) > 0.01) {
            console.warn(`⚠️ Order total mismatch: Expected ${expectedTotal}, but got ${restoredTotal}`);
          } else {
            console.log(`✅ Order total correctly restored to: ${restoredTotal}`);
          }
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
        description: `No se pudo rechazar la modificación: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: "destructive"
      });
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
                                  <span className="text-red-600">{formatCOPCeilToTen(Number(modifications[0].previous_total))}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Nuevo:</span>
                                  <span className="text-green-600">{formatCOPCeilToTen(Number(modifications[0].new_total))}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1">
                                  <span className="font-medium text-gray-700">Diferencia:</span>
                                  <span className={`font-semibold ${Number(modifications[0].new_total) > Number(modifications[0].previous_total) ? 'text-red-600' : 'text-green-600'}`}>
                                    {Number(modifications[0].new_total) > Number(modifications[0].previous_total) ? '+' : ''}{formatCOPCeilToTen(Number(modifications[0].new_total) - Number(modifications[0].previous_total))}
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
                                {formatCOPCeilToTen(calculateItemCorrectPrice(item))}
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
                      <span className="font-medium">{formatCOPCeilToTen(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">IVA (16%):</span>
                      <span className="font-medium">{formatCOPCeilToTen(vatTotal)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-foreground">Total:</span>
                        <span className="text-lg font-bold text-primary">{formatCOPCeilToTen(total)}</span>
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