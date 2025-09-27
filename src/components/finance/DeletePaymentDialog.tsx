import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

interface DeletePaymentDialogProps {
  paymentId: string;
  paymentAmount: number;
  orderNumber?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeletePaymentDialog({
  paymentId,
  paymentAmount,
  orderNumber,
  isOpen,
  onOpenChange,
  onDeleted
}: DeletePaymentDialogProps) {
  const [reason, setReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Debe especificar el motivo de la eliminación",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc("soft_delete_payment", {
        p_payment_id: paymentId,
        p_reason: reason.trim(),
      });

      if (error) throw error;

      toast({
        title: "Pago eliminado",
        description: `El pago de $${paymentAmount.toLocaleString()} ha sido eliminado correctamente`,
      });

      onDeleted?.();
      onOpenChange(false);
      setReason("");
    } catch (error: any) {
      console.error("Error deleting payment:", error);
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el pago",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Eliminar Pago
          </DialogTitle>
          <DialogDescription>
            ¿Está seguro que desea eliminar el pago de <strong>${paymentAmount.toLocaleString()}</strong>
            {orderNumber && ` de la orden ${orderNumber}`}?
            Esta acción quedará registrada en el historial.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2">
          <Label htmlFor="reason">Motivo de eliminación *</Label>
          <Textarea
            id="reason"
            placeholder="Especifique el motivo por el cual se elimina este pago..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-20"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || !reason.trim()}
          >
            {isDeleting ? "Eliminando..." : "Eliminar Pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}