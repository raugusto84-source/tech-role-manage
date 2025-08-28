import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: {
    id: string;
    order_number: string;
    client_name: string;
    client_email: string;
    estimated_cost: number;
    total_paid?: number;
    remaining_balance?: number;
    total_vat_amount?: number;
    subtotal_without_vat?: number;
    total_with_vat?: number;
    collection_type?: string;
    policy_payment_id?: string;
    policy_name?: string;
    payment_period?: string;
    account_type?: string;
  } | null;
  onSuccess?: () => void;
}

export function CollectionDialog({ open, onOpenChange, collection, onSuccess }: CollectionDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [accountType, setAccountType] = useState<"fiscal" | "no_fiscal">("no_fiscal");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [description, setDescription] = useState("");
  const [vatRate, setVatRate] = useState<string>("16");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collection || !amount) return;

    // Validar factura para cuentas fiscales
    if (accountType === "fiscal" && (!invoiceNumber || invoiceNumber.trim() === "")) {
      toast({
        title: "Error",
        description: "Para cuentas fiscales es obligatorio ingresar el número de factura",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const finalAmount = Number(amount);
      
      if (collection.collection_type === 'policy_payment') {
        // Handle policy payment collection
        const finalDescription = description || `Cobro póliza ${collection.policy_name} - ${collection.payment_period} - ${collection.client_name}`;
        
        // Calculate VAT for fiscal income (always included)
        let vatAmount = 0;
        let totalAmount = finalAmount;
        
        if (accountType === "fiscal") {
          const vatRateNum = Number(vatRate);
          vatAmount = finalAmount * (vatRateNum / 100);
          totalAmount = finalAmount + vatAmount; // Total = Subtotal + IVA
        }

        // Create the income record
        const { data: incomeData, error: incomeError } = await supabase
          .from("incomes")
          .insert([{
            amount: totalAmount,
            description: finalDescription,
            category: "poliza",
            account_type: accountType,
            payment_method: paymentMethod || null,
            client_name: collection.client_name,
            income_date: new Date().toISOString().split('T')[0],
            income_number: "",
            vat_rate: accountType === "fiscal" ? Number(vatRate) : null,
            vat_amount: accountType === "fiscal" ? vatAmount : null,
            taxable_amount: accountType === "fiscal" ? finalAmount : null,
            has_invoice: accountType === "fiscal",
            invoice_number: accountType === "fiscal" ? invoiceNumber : null
          }])
          .select('id')
          .single();

        if (incomeError) throw incomeError;

        // Mark policy payment as paid
        const { error: paymentUpdateError } = await supabase
          .from('policy_payments')
          .update({
            is_paid: true,
            payment_status: 'pagado',
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: paymentMethod || null
          })
          .eq('id', collection.policy_payment_id);

        if (paymentUpdateError) throw paymentUpdateError;

        toast({
          title: "Cobro de póliza registrado",
          description: `Se registró el pago de la póliza ${collection.policy_name} por $${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`
        });

      } else {
        // Handle order payment collection (existing logic)
        const finalDescription = description || `Cobro orden ${collection.order_number} - ${collection.client_name}`;

        // Calculate VAT for fiscal income (always included)
        let vatAmount = 0;
        let totalAmount = finalAmount;
        
        if (accountType === "fiscal") {
          const vatRateNum = Number(vatRate);
          vatAmount = finalAmount * (vatRateNum / 100);
          totalAmount = finalAmount + vatAmount; // Total = Subtotal + IVA
        }

        // First, create the income record (income_number will be auto-generated)
        const { data: incomeData, error: incomeError } = await supabase
          .from("incomes")
          .insert([{
            amount: totalAmount, // Total amount including VAT for fiscal
            description: finalDescription,
            category: "cobro",
            account_type: accountType,
            payment_method: paymentMethod || null,
            client_name: collection.client_name,
            income_date: new Date().toISOString().split('T')[0],
            income_number: "", // Will be auto-generated by trigger
            vat_rate: accountType === "fiscal" ? Number(vatRate) : null,
            vat_amount: accountType === "fiscal" ? vatAmount : null,
            taxable_amount: accountType === "fiscal" ? finalAmount : null, // Subtotal amount
            has_invoice: accountType === "fiscal",
            invoice_number: accountType === "fiscal" ? invoiceNumber : null
          }])
          .select('id')
          .single();

        if (incomeError) throw incomeError;

        // Then, record the payment in order_payments table
        const { error: paymentError } = await supabase
          .from("order_payments")
          .insert([{
            order_id: collection.id,
            order_number: collection.order_number,
            client_name: collection.client_name,
            payment_amount: totalAmount, // Use total amount including VAT
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: paymentMethod || null,
            account_type: accountType,
            description: finalDescription,
            income_id: incomeData?.id
          }]);

        if (paymentError) throw paymentError;

        // Check if this payment completes the order
        const { data: totalPayments } = await supabase
          .from("order_payments")
          .select("payment_amount")
          .eq("order_number", collection.order_number);

        const totalPaid = (totalPayments || []).reduce((sum, payment) => sum + Number(payment.payment_amount), 0);
        const isCompletelyPaid = totalPaid >= (collection.total_with_vat || collection.estimated_cost);

        // Log the collection operation (optional - just skip if function doesn't exist)
        try {
          console.log('Collection registered:', {
            order_number: collection.order_number,
            client_name: collection.client_name,
            amount: finalAmount,
            is_completely_paid: isCompletelyPaid
          });
        } catch (error) {
          console.error('Error logging collection operation:', error);
        }

        const vatMessage = accountType === "fiscal" 
          ? ` (Subtotal: $${finalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} + IVA: $${vatAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} = Total: $${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN)`
          : '';
          
        toast({
          title: "Cobro registrado",
          description: `Se registró el pago${vatMessage}${
            isCompletelyPaid ? '. La orden está completamente pagada.' : `. Saldo pendiente: $${((collection.total_with_vat || collection.estimated_cost) - totalPaid).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`
          }`
        });
      }

      onOpenChange(false);
      onSuccess?.();
      
      // Reset form
      setAmount("");
      setDescription("");
      setPaymentMethod("");
      setAccountType("no_fiscal");
      setVatRate("16");
      setInvoiceNumber("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar el cobro",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Set default amount when collection changes
  useEffect(() => {
    if (collection && open) {
      // For fiscal accounts, set the subtotal; for non-fiscal, set the total
      const defaultAmount = accountType === "fiscal" 
        ? (collection.subtotal_without_vat || collection.remaining_balance || collection.estimated_cost)
        : (collection.remaining_balance || collection.estimated_cost);
      setAmount(defaultAmount.toString());
      setDescription(`Cobro orden ${collection.order_number} - ${collection.client_name}`);
    }
  }, [collection, open, accountType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              💰
            </div>
            Registrar Cobro
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-2">
              <div>Registrar el cobro de la orden <strong>{collection?.order_number}</strong> para el cliente <strong>{collection?.client_name}</strong></div>
              
              {collection?.total_paid && collection.total_paid > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Total de la orden:</span>
                      <div className="font-medium">$${collection.estimated_cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ya pagado:</span>
                      <div className="font-medium text-green-600">$${collection.total_paid.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <span className="text-muted-foreground">Saldo pendiente:</span>
                    <div className="font-bold text-red-600 text-lg">$${(collection.remaining_balance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
                  </div>
                </div>
              )}
              
              {(!collection?.total_paid || collection.total_paid === 0) && (
                <div className="bg-green-50 p-3 rounded-lg text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Subtotal:</span>
                      <div className="font-medium">${(collection?.subtotal_without_vat || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">IVA:</span>
                      <div className="font-medium text-blue-600">${(collection?.total_vat_amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <span className="text-muted-foreground">Total a cobrar:</span>
                    <div className="font-bold text-green-600 text-lg">${(collection?.total_with_vat || collection?.estimated_cost || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
                  </div>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountType">Tipo de Cuenta *</Label>
            <Select value={accountType} onValueChange={(value: "fiscal" | "no_fiscal") => setAccountType(value)}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_fiscal">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">No Fiscal</span>
                    <span className="text-xs text-muted-foreground">Cuenta personal/efectivo</span>
                  </div>
                </SelectItem>
                <SelectItem value="fiscal">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Fiscal</span>
                    <span className="text-xs text-muted-foreground">Cuenta empresarial (IVA incluido automáticamente)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {accountType === "fiscal" 
                ? "Los ingresos fiscales incluyen IVA automáticamente. Ingrese el subtotal sin IVA."
                : "Selecciona dónde se registrará este ingreso"
              }
            </p>
           </div>


          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Método de Pago</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="deposito">Depósito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {accountType === "fiscal" && (
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Número de Factura *</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="A001-001-000001"
                required
              />
              <p className="text-xs text-muted-foreground">
                Requerido para cuentas fiscales
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del cobro"
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !amount || (accountType === "fiscal" && !invoiceNumber.trim())}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? "Registrando..." : "Registrar Cobro"}
            </Button>
          </DialogFooter>
        </form>
            </DialogContent>
          </Dialog>
        );
      }

      // Add delete functionality for collections
      export function DeleteCollectionDialog({ 
        open, 
        onOpenChange, 
        collectionId, 
        onSuccess 
      }: {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        collectionId: string;
        onSuccess?: () => void;
      }) {
        const { toast } = useToast();
        const [loading, setLoading] = useState(false);

        const handleDelete = async () => {
          setLoading(true);
          try {
            const { error } = await supabase
              .from('order_payments')
              .delete()
              .eq('id', collectionId);

            if (error) throw error;

            toast({
              title: "Cobro eliminado",
              description: "El cobro pendiente ha sido eliminado exitosamente",
            });

            onSuccess?.();
            onOpenChange(false);
          } catch (error: any) {
            console.error('Error deleting collection:', error);
            toast({
              title: "Error",
              description: error.message || "No se pudo eliminar el cobro",
              variant: "destructive",
            });
          } finally {
            setLoading(false);
          }
        };

        return (
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Eliminar Cobro Pendiente</DialogTitle>
                <DialogDescription>
                  ¿Estás seguro de que deseas eliminar este cobro pendiente? Esta acción no se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                  {loading ? "Eliminando..." : "Eliminar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      }