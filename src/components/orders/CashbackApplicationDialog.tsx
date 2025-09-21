import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCOPCeilToTen } from "@/utils/currency";

interface CashbackApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableCashback: number;
  orderTotal: number;
  onApply: (amount: number) => void;
}

export function CashbackApplicationDialog({ 
  open, 
  onOpenChange, 
  availableCashback, 
  orderTotal, 
  onApply 
}: CashbackApplicationDialogProps) {
  const { toast } = useToast();
  const [amountToUse, setAmountToUse] = useState("");

  const formatCurrency = formatCOPCeilToTen;
  const formatCashbackExact = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  const maxUsableAmount = Math.min(availableCashback, orderTotal);

  const handleApply = () => {
    const amount = Number(amountToUse);
    
    if (amount <= 0) {
      toast({
        title: "Error",
        description: "Debes ingresar una cantidad válida",
        variant: "destructive"
      });
      return;
    }

    if (amount > availableCashback) {
      toast({
        title: "Error", 
        description: "No puedes usar más cashback del disponible",
        variant: "destructive"
      });
      return;
    }

    if (amount > orderTotal) {
      toast({
        title: "Error",
        description: "No puedes usar más cashback que el total de la orden",
        variant: "destructive"
      });
      return;
    }

    onApply(amount);
    onOpenChange(false);
    setAmountToUse("");
  };

  const handleUseAll = () => {
    setAmountToUse(maxUsableAmount.toString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-600" />
            Aplicar Cashback
          </DialogTitle>
          <DialogDescription>
            Usa tu cashback disponible como descuento en esta orden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Cashback disponible:</span>
                <div className="font-bold text-green-600">{formatCashbackExact(availableCashback)}</div>
              </div>
              <div>
                <span className="text-gray-600">Total de la orden:</span>
                <div className="font-bold">{formatCurrency(orderTotal)}</div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-green-200">
              <span className="text-gray-600 text-sm">Máximo a usar:</span>
              <div className="font-bold text-lg text-green-700">{formatCurrency(maxUsableAmount)}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cashback-amount">Cantidad a usar</Label>
            <div className="flex gap-2">
              <Input
                id="cashback-amount"
                type="number"
                step="0.01"
                min="0"
                max={maxUsableAmount}
                value={amountToUse}
                onChange={(e) => setAmountToUse(e.target.value)}
                placeholder="0.00"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleUseAll}
                disabled={maxUsableAmount <= 0}
              >
                Usar todo
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Máximo: {formatCurrency(maxUsableAmount)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleApply}
            disabled={!amountToUse || Number(amountToUse) <= 0}
            className="bg-green-600 hover:bg-green-700"
          >
            Aplicar Cashback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}