import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PenTool, CheckCircle2, ArrowLeft } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

interface SimpleOrderApprovalProps {
  order: {
    id: string;
    order_number: string;
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

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const vatTotal = orderItems.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
    const total = orderItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    
    return { subtotal, vatTotal, total };
  };

  const { subtotal, vatTotal, total } = calculateTotals();

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

      // Guardar la firma de autorización
      const { error: signatureError } = await supabase
        .from('order_authorization_signatures')
        .insert({
          order_id: order.id,
          client_signature_data: signatureData,
          client_name: order.clients?.name || '',
          authorization_date: new Date().toISOString()
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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={onBack} className="mr-4">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Aprobación de Orden</h1>
            <p className="text-muted-foreground">{order.order_number}</p>
          </div>
        </div>

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

        {!showSignature ? (
          <Card>
            <CardContent className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Confirmar Aprobación</h3>
              <p className="text-muted-foreground mb-6">
                Al aprobar esta orden, confirma que está de acuerdo con los servicios y el costo total.
              </p>
              <Button 
                onClick={() => setShowSignature(true)}
                className="px-8 py-3 text-lg"
              >
                <PenTool className="h-5 w-5 mr-2" />
                Firmar y Aceptar
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PenTool className="h-5 w-5 mr-2" />
                Firma de Aprobación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    Firme en el área de arriba para aprobar la orden
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
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirmar Aprobación
                    </>
                  )}
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Al firmar, confirma que aprueba la orden con los servicios y costos mostrados
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}