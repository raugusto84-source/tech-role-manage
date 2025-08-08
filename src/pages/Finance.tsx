import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";

// Util simple para exportar CSV en cliente
function exportCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };
  const csv = [headers.join(",")]
    .concat(rows.map(r => headers.map(h => escape(r[h])).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Finance() {
  const { toast } = useToast();

  // SEO básico
  useEffect(() => {
    document.title = "Finanzas y Cobranzas | SYSLAG";
    const metaDesc = document.querySelector('meta[name="description"]') || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Finanzas SYSLAG: ingresos, egresos y cobranzas pendientes con filtros y exportación CSV.");
    if (!metaDesc.parentElement) document.head.appendChild(metaDesc);

    const linkCanonical = document.querySelector('link[rel="canonical"]') || document.createElement("link");
    linkCanonical.setAttribute("rel", "canonical");
    linkCanonical.setAttribute("href", window.location.origin + "/finanzas");
    if (!linkCanonical.parentElement) document.head.appendChild(linkCanonical);
  }, []);

  // Filtros compartidos
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), 0, 1).toISOString().substring(0,10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().substring(0,10));
  const [accountType, setAccountType] = useState<string>("all"); // all | fiscal | no_fiscal

  // Queries
  const incomesQuery = useQuery({
    queryKey: ["incomes", startDate, endDate, accountType],
    queryFn: async () => {
      let q = supabase.from("incomes").select("id,income_number,income_date,amount,account_type,category,description,payment_method,created_at").order("income_date", { ascending: false });
      if (startDate) q = q.gte("income_date", startDate);
      if (endDate) q = q.lte("income_date", endDate);
      if (accountType !== "all") q = q.eq("account_type", accountType as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    }
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", startDate, endDate, accountType],
    queryFn: async () => {
      let q = supabase.from("expenses").select("id,expense_number,expense_date,amount,account_type,category,description,payment_method,created_at").order("expense_date", { ascending: false });
      if (startDate) q = q.gte("expense_date", startDate);
      if (endDate) q = q.lte("expense_date", endDate);
      if (accountType !== "all") q = q.eq("account_type", accountType as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    }
  });

  const collectionsQuery = useQuery({
    queryKey: ["pending_collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_collections")
        .select("id,order_number,client_name,client_email,estimated_cost,delivery_date,status")
        .order("delivery_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
  });
  
  const fixedExpensesQuery = useQuery({
    queryKey: ["fixed_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_expenses")
        .select("id,description,amount,account_type,payment_method,next_run_date,active")
        .order("next_run_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
  });
  
  const incomesTotal = useMemo(() => (incomesQuery.data?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0), [incomesQuery.data]);
  const expensesTotal = useMemo(() => (expensesQuery.data?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0), [expensesQuery.data]);

  // Desglose por cuenta
  const incomesData = incomesQuery.data ?? [];
  const expensesData = expensesQuery.data ?? [];
  const incomesFiscal = useMemo(() => incomesData.filter((r: any) => r.account_type === 'fiscal'), [incomesData]);
  const incomesNoFiscal = useMemo(() => incomesData.filter((r: any) => r.account_type === 'no_fiscal'), [incomesData]);
  const expensesFiscal = useMemo(() => expensesData.filter((r: any) => r.account_type === 'fiscal'), [expensesData]);
  const expensesNoFiscal = useMemo(() => expensesData.filter((r: any) => r.account_type === 'no_fiscal'), [expensesData]);

  const totIF = useMemo(() => incomesFiscal.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0), [incomesFiscal]);
  const totINF = useMemo(() => incomesNoFiscal.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0), [incomesNoFiscal]);
  const totEF = useMemo(() => expensesFiscal.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0), [expensesFiscal]);
  const totENF = useMemo(() => expensesNoFiscal.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0), [expensesNoFiscal]);

  const [feDesc, setFeDesc] = useState("");
  const [feAmount, setFeAmount] = useState("");
  const [feAccount, setFeAccount] = useState<"fiscal" | "no_fiscal">("fiscal");
  const [feMethod, setFeMethod] = useState("");

  const [pEmployee, setPEmployee] = useState("");
  const [pBaseSalary, setPBaseSalary] = useState("");
  const [pNetSalary, setPNetSalary] = useState("");
  const [pMonth, setPMonth] = useState<number>(new Date().getMonth() + 1);
  const [pYear, setPYear] = useState<number>(new Date().getFullYear());
  const [pAccount, setPAccount] = useState<"fiscal" | "no_fiscal">("fiscal");
  const [pMethod, setPMethod] = useState("");

  const addFixedExpense = async () => {
    try {
      const amount = Number(feAmount);
      if (!feDesc || !amount) throw new Error("Completa descripción y monto válido");
      const { error } = await supabase.from("fixed_expenses").insert({
        description: feDesc,
        amount,
        account_type: feAccount as any,
        payment_method: feMethod || null,
        frequency: 'monthly',
      } as any);
      if (error) throw error;
      toast({ title: "Gasto fijo programado" });
      setFeDesc(""); setFeAmount(""); setFeMethod(""); setFeAccount("fiscal");
      fixedExpensesQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible agregar", variant: "destructive" });
    }
  };

  const addPayroll = async () => {
    try {
      const baseSalary = Number(pBaseSalary);
      const netSalary = Number(pNetSalary);
      if (!pEmployee || !netSalary || !baseSalary) throw new Error("Completa empleado y montos válidos");
      const { error: payErr } = await supabase.from("payrolls").insert({
        employee_name: pEmployee,
        base_salary: baseSalary,
        net_salary: netSalary,
        period_month: pMonth,
        period_year: pYear,
        status: "pendiente",
      } as any);
      if (payErr) throw payErr;

      const { error: expErr } = await supabase.from("expenses").insert({
        amount: netSalary,
        description: `Nómina ${pEmployee} ${pMonth}/${pYear}`,
        category: "nomina",
        account_type: pAccount as any,
        payment_method: pMethod || null,
      } as any);
      if (expErr) throw expErr;

      toast({ title: "Nómina registrada" });
      setPEmployee(""); setPBaseSalary(""); setPNetSalary(""); setPMethod(""); setPAccount("fiscal");
      expensesQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible registrar", variant: "destructive" });
    }
  };
  
  const toggleFixedActive = async (row: any) => {
    try {
      const { error } = await supabase.from('fixed_expenses').update({ active: !row.active }).eq('id', row.id);
      if (error) throw error;
      toast({ title: row.active ? 'Gasto fijo desactivado' : 'Gasto fijo activado' });
      fixedExpensesQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No fue posible actualizar', variant: 'destructive' });
    }
  };

  const runFixedNow = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('run-fixed-expenses');
      if (error) throw error as any;
      toast({ title: 'Gastos fijos ejecutados', description: `Procesados: ${data?.created ?? 0}` });
      expensesQuery.refetch();
      fixedExpensesQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No fue posible ejecutar', variant: 'destructive' });
    }
  };

  const onExport = (type: "incomes" | "expenses" | "collections") => {
    try {
      if (type === "incomes" && incomesQuery.data) {
        exportCsv(`ingresos_${startDate}_${endDate}`, incomesQuery.data as any);
      } else if (type === "expenses" && expensesQuery.data) {
        exportCsv(`egresos_${startDate}_${endDate}`, expensesQuery.data as any);
      } else if (type === "collections" && collectionsQuery.data) {
        exportCsv(`cobranzas_pendientes`, collectionsQuery.data as any);
      }
      toast({ title: "Exportación lista", description: "Se descargó el archivo CSV." });
    } catch (e: any) {
      toast({ title: "Error al exportar", description: e?.message || "Intenta de nuevo", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Finanzas: Ingresos, Egresos y Cobranzas</h1>
        <p className="text-muted-foreground mt-2">Panel administrativo para gestionar finanzas con filtros por fecha y tipo de cuenta.</p>
      </header>

      <section className="mb-6 grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-sm text-muted-foreground">Desde</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Hasta</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cuenta Fiscal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Ingresos</div>
                <div className="font-semibold">{totIF.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Egresos</div>
                <div className="font-semibold">{totEF.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Balance</div>
                <div className="font-semibold">{(totIF - totEF).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cuenta No Fiscal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Ingresos</div>
                <div className="font-semibold">{totINF.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Egresos</div>
                <div className="font-semibold">{totENF.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Balance</div>
                <div className="font-semibold">{(totINF - totENF).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="incomes">
        <TabsList>
          <TabsTrigger value="incomes">Ingresos</TabsTrigger>
          <TabsTrigger value="expenses">Egresos</TabsTrigger>
          <TabsTrigger value="gastos">Gastos fijos y nóminas</TabsTrigger>
          <TabsTrigger value="collections">Cobranzas pendientes</TabsTrigger>
        </TabsList>

        <TabsContent value="incomes">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Ingresos - Fiscal ({incomesFiscal.length}) · Total: {totIF.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</CardTitle>
                <Button size="sm" onClick={() => exportCsv(`ingresos_fiscal_${startDate}_${endDate}`, incomesFiscal as any)}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Descripción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomesQuery.isLoading && (
                        <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow>
                      )}
                      {!incomesQuery.isLoading && incomesFiscal.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.income_number}</TableCell>
                          <TableCell>{r.income_date}</TableCell>
                          <TableCell>{Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Ingresos - No Fiscal ({incomesNoFiscal.length}) · Total: {totINF.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</CardTitle>
                <Button size="sm" onClick={() => exportCsv(`ingresos_no_fiscal_${startDate}_${endDate}`, incomesNoFiscal as any)}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Descripción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomesQuery.isLoading && (
                        <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow>
                      )}
                      {!incomesQuery.isLoading && incomesNoFiscal.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.income_number}</TableCell>
                          <TableCell>{r.income_date}</TableCell>
                          <TableCell>{Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="expenses">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Egresos - Fiscal ({expensesFiscal.length}) · Total: {totEF.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</CardTitle>
                <Button size="sm" onClick={() => exportCsv(`egresos_fiscal_${startDate}_${endDate}`, expensesFiscal as any)}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Descripción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesQuery.isLoading && (
                        <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow>
                      )}
                      {!expensesQuery.isLoading && expensesFiscal.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.expense_number}</TableCell>
                          <TableCell>{r.expense_date}</TableCell>
                          <TableCell>{Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Egresos - No Fiscal ({expensesNoFiscal.length}) · Total: {totENF.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</CardTitle>
                <Button size="sm" onClick={() => exportCsv(`egresos_no_fiscal_${startDate}_${endDate}`, expensesNoFiscal as any)}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Descripción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesQuery.isLoading && (
                        <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow>
                      )}
                      {!expensesQuery.isLoading && expensesNoFiscal.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.expense_number}</TableCell>
                          <TableCell>{r.expense_date}</TableCell>
                          <TableCell>{Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gastos">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Gastos fijos recurrentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Descripción</label>
                  <Input value={feDesc} onChange={e => setFeDesc(e.target.value)} placeholder="Ej. Renta, Luz, Internet" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Monto</label>
                  <Input type="number" inputMode="decimal" value={feAmount} onChange={e => setFeAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Cuenta</label>
                  <Select value={feAccount} onValueChange={(v) => setFeAccount(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fiscal">Fiscal</SelectItem>
                      <SelectItem value="no_fiscal">No fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Método de pago</label>
                  <Input value={feMethod} onChange={e => setFeMethod(e.target.value)} placeholder="Transferencia, Efectivo, etc." />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={addFixedExpense}>Agregar gasto fijo</Button>
                  <Button variant="secondary" onClick={runFixedNow}>Ejecutar ahora</Button>
                </div>
                <p className="text-xs text-muted-foreground">Se programa mensual; puedes ejecutarlo manualmente o configurarlo con cron.</p>

                <div className="pt-4">
                  <div className="text-sm font-medium mb-2">Programados</div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Cuenta</TableHead>
                          <TableHead>Próxima ejecución</TableHead>
                          <TableHead>Activo</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fixedExpensesQuery.isLoading && (
                          <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow>
                        )}
                        {!fixedExpensesQuery.isLoading && (fixedExpensesQuery.data ?? []).map((fx: any) => (
                          <TableRow key={fx.id}>
                            <TableCell>{fx.description}</TableCell>
                            <TableCell>{Number(fx.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                            <TableCell>{fx.account_type}</TableCell>
                            <TableCell>{fx.next_run_date}</TableCell>
                            <TableCell>{fx.active ? 'Sí' : 'No'}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => toggleFixedActive(fx)}>
                                {fx.active ? 'Desactivar' : 'Activar'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!fixedExpensesQuery.isLoading && (fixedExpensesQuery.data ?? []).length === 0 && (
                          <TableRow><TableCell colSpan={6}>Sin gastos fijos programados.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Nóminas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Empleado</label>
                  <Input value={pEmployee} onChange={e => setPEmployee(e.target.value)} placeholder="Nombre del empleado" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Sueldo base</label>
                    <Input type="number" inputMode="decimal" value={pBaseSalary} onChange={e => setPBaseSalary(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Sueldo neto</label>
                    <Input type="number" inputMode="decimal" value={pNetSalary} onChange={e => setPNetSalary(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Mes</label>
                    <Input type="number" min={1} max={12} value={pMonth} onChange={e => setPMonth(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Año</label>
                    <Input type="number" value={pYear} onChange={e => setPYear(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Cuenta</label>
                    <Select value={pAccount} onValueChange={(v) => setPAccount(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fiscal">Fiscal</SelectItem>
                        <SelectItem value="no_fiscal">No fiscal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Método de pago</label>
                  <Input value={pMethod} onChange={e => setPMethod(e.target.value)} placeholder="Transferencia, Efectivo, etc." />
                </div>
                <div className="pt-2">
                  <Button onClick={addPayroll}>Registrar nómina</Button>
                </div>
                <p className="text-xs text-muted-foreground">Se crea registro en Nóminas y egreso asociado en la cuenta elegida.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="collections">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Cobranzas pendientes ({collectionsQuery.data?.length ?? 0})</CardTitle>
              <Button size="sm" onClick={() => onExport("collections")}>Exportar CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Estimado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectionsQuery.isLoading && (
                      <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow>
                    )}
                    {!collectionsQuery.isLoading && (collectionsQuery.data ?? []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.order_number}</TableCell>
                        <TableCell>{r.client_name}</TableCell>
                        <TableCell>{r.client_email}</TableCell>
                        <TableCell>{r.delivery_date}</TableCell>
                        <TableCell>{r.status}</TableCell>
                        <TableCell>{Number(r.estimated_cost).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                      </TableRow>
                    ))}
                    {!collectionsQuery.isLoading && (collectionsQuery.data ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={6}>Sin cobranzas pendientes.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
