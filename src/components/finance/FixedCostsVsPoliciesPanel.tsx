import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { formatMXNExact } from "@/utils/currency";

interface FixedCostsVsPoliciesPanelProps {
  startDate?: string;
  endDate?: string;
}

export function FixedCostsVsPoliciesPanel({ startDate, endDate }: FixedCostsVsPoliciesPanelProps) {
  // Query para gastos fijos del período
  const fixedExpensesQuery = useQuery({
    queryKey: ["fixed_costs_period", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select("amount, expense_date, description")
        .eq("category", "gasto_fijo")
        .order("expense_date", { ascending: false });

      if (startDate) query = query.gte("expense_date", startDate);
      if (endDate) query = query.lte("expense_date", endDate);

      const { data, error } = await query;
      if (error) throw error;

      const total = (data || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      return { total, count: data?.length || 0, items: data || [] };
    },
    enabled: !!startDate && !!endDate,
  });

  // Query para nóminas del período
  const payrollsQuery = useQuery({
    queryKey: ["payrolls_period", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select("amount, expense_date, description")
        .or("category.eq.nomina,category.eq.nómina")
        .order("expense_date", { ascending: false });

      if (startDate) query = query.gte("expense_date", startDate);
      if (endDate) query = query.lte("expense_date", endDate);

      const { data, error } = await query;
      if (error) throw error;

      const total = (data || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      return { total, count: data?.length || 0, items: data || [] };
    },
    enabled: !!startDate && !!endDate,
  });

  // Query para pagos de préstamos del período
  const loanPaymentsQuery = useQuery({
    queryKey: ["loan_payments_period", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("loan_payments")
        .select("amount, due_date, loans!inner(loan_number)")
        .eq("status", "pagado")
        .order("due_date", { ascending: false });

      if (startDate) query = query.gte("due_date", startDate);
      if (endDate) query = query.lte("due_date", endDate);

      const { data, error } = await query;
      if (error) throw error;

      const total = (data || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      return { total, count: data?.length || 0, items: data || [] };
    },
    enabled: !!startDate && !!endDate,
  });

  // Query para ingresos por pólizas del período
  const policyIncomesQuery = useQuery({
    queryKey: ["policy_incomes_period", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("policy_payments")
        .select("amount")
        .eq("is_paid", true);

      if (startDate) query = query.gte("payment_date", startDate);
      if (endDate) query = query.lte("payment_date", endDate);

      const { data, error } = await query;
      if (error) throw error;

      const total = (data || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      return { total, count: data?.length || 0 };
    },
    enabled: !!startDate && !!endDate,
  });

  const isLoading =
    fixedExpensesQuery.isLoading ||
    payrollsQuery.isLoading ||
    loanPaymentsQuery.isLoading ||
    policyIncomesQuery.isLoading;

  if (!startDate || !endDate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumen: Gastos Recurrentes vs Pólizas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Selecciona un período de fechas para ver el resumen</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumen: Gastos Recurrentes vs Pólizas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Cargando datos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalFixedExpenses = fixedExpensesQuery.data?.total || 0;
  const totalPayrolls = payrollsQuery.data?.total || 0;
  const totalLoanPayments = loanPaymentsQuery.data?.total || 0;
  const totalRecurringExpenses = totalFixedExpenses + totalPayrolls + totalLoanPayments;

  const totalPolicyIncomes = policyIncomesQuery.data?.total || 0;
  const balance = totalPolicyIncomes - totalRecurringExpenses;
  const isPositive = balance >= 0;

  // Calcular porcentaje de cobertura
  const coveragePercentage = totalRecurringExpenses > 0 
    ? (totalPolicyIncomes / totalRecurringExpenses) * 100 
    : 0;

  return (
    <Card className="border-2">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <CardTitle className="flex items-center justify-between">
          <span>Resumen: Gastos Recurrentes vs Pólizas</span>
          {coveragePercentage > 0 && (
            <Badge variant={coveragePercentage >= 100 ? "default" : "destructive"}>
              {coveragePercentage.toFixed(1)}% cobertura
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Gastos Recurrentes */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                Gastos Recurrentes
              </h3>
              <div className="text-3xl font-bold text-red-700 dark:text-red-300">
                {formatMXNExact(totalRecurringExpenses)}
              </div>
            </div>
            
            <div className="space-y-3 bg-red-50/50 dark:bg-red-950/20 p-4 rounded-lg">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm font-semibold text-muted-foreground">Gastos Fijos</span>
                <div className="text-right">
                  <div className="font-semibold">{formatMXNExact(totalFixedExpenses)}</div>
                  <div className="text-xs text-muted-foreground">
                    {fixedExpensesQuery.data?.count || 0} registros
                  </div>
                </div>
              </div>
              
              {fixedExpensesQuery.data?.items.map((expense, idx) => (
                <div key={idx} className="flex justify-between items-start text-sm">
                  <div className="flex-1">
                    <div className="text-muted-foreground line-clamp-1">{expense.description}</div>
                    <div className="text-xs text-muted-foreground/70">
                      {new Date(expense.expense_date).toLocaleDateString('es-MX')}
                    </div>
                  </div>
                  <div className="font-medium ml-2">{formatMXNExact(expense.amount)}</div>
                </div>
              ))}
              
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm font-semibold text-muted-foreground">Nóminas</span>
                <div className="text-right">
                  <div className="font-semibold">{formatMXNExact(totalPayrolls)}</div>
                  <div className="text-xs text-muted-foreground">
                    {payrollsQuery.data?.count || 0} registros
                  </div>
                </div>
              </div>
              
              {payrollsQuery.data?.items.map((payroll, idx) => (
                <div key={idx} className="flex justify-between items-start text-sm">
                  <div className="flex-1">
                    <div className="text-muted-foreground line-clamp-1">{payroll.description}</div>
                    <div className="text-xs text-muted-foreground/70">
                      {new Date(payroll.expense_date).toLocaleDateString('es-MX')}
                    </div>
                  </div>
                  <div className="font-medium ml-2">{formatMXNExact(payroll.amount)}</div>
                </div>
              ))}
              
              <div className="flex justify-between items-center border-b pb-2 mt-3">
                <span className="text-sm font-semibold text-muted-foreground">Préstamos</span>
                <div className="text-right">
                  <div className="font-semibold">{formatMXNExact(totalLoanPayments)}</div>
                  <div className="text-xs text-muted-foreground">
                    {loanPaymentsQuery.data?.count || 0} pagos
                  </div>
                </div>
              </div>
              
              {loanPaymentsQuery.data?.items.map((payment, idx) => (
                <div key={idx} className="flex justify-between items-start text-sm">
                  <div className="flex-1">
                    <div className="text-muted-foreground line-clamp-1">
                      {payment.loans?.loan_number || 'Préstamo'}
                    </div>
                    <div className="text-xs text-muted-foreground/70">
                      {new Date(payment.due_date).toLocaleDateString('es-MX')}
                    </div>
                  </div>
                  <div className="font-medium ml-2">{formatMXNExact(payment.amount)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Flecha VS */}
          <div className="flex items-center justify-center">
            <div className="text-center">
              <ArrowRight className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <div className="text-xl font-bold text-muted-foreground">VS</div>
            </div>
          </div>

          {/* Ingresos por Pólizas */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">
                Ingresos por Pólizas
              </h3>
              <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                {formatMXNExact(totalPolicyIncomes)}
              </div>
            </div>
            
            <div className="bg-green-50/50 dark:bg-green-950/20 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pagos Cobrados</span>
                <div className="text-right">
                  <div className="font-semibold">{formatMXNExact(totalPolicyIncomes)}</div>
                  <div className="text-xs text-muted-foreground">
                    {policyIncomesQuery.data?.count || 0} pagos
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Final */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
              <span className="text-lg font-semibold">Balance Final:</span>
            </div>
            <div className={`text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {formatMXNExact(balance)}
            </div>
          </div>
          
          <div className="mt-2 text-sm text-muted-foreground text-center">
            {isPositive ? (
              <p>✓ Los ingresos por pólizas cubren los gastos recurrentes del período</p>
            ) : (
              <p>⚠️ Los gastos recurrentes exceden los ingresos por pólizas en este período</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
