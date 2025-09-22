import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { revertOrderPayments, RevertPaymentResult } from '@/utils/paymentRevert';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface PaymentRevertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onSuccess?: () => void;
}

export function PaymentRevertDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onSuccess
}: PaymentRevertDialogProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();

  const handleRevert = async () => {
    if (!orderId) return;

    setLoading(true);
    try {
      const result: RevertPaymentResult = await revertOrderPayments(orderId);
      
      if (result.success) {
        toast({
          title: "Pagos revertidos",
          description: result.message,
          variant: "default"
        });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast({
          title: "Error al revertir",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudieron revertir los pagos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setShowConfirmation(false);
    }
  };

  const handleConfirmRevert = () => {
    setShowConfirmation(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Revertir Pagos
            </DialogTitle>
            <DialogDescription className="text-left">
              ¿Estás seguro de que deseas revertir todos los pagos de la orden <strong>{orderNumber}</strong>?
              <br /><br />
              Esta acción:
              <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                <li>Eliminará todos los registros de pago</li>
                <li>Restaurará la deuda completa de la orden</li>
                <li>Permitirá cobrar la orden nuevamente</li>
                <li>Se registrará en el historial financiero</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRevert}
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Revertir Pagos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar reversión?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. ¿Está completamente seguro de que desea proceder con la reversión de todos los pagos de la orden <strong>{orderNumber}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmation(false)} disabled={loading}>
              No, cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevert}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Revirtiendo...
                </>
              ) : (
                "Sí, revertir pagos"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}