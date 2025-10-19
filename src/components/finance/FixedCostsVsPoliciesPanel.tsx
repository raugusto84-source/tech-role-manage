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
  // Query para gastos fijos totales (sin filtro de fecha)
  const fixedExpensesQuery = useQuery({
    queryKey: ["fixed_costs_total"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount")
        .eq("category", "gasto_fijo");

      if (error) throw error;

      const total = (data || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      return { total, count: data?.length || 0 };
    },
  });

  // Query para nóminas totales (sin filtro de fecha)
  const payrollsQuery = useQuery({
    queryKey: ["payrolls_total"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount")
        .or("category.eq.nomina,category.eq.nómina");

      if (error) throw error;

      const total = (data || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      return { total, count: data?.length || 0 };
    },
  });

  // Query para pagos de préstamos totales (sin filtro de fecha)
  const loanPaymentsQuery = useQuery({
    queryKey: ["loan_payments_total"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_payments")
        .select("amount")
        .eq("status", "pagado");

      if (error) throw error;

      const total = (data || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      return { total, count: data?.length || 0 };
    },
  });

  // Query para ingresos por pólizas totales (sin filtro de fecha)
  const policyIncomesQuery = useQuery({
    queryKey: ["policy_incomes_total"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policy_payments")
        .select("amount")
        .eq("is_paid", true);

      if (error) throw error;

      const total = (data || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      return { total, count: data?.length || 0 };
    },
  });

  const isLoading =
    fixedExpensesQuery.isLoading ||
    payrollsQuery.isLoading ||
    loanPaymentsQuery.isLoading ||
    policyIncomesQuery.isLoading;

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
    <div>
      <h2 className="text-xl font-semibold mb-4">Balance General (Total Acumulado)</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {/* Gastos Recurrentes - Total */}
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                Gastos Recurrentes - Total
              </h3>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Gastos Fijos</div>
                <div className="font-semibold text-sm">{formatMXNExact(totalFixedExpenses)}</div>
                <div className="text-xs text-muted-foreground">{fixedExpensesQuery.data?.count || 0} items</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Nóminas</div>
                <div className="font-semibold text-sm">{formatMXNExact(totalPayrolls)}</div>
                <div className="text-xs text-muted-foreground">{payrollsQuery.data?.count || 0} items</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Préstamos</div>
                <div className="font-semibold text-sm text-red-600 dark:text-red-400">{formatMXNExact(totalLoanPayments)}</div>
                <div className="text-xs text-muted-foreground">{loanPaymentsQuery.data?.count || 0} pagos</div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Egresos</span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  {formatMXNExact(totalRecurringExpenses)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingresos por Pólizas - Total */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5" />
              <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                Ingresos por Pólizas - Total
              </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Total Cobrado</div>
                <div className="font-semibold text-sm text-green-600 dark:text-green-400">
                  {formatMXNExact(totalPolicyIncomes)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Cobertura</div>
                <div className="font-semibold text-sm">
                  {coveragePercentage.toFixed(1)}%
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Ingresos</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {formatMXNExact(totalPolicyIncomes)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {policyIncomesQuery.data?.count || 0} pagos cobrados
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance General */}
        <Card className={`border-l-4 ${isPositive ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'} mt-1.5`} />
              <h3 className={`text-lg font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                Balance General
              </h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Ingresos</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {formatMXNExact(totalPolicyIncomes)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Egresos</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {formatMXNExact(totalRecurringExpenses)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pt-2 border-t">
                <span className="font-medium">Balance</span>
                <span className={`text-lg font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatMXNExact(balance)}
                </span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs text-muted-foreground text-center">
                {isPositive ? (
                  <span className="text-green-600 dark:text-green-400">✓ Punto de equilibrio alcanzado</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">⚠️ Por debajo del punto de equilibrio</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
