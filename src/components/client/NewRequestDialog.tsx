import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Diálogo reutilizable para crear una nueva solicitud:
 * - type: "orden" | "cotizacion" (para etiquetar la solicitud)
 * Inserta en public.order_requests (los clientes tienen permiso para INSERT)
 */
export default function NewRequestDialog({
  open,
  onOpenChange,
  onSuccess,
  type = "orden",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  type?: "orden" | "cotizacion";
}) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [serviceDescription, setServiceDescription] = useState("");
  const [failureDescription, setFailureDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setServiceDescription("");
    setFailureDescription("");
    setPreferredDate("");
    setAddress("");
    setPhone("");
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const payload = {
        client_name: profile?.full_name || "Cliente",
        client_email: profile?.email || "",
        client_phone: phone || null,
        client_address: address || "",
        service_description: serviceDescription || (type === "cotizacion" ? "Solicitud de cotización" : "Solicitud de servicio"),
        failure_description: failureDescription || (type === "cotizacion" ? "El cliente solicita cotización." : ""),
        preferred_delivery_date: preferredDate || null,
        status: "pendiente",
      };

      const { error } = await supabase.from("order_requests").insert(payload);
      if (error) throw error;

      toast({ title: "Enviado", description: "Tu solicitud ha sido registrada." });
      reset();
      onSuccess?.();
    } catch (err: any) {
      console.error("Error creating request:", err);
      toast({ title: "Error", description: "No se pudo enviar tu solicitud.", variant: "destructive" });
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === "cotizacion" ? "Solicitar Cotización" : "Nueva Orden"}</DialogTitle>
          <DialogDescription>
            Completa los campos y enviaremos tu solicitud al equipo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Descripción del servicio</Label>
            <Input
              placeholder={type === "cotizacion" ? "Ej. Cotización mantenimiento de PC" : "Ej. Mantenimiento de PC"}
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Descripción del problema (opcional)</Label>
            <Textarea
              placeholder="Describe el problema o necesidad"
              value={failureDescription}
              onChange={(e) => setFailureDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha preferida (opcional)</Label>
              <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono de contacto</Label>
              <Input placeholder="Tu teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dirección</Label>
            <Input placeholder="Tu dirección" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !profile?.email}>
            {loading ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
