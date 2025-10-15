import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit, X, Building2, Loader2 } from "lucide-react";
import { formatCOPCeilToTen } from "@/utils/currency";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FixedExpense {
  id: string;
  description: string;
  amount: number;
  account_type: string;
  payment_method: string | null;
  supplier_id: string | null;
  created_at: string;
}

interface Supplier {
  id: string;
  supplier_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  status: string;
}

export function FixedExpensesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form states
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [accountType, setAccountType] = useState<"fiscal" | "no_fiscal">("no_fiscal");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);
  
  // Supplier dialog states
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  // Query gastos fijos
  const fixedExpensesQuery = useQuery({
    queryKey: ["fixed_expenses_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("category", "gasto_fijo")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Query suppliers
  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("status", "activo")
        .order("supplier_name");
      
      if (error) throw error;
      return data as Supplier[];
    }
  });

  // Add supplier mutation
  const addSupplierMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          supplier_name: newSupplierName,
          email: newSupplierEmail || null,
          phone: newSupplierPhone || null,
          status: "activo",
          created_by: user?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (newSupplier) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSupplierId(newSupplier.id);
      setNewSupplierName("");
      setNewSupplierEmail("");
      setNewSupplierPhone("");
      setShowSupplierDialog(false);
      toast({
        title: "Proveedor agregado",
        description: "El proveedor ha sido agregado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo agregar el proveedor",
        variant: "destructive",
      });
    }
  });

  const addFixedExpense = async () => {
    try {
      const amountNum = Number(amount);
      if (!description || !amountNum) {
        throw new Error("Completa descripción y monto válido");
      }

      // Calcular IVA si es fiscal
      const vatRate = accountType === "fiscal" ? 16 : 0;
      const taxableAmount = accountType === "fiscal" ? amountNum / 1.16 : amountNum;
      const vatAmount = accountType === "fiscal" ? amountNum - taxableAmount : 0;

      const { error } = await supabase.from("expenses").insert({
        amount: amountNum,
        description: `[Gasto Fijo] ${description}`,
        category: "gasto_fijo",
        account_type: accountType,
        payment_method: paymentMethod || null,
        supplier_id: supplierId || null,
        expense_date: new Date().toISOString(),
        status: "pagado",
        vat_rate: vatRate,
        vat_amount: vatAmount,
        taxable_amount: taxableAmount,
        withdrawal_status: "retirado"
      } as any).select().single();

      if (error) throw error;

      toast({
        title: "Gasto fijo registrado",
        description: "El gasto ha sido agregado correctamente"
      });

      // Reset form
      setDescription("");
      setAmount("");
      setPaymentMethod("");
      setSupplierId("");
      setAccountType("no_fiscal");
      fixedExpensesQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible agregar el gasto",
        variant: "destructive"
      });
    }
  };

  const updateFixedExpense = async () => {
    try {
      if (!editingExpense) return;
      
      const amountNum = Number(amount);
      if (!description || !amountNum) {
        throw new Error("Completa descripción y monto válido");
      }

      // Calcular IVA si es fiscal
      const vatRate = accountType === "fiscal" ? 16 : 0;
      const taxableAmount = accountType === "fiscal" ? amountNum / 1.16 : amountNum;
      const vatAmount = accountType === "fiscal" ? amountNum - taxableAmount : 0;

      const { error } = await supabase
        .from("expenses")
        .update({
          amount: amountNum,
          description: `[Gasto Fijo] ${description}`,
          account_type: accountType,
          payment_method: paymentMethod || null,
          supplier_id: supplierId || null,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          taxable_amount: taxableAmount,
        })
        .eq("id", editingExpense.id);

      if (error) throw error;

      toast({
        title: "Gasto actualizado",
        description: "El gasto ha sido modificado correctamente"
      });

      // Reset form
      setDescription("");
      setAmount("");
      setPaymentMethod("");
      setSupplierId("");
      setAccountType("no_fiscal");
      setEditingExpense(null);
      fixedExpensesQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible actualizar el gasto",
        variant: "destructive"
      });
    }
  };

  const deleteFixedExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId);

      if (error) throw error;

      toast({
        title: "Gasto eliminado",
        description: "El gasto ha sido eliminado correctamente"
      });

      fixedExpensesQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible eliminar el gasto",
        variant: "destructive"
      });
    }
  };

  const startEdit = (expense: FixedExpense) => {
    setEditingExpense(expense);
    setDescription(expense.description.replace("[Gasto Fijo] ", ""));
    setAmount(expense.amount.toString());
    setAccountType(expense.account_type as "fiscal" | "no_fiscal");
    setPaymentMethod(expense.payment_method || "");
    setSupplierId(expense.supplier_id || "");
  };

  const cancelEdit = () => {
    setEditingExpense(null);
    setDescription("");
    setAmount("");
    setPaymentMethod("");
    setSupplierId("");
    setAccountType("no_fiscal");
  };

  const handleAddSupplier = () => {
    if (!newSupplierName.trim()) {
      toast({
        title: "Error",
        description: "El nombre del proveedor es requerido",
        variant: "destructive",
      });
      return;
    }
    addSupplierMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle>
              {editingExpense ? "Editar Gasto Fijo" : "Registrar Gasto Fijo"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="description">Descripción*</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Luz, Agua, Renta, Teléfono, Internet"
              />
            </div>

            <div>
              <Label htmlFor="amount">Monto*</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              {accountType === "fiscal" && amount && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Base: ${(Number(amount) / 1.16).toFixed(2)} | IVA (16%): $
                  {(Number(amount) - Number(amount) / 1.16).toFixed(2)}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="account">Cuenta</Label>
              <Select
                value={accountType}
                onValueChange={(v: "fiscal" | "no_fiscal") => setAccountType(v)}
              >
                <SelectTrigger id="account">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fiscal">Fiscal</SelectItem>
                  <SelectItem value="no_fiscal">No Fiscal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="method">Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="method">
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="supplier">Proveedor</Label>
              <div className="flex gap-2">
                <Select value={supplierId || "none"} onValueChange={(value) => setSupplierId(value === "none" ? "" : value)}>
                  <SelectTrigger id="supplier" className="flex-1">
                    <SelectValue placeholder="Seleccionar proveedor (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proveedor</SelectItem>
                    {suppliersQuery.data?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSupplierDialog(true)}
                  title="Agregar nuevo proveedor"
                >
                  <Building2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={editingExpense ? updateFixedExpense : addFixedExpense} className="flex-1">
                {editingExpense ? "Actualizar" : "Registrar"}
              </Button>
              {editingExpense && (
                <Button onClick={cancelEdit} variant="outline">
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de gastos */}
        <Card>
          <CardHeader>
            <CardTitle>Gastos Fijos Registrados ({fixedExpensesQuery.data?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {fixedExpensesQuery.isLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fixedExpensesQuery.data?.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="max-w-[200px] truncate" title={expense.description}>
                          {expense.description}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCOPCeilToTen(expense.amount)}
                        </TableCell>
                        <TableCell>
                          <span className={expense.account_type === 'fiscal' ? 'text-orange-600' : 'text-blue-600'}>
                            {expense.account_type === 'fiscal' ? 'Fiscal' : 'No Fiscal'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {expense.supplier_id 
                            ? suppliersQuery.data?.find(s => s.id === expense.supplier_id)?.supplier_name || 'N/A'
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => startEdit(expense)}
                              className="h-8 w-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar gasto fijo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede revertir. El gasto será eliminado permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteFixedExpense(expense.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Supplier Dialog */}
      <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Proveedor</DialogTitle>
            <DialogDescription>
              Ingresa los datos del proveedor para gastos fijos (agua, luz, etc.)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Nombre del Proveedor *</Label>
              <Input
                id="supplier-name"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Ej: CFE, Agua Municipal, Telmex"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier-email">Email (opcional)</Label>
              <Input
                id="supplier-email"
                type="email"
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                placeholder="contacto@proveedor.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">Teléfono (opcional)</Label>
              <Input
                id="supplier-phone"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                placeholder="555-1234"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSupplierDialog(false);
                setNewSupplierName("");
                setNewSupplierEmail("");
                setNewSupplierPhone("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddSupplier}
              disabled={addSupplierMutation.isPending}
            >
              {addSupplierMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agregar Proveedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
