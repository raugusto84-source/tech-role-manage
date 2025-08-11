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
import { CollectionDialog } from "@/components/finance/CollectionDialog";
import { X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'administrador';

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
      let q = supabase.from("incomes").select("id,income_number,income_date,amount,account_type,category,description,payment_method,vat_rate,vat_amount,taxable_amount,created_at").order("income_date", { ascending: false });
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
      let q = supabase.from("expenses").select("id,expense_number,expense_date,amount,account_type,category,description,payment_method,withdrawal_status,vat_rate,vat_amount,taxable_amount,created_at").order("expense_date", { ascending: false });
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
        .select("id,order_number,client_name,client_email,estimated_cost,delivery_date,total_paid,remaining_balance")
        .order("delivery_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
  });

  // Query para gastos fiscales pendientes de retiro
  const fiscalExpensesQuery = useQuery({
    queryKey: ["fiscal_expenses_pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id,expense_number,description,amount,expense_date,withdrawal_status,account_type")
        .eq("account_type", "fiscal")
        .eq("withdrawal_status", "pendiente")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
  });

  // Query para gestión de IVA - ahora desde incomes y expenses
  const vatDetailsQuery = useQuery({
    queryKey: ["vat_details", startDate, endDate],
    queryFn: async () => {
      const [incomesData, expensesData] = await Promise.all([
        supabase.from("incomes")
          .select("income_date, description, amount, vat_rate, vat_amount, taxable_amount")
          .eq("account_type", "fiscal")
          .not("vat_amount", "is", null)
          .gte("income_date", startDate)
          .lte("income_date", endDate)
          .order("income_date", { ascending: false }),
        supabase.from("expenses")
          .select("expense_date, description, amount, vat_rate, vat_amount, taxable_amount")
          .eq("account_type", "fiscal")
          .not("vat_amount", "is", null)
          .gte("expense_date", startDate)
          .lte("expense_date", endDate)
          .order("expense_date", { ascending: false })
      ]);
      
      if (incomesData.error) throw incomesData.error;
      if (expensesData.error) throw expensesData.error;
      
      const combined = [
        ...(incomesData.data || []).map(item => ({ ...item, date: item.income_date, type: 'ingresos' })),
        ...(expensesData.data || []).map(item => ({ ...item, date: item.expense_date, type: 'egresos' }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return combined;
    }
  });

  // Query para resumen de IVA
  const vatSummaryQuery = useQuery({
    queryKey: ["vat_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vat_summary")
        .select("*")
        .limit(12);
      if (error) throw error;
      return data ?? [];
    }
  });

  const financialHistoryQuery = useQuery({
    queryKey: ["financial_history", startDate, endDate],
    queryFn: async () => {
      let q = supabase
        .from("financial_history")
        .select(`
          id,
          operation_type,
          table_name,
          operation_description,
          amount,
          account_type,
          operation_date,
          created_at,
          performed_by,
          profiles:performed_by(full_name)
        `)
        .order("created_at", { ascending: false });
      
      if (startDate) q = q.gte("operation_date", startDate);
      if (endDate) q = q.lte("operation_date", endDate);
      
      const { data, error } = await q;
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
  
  const recurringPayrollsQuery = useQuery({
    queryKey: ["recurring_payrolls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_payrolls")
        .select("id,employee_name,base_salary,net_salary,account_type,payment_method,next_run_date,active")
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
  const [pBonusAmount, setPBonusAmount] = useState("");
  const [pBonusDesc, setPBonusDesc] = useState("");
  const [pExtraPayments, setPExtraPayments] = useState("");
  const [pMonth, setPMonth] = useState<number>(new Date().getMonth() + 1);
  const [pYear, setPYear] = useState<number>(new Date().getFullYear());
  const [pAccount, setPAccount] = useState<"fiscal" | "no_fiscal">("fiscal");
  const [pMethod, setPMethod] = useState("");
  const [pRecurring, setPRecurring] = useState<boolean>(false);
  const [pFrequency, setPFrequency] = useState<"weekly" | "monthly">("weekly");
  const [pCutoffWeekday, setPCutoffWeekday] = useState<number>(5);
  const [pDefaultBonus, setPDefaultBonus] = useState("");

  // Estados para IVA (ya no se usan para registrar, solo para mostrar cálculos)
  const [showVatCalculator, setShowVatCalculator] = useState(false);
  const [tempAmount, setTempAmount] = useState("");
  const [tempVatRate, setTempVatRate] = useState("16");
  
  // Estados para gastos fiscales seleccionados
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  
  // Estados para el diálogo de cobro
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<any>(null);

  // Función para registrar en historial financiero
  const logFinancialOperation = async (
    operationType: string,
    tableName: string,
    recordId: string,
    recordData: any,
    description: string,
    amount: number,
    accountType?: string,
    operationDate?: string
  ) => {
    try {
      await supabase.rpc('log_financial_operation', {
        p_operation_type: operationType,
        p_table_name: tableName,
        p_record_id: recordId,
        p_record_data: recordData,
        p_operation_description: description,
        p_amount: amount,
        p_account_type: accountType,
        p_operation_date: operationDate || new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error logging financial operation:', error);
    }
  };

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

  const deleteFixedExpense = async (id: string) => {
    if (!isAdmin) return;
    try {
      // Get record data before deletion for history
      const { data: recordData } = await supabase.from("fixed_expenses").select("*").eq("id", id).single();
      
      const { error } = await supabase.from("fixed_expenses").delete().eq("id", id);
      if (error) throw error;

      // Log deletion
      if (recordData) {
        await logFinancialOperation(
          'delete',
          'fixed_expenses',
          id,
          recordData,
          `Eliminación de gasto fijo: ${recordData.description}`,
          recordData.amount,
          recordData.account_type
        );
      }

      toast({ title: "Gasto fijo eliminado" });
      fixedExpensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible eliminar", variant: "destructive" });
    }
  };

  const deleteRecurringPayroll = async (id: string) => {
    if (!isAdmin) return;
    try {
      // Get record data before deletion for history
      const { data: recordData } = await supabase.from("recurring_payrolls").select("*").eq("id", id).single();
      
      const { error } = await supabase.from("recurring_payrolls").delete().eq("id", id);
      if (error) throw error;

      // Log deletion
      if (recordData) {
        await logFinancialOperation(
          'delete',
          'recurring_payrolls',
          id,
          recordData,
          `Eliminación de nómina recurrente: ${recordData.employee_name}`,
          recordData.net_salary,
          recordData.account_type
        );
      }

      toast({ title: "Nómina recurrente eliminada" });
      recurringPayrollsQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible eliminar", variant: "destructive" });
    }
  };

  const deleteIncome = async (id: string) => {
    if (!isAdmin) return;
    try {
      // Get record data before deletion for history
      const { data: recordData } = await supabase.from("incomes").select("*").eq("id", id).single();
      
      const { error } = await supabase.from("incomes").delete().eq("id", id);
      if (error) throw error;

      // Log deletion
      if (recordData) {
        await logFinancialOperation(
          'delete',
          'incomes',
          id,
          recordData,
          `Eliminación de ingreso: ${recordData.description}`,
          recordData.amount,
          recordData.account_type,
          recordData.income_date
        );
      }

      toast({ title: "Ingreso eliminado" });
      incomesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible eliminar", variant: "destructive" });
    }
  };

  const deleteExpense = async (id: string) => {
    if (!isAdmin) return;
    try {
      // Get record data before deletion for history
      const { data: recordData } = await supabase.from("expenses").select("*").eq("id", id).single();
      
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;

      // Log deletion
      if (recordData) {
        await logFinancialOperation(
          'delete',
          'expenses',
          id,
          recordData,
          `Eliminación de egreso: ${recordData.description}`,
          recordData.amount,
          recordData.account_type,
          recordData.expense_date
        );
      }

      toast({ title: "Egreso eliminado" });
      expensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible eliminar", variant: "destructive" });
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
        bonus_amount: pBonusAmount ? Number(pBonusAmount) : 0,
        bonus_description: pBonusDesc || null,
        extra_payments: pExtraPayments ? Number(pExtraPayments) : 0,
        period_month: pMonth,
        period_year: pYear,
        period_week: pFrequency === 'weekly' ? Math.ceil(new Date().getDate() / 7) : null,
        status: "pendiente",
      } as any);
      if (payErr) throw payErr;

      const totalAmount = netSalary + (pBonusAmount ? Number(pBonusAmount) : 0) + (pExtraPayments ? Number(pExtraPayments) : 0);
      const { error: expErr } = await supabase.from("expenses").insert({
        amount: totalAmount,
        description: `Nómina ${pEmployee} ${pMonth}/${pYear}${pBonusDesc ? ` - ${pBonusDesc}` : ''}`,
        category: "nomina",
        account_type: pAccount as any,
        payment_method: pMethod || null,
      } as any);
      if (expErr) throw expErr;

      toast({ title: "Nómina registrada" });
      setPEmployee(""); setPBaseSalary(""); setPNetSalary(""); setPBonusAmount(""); setPBonusDesc("");
      setPExtraPayments(""); setPMethod(""); setPAccount("fiscal");
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

  const addRecurringPayroll = async () => {
    try {
      const baseSalary = Number(pBaseSalary);
      const netSalary = Number(pNetSalary);
      if (!pEmployee || !netSalary || !baseSalary) throw new Error('Completa empleado y montos válidos');
      const { error } = await supabase.from('recurring_payrolls').insert({
        employee_name: pEmployee,
        base_salary: baseSalary,
        net_salary: netSalary,
        account_type: pAccount as any,
        payment_method: pMethod || null,
        frequency: 'monthly',
      } as any);
      if (error) throw error;
      toast({ title: 'Nómina recurrente programada' });
      setPEmployee(''); setPBaseSalary(''); setPNetSalary(''); setPMethod(''); setPAccount('fiscal'); setPRecurring(false);
      recurringPayrollsQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No fue posible programar', variant: 'destructive' });
    }
  };

  const toggleRecurringPayrollActive = async (row: any) => {
    try {
      const { error } = await supabase.from('recurring_payrolls').update({ active: !row.active }).eq('id', row.id);
      if (error) throw error;
      toast({ title: row.active ? 'Recurrente desactivado' : 'Recurrente activado' });
      recurringPayrollsQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No fue posible actualizar', variant: 'destructive' });
    }
  };

  const runRecurringNow = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('run-recurring-payrolls');
      if (error) throw error as any;
      toast({ title: 'Nóminas recurrentes ejecutadas', description: `Procesadas: ${data?.created ?? 0}` });
      expensesQuery.refetch();
      recurringPayrollsQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No fue posible ejecutar', variant: 'destructive' });
    }
  };

  const handleRevertExpense = async (row: any) => {
    if (!isAdmin) return;
    try {
      const today = new Date().toISOString().substring(0,10);
      
      // Create a reversal income record (income_number will be auto-generated)
      const { error: insErr } = await supabase.from('incomes').insert({
        amount: row.amount,
        description: `Reverso egreso ${row.expense_number ?? ''} - ${row.description ?? ''}`.trim(),
        account_type: row.account_type,
        category: 'reverso',
        income_date: today,
        payment_method: row.payment_method ?? null,
      } as any);
      if (insErr) throw insErr;
      
      // Log the reversal operation
      await logFinancialOperation(
        'reverse',
        'expenses',
        row.id,
        row,
        `Reverso de egreso ${row.expense_number || ''} - ${row.description || ''}`.trim(),
        row.amount,
        row.account_type,
        row.expense_date
      );

      // Delete the original expense
      const { error: delErr } = await supabase.from('expenses').delete().eq('id', row.id);
      if (delErr) throw delErr;
      
      toast({ title: 'Egreso revertido' });
      incomesQuery.refetch();
      expensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No fue posible revertir', variant: 'destructive' });
    }
  };

  const handleRevertIncome = async (row: any) => {
    if (!isAdmin) return;
    try {
      const today = new Date().toISOString().substring(0,10);
      
      // First, check if this income is related to any order payments and remove them
      // This will make the orders appear back in pending collections
      const { data: relatedPayments, error: paymentsQueryError } = await supabase
        .from('order_payments')
        .select('id, order_id, order_number')
        .eq('income_id', row.id);
      
      if (paymentsQueryError) throw paymentsQueryError;
      
      // Remove related order payments to return orders to pending collections
      if (relatedPayments && relatedPayments.length > 0) {
        const { error: deletePaymentsError } = await supabase
          .from('order_payments')
          .delete()
          .eq('income_id', row.id);
        
        if (deletePaymentsError) throw deletePaymentsError;
      }
      
      // Create expense to counteract the income
      const { error: insErr } = await supabase.from('expenses').insert({
        amount: row.amount,
        description: `Reverso ingreso ${row.income_number ?? ''} - ${row.description ?? ''}`.trim(),
        category: 'reverso',
        account_type: row.account_type,
        payment_method: row.payment_method ?? null,
        expense_date: today,
      } as any);
      if (insErr) throw insErr;
      
      // Log the reversal operation
      await logFinancialOperation(
        'reverse',
        'incomes',
        row.id,
        row,
        `Reverso de ingreso ${row.income_number || ''} - ${row.description || ''}`.trim(),
        row.amount,
        row.account_type,
        row.income_date
      );

      // Delete the original income
      const { error: delErr } = await supabase.from('incomes').delete().eq('id', row.id);
      if (delErr) throw delErr;
      
      const orderNumbers = relatedPayments?.map(p => p.order_number).join(', ') || '';
      toast({ 
        title: 'Ingreso revertido', 
        description: relatedPayments && relatedPayments.length > 0 
          ? `Las órdenes ${orderNumbers} han regresado a cobranzas pendientes` 
          : undefined
      });
      
      incomesQuery.refetch();
      expensesQuery.refetch();
      collectionsQuery.refetch(); // Refresh pending collections
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No fue posible revertir', variant: 'destructive' });
    }
  };

  // Funciones para gestión de IVA (ya no se registra manualmente)
  const calculateVat = (amount: number, rate: number) => {
    return (amount * rate) / 100;
  };

  const calculateTotal = (amount: number, rate: number) => {
    return amount + calculateVat(amount, rate);
  };

  // Funciones para retiro de gastos fiscales
  const handleExpenseSelection = (expenseId: string, checked: boolean) => {
    if (checked) {
      setSelectedExpenses(prev => [...prev, expenseId]);
    } else {
      setSelectedExpenses(prev => prev.filter(id => id !== expenseId));
    }
  };

  const withdrawSelectedExpenses = async () => {
    if (selectedExpenses.length === 0) {
      toast({ title: "Error", description: "Selecciona al menos un gasto", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          withdrawal_status: "retirado",
          withdrawn_at: new Date().toISOString(),
          withdrawn_by: profile?.user_id
        })
        .in("id", selectedExpenses);
      if (error) throw error;
      toast({ title: `${selectedExpenses.length} gastos marcados como retirados` });
      setSelectedExpenses([]);
      fiscalExpensesQuery.refetch();
      expensesQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible retirar", variant: "destructive" });
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

  const handleCollect = (order: any) => {
    setSelectedCollection(order);
    setCollectionDialogOpen(true);
  };

  const handleCollectionSuccess = () => {
    collectionsQuery.refetch();
    incomesQuery.refetch();
    toast({ title: "Cobro registrado exitosamente" });
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
                <div className="font-semibold">{totIF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Egresos</div>
                <div className="font-semibold">{totEF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Balance</div>
                <div className="font-semibold">{(totIF - totEF).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
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
                <div className="font-semibold">{totINF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Egresos</div>
                <div className="font-semibold">{totENF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Balance</div>
                <div className="font-semibold">{(totINF - totENF).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
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
          <TabsTrigger value="fiscal-withdrawal">Retiro Gastos Fiscales</TabsTrigger>
          <TabsTrigger value="vat-management">Gestión IVA</TabsTrigger>
          <TabsTrigger value="collections">Cobranzas pendientes</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="incomes">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Ingresos - Fiscal ({incomesFiscal.length}) · Total: {totIF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</CardTitle>
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
                        <TableHead>IVA</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomesQuery.isLoading && (
                        <TableRow><TableCell colSpan={9}>Cargando...</TableCell></TableRow>
                      )}
                      {!incomesQuery.isLoading && incomesFiscal.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.income_number}</TableCell>
                          <TableCell>{r.income_date}</TableCell>
                          <TableCell>{Number(r.taxable_amount || r.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</TableCell>
                          <TableCell className="text-green-600">
                            {r.vat_amount ? `${Number(r.vat_amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })} (${r.vat_rate}%)` : 'Sin IVA'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isAdmin && (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => handleRevertIncome(r)}>Revertir</Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>¿Eliminar ingreso?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Esta acción no se puede revertir. El ingreso será eliminado permanentemente del sistema.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteIncome(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Eliminar
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}
                              </div>
                            </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Ingresos - No Fiscal ({incomesNoFiscal.length}) · Total: {totINF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</CardTitle>
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
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       {incomesQuery.isLoading && (
                         <TableRow><TableCell colSpan={7}>Cargando...</TableCell></TableRow>
                       )}
                       {!incomesQuery.isLoading && incomesNoFiscal.map((r: any) => (
                         <TableRow key={r.id}>
                           <TableCell>{r.income_number}</TableCell>
                           <TableCell>{r.income_date}</TableCell>
                           <TableCell>{Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</TableCell>
                           <TableCell>{r.category}</TableCell>
                           <TableCell>{r.payment_method}</TableCell>
                           <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isAdmin && (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => handleRevertIncome(r)}>Revertir</Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>¿Eliminar ingreso?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Esta acción no se puede revertir. El ingreso será eliminado permanentemente del sistema.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteIncome(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Eliminar
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}
                              </div>
                            </TableCell>
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
                <CardTitle>Egresos - Fiscal ({expensesFiscal.length}) · Total: {totEF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</CardTitle>
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
                        <TableHead>IVA</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesQuery.isLoading && (
                        <TableRow><TableCell colSpan={9}>Cargando...</TableCell></TableRow>
                      )}
                      {!expensesQuery.isLoading && expensesFiscal.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.expense_number}</TableCell>
                          <TableCell>{r.expense_date}</TableCell>
                          <TableCell>{Number(r.taxable_amount || r.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</TableCell>
                          <TableCell className="text-red-600">
                            {r.vat_amount ? `${Number(r.vat_amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })} (${r.vat_rate}%)` : 'Sin IVA'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                           <TableCell>
                             <div className="flex items-center gap-2">
                               {isAdmin && (
                                 <>
                                   <Button size="sm" variant="outline" onClick={() => handleRevertExpense(r)}>Revertir</Button>
                                   <AlertDialog>
                                     <AlertDialogTrigger asChild>
                                       <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                                         <X className="h-4 w-4" />
                                       </Button>
                                     </AlertDialogTrigger>
                                     <AlertDialogContent>
                                       <AlertDialogHeader>
                                         <AlertDialogTitle>¿Eliminar egreso?</AlertDialogTitle>
                                         <AlertDialogDescription>
                                           Esta acción no se puede revertir. El egreso será eliminado permanentemente del sistema.
                                         </AlertDialogDescription>
                                       </AlertDialogHeader>
                                       <AlertDialogFooter>
                                         <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                         <AlertDialogAction onClick={() => deleteExpense(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                           Eliminar
                                         </AlertDialogAction>
                                       </AlertDialogFooter>
                                     </AlertDialogContent>
                                   </AlertDialog>
                                 </>
                               )}
                             </div>
                           </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Egresos - No Fiscal ({expensesNoFiscal.length}) · Total: {totENF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</CardTitle>
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
                        <TableHead>IVA</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesQuery.isLoading && (
                        <TableRow><TableCell colSpan={9}>Cargando...</TableCell></TableRow>
                      )}
                      {!expensesQuery.isLoading && expensesNoFiscal.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.expense_number}</TableCell>
                          <TableCell>{r.expense_date}</TableCell>
                          <TableCell>{Number(r.taxable_amount || r.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</TableCell>
                          <TableCell className="text-red-600">
                            {r.vat_amount ? `${Number(r.vat_amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })} (${r.vat_rate}%)` : 'Sin IVA'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                          <TableCell>
                             <div className="flex items-center gap-2">
                               {isAdmin && (
                                 <>
                                   <Button size="sm" variant="outline" onClick={() => handleRevertExpense(r)}>Revertir</Button>
                                   <AlertDialog>
                                     <AlertDialogTrigger asChild>
                                       <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                                         <X className="h-4 w-4" />
                                       </Button>
                                     </AlertDialogTrigger>
                                     <AlertDialogContent>
                                       <AlertDialogHeader>
                                         <AlertDialogTitle>¿Eliminar egreso?</AlertDialogTitle>
                                         <AlertDialogDescription>
                                           Esta acción no se puede revertir. El egreso será eliminado permanentemente del sistema.
                                         </AlertDialogDescription>
                                       </AlertDialogHeader>
                                       <AlertDialogFooter>
                                         <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                         <AlertDialogAction onClick={() => deleteExpense(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                           Eliminar
                                         </AlertDialogAction>
                                       </AlertDialogFooter>
                                     </AlertDialogContent>
                                   </AlertDialog>
                                 </>
                               )}
                             </div>
                          </TableCell>
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
                            <TableCell>{Number(fx.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</TableCell>
                            <TableCell>{fx.account_type}</TableCell>
                            <TableCell>{fx.next_run_date}</TableCell>
                            <TableCell>{fx.active ? 'Sí' : 'No'}</TableCell>
                             <TableCell>
                               <div className="flex items-center gap-2">
                                 <Button size="sm" variant="outline" onClick={() => toggleFixedActive(fx)}>
                                   {fx.active ? 'Desactivar' : 'Activar'}
                                 </Button>
                                 {isAdmin && (
                                   <AlertDialog>
                                     <AlertDialogTrigger asChild>
                                       <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                                         <X className="h-4 w-4" />
                                       </Button>
                                     </AlertDialogTrigger>
                                     <AlertDialogContent>
                                       <AlertDialogHeader>
                                         <AlertDialogTitle>¿Eliminar gasto fijo?</AlertDialogTitle>
                                         <AlertDialogDescription>
                                           Esta acción no se puede revertir. El gasto fijo será eliminado permanentemente del sistema.
                                         </AlertDialogDescription>
                                       </AlertDialogHeader>
                                       <AlertDialogFooter>
                                         <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                         <AlertDialogAction onClick={() => deleteFixedExpense(fx.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                           Eliminar
                                         </AlertDialogAction>
                                       </AlertDialogFooter>
                                     </AlertDialogContent>
                                   </AlertDialog>
                                 )}
                               </div>
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
                    <label className="text-sm text-muted-foreground">Bono/Extra</label>
                    <Input type="number" inputMode="decimal" value={pBonusAmount} onChange={e => setPBonusAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Descripción bono</label>
                    <Input value={pBonusDesc} onChange={e => setPBonusDesc(e.target.value)} placeholder="Ej. Bono productividad" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Pagos extras</label>
                    <Input type="number" inputMode="decimal" value={pExtraPayments} onChange={e => setPExtraPayments(e.target.value)} placeholder="0.00" />
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
                {pRecurring && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-sm text-muted-foreground">Frecuencia</label>
                      <Select value={pFrequency} onValueChange={(v) => setPFrequency(v as any)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona frecuencia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="monthly">Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {pFrequency === 'weekly' && (
                      <div>
                        <label className="text-sm text-muted-foreground">Día de corte</label>
                        <Select value={pCutoffWeekday.toString()} onValueChange={(v) => setPCutoffWeekday(Number(v))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Día de corte" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Lunes</SelectItem>
                            <SelectItem value="2">Martes</SelectItem>
                            <SelectItem value="3">Miércoles</SelectItem>
                            <SelectItem value="4">Jueves</SelectItem>
                            <SelectItem value="5">Viernes</SelectItem>
                            <SelectItem value="6">Sábado</SelectItem>
                            <SelectItem value="0">Domingo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <label className="text-sm text-muted-foreground">Bono por defecto</label>
                      <Input type="number" inputMode="decimal" value={pDefaultBonus} onChange={e => setPDefaultBonus(e.target.value)} placeholder="0.00" />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox id="rec-pay" checked={pRecurring} onCheckedChange={(v) => setPRecurring(!!v)} />
                  <label htmlFor="rec-pay" className="text-sm">Programar como recurrente</label>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={pRecurring ? addRecurringPayroll : addPayroll}>{pRecurring ? 'Programar nómina' : 'Registrar nómina'}</Button>
                  <Button variant="secondary" onClick={runRecurringNow}>Ejecutar recurrentes ahora</Button>
                </div>
                <p className="text-xs text-muted-foreground">Si marcas recurrente, se programará mensual y podrás ejecutarlo manualmente o con cron.</p>

                <div className="pt-4">
                  <div className="text-sm font-medium mb-2">Nóminas programadas</div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empleado</TableHead>
                          <TableHead>Neto</TableHead>
                          <TableHead>Cuenta</TableHead>
                          <TableHead>Próxima ejecución</TableHead>
                          <TableHead>Activo</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recurringPayrollsQuery.isLoading && (
                          <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow>
                        )}
                        {!recurringPayrollsQuery.isLoading && (recurringPayrollsQuery.data ?? []).map((rp: any) => (
                          <TableRow key={rp.id}>
                            <TableCell>{rp.employee_name}</TableCell>
                            <TableCell>{Number(rp.net_salary).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</TableCell>
                            <TableCell>{rp.account_type}</TableCell>
                            <TableCell>{rp.next_run_date}</TableCell>
                            <TableCell>{rp.active ? 'Sí' : 'No'}</TableCell>
                             <TableCell>
                               <div className="flex items-center gap-2">
                                 <Button size="sm" variant="outline" onClick={() => toggleRecurringPayrollActive(rp)}>
                                   {rp.active ? 'Desactivar' : 'Activar'}
                                 </Button>
                                 {isAdmin && (
                                   <AlertDialog>
                                     <AlertDialogTrigger asChild>
                                       <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                                         <X className="h-4 w-4" />
                                       </Button>
                                     </AlertDialogTrigger>
                                     <AlertDialogContent>
                                       <AlertDialogHeader>
                                         <AlertDialogTitle>¿Eliminar nómina recurrente?</AlertDialogTitle>
                                         <AlertDialogDescription>
                                           Esta acción no se puede revertir. La nómina recurrente será eliminada permanentemente del sistema.
                                         </AlertDialogDescription>
                                       </AlertDialogHeader>
                                       <AlertDialogFooter>
                                         <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                         <AlertDialogAction onClick={() => deleteRecurringPayroll(rp.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                           Eliminar
                                         </AlertDialogAction>
                                       </AlertDialogFooter>
                                     </AlertDialogContent>
                                   </AlertDialog>
                                 )}
                               </div>
                             </TableCell>
                          </TableRow>
                        ))}
                        {!recurringPayrollsQuery.isLoading && (recurringPayrollsQuery.data ?? []).length === 0 && (
                          <TableRow><TableCell colSpan={6}>Sin nóminas programadas.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fiscal-withdrawal">
          <Card>
            <CardHeader>
              <CardTitle>Retiro de Gastos Fiscales</CardTitle>
              <p className="text-sm text-muted-foreground">Gastos fiscales pendientes de retiro de la cuenta</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <Button 
                  onClick={withdrawSelectedExpenses} 
                  disabled={selectedExpenses.length === 0}
                  className="bg-primary hover:bg-primary/90"
                >
                  Retirar Seleccionados ({selectedExpenses.length})
                </Button>
                <Button variant="outline" onClick={() => setSelectedExpenses([])}>
                  Limpiar Selección
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Seleccionar</TableHead>
                      <TableHead>#</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fiscalExpensesQuery.isLoading && (
                      <TableRow><TableCell colSpan={7}>Cargando...</TableCell></TableRow>
                    )}
                    {!fiscalExpensesQuery.isLoading && (fiscalExpensesQuery.data ?? []).map((expense: any) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedExpenses.includes(expense.id)}
                            onCheckedChange={(checked) => handleExpenseSelection(expense.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>{expense.expense_number}</TableCell>
                        <TableCell>{expense.expense_date}</TableCell>
                        <TableCell className="max-w-[300px] truncate" title={expense.description}>
                          {expense.description}
                        </TableCell>
                        <TableCell>{Number(expense.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-warning text-warning-foreground">
                            Pendiente
                          </span>
                        </TableCell>
                        <TableCell>
                          {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <X className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar egreso?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede revertir. El egreso será eliminado permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteExpense(expense.id)}>
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!fiscalExpensesQuery.isLoading && (fiscalExpensesQuery.data ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={7}>No hay gastos fiscales pendientes de retiro.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vat-management">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Calculadora de IVA</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Herramienta para calcular IVA. El IVA se registra automáticamente al crear ingresos/egresos fiscales.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Monto base (sin IVA)</label>
                    <Input 
                      type="number" 
                      inputMode="decimal" 
                      value={tempAmount} 
                      onChange={e => setTempAmount(e.target.value)} 
                      placeholder="0.00" 
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Tasa IVA (%)</label>
                    <Select value={tempVatRate} onValueChange={setTempVatRate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tasa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0% (Exento)</SelectItem>
                        <SelectItem value="8">8%</SelectItem>
                        <SelectItem value="16">16% (General)</SelectItem>
                        <SelectItem value="21">21%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {tempAmount && tempVatRate && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Monto base:</span>
                        <span>{Number(tempAmount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>IVA ({tempVatRate}%):</span>
                        <span>{calculateVat(Number(tempAmount), Number(tempVatRate)).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-lg border-t pt-2">
                        <span>Total:</span>
                        <span>{calculateTotal(Number(tempAmount), Number(tempVatRate)).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    💡 <strong>Tip:</strong> Para registrar transacciones con IVA, ve a la sección de Ingresos o Egresos 
                    y configura el IVA al crear cada registro.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumen IVA por Mes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead>IVA Cobrado</TableHead>
                        <TableHead>IVA Pagado</TableHead>
                        <TableHead>Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vatSummaryQuery.isLoading && (
                        <TableRow><TableCell colSpan={4}>Cargando...</TableCell></TableRow>
                      )}
                      {!vatSummaryQuery.isLoading && (vatSummaryQuery.data ?? []).map((summary: any) => (
                        <TableRow key={summary.period}>
                          <TableCell>{new Date(summary.period).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}</TableCell>
                          <TableCell className="text-green-600">
                            {Number(summary.vat_collected || 0).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                          </TableCell>
                          <TableCell className="text-red-600">
                            {Number(summary.vat_paid || 0).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                          </TableCell>
                          <TableCell className={Number(summary.vat_balance || 0) >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {Number(summary.vat_balance || 0).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!vatSummaryQuery.isLoading && (vatSummaryQuery.data ?? []).length === 0 && (
                        <TableRow><TableCell colSpan={4}>No hay datos de IVA registrados.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Detalle de Registros con IVA</CardTitle>
              <p className="text-sm text-muted-foreground">
                Transacciones fiscales que incluyen IVA registrado automáticamente
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Monto Base</TableHead>
                      <TableHead>Tasa IVA</TableHead>
                      <TableHead>IVA</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vatDetailsQuery.isLoading && (
                      <TableRow><TableCell colSpan={7}>Cargando...</TableCell></TableRow>
                    )}
                    {!vatDetailsQuery.isLoading && (vatDetailsQuery.data ?? []).map((vat: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{vat.date}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                            vat.type === 'ingresos' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {vat.type === 'ingresos' ? 'Ingreso' : 'Egreso'}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={vat.description}>
                          {vat.description}
                        </TableCell>
                        <TableCell>{Number(vat.taxable_amount || vat.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</TableCell>
                        <TableCell>{vat.vat_rate || 0}%</TableCell>
                        <TableCell className={vat.type === 'ingresos' ? 'text-green-600' : 'text-red-600'}>
                          {Number(vat.vat_amount || 0).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {Number(vat.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!vatDetailsQuery.isLoading && (vatDetailsQuery.data ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={7}>No hay registros con IVA para el período seleccionado.</TableCell></TableRow>
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
              <div>
                <CardTitle>Cobranza Pendiente ({collectionsQuery.data?.length ?? 0})</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Órdenes terminadas pendientes de cobro
                </p>
              </div>
              <Button size="sm" onClick={() => onExport("collections")}>Exportar CSV</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Pagado</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectionsQuery.isLoading && (
                      <TableRow><TableCell colSpan={8}>Cargando cobranzas pendientes...</TableCell></TableRow>
                    )}
                    {!collectionsQuery.isLoading && (collectionsQuery.data ?? []).map((order: any) => (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.client_name}</div>
                            <div className="text-xs text-muted-foreground">{order.client_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(order.delivery_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">
                          {Number(order.estimated_cost).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                        </TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {Number(order.total_paid || 0).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                        </TableCell>
                        <TableCell className="text-red-600 font-medium">
                          {Number(order.remaining_balance || order.estimated_cost).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <span className="text-sm text-orange-600 font-medium">Pendiente Cobro</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={() => {
                              setSelectedCollection(order);
                              setCollectionDialogOpen(true);
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Cobrar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!collectionsQuery.isLoading && (collectionsQuery.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-4xl">💰</div>
                            <div className="font-medium">No hay cobranzas pendientes</div>
                            <div className="text-sm">Todas las órdenes terminadas han sido cobradas</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Historial de Movimientos ({financialHistoryQuery.data?.length || 0})</CardTitle>
              <Button 
                size="sm" 
                onClick={() => exportCsv(`historial_financiero_${startDate}_${endDate}`, financialHistoryQuery.data as any)}
                disabled={!financialHistoryQuery.data?.length}
              >
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tabla</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Usuario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialHistoryQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          Cargando historial...
                        </TableCell>
                      </TableRow>
                    )}
                    {financialHistoryQuery.data?.map((h: any) => (
                      <TableRow key={h.id}>
                        <TableCell>{h.operation_date}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            h.operation_type === 'create' ? 'bg-green-100 text-green-800' :
                            h.operation_type === 'delete' ? 'bg-red-100 text-red-800' :
                            h.operation_type === 'reverse' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {h.operation_type === 'create' ? 'Crear' :
                             h.operation_type === 'delete' ? 'Eliminar' :
                             h.operation_type === 'reverse' ? 'Revertir' :
                             h.operation_type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            h.table_name === 'incomes' ? 'bg-blue-100 text-blue-800' :
                            h.table_name === 'expenses' ? 'bg-orange-100 text-orange-800' :
                            h.table_name === 'fixed_expenses' ? 'bg-purple-100 text-purple-800' :
                            h.table_name === 'recurring_payrolls' ? 'bg-pink-100 text-pink-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {h.table_name === 'incomes' ? 'Ingresos' :
                             h.table_name === 'expenses' ? 'Egresos' :
                             h.table_name === 'fixed_expenses' ? 'Gastos Fijos' :
                             h.table_name === 'recurring_payrolls' ? 'Nóminas' :
                             h.table_name}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate" title={h.operation_description}>
                          {h.operation_description}
                        </TableCell>
                        <TableCell className="font-mono">
                          {Number(h.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            h.account_type === 'fiscal' ? 'bg-green-100 text-green-800' :
                            h.account_type === 'no_fiscal' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {h.account_type === 'fiscal' ? 'Fiscal' :
                             h.account_type === 'no_fiscal' ? 'No Fiscal' :
                             h.account_type || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {h.profiles?.full_name || 'Sistema'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!financialHistoryQuery.isLoading && (!financialHistoryQuery.data || financialHistoryQuery.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-4xl">📋</div>
                            <div className="font-medium">No hay movimientos en el historial</div>
                            <div className="text-sm">Los movimientos aparecerán aquí conforme se vayan realizando</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CollectionDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
        collection={selectedCollection}
        onSuccess={() => {
          incomesQuery.refetch();
          collectionsQuery.refetch();
          toast({ title: "Cobro registrado exitosamente" });
        }}
      />
    </AppLayout>
  );
}
