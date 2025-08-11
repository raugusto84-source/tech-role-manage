import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, FileText, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
  const { toast } = useToast();

  const handleApproval = async () => {
    setApproving(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          client_approval: true,
          client_approval_notes: approvalNotes || "Orden aprobada sin comentarios adicionales",
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
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
              <h4 className="font-medium text-warning mb-2">
                ⚠️ Esta orden requiere tu aprobación
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                Por favor revisa los detalles del servicio y confirma que estás de acuerdo con proceder. 
                Una vez aprobada, nuestros técnicos comenzarán a trabajar en tu solicitud.
              </p>
              
              <div className="space-y-3">
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
                
                <Button 
                  onClick={handleApproval}
                  disabled={approving}
                  className="w-full"
                  size="lg"
                >
                  {approving ? "Aprobando..." : "✓ Aprobar Orden"}
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
    </div>
  );
}