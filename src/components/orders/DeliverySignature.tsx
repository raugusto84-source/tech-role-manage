import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PenTool, CheckCircle2, ArrowLeft, X } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

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

    try {
      const signatureData = signatureRef.current.toDataURL();
      console.log('✅ Firma capturada exitosamente');

      // Guardar firma de entrega
      console.log('💾 Insertando firma en delivery_signatures...');
      const { error: signatureError } = await supabase
        .from('delivery_signatures')
        .insert({
          order_id: order.id,
          client_name: order.clients?.name || 'Cliente',
          client_signature_data: signatureData,
          delivery_date: new Date().toISOString(),
        });

      if (signatureError) {
        console.error('❌ Error al insertar firma:', signatureError);
        throw signatureError;
      }
      console.log('✅ Firma guardada exitosamente');

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
        // Calcular totales
        const totalAmount = orderDetails.order_items?.reduce((sum: number, item: any) => sum + (item.total_amount || 0), 0) || orderDetails.estimated_cost || 0;
        const vatAmount = orderDetails.order_items?.reduce((sum: number, item: any) => sum + (item.vat_amount || 0), 0) || 0;
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              Confirmar Entrega
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Orden: {order.order_number}
            </p>
            <p className="text-sm text-muted-foreground">
              Cliente: {order.clients?.name}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Información de entrega */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-800">Confirmación de Entrega</h3>
              </div>
              <p className="text-sm text-green-700">
                Al firmar confirma que:
              </p>
              <ul className="text-sm text-green-700 mt-2 ml-4 space-y-1">
                <li>• Ha recibido los servicios/productos solicitados</li>
                <li>• Los trabajos fueron realizados satisfactoriamente</li>
                <li>• No tiene pendientes adicionales con esta orden</li>
                <li>• Acepta que la orden sea marcada como finalizada</li>
              </ul>
            </CardContent>
          </Card>

          {/* Canvas de firma */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Firma de Entrega</h3>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Por favor, firme en el recuadro para confirmar la entrega:
            </p>

            <div className="border-2 border-dashed border-border rounded-lg p-4 bg-background">
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: 'signature-canvas w-full h-48 bg-white rounded border border-border'
                }}
                backgroundColor="white"
                penColor="black"
                minWidth={1}
                maxWidth={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={clearSignature}
                disabled={loading}
              >
                Limpiar Firma
              </Button>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="sm:order-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            
            <Button
              onClick={handleConfirmDelivery}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white sm:order-2 flex-1"
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
          </div>

          <div className="text-xs text-muted-foreground text-center pt-2">
            🔒 Al confirmar, se registrará la firma digitalmente y la orden será finalizada.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}