import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, FileText, Calendar, User, PenTool, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import SignatureCanvas from "react-signature-canvas";

interface ClientOrderApprovalProps {
  order: {
    id: string;
    order_number: string;
    failure_description: string;
    delivery_date: string;
    created_at: string;
    status: string;
    client_approval?: boolean;
    client_approval_notes?: string;
    client_approved_at?: string;
    estimated_cost?: number;
    clients?: {
      name: string;
      client_number: string;
      address: string;
    };
    service_types?: {
      name: string;
      description?: string;
    };
  };
  onApprovalChange?: () => void;
}

export function ClientOrderApproval({ order, onApprovalChange }: ClientOrderApprovalProps) {
  const [approving, setApproving] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string>("");
  const signatureRef = useRef<SignatureCanvas>(null);
  const { toast } = useToast();

  const handleSignatureConfirm = () => {
    if (signatureRef.current?.isEmpty()) {
      toast({
        title: "Firma requerida",
        description: "Por favor, firma en el área designada para continuar.",
        variant: "destructive"
      });
      return;
    }

    const signatureDataURL = signatureRef.current?.toDataURL();
    setSignatureData(signatureDataURL || "");
    setShowSignature(false);
    
    toast({
      title: "Firma capturada",
      description: "Firma registrada correctamente. Ahora puedes aprobar la orden.",
      variant: "default"
    });
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
  };

  const handleApproval = async () => {
    if (!signatureData) {
      toast({
        title: "Firma requerida",
        description: "Debes firmar antes de aprobar la orden.",
        variant: "destructive"
      });
      setShowSignature(true);
      return;
    }

    setApproving(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          client_approval: true,
          client_approval_notes: approvalNotes || "Orden aprobada sin comentarios adicionales",
          initial_signature_url: signatureData
        })
        .eq("id", order.id);

      if (error) throw error;

      toast({
        title: "Orden Aprobada",
        description: "La orden ha sido aprobada y enviada a los técnicos.",
        variant: "default"
      });

      onApprovalChange?.();
    } catch (error) {
      console.error("Error approving order:", error);
      toast({
        title: "Error",
        description: "No se pudo aprobar la orden. Intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setApproving(false);
    }
  };

  const isPendingApproval = order.status === "pendiente_aprobacion";
  const isAlreadyApproved = order.client_approval;

  return (
    <div className="space-y-6">
      {/* Estado de la orden */}
      <Card className={`border-l-4 ${
        isPendingApproval 
          ? "border-l-warning bg-warning/5" 
          : isAlreadyApproved 
            ? "border-l-success bg-success/5"
            : "border-l-muted"
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {isPendingApproval ? (
                <AlertCircle className="h-5 w-5 text-warning" />
              ) : isAlreadyApproved ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground" />
              )}
              {order.order_number}
            </CardTitle>
            <Badge className={
              isPendingApproval 
                ? "bg-warning/10 text-warning border-warning/20"
                : isAlreadyApproved
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-muted text-foreground"
            }>
              {isPendingApproval ? "PENDIENTE APROBACIÓN" : 
               isAlreadyApproved ? "APROBADA" : 
               order.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Información del servicio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <User className="h-4 w-4 mr-2" />
                <span>Cliente: {order.clients?.name}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Fecha de entrega: {format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: es })}</span>
              </div>
            </div>
            
            {order.estimated_cost && (
              <div className="flex items-center justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Costo estimado</p>
                  <p className="text-2xl font-bold text-primary">${order.estimated_cost.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Descripción del servicio */}
          <div className="space-y-2">
            <h4 className="font-medium">Servicio solicitado:</h4>
            <p className="text-sm font-medium text-primary">{order.service_types?.name}</p>
            <p className="text-sm text-muted-foreground">{order.failure_description}</p>
          </div>

          {/* Estado de aprobación */}
          {isPendingApproval && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-6">
              <h4 className="font-bold text-warning mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                ⚠️ Esta orden requiere tu firma y aprobación
              </h4>
              <div className="bg-white rounded-lg p-4 mb-4 border">
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Importante:</strong> Al firmar y aprobar esta orden, confirmas que:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mb-3">
                  <li>Has revisado y aceptas los servicios descritos</li>
                  <li>Autorizas el costo estimado mostrado</li>
                  <li>Permites que nuestros técnicos inicien el trabajo</li>
                  <li>Entiendes que el trabajo comenzará una vez aprobado</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                {/* Área de firma */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <PenTool className="h-4 w-4" />
                      Firma digital requerida
                    </label>
                    {signatureData && (
                      <div className="flex items-center gap-2 text-success text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Firma capturada
                      </div>
                    )}
                  </div>
                  
                  {!signatureData ? (
                    <Button 
                      onClick={() => setShowSignature(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <PenTool className="h-4 w-4 mr-2" />
                      Hacer clic para firmar
                    </Button>
                  ) : (
                    <div className="border rounded-lg p-3 bg-success/5 border-success/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-success">✓ Firma registrada correctamente</span>
                        <Button 
                          onClick={() => setShowSignature(true)}
                          variant="ghost"
                          size="sm"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Cambiar firma
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Comentarios adicionales */}
                <div>
                  <label className="text-sm font-medium">Comentarios adicionales (opcional)</label>
                  <Textarea
                    placeholder="Agrega cualquier comentario o instrucción especial..."
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>
                
                {/* Botón de aprobación */}
                <Button 
                  onClick={handleApproval}
                  disabled={approving || !signatureData}
                  className="w-full"
                  size="lg"
                >
                  {approving ? "Aprobando..." : "✓ Firmar y Aprobar Orden"}
                </Button>
              </div>
            </div>
          )}

          {/* Orden ya aprobada */}
          {isAlreadyApproved && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-4">
              <h4 className="font-medium text-success mb-2">
                ✓ Orden aprobada
              </h4>
              <p className="text-sm text-muted-foreground">
                Aprobada el {order.client_approved_at && format(new Date(order.client_approved_at), 'dd/MM/yyyy HH:mm', { locale: es })}
              </p>
              {order.client_approval_notes && (
                <div className="mt-2">
                  <p className="text-sm font-medium">Comentarios:</p>
                  <p className="text-sm text-muted-foreground italic">"{order.client_approval_notes}"</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de firma digital */}
      {showSignature && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                Firma Digital
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Firma en el área blanca de abajo para aprobar la orden
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-2 bg-white">
                <SignatureCanvas
                  ref={signatureRef}
                  canvasProps={{
                    width: 400,
                    height: 200,
                    className: 'signature-canvas w-full'
                  }}
                  backgroundColor="white"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={clearSignature}
                  variant="outline"
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
                <Button 
                  onClick={handleSignatureConfirm}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Firma
                </Button>
              </div>
              
              <Button 
                onClick={() => setShowSignature(false)}
                variant="ghost"
                className="w-full"
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}