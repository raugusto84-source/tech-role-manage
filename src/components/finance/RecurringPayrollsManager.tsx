import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecurringPayroll {
  id: string;
  employee_name: string;
  base_salary: number;
  net_salary: number;
  account_type: string;
  payment_method: string;
  frequency: string;
  day_of_month: number;
  next_run_date: string;
  last_run_date?: string;
  active: boolean;
}

export function RecurringPayrollsManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<RecurringPayroll | null>(null);
  const [formData, setFormData] = useState({
    employee_name: '',
    base_salary: '',
    net_salary: '',
    account_type: 'no_fiscal',
    payment_method: 'transferencia',
    frequency: 'mensual',
    day_of_month: 15,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: payrolls, isLoading } = useQuery({
    queryKey: ['recurring-payrolls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_payrolls')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RecurringPayroll[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Calcular next_run_date
      const now = new Date();
      const nextRun = new Date(now.getFullYear(), now.getMonth(), data.day_of_month);
      if (nextRun < now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }

      const { error } = await supabase.from('recurring_payrolls').insert({
        ...data,
        next_run_date: nextRun.toISOString().split('T')[0],
        active: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-payrolls'] });
      toast({ title: "Nómina recurrente creada exitosamente" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear nómina recurrente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('recurring_payrolls')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-payrolls'] });
      toast({ title: "Nómina recurrente actualizada" });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_payrolls')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-payrolls'] });
      toast({ title: "Nómina recurrente eliminada" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('recurring_payrolls')
        .update({ active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-payrolls'] });
    },
  });

  const resetForm = () => {
    setFormData({
      employee_name: '',
      base_salary: '',
      net_salary: '',
      account_type: 'no_fiscal',
      payment_method: 'transferencia',
      frequency: 'mensual',
      day_of_month: 15,
    });
    setEditingPayroll(null);
  };

  const handleEdit = (payroll: RecurringPayroll) => {
    setEditingPayroll(payroll);
    setFormData({
      employee_name: payroll.employee_name,
      base_salary: payroll.base_salary.toString(),
      net_salary: payroll.net_salary.toString(),
      account_type: payroll.account_type,
      payment_method: payroll.payment_method,
      frequency: payroll.frequency,
      day_of_month: payroll.day_of_month,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      employee_name: formData.employee_name,
      base_salary: parseFloat(formData.base_salary),
      net_salary: parseFloat(formData.net_salary),
      account_type: formData.account_type,
      payment_method: formData.payment_method,
      frequency: formData.frequency,
      day_of_month: formData.day_of_month,
    };

    if (editingPayroll) {
      updateMutation.mutate({ id: editingPayroll.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Nóminas Recurrentes</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Nómina Recurrente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nóminas Programadas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : payrolls && payrolls.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Salario Neto</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Día del Mes</TableHead>
                  <TableHead>Próxima Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.map((payroll) => (
                  <TableRow key={payroll.id}>
                    <TableCell className="font-medium">{payroll.employee_name}</TableCell>
                    <TableCell>${payroll.net_salary.toFixed(2)}</TableCell>
                    <TableCell className="capitalize">{payroll.frequency}</TableCell>
                    <TableCell>{payroll.day_of_month}</TableCell>
                    <TableCell>
                      {new Date(payroll.next_run_date).toLocaleDateString('es-MX')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={payroll.active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: payroll.id, active: checked })
                          }
                        />
                        <Badge variant={payroll.active ? 'default' : 'secondary'}>
                          {payroll.active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(payroll)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(payroll.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No hay nóminas recurrentes configuradas</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPayroll ? 'Editar' : 'Nueva'} Nómina Recurrente
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="employee_name">Nombre del Empleado</Label>
              <Input
                id="employee_name"
                value={formData.employee_name}
                onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="base_salary">Salario Base</Label>
                <Input
                  id="base_salary"
                  type="number"
                  step="0.01"
                  value={formData.base_salary}
                  onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="net_salary">Salario Neto</Label>
                <Input
                  id="net_salary"
                  type="number"
                  step="0.01"
                  value={formData.net_salary}
                  onChange={(e) => setFormData({ ...formData, net_salary: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="account_type">Tipo de Cuenta</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(value) => setFormData({ ...formData, account_type: value })}
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
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="frequency">Frecuencia</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quincenal">Quincenal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="day_of_month">Día del Mes</Label>
                <Input
                  id="day_of_month"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.day_of_month}
                  onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingPayroll ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}