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

    try {
      const signatureData = signatureRef.current.toDataURL();

      // Guardar firma de entrega
      const { error: signatureError } = await supabase
        .from('delivery_signatures')
        .insert({
          order_id: order.id,
          client_name: order.clients?.name || 'Cliente',
          client_signature_data: signatureData,
          delivery_date: new Date().toISOString(),
        });

      if (signatureError) throw signatureError;

      // Actualizar orden como finalizada
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          status: 'finalizada',
          final_signature_url: signatureData,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      toast({
        title: "Entrega Confirmada",
        description: "La orden ha sido marcada como finalizada con la firma del cliente",
      });

      onComplete();
      onClose();

    } catch (error) {
      console.error('Error confirming delivery:', error);
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