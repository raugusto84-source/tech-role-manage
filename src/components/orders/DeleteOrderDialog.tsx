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

interface DeleteOrderDialogProps {
  orderId: string;
  orderNumber: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteOrderDialog({
  orderId,
  orderNumber,
  isOpen,
  onOpenChange,
  onDeleted
}: DeleteOrderDialogProps) {
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
      const { data, error } = await supabase.rpc("soft_delete_order", {
        p_order_id: orderId,
        p_reason: reason.trim(),
      });

      if (error) throw error;

      toast({
        title: "Orden eliminada",
        description: `La orden ${orderNumber} ha sido eliminada correctamente`,
      });

      onDeleted?.();
      onOpenChange(false);
      setReason("");
    } catch (error: any) {
      console.error("Error deleting order:", error);
      toast({
        title: "Error",
        description: error.message || "Error al eliminar la orden",
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
            Eliminar Orden
          </DialogTitle>
          <DialogDescription>
            ¿Está seguro que desea eliminar la orden <strong>{orderNumber}</strong>?
            Esta acción quedará registrada en el historial.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2">
          <Label htmlFor="reason">Motivo de eliminación *</Label>
          <Textarea
            id="reason"
            placeholder="Especifique el motivo por el cual se elimina esta orden..."
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
            {isDeleting ? "Eliminando..." : "Eliminar Orden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}