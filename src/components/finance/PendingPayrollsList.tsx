import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCurrentDateMexico } from "@/utils/dateUtils";

interface PendingPayroll {
  id: string;
  employee_name: string;
  base_salary: number;
  net_salary: number;
  period_month: number;
  period_year: number;
  status: string;
  account_type?: string;
  payment_method?: string;
  created_at: string;
}

interface PaymentDialogData {
  payroll: PendingPayroll | null;
  open: boolean;
}

export function PendingPayrollsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentDialog, setPaymentDialog] = useState<PaymentDialogData>({
    payroll: null,
    open: false,
  });
  const [paymentData, setPaymentData] = useState({
    account_type: 'no_fiscal',
    payment_method: 'transferencia',
    payment_date: getCurrentDateMexico(),
  });

  const { data: pendingPayrolls, isLoading } = useQuery({
    queryKey: ['pending-payrolls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payrolls')
        .select('*')
        .eq('status', 'pendiente')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PendingPayroll[];
    },
  });

  const payMutation = useMutation({
    mutationFn: async ({ payrollId, data }: { payrollId: string; data: typeof paymentData }) => {
      const payroll = pendingPayrolls?.find(p => p.id === payrollId);
      if (!payroll) throw new Error('Nómina no encontrada');

      // 1. Crear el egreso (el trigger generará el expense_number automáticamente)
      const { error: expenseError } = await supabase.from('expenses').insert([{
        amount: payroll.net_salary,
        description: `[Nómina] ${payroll.employee_name} ${payroll.period_month}/${payroll.period_year}`,
        category: 'nomina',
        account_type: data.account_type as 'fiscal' | 'no_fiscal',
        payment_method: data.payment_method,
        expense_date: data.payment_date,
        expense_number: '', // El trigger lo generará automáticamente
        status: 'pagado',
      }]);

      if (expenseError) throw expenseError;

      // 2. Actualizar el status de la nómina a 'pagado'
      const { error: payrollError } = await supabase
        .from('payrolls')
        .update({ 
          status: 'pagado',
          account_type: data.account_type,
          payment_method: data.payment_method,
        })
        .eq('id', payrollId);

      if (payrollError) throw payrollError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-payrolls'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['payrolls_expenses'] });
      toast({ title: "Nómina pagada exitosamente" });
      setPaymentDialog({ payroll: null, open: false });
      setPaymentData({
        account_type: 'no_fiscal',
        payment_method: 'transferencia',
        payment_date: getCurrentDateMexico(),
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al pagar nómina",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenPaymentDialog = (payroll: PendingPayroll) => {
    setPaymentData({
      account_type: payroll.account_type || 'no_fiscal',
      payment_method: payroll.payment_method || 'transferencia',
      payment_date: getCurrentDateMexico(),
    });
    setPaymentDialog({ payroll, open: true });
  };

  const handlePayment = () => {
    if (!paymentDialog.payroll) return;
    payMutation.mutate({
      payrollId: paymentDialog.payroll.id,
      data: paymentData,
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nóminas Pendientes de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : pendingPayrolls && pendingPayrolls.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Salario Neto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayrolls.map((payroll) => (
                  <TableRow key={payroll.id}>
                    <TableCell className="font-medium">{payroll.employee_name}</TableCell>
                    <TableCell>
                      {payroll.period_month}/{payroll.period_year}
                    </TableCell>
                    <TableCell>${payroll.net_salary.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Pendiente</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleOpenPaymentDialog(payroll)}
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Pagar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No hay nóminas pendientes de pago</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={paymentDialog.open} onOpenChange={(open) => setPaymentDialog({ ...paymentDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar Nómina</DialogTitle>
          </DialogHeader>
          {paymentDialog.payroll && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm text-muted-foreground">Empleado</p>
                <p className="font-medium">{paymentDialog.payroll.employee_name}</p>
                <p className="text-sm text-muted-foreground mt-2">Período</p>
                <p className="font-medium">
                  {paymentDialog.payroll.period_month}/{paymentDialog.payroll.period_year}
                </p>
                <p className="text-sm text-muted-foreground mt-2">Monto a Pagar</p>
                <p className="text-lg font-bold">${paymentDialog.payroll.net_salary.toFixed(2)}</p>
              </div>

              <div>
                <Label htmlFor="account_type">Tipo de Cuenta</Label>
                <Select
                  value={paymentData.account_type}
                  onValueChange={(value) => setPaymentData({ ...paymentData, account_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fiscal">Fiscal</SelectItem>
                    <SelectItem value="no_fiscal">No Fiscal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment_method">Método de Pago</Label>
                <Select
                  value={paymentData.payment_method}
                  onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment_date">Fecha de Pago</Label>
                <input
                  id="payment_date"
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialog({ payroll: null, open: false })}
            >
              Cancelar
            </Button>
            <Button onClick={handlePayment} disabled={payMutation.isPending}>
              {payMutation.isPending ? "Procesando..." : "Confirmar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
