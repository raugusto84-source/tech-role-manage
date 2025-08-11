import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, PenTool } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

interface DeliverySignatureProps {
  orderId: string;
  clientName: string;
  onSignatureComplete: () => void;
}

export function DeliverySignature({ orderId, clientName, onSignatureComplete }: DeliverySignatureProps) {
  const { toast } = useToast();
  const signatureRef = useRef<SignatureCanvas>(null);
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientNameInput, setClientNameInput] = useState(clientName || '');

  const clearSignature = () => {
    signatureRef.current?.clear();
  };

  const handleSubmit = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: "Error",
        description: "Por favor, proporcione su firma",
        variant: "destructive"
      });
      return;
    }

    if (!clientNameInput.trim()) {
      toast({
        title: "Error", 
        description: "Por favor, ingrese su nombre",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const signatureData = signatureRef.current.toDataURL();

      const { error } = await supabase
        .from('delivery_signatures')
        .insert({
          order_id: orderId,
          client_signature_data: signatureData,
          client_name: clientNameInput.trim(),
          observations: observations.trim() || null,
          delivery_date: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Firma registrada correctamente. Ahora puede proceder con la encuesta de satisfacción.",
        variant: "default"
      });

      onSignatureComplete();
    } catch (error) {
      console.error('Error saving signature:', error);
      toast({
        title: "Error",
        description: "No se pudo registrar la firma. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <PenTool className="h-6 w-6 text-primary" />
            Conformidad de Entrega de Servicio
          </CardTitle>
          <p className="text-muted-foreground">
            Por favor, confirme que ha recibido el servicio satisfactoriamente
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Nombre del cliente */}
          <div className="space-y-2">
            <Label htmlFor="clientName">Nombre completo</Label>
            <Input
              id="clientName"
              value={clientNameInput}
              onChange={(e) => setClientNameInput(e.target.value)}
              placeholder="Ingrese su nombre completo"
              required
            />
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <Label htmlFor="observations">Observaciones (opcional)</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Comentarios adicionales sobre el servicio recibido..."
              rows={3}
            />
          </div>

          {/* Área de firma */}
          <div className="space-y-2">
            <Label>Firma de conformidad</Label>
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
                  Firme en el área de arriba para confirmar la conformidad
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
          </div>

          {/* Botones de acción */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Registrando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Entrega
                </>
              )}
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Al firmar, confirma que ha recibido el servicio según lo acordado
          </div>
        </CardContent>
      </Card>
    </div>
  );
}