import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FiscalWithdrawalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawal: any;
  onSuccess: () => void;
}

export function FiscalWithdrawalDialog({ open, onOpenChange, withdrawal, onSuccess }: FiscalWithdrawalDialogProps) {
  const [concept, setConcept] = useState("");
  const [description, setDescription] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!concept.trim()) {
      toast({
        title: "Error",
        description: "El concepto es obligatorio",
        variant: "destructive"
      });
      return;
    }

    if (!invoiceNumber.trim()) {
      toast({
        title: "Error", 
        description: "El número de factura es obligatorio para transacciones fiscales",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Calcular IVA para cuenta fiscal (16%)
      const amount = Number(withdrawal.amount);
      const taxableAmount = amount / 1.16;
      const vatAmount = amount - taxableAmount;

      // Create the fiscal expense record with invoice info
      const { error: expenseError } = await supabase.from("expenses").insert({
        amount: amount,
        description: `${concept}${description ? ' - ' + description : ''}`,
        category: 'retiro_fiscal',
        account_type: 'fiscal',
        payment_method: 'transferencia',
        expense_date: new Date().toISOString().split('T')[0],
        status: 'pagado',
        has_invoice: true,
        invoice_number: invoiceNumber.trim(),
        vat_rate: 16,
        vat_amount: vatAmount,
        taxable_amount: taxableAmount
      } as any);

      if (expenseError) throw expenseError;

      // Update the withdrawal status
      const { error: updateError } = await supabase.from("fiscal_withdrawals").update({
        withdrawal_status: "withdrawn",
        withdrawn_at: new Date().toISOString(),
        withdrawn_by: (await supabase.auth.getUser()).data.user?.id
      }).eq("id", withdrawal.id);

      if (updateError) throw updateError;

      toast({
        title: "Retiro realizado exitosamente",
        description: `Se retiró $${amount.toLocaleString()} con factura ${invoiceNumber}`
      });

      setConcept("");
      setDescription("");
      setInvoiceNumber("");
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible realizar el retiro",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Realizar Retiro Fiscal</DialogTitle>
          <DialogDescription>
            Retiro de ${withdrawal?.amount?.toLocaleString()} de cuenta fiscal
            <br />
            <span className="text-sm text-orange-600">
              Requiere número de factura para transacciones fiscales
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="concept">Concepto *</Label>
            <Input
              id="concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Retiro factura compra materiales"
            />
          </div>

          <div>
            <Label htmlFor="invoice-number">Número de Factura *</Label>
            <Input
              id="invoice-number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ej: A123456789"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Obligatorio para retiros de cuenta fiscal
            </p>
          </div>

          <div>
            <Label htmlFor="description">Descripción adicional</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles adicionales del retiro (opcional)"
              rows={3}
            />
          </div>

          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="text-sm font-medium text-orange-800 mb-1">
              Cálculo automático de IVA (16%)
            </div>
            <div className="text-xs text-orange-600 space-y-1">
              <div>Base gravable: ${(Number(withdrawal?.amount || 0) / 1.16).toFixed(2)}</div>
              <div>IVA (16%): ${(Number(withdrawal?.amount || 0) - Number(withdrawal?.amount || 0) / 1.16).toFixed(2)}</div>
              <div className="font-medium">Total: ${Number(withdrawal?.amount || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? "Procesando..." : "Confirmar Retiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}