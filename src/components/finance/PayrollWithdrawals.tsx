import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, User } from "lucide-react";

export function PayrollWithdrawals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [accountType, setAccountType] = useState<"fiscal" | "no_fiscal">("no_fiscal");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [concept, setConcept] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().substring(0, 10));
  const [submitting, setSubmitting] = useState(false);

  // Cargar empleados
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, role')
        .in('role', ['tecnico', 'vendedor', 'administrador', 'supervisor'])
        .order('full_name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employeeId || !amount || !concept) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    
    try {
      const selectedEmployee = employees?.find(emp => emp.user_id === employeeId);
      const employeeName = selectedEmployee?.full_name || "Empleado";
      
      // Generar número de egreso
      const { data: expenseNumber, error: numberError } = await supabase
        .rpc('generate_expense_number');
      
      if (numberError) throw numberError;
      
      // Crear el egreso de nómina
      const { error } = await supabase
        .from('expenses')
        .insert({
          expense_number: expenseNumber || `EXP-NOM-${Date.now()}`,
          amount: parseFloat(amount),
          description: `[Nómina] ${employeeName} - ${concept}${description ? ': ' + description : ''}`,
          category: 'nomina',
          account_type: accountType,
          payment_method: paymentMethod,
          expense_date: expenseDate,
          status: 'pagado'
        });

      if (error) throw error;

      toast({
        title: "Retiro de nómina registrado",
        description: `Se registró el pago de nómina para ${employeeName}`,
      });

      // Limpiar formulario
      setEmployeeId("");
      setAmount("");
      setConcept("");
      setDescription("");
      setExpenseDate(new Date().toISOString().substring(0, 10));
      
      // Refrescar datos
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['general-expenses'] });
      
    } catch (error: any) {
      console.error('Error al registrar retiro de nómina:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar el retiro de nómina",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Registrar Retiro de Nómina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee">
                  Empleado <span className="text-destructive">*</span>
                </Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger id="employee">
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((emp) => (
                      <SelectItem key={emp.user_id} value={emp.user_id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {emp.full_name} ({emp.role})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">
                  Monto <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountType">Tipo de Cuenta</Label>
                <Select value={accountType} onValueChange={(value: any) => setAccountType(value)}>
                  <SelectTrigger id="accountType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_fiscal">No Fiscal</SelectItem>
                    <SelectItem value="fiscal">Fiscal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de Pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expenseDate">Fecha de Pago</Label>
                <Input
                  id="expenseDate"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="concept">
                  Concepto <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="concept"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej: Pago quincenal, Bono, Comisión"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción Adicional</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles adicionales del pago..."
                rows={3}
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Registrando..." : "Registrar Retiro de Nómina"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
