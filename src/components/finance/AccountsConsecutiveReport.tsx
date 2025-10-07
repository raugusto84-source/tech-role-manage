import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, Calendar } from "lucide-react";
import { formatMXNExact } from "@/utils/currency";

interface AccountsConsecutiveReportProps {
  startDate: string;
  endDate: string;
}

export function AccountsConsecutiveReport({ startDate, endDate }: AccountsConsecutiveReportProps) {
  const [localStartDate, setLocalStartDate] = useState(startDate || "");
  const [localEndDate, setLocalEndDate] = useState(endDate || "");

  // Query para ingresos fiscales con detalles de IVA e ISR
  const incomesQuery = useQuery({
    queryKey: ["consecutive_incomes", localStartDate, localEndDate],
    queryFn: async () => {
      if (!localStartDate || !localEndDate) return [];
      
      const { data, error } = await supabase
        .from("incomes")
        .select("*")
        .eq("account_type", "fiscal")
        .eq("status", "recibido")
        .neq("category", "referencia")
        .gte("income_date", localStartDate)
        .lte("income_date", localEndDate)
        .order("income_number", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!localStartDate && !!localEndDate
  });

  // Query para egresos fiscales con información del proveedor
  const expensesQuery = useQuery({
    queryKey: ["consecutive_expenses", localStartDate, localEndDate],
    queryFn: async () => {
      if (!localStartDate || !localEndDate) return [];
      
      console.log('Fetching expenses for period:', localStartDate, 'to', localEndDate);
      
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          suppliers(supplier_name)
        `)
        .eq("account_type", "fiscal")
        .gte("expense_date", localStartDate)
        .lte("expense_date", localEndDate)
        .order("expense_date", { ascending: true });
      
      if (error) {
        console.error('Error fetching expenses:', error);
        throw error;
      }
      
      console.log('Expenses fetched:', data?.length || 0, 'records');
      return data || [];
    },
    enabled: !!localStartDate && !!localEndDate
  });

  // Calcular totales y resúmenes
  const summary = useMemo(() => {
    const incomes = incomesQuery.data || [];
    const expenses = expensesQuery.data || [];

    console.log('Calculating summary - Incomes:', incomes.length, 'Expenses:', expenses.length);

    const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const totalVatIncome = incomes.reduce((sum, i) => sum + Number(i.vat_amount || 0), 0);
    const totalISR = incomes.reduce((sum, i) => sum + Number(i.isr_withholding_amount || 0), 0);
    
    const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalVatExpense = expenses.reduce((sum, e) => sum + Number(e.vat_amount || 0), 0);

    console.log('Totals - Income:', totalIncome, 'Expense:', totalExpense, 'ISR:', totalISR);

    const vatBalance = totalVatIncome - totalVatExpense;
    const availableForWithdrawal = totalIncome - totalExpense - Math.abs(totalISR);

    return {
      totalIncome,
      totalVatIncome,
      totalISR,
      totalExpense,
      totalVatExpense,
      vatBalance,
      vatStatus: vatBalance > 0 ? "A Pagar" : vatBalance < 0 ? "A Favor" : "Neutral",
      availableForWithdrawal,
      incomeCount: incomes.length,
      expenseCount: expenses.length
    };
  }, [incomesQuery.data, expensesQuery.data]);

  const exportToCSV = () => {
    const incomes = incomesQuery.data || [];
    const expenses = expensesQuery.data || [];

    const rows = [
      ["REPORTE CONSECUTIVO DE CUENTAS"],
      [`Período: ${localStartDate} a ${localEndDate}`],
      [],
      ["INGRESOS"],
      ["Factura", "Fecha", "Descripción", "Subtotal", "IVA", "ISR Retenido", "Total"],
      ...incomes.map(i => [
        i.income_number || "",
        i.income_date || "",
        i.description || "",
        i.taxable_amount || 0,
        i.vat_amount || 0,
        i.isr_withholding_amount || 0,
        i.amount || 0
      ]),
      ["", "", "", "", "", "Total ISR:", summary.totalISR],
      ["", "", "", "", "", "Total IVA:", summary.totalVatIncome],
      ["", "", "", "", "", "Total Ingresos:", summary.totalIncome],
      [],
      ["EGRESOS"],
      ["Factura", "Fecha", "Descripción", "Justificación (Factura)", "IVA", "Total"],
      ...expenses.map(e => {
        // Construir justificación con proveedor y número de factura
        const supplierName = (e as any).suppliers?.supplier_name || "Sin proveedor";
        const invoiceNumber = e.invoice_number || "Sin factura";
        const justification = `${supplierName} - Factura: ${invoiceNumber}`;
        
        return [
          e.expense_number || "",
          e.expense_date || "",
          e.description || "",
          justification,
          e.vat_amount || 0,
          e.amount || 0
        ];
      }),
      ["", "", "", "Total IVA:", summary.totalVatExpense],
      ["", "", "", "Total Egresos:", summary.totalExpense],
      [],
      ["RESUMEN"],
      ["IVA Cobrado", summary.totalVatIncome],
      ["IVA Pagado", summary.totalVatExpense],
      ["IVA Balance", `${summary.vatBalance} (${summary.vatStatus})`],
      ["ISR Retenido", summary.totalISR],
      ["Disponible para Retiro", summary.availableForWithdrawal]
    ];

    const csv = rows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-consecutivo-${localStartDate}-${localEndDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const setCurrentMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10);
    setLocalStartDate(firstDay);
    setLocalEndDate(lastDay);
  };

  return (
    <div className="space-y-6">
      {/* Filtros de fecha */}
      <Card>
        <CardHeader>
          <CardTitle>Período de Reporte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="start-date">Fecha Inicio</Label>
              <Input
                id="start-date"
                type="date"
                value={localStartDate}
                onChange={(e) => setLocalStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="end-date">Fecha Fin</Label>
              <Input
                id="end-date"
                type="date"
                value={localEndDate}
                onChange={(e) => setLocalEndDate(e.target.value)}
              />
            </div>
            <Button onClick={setCurrentMonth} variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Mes Actual
            </Button>
            <Button onClick={exportToCSV} disabled={!localStartDate || !localEndDate}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      {localStartDate && localEndDate && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatMXNExact(summary.totalIncome)}</div>
              <p className="text-xs text-muted-foreground">{summary.incomeCount} facturas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Egresos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatMXNExact(summary.totalExpense)}</div>
              <p className="text-xs text-muted-foreground">{summary.expenseCount} registros</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">IVA {summary.vatStatus}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.vatBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatMXNExact(Math.abs(summary.vatBalance))}
              </div>
              <Badge variant={summary.vatBalance > 0 ? "destructive" : "default"}>
                {summary.vatStatus}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">ISR Retenido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMXNExact(summary.totalISR)}</div>
              <p className="text-xs text-muted-foreground">Pagado en el período</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Disponible para Retiro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatMXNExact(summary.availableForWithdrawal)}</div>
              <p className="text-xs text-muted-foreground">Después de impuestos</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla de Ingresos */}
      {localStartDate && localEndDate && (
        <Card>
          <CardHeader>
            <CardTitle>Ingresos Fiscales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">ISR Retenido</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomesQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">Cargando...</TableCell>
                    </TableRow>
                  ) : incomesQuery.data?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">No hay ingresos en este período</TableCell>
                    </TableRow>
                  ) : (
                    incomesQuery.data?.map((income) => (
                      <TableRow key={income.id}>
                        <TableCell className="font-medium">{income.income_number}</TableCell>
                        <TableCell>{income.income_date}</TableCell>
                        <TableCell>{income.description}</TableCell>
                        <TableCell className="text-right">{formatMXNExact(income.taxable_amount || 0)}</TableCell>
                        <TableCell className="text-right">{formatMXNExact(income.vat_amount || 0)}</TableCell>
                        <TableCell className="text-right text-orange-600">
                          {formatMXNExact(income.isr_withholding_amount || 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold">{formatMXNExact(income.amount || 0)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {incomesQuery.data && incomesQuery.data.length > 0 && (
                    <TableRow className="bg-muted font-bold">
                      <TableCell colSpan={3}>TOTALES</TableCell>
                      <TableCell className="text-right">{formatMXNExact(summary.totalIncome - summary.totalVatIncome)}</TableCell>
                      <TableCell className="text-right">{formatMXNExact(summary.totalVatIncome)}</TableCell>
                      <TableCell className="text-right text-orange-600">{formatMXNExact(summary.totalISR)}</TableCell>
                      <TableCell className="text-right">{formatMXNExact(summary.totalIncome)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla de Egresos */}
      {localStartDate && localEndDate && (
        <Card>
          <CardHeader>
            <CardTitle>Egresos Justificados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Justificación (Factura de Ingreso)</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">Cargando...</TableCell>
                    </TableRow>
                  ) : expensesQuery.data?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">No hay egresos en este período</TableCell>
                    </TableRow>
                  ) : (
                    expensesQuery.data?.map((expense) => {
                      // Construir justificación con proveedor y número de factura
                      const supplierName = (expense as any).suppliers?.supplier_name || "Sin proveedor";
                      const invoiceNumber = expense.invoice_number || "Sin factura";
                      const justification = `${supplierName} - Factura: ${invoiceNumber}`;
                      
                      return (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">{expense.expense_number}</TableCell>
                          <TableCell>{expense.expense_date}</TableCell>
                          <TableCell>{expense.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{justification}</TableCell>
                          <TableCell className="text-right">{formatMXNExact(expense.vat_amount || 0)}</TableCell>
                          <TableCell className="text-right font-bold">{formatMXNExact(expense.amount || 0)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                  {expensesQuery.data && expensesQuery.data.length > 0 && (
                    <TableRow className="bg-muted font-bold">
                      <TableCell colSpan={4}>TOTALES</TableCell>
                      <TableCell className="text-right">{formatMXNExact(summary.totalVatExpense)}</TableCell>
                      <TableCell className="text-right">{formatMXNExact(summary.totalExpense)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen Final */}
      {localStartDate && localEndDate && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen Fiscal del Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">IVA Cobrado (Ingresos)</p>
                  <p className="text-lg font-bold">{formatMXNExact(summary.totalVatIncome)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IVA Pagado (Egresos)</p>
                  <p className="text-lg font-bold">{formatMXNExact(summary.totalVatExpense)}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <p className="font-medium">IVA Balance:</p>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${summary.vatBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatMXNExact(Math.abs(summary.vatBalance))}
                    </p>
                    <Badge variant={summary.vatBalance > 0 ? "destructive" : "default"}>
                      {summary.vatStatus}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <p className="font-medium">ISR Retenido en el Período:</p>
                  <p className="text-xl font-bold text-orange-600">{formatMXNExact(summary.totalISR)}</p>
                </div>
              </div>

              <div className="border-t pt-4 bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-lg">Disponible para Retiro:</p>
                  <p className="text-2xl font-bold text-blue-600">{formatMXNExact(summary.availableForWithdrawal)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  (Ingresos - Egresos - ISR Retenido)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
