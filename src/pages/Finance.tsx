import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

  const incomesTotal = useMemo(() => (incomesQuery.data?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0), [incomesQuery.data]);
  const expensesTotal = useMemo(() => (expensesQuery.data?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0), [expensesQuery.data]);

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

      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <div>
          <label className="text-sm text-muted-foreground">Desde</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Hasta</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Tipo de cuenta</label>
          <Select value={accountType} onValueChange={setAccountType}>
            <SelectTrigger>
              <SelectValue placeholder="Selector de cuenta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="fiscal">Fiscal</SelectItem>
              <SelectItem value="no_fiscal">No fiscal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <Tabs defaultValue="incomes">
        <TabsList>
          <TabsTrigger value="incomes">Ingresos</TabsTrigger>
          <TabsTrigger value="expenses">Egresos</TabsTrigger>
          <TabsTrigger value="collections">Cobranzas pendientes</TabsTrigger>
        </TabsList>

        <TabsContent value="incomes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ingresos ({incomesQuery.data?.length ?? 0}) · Total: {incomesTotal.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</CardTitle>
              <Button size="sm" onClick={() => onExport("incomes")}>Exportar CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomesQuery.isLoading && (
                      <TableRow><TableCell colSpan={7}>Cargando...</TableCell></TableRow>
                    )}
                    {!incomesQuery.isLoading && (incomesQuery.data ?? []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.income_number}</TableCell>
                        <TableCell>{r.income_date}</TableCell>
                        <TableCell>{Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                        <TableCell>{r.account_type}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell>{r.payment_method}</TableCell>
                        <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                      </TableRow>
                    ))}
                    {!incomesQuery.isLoading && (incomesQuery.data ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={7}>Sin datos en el rango seleccionado.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Egresos ({expensesQuery.data?.length ?? 0}) · Total: {expensesTotal.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</CardTitle>
              <Button size="sm" onClick={() => onExport("expenses")}>Exportar CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expensesQuery.isLoading && (
                      <TableRow><TableCell colSpan={7}>Cargando...</TableCell></TableRow>
                    )}
                    {!expensesQuery.isLoading && (expensesQuery.data ?? []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.expense_number}</TableCell>
                        <TableCell>{r.expense_date}</TableCell>
                        <TableCell>{Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</TableCell>
                        <TableCell>{r.account_type}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell>{r.payment_method}</TableCell>
                        <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                      </TableRow>
                    ))}
                    {!expensesQuery.isLoading && (expensesQuery.data ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={7}>Sin datos en el rango seleccionado.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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
