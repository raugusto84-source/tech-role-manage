import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, FileCheck, Trash2 } from 'lucide-react';

interface PendingExpense {
  id: string;
  supplier_name: string;
  invoice_number: string;
  amount: number;
  purchase_date: string;
  description?: string;
  status: string;
  created_at: string;
}

export function PendingExpensesTab() {
  const { toast } = useToast();
  const [pendingExpenses, setPendingExpenses] = useState<PendingExpense[]>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Form states
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().substring(0, 10));
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadPendingExpenses();
  }, []);

  const loadPendingExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('pending_expenses')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingExpenses(data || []);
    } catch (error) {
      console.error('Error loading pending expenses:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los egresos pendientes",
        variant: "destructive"
      });
    }
  };

  const addPendingExpense = async () => {
    if (!supplierName || !invoiceNumber || !amount) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pending_expenses')
        .insert({
          supplier_name: supplierName,
          invoice_number: invoiceNumber,
          amount: parseFloat(amount),
          purchase_date: purchaseDate,
          description: description || null
        });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Egreso pendiente agregado correctamente"
      });

      // Reset form
      setSupplierName('');
      setInvoiceNumber('');
      setAmount('');
      setPurchaseDate(new Date().toISOString().substring(0, 10));
      setDescription('');
      setShowAddDialog(false);
      
      loadPendingExpenses();
    } catch (error) {
      console.error('Error adding pending expense:', error);
      toast({
        title: "Error",
        description: "No se pudo agregar el egreso pendiente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const applySelectedExpenses = async () => {
    if (selectedExpenses.length === 0) {
      toast({
        title: "Error",
        description: "Seleccione al menos un egreso para aplicar",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Get selected expenses details
      const expensesToApply = pendingExpenses.filter(exp => 
        selectedExpenses.includes(exp.id)
      );

      // Create expense records
      const expenseInserts = expensesToApply.map((exp, index) => ({
        expense_number: `EXP-${Date.now()}-${index}`,
        description: `[Factura ${exp.invoice_number}] ${exp.supplier_name} - ${exp.description || 'Compra'}`,
        amount: exp.amount,
        expense_date: exp.purchase_date,
        category: 'compras',
        account_type: 'fiscal' as const,
        payment_method: 'efectivo',
        status: 'pagado',
        has_invoice: true,
        invoice_number: exp.invoice_number
      }));

      const { error: expenseError } = await supabase
        .from('expenses')
        .insert(expenseInserts);

      if (expenseError) throw expenseError;

      // Mark pending expenses as applied
      const { error: updateError } = await supabase
        .from('pending_expenses')
        .update({ 
          status: 'applied',
          applied_at: new Date().toISOString()
        })
        .in('id', selectedExpenses);

      if (updateError) throw updateError;

      toast({
        title: "Éxito",
        description: `Se aplicaron ${selectedExpenses.length} egresos correctamente`
      });

      setSelectedExpenses([]);
      loadPendingExpenses();
    } catch (error) {
      console.error('Error applying expenses:', error);
      toast({
        title: "Error",
        description: "No se pudieron aplicar los egresos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deletePendingExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('pending_expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Egreso pendiente eliminado correctamente"
      });

      loadPendingExpenses();
    } catch (error) {
      console.error('Error deleting pending expense:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el egreso pendiente",
        variant: "destructive"
      });
    }
  };

  const toggleExpenseSelection = (expenseId: string) => {
    setSelectedExpenses(prev => 
      prev.includes(expenseId)
        ? prev.filter(id => id !== expenseId)
        : [...prev, expenseId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedExpenses.length === pendingExpenses.length) {
      setSelectedExpenses([]);
    } else {
      setSelectedExpenses(pendingExpenses.map(exp => exp.id));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalSelectedAmount = pendingExpenses
    .filter(exp => selectedExpenses.includes(exp.id))
    .reduce((total, exp) => total + exp.amount, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Egresos Pendientes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Compras con facturas pagadas desde cuenta no fiscal
              </p>
            </div>
            <div className="flex gap-2">
              {selectedExpenses.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="default" disabled={loading}>
                      <FileCheck className="h-4 w-4 mr-2" />
                      Aplicar ({selectedExpenses.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Aplicar Egresos Seleccionados</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se aplicarán {selectedExpenses.length} egresos por un total de {formatCurrency(totalSelectedAmount)}.
                        Esto creará registros de egresos y marcará estos elementos como aplicados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={applySelectedExpenses}>
                        Aplicar Egresos
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Egreso Pendiente
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuevo Egreso Pendiente</DialogTitle>
                    <DialogDescription>
                      Registre una compra con factura pagada desde cuenta no fiscal
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div>
                      <Label htmlFor="supplier">Proveedor *</Label>
                      <Input
                        id="supplier"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        placeholder="Nombre del proveedor"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="invoice">Número de Factura *</Label>
                      <Input
                        id="invoice"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="Ej: FAC-001"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="amount">Monto *</Label>
                        <Input
                          id="amount"
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="date">Fecha de Compra</Label>
                        <Input
                          id="date"
                          type="date"
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Descripción</Label>
                      <Input
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descripción de la compra"
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={addPendingExpense} disabled={loading}>
                      Agregar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {pendingExpenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedExpenses.length === pendingExpenses.length && pendingExpenses.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedExpenses.includes(expense.id)}
                        onCheckedChange={() => toggleExpenseSelection(expense.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{expense.supplier_name}</TableCell>
                    <TableCell>{expense.invoice_number}</TableCell>
                    <TableCell>{formatCurrency(expense.amount)}</TableCell>
                    <TableCell>
                      {new Date(expense.purchase_date).toLocaleDateString('es-CO')}
                    </TableCell>
                    <TableCell>{expense.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                        Pendiente
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar Egreso Pendiente</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Está seguro de que desea eliminar este egreso pendiente? Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deletePendingExpense(expense.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay egresos pendientes
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}