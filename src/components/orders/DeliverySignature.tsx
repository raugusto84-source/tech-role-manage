import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PenTool, CheckCircle2, ArrowLeft, X } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { triggerOrderFollowUp } from '@/utils/followUp';
import { useRewardSettings } from '@/hooks/useRewardSettings';

interface DeliverySignatureProps {
  order: {
    id: string;
    order_number: string;
    clients?: {
      name: string;
      email?: string;
    } | null;
  };
  onClose: () => void;
  onComplete: () => void;
}

export function DeliverySignature({ order, onClose, onComplete }: DeliverySignatureProps) {
  const { toast } = useToast();
  const signatureRef = useRef<SignatureCanvas>(null);
  const [loading, setLoading] = useState(false);
  const { settings: rewardSettings } = useRewardSettings();

  const clearSignature = () => {
    signatureRef.current?.clear();
  };

  const handleConfirmDelivery = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: "Firma requerida",
        description: "Por favor, proporcione su firma para confirmar la entrega",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    console.log('🔄 Iniciando proceso de confirmación de entrega para orden:', order.id);
    console.log('🔍 Usuario actual:', supabase.auth.getUser());

    try {
      const signatureData = signatureRef.current.toDataURL();
      console.log('✅ Firma capturada exitosamente');

      // Guardar firma de entrega
      console.log('💾 Insertando firma en delivery_signatures...');
      console.log('📋 Datos a insertar:', {
        order_id: order.id,
        client_name: order.clients?.name || 'Cliente',
        delivery_date: new Date().toISOString(),
      });

      const { data: signatureResult, error: signatureError } = await supabase
        .from('delivery_signatures')
        .insert({
          order_id: order.id,
          client_name: order.clients?.name || 'Cliente',
          client_signature_data: signatureData,
          delivery_date: new Date().toISOString(),
        })
        .select();

      if (signatureError) {
        console.error('❌ Error al insertar firma:', signatureError);
        console.error('❌ Detalles del error:', JSON.stringify(signatureError, null, 2));
        throw signatureError;
      }
      console.log('✅ Firma guardada exitosamente:', signatureResult);

      // Actualizar orden como finalizada
      console.log('🔄 Actualizando estado de orden a finalizada...');
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          status: 'finalizada',
          final_signature_url: signatureData,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderError) {
        console.error('❌ Error al actualizar orden:', orderError);
        throw orderError;
      }
      console.log('✅ Orden actualizada exitosamente');

      // Disparar seguimiento para orden completada
      await triggerOrderFollowUp(order, 'order_completed');

      // Obtener detalles de la orden para generar cobranza
      console.log('🔍 Obteniendo detalles de la orden para cobranza...');
      const { data: orderDetails, error: orderDetailsError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            total_amount,
            vat_amount
          ),
          clients (
            name
          )
        `)
        .eq('id', order.id)
        .single();

      if (orderDetailsError) {
        console.error('⚠️ Error getting order details:', orderDetailsError);
      } else if (orderDetails) {
        console.log('✅ Detalles de orden obtenidos, generando cobranza...');
        // Calcular totales (incluyendo cashback si aplica)
        const cashbackPercent = rewardSettings?.apply_cashback_to_items
          ? (rewardSettings.general_cashback_percent || 0)
          : 0;

        const items = orderDetails.order_items || [];
        let totalAmount = 0;
        let vatAmount = 0;

        if (items.length > 0) {
          const itemsTotal = items.reduce((sum: number, item: any) => sum + (item.total_amount || 0), 0);
          // Aplicar cashback sobre el total con IVA
          totalAmount = itemsTotal * (1 + cashbackPercent / 100);
          // Mantener IVA sumado de items (el cashback no es IVA)
          vatAmount = items.reduce((sum: number, item: any) => sum + (item.vat_amount || 0), 0);
        } else {
          // Si no hay items, usar el estimado ya calculado
          totalAmount = orderDetails.estimated_cost || 0;
          vatAmount = orderDetails.order_items?.reduce((sum: number, item: any) => sum + (item.vat_amount || 0), 0) || 0;
        }

        const taxableAmount = totalAmount - vatAmount;

        // Generar número de ingreso
        const currentYear = new Date().getFullYear();
        const { data: existingIncomes } = await supabase
          .from('incomes')
          .select('income_number')
          .like('income_number', `ING-${currentYear}-%`)
          .order('created_at', { ascending: false })
          .limit(1);

        let nextNumber = '0001';
        if (existingIncomes && existingIncomes.length > 0) {
          const lastNumber = existingIncomes[0].income_number.split('-')[2];
          nextNumber = (parseInt(lastNumber) + 1).toString().padStart(4, '0');
        }
        const incomeNumber = `ING-${currentYear}-${nextNumber}`;

        // Crear registro de cobranza pendiente
        console.log('💰 Creando registro de cobranza:', { incomeNumber, totalAmount });
        const { error: incomeError } = await supabase
          .from('incomes')
          .insert({
            income_number: incomeNumber,
            amount: totalAmount,
            taxable_amount: taxableAmount,
            vat_amount: vatAmount,
            vat_rate: vatAmount > 0 ? 16 : 0,
            description: `Cobranza orden #${order.order_number}`,
            category: 'servicio',
            client_name: orderDetails.clients?.name || 'Cliente',
            account_type: 'no_fiscal', // Por defecto no fiscal, se cambiará al cobrar
            status: 'pendiente', // Pendiente de cobro
            has_invoice: false, // Se definirá al momento del cobro
            income_date: new Date().toISOString().split('T')[0]
          });

        if (incomeError) {
          console.error('⚠️ Error creating income record:', incomeError);
          // No fallar la operación por este error, solo registrar
        } else {
          console.log('✅ Registro de cobranza creado exitosamente');
          // Disparar seguimiento de finanzas: pago pendiente
          await supabase.functions.invoke('process-follow-ups', {
            body: {
              trigger_event: 'payment_pending',
              related_id: order.id,
              related_type: 'income',
              target_email: null,
              additional_data: {
                client_name: orderDetails.clients?.name || 'Cliente',
                amount: totalAmount
              }
            }
          });
        }
      }

      console.log('🎉 Proceso de confirmación completado exitosamente');
      toast({
        title: "Entrega Confirmada",
        description: "La orden ha sido marcada como finalizada con la firma del cliente",
      });

      onComplete();
      onClose();

    } catch (error) {
      console.error('❌ Error confirming delivery:', error);
      toast({
        title: "Error",
        description: "No se pudo confirmar la entrega. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <Card className="w-full max-w-lg mx-0 rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="pb-3 px-4 pt-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Confirmar Entrega
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground truncate">
              <span className="font-medium">Orden:</span> {order.order_number}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              <span className="font-medium">Cliente:</span> {order.clients?.name}
            </p>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Información de entrega */}
          <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">Confirmación de Entrega</h3>
              </div>
              <p className="text-xs text-green-700 dark:text-green-300 mb-2">
                Al firmar confirma que:
              </p>
              <ul className="text-xs text-green-700 dark:text-green-300 space-y-0.5 ml-2">
                <li>• Ha recibido los servicios/productos</li>
                <li>• Los trabajos fueron satisfactorios</li>
                <li>• No tiene pendientes adicionales</li>
                <li>• Acepta finalizar la orden</li>
              </ul>
            </CardContent>
          </Card>

          {/* Canvas de firma */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <PenTool className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold">Firma de Entrega</h3>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Firme en el recuadro para confirmar:
            </p>

            <div className="border-2 border-dashed border-border rounded-lg p-2 bg-white">
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: 'signature-canvas w-full h-40 bg-white rounded touch-action-none'
                }}
                backgroundColor="white"
                penColor="black"
                minWidth={1.5}
                maxWidth={3}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={clearSignature}
              disabled={loading}
              size="sm"
              className="w-full sm:w-auto"
            >
              Limpiar Firma
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            🔒 Al confirmar, se registrará la firma digitalmente
          </div>
        </CardContent>

        {/* Botones de acción fijos en la parte inferior */}
        <div className="p-4 bg-background border-t flex-shrink-0">
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleConfirmDelivery}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white w-full h-12"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Confirmando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar Entrega
                </div>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}