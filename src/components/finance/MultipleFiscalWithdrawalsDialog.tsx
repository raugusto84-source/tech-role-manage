import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface MultipleFiscalWithdrawalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawals: any[];
  onSuccess: () => void;
}

export function MultipleFiscalWithdrawalsDialog({ 
  open, 
  onOpenChange, 
  withdrawals, 
  onSuccess 
}: MultipleFiscalWithdrawalsDialogProps) {
  const [concept, setConcept] = useState("");
  const [description, setDescription] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [selectedWithdrawals, setSelectedWithdrawals] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleWithdrawalToggle = (withdrawalId: string) => {
    setSelectedWithdrawals(prev => 
      prev.includes(withdrawalId) 
        ? prev.filter(id => id !== withdrawalId)
        : [...prev, withdrawalId]
    );
  };

  const selectedTotal = withdrawals
    .filter(w => selectedWithdrawals.includes(w.id))
    .reduce((sum, w) => sum + Number(w.amount), 0);

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
        description: "El número de factura es obligatorio para transacciones fiscales múltiples",
        variant: "destructive"
      });
      return;
    }

    if (selectedWithdrawals.length === 0) {
      toast({
        title: "Error",
        description: "Debe seleccionar al menos un retiro",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Process each selected withdrawal
      for (const withdrawalId of selectedWithdrawals) {
        const withdrawal = withdrawals.find(w => w.id === withdrawalId);
        if (!withdrawal) continue;

        // Calculate IVA for fiscal account (16%)
        const amount = Number(withdrawal.amount);
        const taxableAmount = amount / 1.16;
        const vatAmount = amount - taxableAmount;

        // Create the fiscal expense record with invoice info
        const { error: expenseError } = await supabase.from("expenses").insert({
          amount: amount,
          description: `${concept}${description ? ' - ' + description : ''} (${withdrawal.description})`,
          category: 'retiro_fiscal_multiple',
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
        }).eq("id", withdrawalId);

        if (updateError) throw updateError;
      }

      toast({
        title: "Retiros fiscales realizados exitosamente",
        description: `Se procesaron ${selectedWithdrawals.length} retiros por un total de $${selectedTotal.toLocaleString()} con factura ${invoiceNumber}`
      });

      setConcept("");
      setDescription("");
      setInvoiceNumber("");
      setSelectedWithdrawals([]);
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible realizar los retiros",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Realizar Retiros Fiscales Múltiples</DialogTitle>
          <DialogDescription>
            Seleccione los retiros que desea procesar con un solo concepto y factura
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="concept">Concepto *</Label>
            <Input
              id="concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Retiro factura compra materiales múltiples"
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
              Obligatorio para retiros fiscales múltiples
            </p>
          </div>

          <div>
            <Label htmlFor="description">Descripción adicional</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles adicionales de los retiros (opcional)"
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Seleccionar Retiros Fiscales Disponibles</Label>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {withdrawals.map((withdrawal) => (
                <Card key={withdrawal.id} className="p-3">
                  <CardContent className="p-0">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={withdrawal.id}
                        checked={selectedWithdrawals.includes(withdrawal.id)}
                        onCheckedChange={() => handleWithdrawalToggle(withdrawal.id)}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium">
                              ${Number(withdrawal.amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {withdrawal.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(withdrawal.created_at).toLocaleDateString('es-CO')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {selectedWithdrawals.length > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm font-medium text-green-800 mb-1">
                Resumen de Retiros Seleccionados
              </div>
              <div className="text-xs text-green-600 space-y-1">
                <div>Cantidad de retiros: {selectedWithdrawals.length}</div>
                <div>Total a retirar: ${selectedTotal.toFixed(2)}</div>
                <div>Base gravable: ${(selectedTotal / 1.16).toFixed(2)}</div>
                <div>IVA (16%): ${(selectedTotal - selectedTotal / 1.16).toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || selectedWithdrawals.length === 0} 
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? "Procesando..." : `Procesar ${selectedWithdrawals.length} Retiros`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}