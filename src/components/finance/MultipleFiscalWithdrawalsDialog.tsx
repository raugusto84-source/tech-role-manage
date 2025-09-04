import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FiscalWithdrawal {
  id: string;
  amount: number;
  description: string;
  withdrawal_date: string;
  withdrawal_status: string;
}

interface MultipleFiscalWithdrawalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawals: FiscalWithdrawal[];
  onSuccess?: () => void;
}

export function MultipleFiscalWithdrawalsDialog({ 
  open, 
  onOpenChange, 
  withdrawals, 
  onSuccess 
}: MultipleFiscalWithdrawalsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [concept, setConcept] = useState("");
  const [description, setDescription] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [selectedWithdrawals, setSelectedWithdrawals] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedWithdrawals([]);
      setConcept("");
      setDescription("");
      setInvoiceNumber("");
    }
  }, [open]);

  const handleWithdrawalToggle = (withdrawalId: string) => {
    setSelectedWithdrawals(prev => 
      prev.includes(withdrawalId)
        ? prev.filter(id => id !== withdrawalId)
        : [...prev, withdrawalId]
    );
  };

  const selectedTotal = withdrawals
    .filter(w => selectedWithdrawals.includes(w.id))
    .reduce((sum, w) => sum + w.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedWithdrawals.length === 0) {
      toast({
        title: "Error",
        description: "Debe seleccionar al menos un retiro",
        variant: "destructive"
      });
      return;
    }

    if (!concept.trim() || !invoiceNumber.trim()) {
      toast({
        title: "Error", 
        description: "El concepto y número de factura son obligatorios",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Calculate VAT included in total (16%)
      const vatRate = 16;
      const totalWithVat = selectedTotal; // The selected total already includes VAT
      const taxableAmount = selectedTotal / (1 + vatRate / 100); // Calculate subtotal without VAT
      const vatAmount = selectedTotal - taxableAmount; // VAT is the difference

      // Create expense record for the combined withdrawals
      const { data: expenseData, error: expenseError } = await supabase
        .from("expenses")
        .insert([{
          expense_number: `EXP-${Date.now()}`,
          amount: totalWithVat,
          description: `[Retiro Fiscal] ${concept}${description ? ' - ' + description : ''}`,
          category: "retiros_fiscales",
          account_type: "fiscal",
          payment_method: "transferencia",
          expense_date: new Date().toISOString().split('T')[0],
          has_invoice: true,
          invoice_number: invoiceNumber,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          taxable_amount: taxableAmount
        }])
        .select('id')
        .single();

      if (expenseError) throw expenseError;

      // Update all selected withdrawals as processed
      const { error: updateError } = await supabase
        .from("fiscal_withdrawals")
        .update({ 
          withdrawal_status: "processed",
          withdrawn_at: new Date().toISOString()
        })
        .in('id', selectedWithdrawals);

      if (updateError) throw updateError;

      toast({
        title: "Retiros procesados",
        description: `Se procesaron ${selectedWithdrawals.length} retiros fiscales por $${totalWithVat.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (incluye IVA)`
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error processing withdrawals:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron procesar los retiros",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              📋
            </div>
            Procesar Múltiples Retiros Fiscales
          </DialogTitle>
          <DialogDescription>
            Procese varios retiros fiscales con un solo concepto y número de factura
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="concept">Concepto *</Label>
            <Input
              id="concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Compra de materiales de oficina"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Número de Factura *</Label>
            <Input
              id="invoiceNumber"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="A001-001-000001"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción Adicional</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional adicional"
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <Label>Seleccionar Retiros a Procesar</Label>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center space-x-3 p-3 border-b last:border-b-0 hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedWithdrawals.includes(withdrawal.id)}
                    onCheckedChange={() => handleWithdrawalToggle(withdrawal.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">${withdrawal.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                    <div className="text-sm text-muted-foreground">{withdrawal.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(withdrawal.withdrawal_date).toLocaleDateString('es-MX')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedWithdrawals.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Retiros seleccionados:</span>
                  <span className="font-medium">{selectedWithdrawals.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monto gravable:</span>
                  <span className="font-medium">${(selectedTotal / 1.16).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (16%):</span>
                  <span className="font-medium">${(selectedTotal - (selectedTotal / 1.16)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-bold">Total a registrar:</span>
                  <span className="font-bold">${selectedTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || selectedWithdrawals.length === 0 || !concept.trim() || !invoiceNumber.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Procesando..." : "Procesar Retiros"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}