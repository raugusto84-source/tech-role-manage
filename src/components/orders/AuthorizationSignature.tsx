import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, PenTool, FileText } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

interface AuthorizationSignatureProps {
  orderId: string;
  clientName: string;
  orderNumber: string;
  onSignatureComplete: () => void;
}

export function AuthorizationSignature({ orderId, clientName, orderNumber, onSignatureComplete }: AuthorizationSignatureProps) {
  const { toast } = useToast();
  const signatureRef = useRef<SignatureCanvas>(null);
  const [authorizationNotes, setAuthorizationNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientNameInput, setClientNameInput] = useState(clientName || '');

  const clearSignature = () => {
    signatureRef.current?.clear();
  };

  const handleSubmit = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: "Error",
        description: "Por favor, proporcione su firma para autorizar la orden",
        variant: "destructive"
      });
      return;
    }

    if (!clientNameInput.trim()) {
      toast({
        title: "Error", 
        description: "Por favor, ingrese su nombre completo",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const signatureData = signatureRef.current.toDataURL();

      const { error } = await supabase
        .from('order_authorization_signatures')
        .insert({
          order_id: orderId,
          client_signature_data: signatureData,
          client_name: clientNameInput.trim(),
          authorization_notes: authorizationNotes.trim() || null,
          signed_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Orden Autorizada",
        description: "Su orden ha sido autorizada exitosamente y será procesada por nuestro equipo.",
        variant: "default"
      });

      onSignatureComplete();
    } catch (error) {
      console.error('Error saving authorization signature:', error);
      toast({
        title: "Error",
        description: "No se pudo autorizar la orden. Intente nuevamente.",
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
            <FileText className="h-6 w-6 text-primary" />
            Autorización de Orden de Servicio
          </CardTitle>
          <p className="text-muted-foreground">
            Orden #{orderNumber}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Para procesar su orden de servicio, necesitamos su autorización mediante firma digital
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-info/10 border border-info/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <PenTool className="h-5 w-5 text-info mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-info mb-1">¿Por qué necesitamos su autorización?</p>
                <ul className="text-info/80 space-y-1 list-disc list-inside">
                  <li>Confirma que acepta los términos del servicio</li>
                  <li>Autoriza el inicio de los trabajos técnicos</li>
                  <li>Valida los costos estimados presentados</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Nombre del cliente */}
          <div className="space-y-2">
            <Label htmlFor="clientName">Nombre completo *</Label>
            <Input
              id="clientName"
              value={clientNameInput}
              onChange={(e) => setClientNameInput(e.target.value)}
              placeholder="Ingrese su nombre completo"
              required
            />
          </div>

          {/* Notas de autorización */}
          <div className="space-y-2">
            <Label htmlFor="authorizationNotes">Comentarios adicionales (opcional)</Label>
            <Textarea
              id="authorizationNotes"
              value={authorizationNotes}
              onChange={(e) => setAuthorizationNotes(e.target.value)}
              placeholder="Instrucciones especiales, horarios preferidos, etc..."
              rows={3}
            />
          </div>

          {/* Área de firma */}
          <div className="space-y-2">
            <Label>Firma de autorización *</Label>
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
                  Firme en el área de arriba para autorizar la orden
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
                  Autorizando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Autorizar Orden
                </>
              )}
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">Al firmar, usted autoriza:</p>
            <ul className="text-xs space-y-1">
              <li>• El inicio de los trabajos según lo descrito en la orden</li>
              <li>• Los costos estimados presentados</li>
              <li>• Las condiciones de servicio establecidas</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}