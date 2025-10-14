import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { revertPaymentByIncomeId } from "@/utils/paymentRevert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { FiscalWithdrawalDialog } from "@/components/finance/FiscalWithdrawalDialog";
import { MultipleFiscalWithdrawalsDialog } from "@/components/finance/MultipleFiscalWithdrawalsDialog";
import { FinancialHistoryPanel } from "@/components/finance/FinancialHistoryPanel";
import { CollectionsManager } from "@/components/finance/CollectionsManager";
import { PayrollWithdrawals } from "@/components/finance/PayrollWithdrawals";
import { AccountsConsecutiveReport } from "@/components/finance/AccountsConsecutiveReport";
import { LoansManager } from "@/components/finance/LoansManager";
import { RecurringPayrollsManager } from "@/components/finance/RecurringPayrollsManager";
import { FixedExpensesManager } from "@/components/finance/FixedExpensesManager";
import { X, Plus, Trash2, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateMexico, formatDateTimeMexico } from '@/utils/dateUtils';

// Util simple para exportar CSV en cliente
function exportCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };
  const csv = [headers.join(",")].concat(rows.map(r => headers.map(h => escape(r[h])).join(","))).join("\n");
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
export default function Finance() {
  const {
    toast
  } = useToast();
  const {
    profile
  } = useAuth();
  const isAdmin = profile?.role === 'administrador';

  // SEO básico
  useEffect(() => {
    document.title = "Finanzas y Cobranzas | SYSLAG";
    const metaDesc = document.querySelector('meta[name="description"]') || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Finanzas SYSLAG: ingresos, egresos y exportación CSV.");
    if (!metaDesc.parentElement) document.head.appendChild(metaDesc);
    const linkCanonical = document.querySelector('link[rel="canonical"]') || document.createElement("link");
    linkCanonical.setAttribute("rel", "canonical");
    linkCanonical.setAttribute("href", window.location.origin + "/finanzas");
    if (!linkCanonical.parentElement) document.head.appendChild(linkCanonical);
  }, []);

  // Filtros compartidos - desactivados por defecto
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [accountType, setAccountType] = useState<string>("all"); // all | fiscal | no_fiscal
  const [filtersEnabled, setFiltersEnabled] = useState<boolean>(false);

  // Estado para retiros
  const [selectedWithdrawals, setSelectedWithdrawals] = useState<string[]>([]);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [withdrawalConcept, setWithdrawalConcept] = useState('');
  const [withdrawalDescription, setWithdrawalDescription] = useState('');

  // Estado para diálogo de retiro fiscal individual
  const [fiscalWithdrawalDialog, setFiscalWithdrawalDialog] = useState<{
    open: boolean;
    withdrawal: any;
  }>({
    open: false,
    withdrawal: null
  });

  // Estado para diálogo de retiros fiscales múltiples
  const [multipleFiscalWithdrawalsDialog, setMultipleFiscalWithdrawalsDialog] = useState(false);

  // Función para establecer mes actual rápidamente
  const setCurrentMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10);
    setStartDate(firstDay);
    setEndDate(lastDay);
    setFiltersEnabled(true);
  };
  
  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setFiltersEnabled(false);
  };

  // Queries para balances generales (sin filtros)
  const generalIncomesQuery = useQuery({
    queryKey: ["general_incomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("amount,account_type")
        .eq("status", "recibido")
        .neq("category", "referencia");
      if (error) throw error;
      return data ?? [];
    }
  });

  const generalExpensesQuery = useQuery({
    queryKey: ["general_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount,account_type");
      if (error) throw error;
      return data ?? [];
    }
  });

  // Queries con filtros
  const incomesQuery = useQuery({
    queryKey: ["incomes", startDate, endDate, accountType, filtersEnabled],
    queryFn: async () => {
      let q = supabase.from("incomes").select("id,income_number,income_date,amount,account_type,category,description,payment_method,vat_rate,vat_amount,taxable_amount,isr_withholding_rate,isr_withholding_amount,client_name,invoice_number,created_at").order("income_date", {
        ascending: false
      });
      if (filtersEnabled && startDate) q = q.gte("income_date", startDate);
      if (filtersEnabled && endDate) q = q.lte("income_date", endDate);
      if (accountType !== "all") q = q.eq("account_type", accountType as any);
      // Mostrar solo ingresos cobrados, no los pendientes de cobranza
      q = q.eq("status", "recibido");
      // Excluir ingresos de referencia (dummy entries para retiros fiscales)
      q = q.neq("category", "referencia");
      const {
        data,
        error
      } = await q;
      if (error) throw error;
      return data ?? [];
    }
  });
  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("suppliers").select("*").eq("status", "active").order("supplier_name");
      if (error) throw error;
      return data || [];
    }
  });
  const purchasesQuery = useQuery({
    queryKey: ["purchases", startDate, endDate],
    queryFn: async () => {
      let q = supabase.from("purchases").select(`
          *,
          supplier:suppliers(supplier_name)
        `).order("purchase_date", {
        ascending: false
      });
      if (startDate) q = q.gte("purchase_date", startDate);
      if (endDate) q = q.lte("purchase_date", endDate);
      const {
        data,
        error
      } = await q;
      if (error) throw error;
      return data || [];
    }
  });
  const expensesQuery = useQuery({
    queryKey: ["expenses", startDate, endDate, accountType, filtersEnabled],
    queryFn: async () => {
      let q = supabase.from("expenses").select("id,expense_number,expense_date,amount,account_type,category,description,payment_method,withdrawal_status,vat_rate,vat_amount,taxable_amount,invoice_number,created_at").order("expense_date", {
        ascending: false
      });
      if (filtersEnabled && startDate) q = q.gte("expense_date", startDate);
      if (filtersEnabled && endDate) q = q.lte("expense_date", endDate);
      if (accountType !== "all") q = q.eq("account_type", accountType as any);
      const {
        data,
        error
      } = await q;
      if (error) throw error;
      return data ?? [];
    }
  });

  // Query para retiros fiscales vinculados a órdenes
  const fiscalWithdrawalsQuery = useQuery({
    queryKey: ["fiscal_withdrawals"],
    queryFn: async () => {
      console.log('Fetching fiscal withdrawals...');
      const {
        data,
        error
      } = await supabase.from("fiscal_withdrawals").select(`
          id,
          amount,
          description,
          withdrawal_status,
          created_at,
          withdrawn_at,
          purchases!fiscal_withdrawal_id(invoice_number)
        `).like('description', 'Factura pendiente:%').order("created_at", {
        ascending: false
      });
      if (error) {
        console.error('Error fetching fiscal withdrawals:', error);
        throw error;
      }
      console.log('Fiscal withdrawals fetched:', data);
      console.log('Available withdrawals:', data?.filter(fw => fw.withdrawal_status === 'available'));
      return data ?? [];
    }
  });

  // Query para IVA - ahora desde incomes y expenses
  const vatDetailsQuery = useQuery({
    queryKey: ["vat_details", startDate, endDate],
    queryFn: async () => {
      const [incomesData, expensesData] = await Promise.all([
        supabase.from("incomes").select("income_date, description, amount, vat_rate, vat_amount, taxable_amount")
          .eq("account_type", "fiscal")
          .eq("status", "recibido")
          .neq("category", "referencia") // Excluir referencias
          .not("vat_amount", "is", null)
          .gte("income_date", startDate)
          .lte("income_date", endDate)
          .order("income_date", { ascending: false }), 
        supabase.from("expenses").select("expense_date, description, amount, vat_rate, vat_amount, taxable_amount")
          .eq("account_type", "fiscal")
          .not("vat_amount", "is", null)
          .gte("expense_date", startDate)
          .lte("expense_date", endDate)
          .order("expense_date", { ascending: false })
      ]);
      if (incomesData.error) throw incomesData.error;
      if (expensesData.error) throw expensesData.error;
      const combined = [...(incomesData.data || []).map(item => ({
        ...item,
        date: item.income_date,
        type: 'ingresos'
      })), ...(expensesData.data || []).map(item => ({
        ...item,
        date: item.expense_date,
        type: 'egresos'
      }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return combined;
    }
  });

  // Query para resumen de IVA
  const vatSummaryQuery = useQuery({
    queryKey: ["vat_summary"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("vat_summary").select("*").limit(12);
      if (error) throw error;
      return data ?? [];
    }
  });

  // Query para préstamos activos
  const loansQuery = useQuery({
    queryKey: ["loans_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("id, loan_number, amount, monthly_payment, status")
        .eq("status", "activo");
      if (error) throw error;
      return data ?? [];
    }
  });

  // Query para pagos de préstamos pendientes
  const loanPaymentsQuery = useQuery({
    queryKey: ["loan_payments_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_payments")
        .select("id, loan_id, due_date, amount, status")
        .in("status", ["pendiente", "vencido"])
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
  });

  // Query para ISR retenido de ingresos
  const isrRetentionsQuery = useQuery({
    queryKey: ["isr_retentions", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("income_date, description, amount, isr_withholding_rate, isr_withholding_amount")
        .eq("account_type", "fiscal")
        .eq("status", "recibido")
        .neq("category", "referencia") // Excluir referencias
        .not("isr_withholding_amount", "is", null)
        .gte("income_date", startDate)
        .lte("income_date", endDate)
        .order("income_date", { ascending: false });
      
      if (error) throw error;
      return data ?? [];
    }
  });

  // Query para resumen de IVA del período actual
  const currentVatSummaryQuery = useQuery({
    queryKey: ["current_vat_summary", startDate, endDate],
    queryFn: async () => {
      const [incomesVat, expensesVat] = await Promise.all([
        supabase
          .from("incomes")
          .select("vat_amount")
          .eq("account_type", "fiscal")
          .eq("status", "recibido")
          .neq("category", "referencia") // Excluir referencias
          .not("vat_amount", "is", null)
          .gte("income_date", startDate)
          .lte("income_date", endDate),
        supabase
          .from("expenses")
          .select("vat_amount")
          .eq("account_type", "fiscal")
          .not("vat_amount", "is", null)
          .gte("expense_date", startDate)
          .lte("expense_date", endDate)
      ]);

      if (incomesVat.error) throw incomesVat.error;
      if (expensesVat.error) throw expensesVat.error;

      const totalVatIncome = (incomesVat.data ?? []).reduce((sum, item) => sum + (Number(item.vat_amount) || 0), 0);
      const totalVatExpense = (expensesVat.data ?? []).reduce((sum, item) => sum + (Number(item.vat_amount) || 0), 0);
      const vatBalance = totalVatIncome - totalVatExpense;

      return {
        totalVatIncome,
        totalVatExpense,
        vatBalance,
        status: vatBalance > 0 ? 'a_pagar' : 'a_favor'
      };
    }
  });

  // Query para reporte fiscal - ingresos fiscales detallados
  const fiscalIncomesQuery = useQuery({
    queryKey: ["fiscal_incomes", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("*")
        .eq("account_type", "fiscal")
        .eq("status", "recibido")
        .neq("category", "referencia") // Excluir referencias
        .gte("income_date", startDate)
        .lte("income_date", endDate)
        .order("income_date", { ascending: false });
      
      if (error) throw error;
      return data ?? [];
    }
  });

  // Query para reporte fiscal - egresos fiscales detallados
  const fiscalExpensesQuery = useQuery({
    queryKey: ["fiscal_expenses", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("account_type", "fiscal")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate)
        .order("expense_date", { ascending: false });
      
      if (error) throw error;
      return data ?? [];
    }
  });
  const financialHistoryQuery = useQuery({
    queryKey: ["financial_history", startDate, endDate],
    queryFn: async () => {
      let q = supabase.from("financial_history").select(`
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
        `).order("created_at", {
        ascending: false
      });
      if (startDate) q = q.gte("operation_date", startDate);
      if (endDate) q = q.lte("operation_date", endDate);
      const {
        data,
        error
      } = await q;
      if (error) throw error;
      return data ?? [];
    }
  });
  const fixedExpensesQuery = useQuery({
    queryKey: ["fixed_expenses"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("fixed_expenses").select("id,description,amount,account_type,payment_method,next_run_date,active,day_of_month").order("created_at", {
        ascending: false
      });
      if (error) throw error;
      return data ?? [];
    }
  });
  const recurringPayrollsQuery = useQuery({
    queryKey: ["recurring_payrolls"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("recurring_payrolls").select("id,employee_name,base_salary,net_salary,account_type,payment_method,next_run_date,active,day_of_month").order("created_at", {
        ascending: false
      });
      if (error) throw error;
      return data ?? [];
    }
  });
  const fixedIncomesQuery = useQuery({
    queryKey: ["fixed_incomes"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("fixed_incomes").select("id,description,amount,account_type,payment_method,next_run_date,active,day_of_month").order("created_at", {
        ascending: false
      });
      if (error) throw error;
      return data ?? [];
    }
  });
  // Balances generales (sin filtro)
  const generalData = useMemo(() => {
    const generalIncomes = generalIncomesQuery.data ?? [];
    const generalExpenses = generalExpensesQuery.data ?? [];
    
    const genIF = generalIncomes.filter(r => r.account_type === 'fiscal').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const genINF = generalIncomes.filter(r => r.account_type === 'no_fiscal').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const genEF = generalExpenses.filter(r => r.account_type === 'fiscal').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const genENF = generalExpenses.filter(r => r.account_type === 'no_fiscal').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    
    return { genIF, genINF, genEF, genENF };
  }, [generalIncomesQuery.data, generalExpensesQuery.data]);

  // Resumen de préstamos
  const loansData = useMemo(() => {
    const activeLoans = loansQuery.data ?? [];
    const pendingPayments = loanPaymentsQuery.data ?? [];
    
    const totalDebt = pendingPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const activeLoansCount = activeLoans.length;
    const nextPayment = pendingPayments[0]; // Ya están ordenados por fecha
    
    return { totalDebt, activeLoansCount, nextPayment };
  }, [loansQuery.data, loanPaymentsQuery.data]);

  const incomesTotal = useMemo(() => incomesQuery.data?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0, [incomesQuery.data]);
  const expensesTotal = useMemo(() => expensesQuery.data?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0, [expensesQuery.data]);

  // Cálculos para gastos fijos recurrentes mensuales
  const monthlyFixedExpenses = useMemo(() => {
    return (fixedExpensesQuery.data ?? []).filter((fx: any) => fx.active).reduce((total: number, fx: any) => total + (Number(fx.amount) || 0), 0);
  }, [fixedExpensesQuery.data]);
  const monthlyRecurringPayrolls = useMemo(() => {
    return (recurringPayrollsQuery.data ?? []).filter((pr: any) => pr.active).reduce((total: number, pr: any) => total + (Number(pr.net_salary) || 0), 0);
  }, [recurringPayrollsQuery.data]);

  // Cálculos para ingresos fijos mensuales
  const monthlyFixedIncomes = useMemo(() => {
    return (fixedIncomesQuery.data ?? []).filter((fi: any) => fi.active).reduce((total: number, fi: any) => total + (Number(fi.amount) || 0), 0);
  }, [fixedIncomesQuery.data]);
  const totalMonthlyFixedCosts = monthlyFixedExpenses + monthlyRecurringPayrolls;
  const netMonthlyFixedFlow = monthlyFixedIncomes - totalMonthlyFixedCosts;

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
  const [feDayOfMonth, setFeDayOfMonth] = useState<number>(1);
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
  const [pDayOfMonth, setPDayOfMonth] = useState<number>(1);

  // Estados para ingresos fijos
  const [fiDesc, setFiDesc] = useState("");
  const [fiAmount, setFiAmount] = useState("");
  const [fiAccount, setFiAccount] = useState<"fiscal" | "no_fiscal">("fiscal");
  const [fiMethod, setFiMethod] = useState("");
  const [fiDayOfMonth, setFiDayOfMonth] = useState<number>(1);

  // Estados para egresos directos
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expAccount, setExpAccount] = useState<"fiscal" | "no_fiscal">("fiscal");
  const [expMethod, setExpMethod] = useState("");
  const [expCategory, setExpCategory] = useState("");
  const [expDate, setExpDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [expInvoiceNumber, setExpInvoiceNumber] = useState("");

  // Estados para compras
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [purchaseConcept, setPurchaseConcept] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchaseAccount, setPurchaseAccount] = useState<"fiscal" | "no_fiscal">("no_fiscal");
  const [purchaseMethod, setPurchaseMethod] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [purchaseHasInvoice, setPurchaseHasInvoice] = useState(false);
  const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState("");
  const [editingPurchase, setEditingPurchase] = useState<any>(null);

  // Estados para proveedores
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierRFC, setSupplierRFC] = useState("");
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);

  // Estados para IVA (ya no se usan para registrar, solo para mostrar cálculos)
  const [showVatCalculator, setShowVatCalculator] = useState(false);
  const [tempAmount, setTempAmount] = useState("");
  const [tempVatRate, setTempVatRate] = useState("16");

  // Estados removidos - ya no se necesitan gastos fiscales seleccionados

  // Función para registrar en historial financiero
  const logFinancialOperation = async (operationType: string, tableName: string, recordId: string, recordData: any, description: string, amount: number, accountType?: string, operationDate?: string) => {
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
      const {
        data,
        error
      } = await supabase.from("fixed_expenses").insert({
        description: feDesc,
        amount,
        account_type: feAccount as any,
        payment_method: feMethod || null,
        frequency: 'monthly',
        day_of_month: feDayOfMonth
      } as any).select('*').single();
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation('create', 'fixed_expenses', data.id, data, `Creación de gasto fijo: ${feDesc}`, amount, feAccount as any);
      toast({
        title: "Gasto fijo programado"
      });
      setFeDesc("");
      setFeAmount("");
      setFeMethod("");
      setFeAccount("fiscal");
      setFeDayOfMonth(1);
      fixedExpensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible agregar",
        variant: "destructive"
      });
    }
  };
  const addFixedIncome = async () => {
    try {
      const amount = Number(fiAmount);
      if (!fiDesc || !amount) throw new Error("Completa descripción y monto válido");
      const {
        data,
        error
      } = await supabase.from("fixed_incomes").insert({
        description: fiDesc,
        amount,
        account_type: fiAccount as any,
        payment_method: fiMethod || null,
        frequency: 'monthly',
        day_of_month: fiDayOfMonth
      } as any).select('*').single();
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation('create', 'fixed_incomes', data.id, data, `Creación de ingreso fijo: ${fiDesc}`, amount, fiAccount as any);
      toast({
        title: "Ingreso fijo programado"
      });
      setFiDesc("");
      setFiAmount("");
      setFiMethod("");
      setFiAccount("fiscal");
      setFiDayOfMonth(1);
      fixedIncomesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible agregar",
        variant: "destructive"
      });
    }
  };
  const addSupplier = async () => {
    try {
      if (!supplierName) throw new Error("El nombre del proveedor es obligatorio");
      const {
        data,
        error
      } = await supabase.from("suppliers").insert({
        supplier_name: supplierName,
        contact_person: supplierContact || null,
        email: supplierEmail || null,
        phone: supplierPhone || null,
        address: supplierAddress || null,
        tax_id: supplierRFC || null,
        status: 'active'
      }).select().single();
      if (error) throw error;
      toast({
        title: "Proveedor agregado"
      });
      setSupplierName("");
      setSupplierContact("");
      setSupplierEmail("");
      setSupplierPhone("");
      setSupplierAddress("");
      setSupplierRFC("");
      setShowSupplierDialog(false);
      suppliersQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible agregar el proveedor",
        variant: "destructive"
      });
    }
  };
  const updateSupplier = async () => {
    try {
      if (!editingSupplier || !supplierName) throw new Error("Datos incompletos");
      const {
        error
      } = await supabase.from("suppliers").update({
        supplier_name: supplierName,
        contact_person: supplierContact || null,
        email: supplierEmail || null,
        phone: supplierPhone || null,
        address: supplierAddress || null,
        tax_id: supplierRFC || null
      }).eq("id", editingSupplier.id);
      if (error) throw error;
      toast({
        title: "Proveedor actualizado"
      });
      setSupplierName("");
      setSupplierContact("");
      setSupplierEmail("");
      setSupplierPhone("");
      setSupplierAddress("");
      setSupplierRFC("");
      setEditingSupplier(null);
      setShowSupplierDialog(false);
      suppliersQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible actualizar el proveedor",
        variant: "destructive"
      });
    }
  };
  const deleteSupplier = async (supplierId: string) => {
    try {
      const {
        error
      } = await supabase.from("suppliers").update({
        status: 'inactive'
      }).eq("id", supplierId);
      if (error) throw error;
      toast({
        title: "Proveedor eliminado"
      });
      suppliersQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible eliminar el proveedor",
        variant: "destructive"
      });
    }
  };
  const addPurchase = async () => {
    try {
      const amount = Number(purchaseAmount);
      if (!purchaseSupplier || !purchaseConcept || !amount) throw new Error("Completa todos los campos obligatorios");

      // Validar que si no tiene factura, solo se puede pagar desde cuenta no fiscal
      if (!purchaseHasInvoice && purchaseAccount === 'fiscal') {
        throw new Error("Sin factura solo se puede pagar desde cuenta no fiscal");
      }

      // Si es fiscal con factura, validar número de factura
      if (purchaseHasInvoice && purchaseAccount === 'fiscal' && !purchaseInvoiceNumber.trim()) {
        throw new Error("Debe ingresar un número de factura para compras fiscales");
      }

      // Calcular IVA si es cuenta fiscal
      // Si es fiscal, el monto incluye IVA, así que calculamos la base gravable
      const vatRate = purchaseAccount === "fiscal" ? 16 : 0;
      const taxableAmount = purchaseAccount === "fiscal" ? amount / 1.16 : amount;
      const vatAmount = purchaseAccount === "fiscal" ? amount - taxableAmount : 0;

      // Crear el gasto (incluyendo supplier_id)
      const {
        data: expense,
        error: expenseError
      } = await supabase.from("expenses").insert({
        amount: amount,
        description: `Compra - ${purchaseConcept}`,
        category: "compra",
        account_type: purchaseAccount as any,
        payment_method: purchaseMethod || null,
        expense_date: purchaseDate,
        vat_rate: vatRate || null,
        vat_amount: vatAmount || null,
        taxable_amount: taxableAmount || null,
        has_invoice: purchaseAccount === 'fiscal' ? true : purchaseHasInvoice,
        invoice_number: purchaseAccount === 'fiscal' ? purchaseInvoiceNumber.trim() : purchaseHasInvoice ? purchaseInvoiceNumber.trim() : null,
        supplier_id: purchaseSupplier, // Agregado: guardar el supplier_id
        status: "pagado"
      } as any).select().single();
      if (expenseError) throw expenseError;

      // Buscar el proveedor seleccionado
      const supplier = suppliersQuery.data?.find(s => s.id === purchaseSupplier);

      // Crear el registro de compra
      const purchaseData = {
        supplier_id: purchaseSupplier,
        supplier_name: supplier?.supplier_name || 'Proveedor',
        concept: purchaseConcept,
        total_amount: amount,
        has_invoice: purchaseHasInvoice,
        invoice_number: purchaseHasInvoice ? purchaseInvoiceNumber : null,
        account_type: purchaseAccount,
        payment_method: purchaseMethod || null,
        purchase_date: purchaseDate,
        expense_id: expense.id
      };
      const {
        data: purchase,
        error: purchaseError
      } = await supabase.from("purchases").insert(purchaseData).select().single();
      if (purchaseError) throw purchaseError;

      // Si tiene factura y se pagó de cuenta no fiscal, crear retiro fiscal disponible
      if (purchaseHasInvoice && purchaseAccount === 'no_fiscal' && amount > 0) {
        console.log('Creating fiscal withdrawal for invoiced purchase from non-fiscal account');
        
        const {
          data: withdrawal,
          error: withdrawalError
        } = await supabase.from("fiscal_withdrawals").insert({
          amount: amount,
          description: `Factura pendiente: ${purchaseConcept} - ${supplier?.supplier_name || 'Proveedor'}`,
          withdrawal_status: 'available',
          income_id: null
        } as any).select().single();
        
        if (withdrawalError) {
          console.error("Error creating fiscal withdrawal:", withdrawalError);
          throw withdrawalError;
        } else {
          console.log("Fiscal withdrawal created successfully:", withdrawal);
        }
      }

      // Log en historial financiero
      await logFinancialOperation('create', 'purchases', purchase.id, purchase, `Compra registrada: ${supplier?.supplier_name || 'Proveedor'} - ${purchaseConcept}${purchaseHasInvoice ? ' (Con factura)' : ' (Sin factura)'}`, amount, purchaseAccount, purchaseDate);
      toast({
        title: "Compra registrada"
      });
      setPurchaseSupplier("");
      setPurchaseConcept("");
      setPurchaseAmount("");
      setPurchaseMethod("");
      setPurchaseHasInvoice(false);
      setPurchaseInvoiceNumber("");
      expensesQuery.refetch();
      purchasesQuery.refetch();
      fiscalWithdrawalsQuery.refetch(); // Refrescar retiros fiscales
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible registrar la compra",
        variant: "destructive"
      });
    }
  };

  const updatePurchase = async () => {
    if (!editingPurchase) return;
    try {
      const amount = Number(purchaseAmount);
      if (!purchaseSupplier || !purchaseConcept || !amount) throw new Error("Completa todos los campos obligatorios");

      // Validar que si no tiene factura, solo se puede pagar desde cuenta no fiscal
      if (!purchaseHasInvoice && purchaseAccount === 'fiscal') {
        throw new Error("Sin factura solo se puede pagar desde cuenta no fiscal");
      }

      // Si es fiscal con factura, validar número de factura
      if (purchaseHasInvoice && purchaseAccount === 'fiscal' && !purchaseInvoiceNumber.trim()) {
        throw new Error("Debe ingresar un número de factura para compras fiscales");
      }

      // Calcular IVA si es cuenta fiscal
      const vatRate = purchaseAccount === "fiscal" ? 16 : 0;
      const taxableAmount = purchaseAccount === "fiscal" ? amount / 1.16 : amount;
      const vatAmount = purchaseAccount === "fiscal" ? amount - taxableAmount : 0;

      // Actualizar el gasto relacionado
      const { error: expenseError } = await supabase.from("expenses").update({
        amount: amount,
        description: `Compra - ${purchaseConcept}`,
        account_type: purchaseAccount as any,
        payment_method: purchaseMethod || null,
        expense_date: purchaseDate,
        vat_rate: vatRate || null,
        vat_amount: vatAmount || null,
        taxable_amount: taxableAmount || null,
        has_invoice: purchaseAccount === 'fiscal' ? true : purchaseHasInvoice,
        invoice_number: purchaseAccount === 'fiscal' ? purchaseInvoiceNumber.trim() : purchaseHasInvoice ? purchaseInvoiceNumber.trim() : null,
        supplier_id: purchaseSupplier
      } as any).eq("id", editingPurchase.expense_id);
      
      if (expenseError) throw expenseError;

      // Buscar el proveedor seleccionado
      const supplier = suppliersQuery.data?.find(s => s.id === purchaseSupplier);

      // Actualizar el registro de compra
      const purchaseData = {
        supplier_id: purchaseSupplier,
        supplier_name: supplier?.supplier_name || 'Proveedor',
        concept: purchaseConcept,
        total_amount: amount,
        has_invoice: purchaseHasInvoice,
        invoice_number: purchaseHasInvoice ? purchaseInvoiceNumber : null,
        account_type: purchaseAccount,
        payment_method: purchaseMethod || null,
        purchase_date: purchaseDate
      };
      
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .update(purchaseData)
        .eq("id", editingPurchase.id)
        .select()
        .single();
        
      if (purchaseError) throw purchaseError;

      // Log en historial financiero
      await logFinancialOperation('update', 'purchases', purchase.id, purchase, `Compra actualizada: ${supplier?.supplier_name || 'Proveedor'} - ${purchaseConcept}`, amount, purchaseAccount, purchaseDate);
      
      toast({
        title: "Compra actualizada"
      });
      
      // Resetear estados
      setPurchaseSupplier("");
      setPurchaseConcept("");
      setPurchaseAmount("");
      setPurchaseMethod("");
      setPurchaseHasInvoice(false);
      setPurchaseInvoiceNumber("");
      setEditingPurchase(null);
      
      expensesQuery.refetch();
      purchasesQuery.refetch();
      fiscalWithdrawalsQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible actualizar la compra",
        variant: "destructive"
      });
    }
  };

  const deletePurchase = async (purchaseId: string) => {
    if (!isAdmin) return;
    try {
      // Obtener la compra completa con sus relaciones
      const { data: purchase, error: fetchError } = await supabase
        .from("purchases")
        .select("*")
        .eq("id", purchaseId)
        .single();

      if (fetchError) throw fetchError;
      if (!purchase) throw new Error("Compra no encontrada");

      // 1. Eliminar retiros fiscales relacionados
      if (purchase.fiscal_withdrawal_id) {
        await supabase.from("fiscal_withdrawals").delete().eq("id", purchase.fiscal_withdrawal_id);
      }

      // 2. Eliminar el expense relacionado
      if (purchase.expense_id) {
        await supabase.from("expenses").delete().eq("id", purchase.expense_id);
      }

      // 3. Eliminar la compra
      const { error: deleteError } = await supabase.from("purchases").delete().eq("id", purchaseId);
      if (deleteError) throw deleteError;

      // 4. Log en historial financiero
      await logFinancialOperation(
        'delete',
        'purchases',
        purchaseId,
        purchase,
        `Eliminación de compra: ${purchase.concept} - ${purchase.supplier_name}`,
        purchase.total_amount,
        purchase.account_type,
        purchase.purchase_date
      );

      toast({
        title: "Compra eliminada",
        description: "Se eliminaron todos los registros relacionados (egreso y retiros fiscales)"
      });

      // Refrescar todas las queries relacionadas
      purchasesQuery.refetch();
      expensesQuery.refetch();
      fiscalWithdrawalsQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible eliminar la compra",
        variant: "destructive"
      });
    }
  };
  const deleteFixedExpense = async (id: string) => {
    if (!isAdmin) return;
    try {
      // Get record data before deletion for history
      const {
        data: recordData
      } = await supabase.from("fixed_expenses").select("*").eq("id", id).single();
      const {
        error
      } = await supabase.from("fixed_expenses").delete().eq("id", id);
      if (error) throw error;

      // Log deletion
      if (recordData) {
        await logFinancialOperation('delete', 'fixed_expenses', id, recordData, `Eliminación de gasto fijo: ${recordData.description}`, recordData.amount, recordData.account_type);
      }
      toast({
        title: "Gasto fijo eliminado"
      });
      fixedExpensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible eliminar",
        variant: "destructive"
      });
    }
  };
  const deleteRecurringPayroll = async (id: string) => {
    if (!isAdmin) return;
    try {
      // Get record data before deletion for history
      const {
        data: recordData
      } = await supabase.from("recurring_payrolls").select("*").eq("id", id).single();
      const {
        error
      } = await supabase.from("recurring_payrolls").delete().eq("id", id);
      if (error) throw error;

      // Log deletion
      if (recordData) {
        await logFinancialOperation('delete', 'recurring_payrolls', id, recordData, `Eliminación de nómina recurrente: ${recordData.employee_name}`, recordData.net_salary, recordData.account_type);
      }
      toast({
        title: "Nómina recurrente eliminada"
      });
      recurringPayrollsQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible eliminar",
        variant: "destructive"
      });
    }
  };
  const deleteFixedIncome = async (id: string) => {
    if (!isAdmin) return;
    try {
      // Get record data before deletion for history
      const {
        data: recordData
      } = await supabase.from("fixed_incomes").select("*").eq("id", id).single();
      const {
        error
      } = await supabase.from("fixed_incomes").delete().eq("id", id);
      if (error) throw error;

      // Log deletion
      if (recordData) {
        await logFinancialOperation('delete', 'fixed_incomes', id, recordData, `Eliminación de ingreso fijo: ${recordData.description}`, recordData.amount, recordData.account_type);
      }
      toast({
        title: "Ingreso fijo eliminado"
      });
      fixedIncomesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible eliminar",
        variant: "destructive"
      });
    }
  };
  const toggleFixedIncomeActive = async (row: any) => {
    try {
      const {
        error
      } = await supabase.from('fixed_incomes').update({
        active: !row.active
      }).eq('id', row.id);
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation('update', 'fixed_incomes', row.id, {
        ...row,
        active: !row.active
      }, `${row.active ? 'Desactivación' : 'Activación'} de ingreso fijo: ${row.description}`, row.amount, row.account_type);
      toast({
        title: row.active ? 'Ingreso fijo desactivado' : 'Ingreso fijo activado'
      });
      fixedIncomesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'No fue posible actualizar',
        variant: 'destructive'
      });
    }
  };
  const addExpense = async () => {
    try {
      const amount = Number(expAmount);
      if (!expDesc || !amount || !expAccount || !expCategory) throw new Error("Completa todos los campos requeridos");

      // Validar factura para cuentas fiscales
      if (expAccount === 'fiscal' && (!expInvoiceNumber || expInvoiceNumber.trim() === "")) {
        throw new Error("Para cuentas fiscales es obligatorio ingresar el número de factura");
      }

      // Calcular IVA si es cuenta fiscal
      let vatRate = 0;
      let vatAmount = 0;
      let taxableAmount = amount;
      if (expAccount === 'fiscal') {
        vatRate = 16; // IVA del 16% para México
        taxableAmount = amount / 1.16; // Calcular base gravable
        vatAmount = amount - taxableAmount; // IVA incluido
      }
      const {
        data,
        error
      } = await supabase.from("expenses").insert({
        amount,
        description: expDesc,
        category: expCategory,
        account_type: expAccount as any,
        payment_method: expMethod || null,
        expense_date: expDate,
        vat_rate: expAccount === 'fiscal' ? vatRate : null,
        vat_amount: expAccount === 'fiscal' ? vatAmount : null,
        taxable_amount: expAccount === 'fiscal' ? taxableAmount : null,
        has_invoice: expAccount === 'fiscal',
        invoice_number: expAccount === 'fiscal' ? expInvoiceNumber : null
      } as any).select('*').single();
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation('create', 'expenses', data.id, data, `Creación de egreso: ${expDesc}`, amount, expAccount as any, expDate);
      toast({
        title: "Egreso registrado exitosamente",
        description: expAccount === 'fiscal' && vatAmount > 0 ? `Base: $${taxableAmount.toFixed(2)}, IVA: $${vatAmount.toFixed(2)}, Total: $${amount.toFixed(2)}` : `Total: $${amount.toFixed(2)}`
      });

      // Clear form
      setExpDesc("");
      setExpAmount("");
      setExpMethod("");
      setExpCategory("");
      setExpAccount("fiscal");
      setExpDate(new Date().toISOString().substring(0, 10));
      setExpInvoiceNumber("");
      expensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible registrar el egreso",
        variant: "destructive"
      });
    }
  };
  const deleteIncome = async (id: string) => {
    if (!isAdmin) return;
    try {
      // Get record data before deletion for history
      const {
        data: recordData
      } = await supabase.from("incomes").select("*").eq("id", id).single();
      const {
        error
      } = await supabase.from("incomes").delete().eq("id", id);
      if (error) throw error;

      // Log deletion
      if (recordData) {
        await logFinancialOperation('delete', 'incomes', id, recordData, `Eliminación de ingreso: ${recordData.description}`, recordData.amount, recordData.account_type, recordData.income_date);
      }
      toast({
        title: "Ingreso eliminado"
      });
      incomesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible eliminar",
        variant: "destructive"
      });
    }
  };
  const deleteExpense = async (id: string) => {
    if (!isAdmin) return;
    try {
      // Get record data before deletion for history
      const {
        data: recordData
      } = await supabase.from("expenses").select("*").eq("id", id).single();
      const {
        error
      } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;

      // Log deletion
      if (recordData) {
        await logFinancialOperation('delete', 'expenses', id, recordData, `Eliminación de egreso: ${recordData.description}`, recordData.amount, recordData.account_type, recordData.expense_date);
      }
      toast({
        title: "Egreso eliminado"
      });
      expensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible eliminar",
        variant: "destructive"
      });
    }
  };
  const processWithdrawal = async () => {
    try {
      const amount = Number(feAmount);
      if (!feDesc || !amount || !feAccount) throw new Error("Completa todos los campos requeridos");
      const today = new Date().toISOString().split('T')[0];

      // Calcular IVA si es cuenta fiscal
      let vatRate = 0;
      let vatAmount = 0;
      let taxableAmount = amount;
      if (feAccount === 'fiscal') {
        vatRate = 16; // IVA del 16% para México
        taxableAmount = amount / 1.16; // Calcular base gravable
        vatAmount = amount - taxableAmount; // IVA incluido
      }

      // Create expense for the withdrawal
      const {
        error
      } = await supabase.from("expenses").insert({
        amount,
        description: `[Retiro] ${feDesc}`,
        category: 'retiro',
        account_type: feAccount as any,
        payment_method: feMethod || null,
        expense_date: today,
        vat_rate: feAccount === 'fiscal' ? vatRate : null,
        vat_amount: feAccount === 'fiscal' ? vatAmount : null,
        taxable_amount: feAccount === 'fiscal' ? taxableAmount : null
      } as any);
      if (error) throw error;

      // Log the withdrawal operation
      await logFinancialOperation('create', 'expenses', '',
      // Will be filled by the system
      {
        description: `[Retiro] ${feDesc}`,
        amount,
        account_type: feAccount
      }, `Retiro manual - ${feDesc}`, amount, feAccount as any, today);
      toast({
        title: "Retiro procesado exitosamente",
        description: `Se retiró $${amount.toLocaleString('es-MX', {
          minimumFractionDigits: 2
        })} de la cuenta ${feAccount === 'fiscal' ? 'fiscal' : 'no fiscal'}`
      });

      // Clear form
      setFeDesc("");
      setFeAmount("");
      setFeMethod("");
      setFeAccount("fiscal");
      expensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible procesar el retiro",
        variant: "destructive"
      });
    }
  };
  const addPayroll = async () => {
    try {
      const baseSalary = Number(pBaseSalary);
      const netSalary = Number(pNetSalary);
      if (!pEmployee || !netSalary || !baseSalary) throw new Error("Completa empleado y montos válidos");
      const {
        error: payErr
      } = await supabase.from("payrolls").insert({
        employee_name: pEmployee,
        base_salary: baseSalary,
        net_salary: netSalary,
        bonus_amount: pBonusAmount ? Number(pBonusAmount) : 0,
        bonus_description: pBonusDesc || null,
        extra_payments: pExtraPayments ? Number(pExtraPayments) : 0,
        period_month: pMonth,
        period_year: pYear,
        period_week: pFrequency === 'weekly' ? Math.ceil(new Date().getDate() / 7) : null,
        status: "pendiente"
      } as any);
      if (payErr) throw payErr;
      const totalAmount = netSalary + (pBonusAmount ? Number(pBonusAmount) : 0) + (pExtraPayments ? Number(pExtraPayments) : 0);

      // Calcular IVA si es cuenta fiscal
      let vatRate = 0;
      let vatAmount = 0;
      let taxableAmount = totalAmount;
      if (pAccount === 'fiscal') {
        vatRate = 16; // IVA del 16% para México
        taxableAmount = totalAmount / 1.16; // Calcular base gravable
        vatAmount = totalAmount - taxableAmount; // IVA incluido
      }
      const {
        error: expErr
      } = await supabase.from("expenses").insert({
        amount: totalAmount,
        description: `Nómina ${pEmployee} ${pMonth}/${pYear}${pBonusDesc ? ` - ${pBonusDesc}` : ''}`,
        category: "nomina",
        account_type: pAccount as any,
        payment_method: pMethod || null,
        vat_rate: pAccount === 'fiscal' ? vatRate : null,
        vat_amount: pAccount === 'fiscal' ? vatAmount : null,
        taxable_amount: pAccount === 'fiscal' ? taxableAmount : null
      } as any);
      if (expErr) throw expErr;
      toast({
        title: "Nómina registrada"
      });
      setPEmployee("");
      setPBaseSalary("");
      setPNetSalary("");
      setPBonusAmount("");
      setPBonusDesc("");
      setPExtraPayments("");
      setPMethod("");
      setPAccount("fiscal");
      expensesQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible registrar",
        variant: "destructive"
      });
    }
  };
  const toggleFixedActive = async (row: any) => {
    try {
      const {
        error
      } = await supabase.from('fixed_expenses').update({
        active: !row.active
      }).eq('id', row.id);
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation('update', 'fixed_expenses', row.id, {
        ...row,
        active: !row.active
      }, `${row.active ? 'Desactivación' : 'Activación'} de gasto fijo: ${row.description}`, row.amount, row.account_type);
      toast({
        title: row.active ? 'Gasto fijo desactivado' : 'Gasto fijo activado'
      });
      fixedExpensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'No fue posible actualizar',
        variant: 'destructive'
      });
    }
  };
  const runFixedNow = async () => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('run-fixed-expenses');
      if (error) throw error as any;
      toast({
        title: 'Gastos fijos ejecutados',
        description: `Procesados: ${data?.created ?? 0}`
      });
      expensesQuery.refetch();
      fixedExpensesQuery.refetch();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'No fue posible ejecutar',
        variant: 'destructive'
      });
    }
  };
  const addRecurringPayroll = async () => {
    try {
      const baseSalary = Number(pBaseSalary);
      const netSalary = Number(pNetSalary);
      if (!pEmployee || !netSalary || !baseSalary) throw new Error('Completa empleado y montos válidos');
      const {
        data,
        error
      } = await supabase.from('recurring_payrolls').insert({
        employee_name: pEmployee,
        base_salary: baseSalary,
        net_salary: netSalary,
        account_type: pAccount as any,
        payment_method: pMethod || null,
        frequency: 'monthly'
      } as any).select('*').single();
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation('create', 'recurring_payrolls', data.id, data, `Creación de nómina recurrente: ${pEmployee}`, netSalary, pAccount as any);
      toast({
        title: 'Nómina recurrente programada'
      });
      setPEmployee('');
      setPBaseSalary('');
      setPNetSalary('');
      setPMethod('');
      setPAccount('fiscal');
      setPRecurring(false);
      recurringPayrollsQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'No fue posible programar',
        variant: 'destructive'
      });
    }
  };
  const toggleRecurringPayrollActive = async (row: any) => {
    try {
      const {
        error
      } = await supabase.from('recurring_payrolls').update({
        active: !row.active
      }).eq('id', row.id);
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation('update', 'recurring_payrolls', row.id, {
        ...row,
        active: !row.active
      }, `${row.active ? 'Desactivación' : 'Activación'} de nómina recurrente: ${row.employee_name}`, row.net_salary, row.account_type);
      toast({
        title: row.active ? 'Recurrente desactivado' : 'Recurrente activado'
      });
      recurringPayrollsQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'No fue posible actualizar',
        variant: 'destructive'
      });
    }
  };
  const runRecurringNow = async () => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('run-recurring-payrolls');
      if (error) throw error as any;
      toast({
        title: 'Nóminas recurrentes ejecutadas',
        description: `Procesadas: ${data?.created ?? 0}`
      });
      expensesQuery.refetch();
      recurringPayrollsQuery.refetch();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'No fue posible ejecutar',
        variant: 'destructive'
      });
    }
  };
  const handleRevertExpense = async (row: any) => {
    if (!isAdmin) return;
    try {
      const today = new Date().toISOString().substring(0, 10);
      
      // Check if this is a fiscal withdrawal expense (retiros_fiscales category)
      const isFiscalWithdrawal = row.category === 'retiros_fiscales' || row.category === 'retiro_fiscal';
      
      if (isFiscalWithdrawal && row.invoice_number) {
        // For fiscal withdrawals, reactivate the corresponding withdrawal instead of creating income
        const { error: reactivateError } = await supabase
          .from('fiscal_withdrawals')
          .update({ 
            withdrawal_status: 'available',
            withdrawn_at: null,
            withdrawn_by: null
          })
          .eq('amount', row.amount)
          .eq('withdrawal_status', 'processed')
          .limit(1);
          
        if (reactivateError) {
          console.error('Error reactivating fiscal withdrawal:', reactivateError);
          // Fall back to regular reversion if can't find withdrawal
        } else {
          // Log the reactivation
          await logFinancialOperation('reactivate', 'fiscal_withdrawals', row.id, row, `Retiro fiscal reactivado: ${row.description || ''}`.trim(), row.amount, row.account_type, row.expense_date);
          
          // Delete the original expense
          const { error: delErr } = await supabase.from('expenses').delete().eq('id', row.id);
          if (delErr) throw delErr;
          
          toast({
            title: 'Egreso fiscal revertido',
            description: 'El retiro fiscal ha sido reactivado y está disponible en el historial de compras'
          });
          
          expensesQuery.refetch();
          fiscalWithdrawalsQuery.refetch();
          financialHistoryQuery.refetch();
          return;
        }
      }

      // Regular expense reversion (non-fiscal withdrawals)
      const { error: insErr } = await supabase.from('incomes').insert({
        amount: row.amount,
        description: `Reverso egreso ${row.expense_number ?? ''} - ${row.description ?? ''}`.trim(),
        account_type: row.account_type,
        category: 'reverso',
        income_date: today,
        payment_method: row.payment_method ?? null
      } as any);
      if (insErr) throw insErr;

      // Log the reversal operation
      await logFinancialOperation('reverse', 'expenses', row.id, row, `Reverso de egreso ${row.expense_number || ''} - ${row.description || ''}`.trim(), row.amount, row.account_type, row.expense_date);

      // Delete the original expense
      const { error: delErr } = await supabase.from('expenses').delete().eq('id', row.id);
      if (delErr) throw delErr;
      
      toast({
        title: 'Egreso revertido'
      });
      incomesQuery.refetch();
      expensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'No fue posible revertir',
        variant: 'destructive'
      });
    }
  };
  const handleRevertIncome = async (row: any) => {
    if (!isAdmin) return;
    try {
      const result = await revertPaymentByIncomeId(row.id);
      
      if (result.success) {
        toast({
          title: 'Ingreso revertido',
          description: result.message
        });
        incomesQuery.refetch();
        expensesQuery.refetch();
        financialHistoryQuery.refetch();
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'No fue posible revertir',
        variant: 'destructive'
      });
    }
  };

  // Funciones para gestión de IVA (ya no se registra manualmente)
  const calculateVat = (amount: number, rate: number) => {
    return amount * rate / 100;
  };
  const calculateTotal = (amount: number, rate: number) => {
    return amount + calculateVat(amount, rate);
  };

  // Funciones para retiro de gastos fiscales - removidas

  const withdrawFiscalAmount = async (withdrawal: any) => {
    // Abrir el diálogo para capturar factura y número
    setFiscalWithdrawalDialog({
      open: true,
      withdrawal
    });
  };
  const handleBulkWithdrawal = async () => {
    if (selectedWithdrawals.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos un item para retirar",
        variant: "destructive"
      });
      return;
    }
    if (!withdrawalConcept.trim()) {
      toast({
        title: "Error",
        description: "El concepto es obligatorio",
        variant: "destructive"
      });
      return;
    }
    try {
      // Obtener los retiros seleccionados
      const selectedItems = fiscalWithdrawalsQuery.data?.filter(fw => selectedWithdrawals.includes(fw.id) && fw.withdrawal_status === 'available') || [];
      if (selectedItems.length === 0) {
        toast({
          title: "Error",
          description: "No hay items válidos para retirar",
          variant: "destructive"
        });
        return;
      }

      // Calcular el total a retirar
      const totalAmount = selectedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      // Crear el egreso fiscal por el total
      const {
        error: expenseError
      } = await supabase.from("expenses").insert({
        amount: totalAmount,
        description: `${withdrawalConcept}${withdrawalDescription ? ' - ' + withdrawalDescription : ''}`,
        category: 'retiro_fiscal',
        account_type: 'fiscal' as any,
        payment_method: 'transferencia',
        expense_date: new Date().toISOString().split('T')[0],
        status: 'pagado'
      } as any);
      if (expenseError) throw expenseError;

      // Marcar todos los retiros seleccionados como retirados
      const {
        error: updateError
      } = await supabase.from("fiscal_withdrawals").update({
        withdrawal_status: "withdrawn",
        withdrawn_by: (await supabase.auth.getUser()).data.user?.id,
        withdrawn_at: new Date().toISOString()
      }).in('id', selectedWithdrawals);
      if (updateError) throw updateError;
      toast({
        title: "Retiro realizado exitosamente",
        description: `Se retiraron ${selectedItems.length} items por un total de $${totalAmount.toLocaleString()}`
      });

      // Limpiar estado
      setSelectedWithdrawals([]);
      setWithdrawalConcept('');
      setWithdrawalDescription('');
      setShowWithdrawalDialog(false);

      // Refrescar datos
      fiscalWithdrawalsQuery.refetch();
      expensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No fue posible realizar el retiro",
        variant: "destructive"
      });
    }
  };
  const toggleWithdrawalSelection = (withdrawalId: string) => {
    setSelectedWithdrawals(prev => prev.includes(withdrawalId) ? prev.filter(id => id !== withdrawalId) : [...prev, withdrawalId]);
  };
  const selectAllWithdrawals = () => {
    const availableWithdrawals = fiscalWithdrawalsQuery.data?.filter(fw => fw.withdrawal_status === 'available' && fw.amount > 0) || [];
    if (selectedWithdrawals.length === availableWithdrawals.length) {
      setSelectedWithdrawals([]);
    } else {
      setSelectedWithdrawals(availableWithdrawals.map(fw => fw.id));
    }
  };
  const onExport = (type: "incomes" | "expenses") => {
    try {
      if (type === "incomes" && incomesQuery.data) {
        exportCsv(`ingresos_${startDate}_${endDate}`, incomesQuery.data as any);
      } else if (type === "expenses" && expensesQuery.data) {
        exportCsv(`egresos_${startDate}_${endDate}`, expensesQuery.data as any);
      }
      toast({
        title: "Exportación lista",
        description: "Se descargó el archivo CSV."
      });
    } catch (e: any) {
      toast({
        title: "Error al exportar",
        description: e?.message || "Intenta de nuevo",
        variant: "destructive"
      });
    }
  };
  return <AppLayout>
      <header className="mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Finanzas: Ingresos y Egresos</h1>
          <p className="text-muted-foreground mt-2">Panel administrativo para gestionar finanzas con filtros por fecha y tipo de cuenta.</p>
        </div>
      </header>

      {/* Resumen General - Sin Filtros */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Balance General (Total Acumulado)</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="bg-orange-50/50 dark:bg-orange-950/20">
              <CardTitle className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                Cuenta Fiscal - Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Ingresos</div>
                  <div className="font-semibold text-orange-700 dark:text-orange-300">{generalData.genIF.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'MXN'
                  })}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Egresos</div>
                  <div className="font-semibold text-orange-700 dark:text-orange-300">{generalData.genEF.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'MXN'
                  })}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Balance</div>
                  <div className="font-semibold text-orange-700 dark:text-orange-300">{(generalData.genIF - generalData.genEF).toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'MXN'
                  })}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20">
              <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                Cuenta No Fiscal - Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Ingresos</div>
                  <div className="font-semibold text-blue-700 dark:text-blue-300">{generalData.genINF.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'MXN'
                  })}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Egresos</div>
                  <div className="font-semibold text-blue-700 dark:text-blue-300">{generalData.genENF.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'MXN'
                  })}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Balance</div>
                  <div className="font-semibold text-blue-700 dark:text-blue-300">{(generalData.genINF - generalData.genENF).toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'MXN'
                  })}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="bg-red-50/50 dark:bg-red-950/20">
              <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                Préstamos Activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Activos</div>
                  <div className="font-semibold text-red-700 dark:text-red-300">{loansData.activeLoansCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Deuda Total</div>
                  <div className="font-semibold text-red-700 dark:text-red-300">{loansData.totalDebt.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'MXN'
                  })}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Próximo Pago</div>
                  <div className="font-semibold text-red-700 dark:text-red-300">
                    {loansData.nextPayment ? loansData.nextPayment.amount.toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'MXN'
                    }) : 'N/A'}
                  </div>
                  {loansData.nextPayment && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDateMexico(loansData.nextPayment.due_date)}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Filtros de Fecha */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Filtros {filtersEnabled && <span className="text-sm font-normal text-muted-foreground">(Activos)</span>}</h2>
        <div className="grid gap-3 md:grid-cols-4 mb-4">
          <div>
            <label className="text-sm text-muted-foreground">Desde</label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={e => {
                setStartDate(e.target.value);
                if (e.target.value) setFiltersEnabled(true);
              }} 
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Hasta</label>
            <Input 
              type="date" 
              value={endDate} 
              onChange={e => {
                setEndDate(e.target.value);
                if (e.target.value) setFiltersEnabled(true);
              }} 
            />
          </div>
          <div className="flex items-end">
            <Button onClick={setCurrentMonth} variant="outline" className="w-full">
              Mes Actual
            </Button>
          </div>
          <div className="flex items-end">
            <Button onClick={clearFilters} variant="outline" className="w-full">
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </section>

      {/* Resumen Filtrado */}
      {filtersEnabled && (
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Balance del Período Filtrado</h2>
          <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="bg-orange-50/50 dark:bg-orange-950/20">
            <CardTitle className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              Cuenta Fiscal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Ingresos</div>
                <div className="font-semibold text-orange-700 dark:text-orange-300">{totIF.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Egresos</div>
                <div className="font-semibold text-orange-700 dark:text-orange-300">{totEF.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Balance</div>
                <div className="font-semibold text-orange-700 dark:text-orange-300">{(totIF - totEF).toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20">
            <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              Cuenta No Fiscal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Ingresos</div>
                <div className="font-semibold text-blue-700 dark:text-blue-300">{totINF.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Egresos</div>
                <div className="font-semibold text-blue-700 dark:text-blue-300">{totENF.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Balance</div>
                <div className="font-semibold text-blue-700 dark:text-blue-300">{(totINF - totENF).toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </section>
      )}

      <Tabs defaultValue="fiscal">
        <TabsList className="bg-lime-400 rounded-none">
          <TabsTrigger value="fiscal" className="text-gray-950">Fiscal</TabsTrigger>
          <TabsTrigger value="no_fiscal" className="text-gray-950">No Fiscal</TabsTrigger>
          <TabsTrigger value="purchases">Compras</TabsTrigger>
          <TabsTrigger value="fixed_expenses">Gastos Fijos</TabsTrigger>
          <TabsTrigger value="withdrawals">Retiros</TabsTrigger>
          <TabsTrigger value="loans" className="text-gray-950">Préstamos</TabsTrigger>
          <TabsTrigger value="nomina" className="text-gray-950">Nómina</TabsTrigger>
          <TabsTrigger value="cobranza" className="text-gray-950">Cobranza</TabsTrigger>
          <TabsTrigger value="report" className="text-gray-950">Reporte</TabsTrigger>
          <TabsTrigger value="consecutive" className="text-gray-950">Consecutivo</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="incomes">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between bg-orange-50/50 dark:bg-orange-950/20">
                <CardTitle className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  Ingresos - Fiscal ({incomesFiscal.length}) · Total: {totIF.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}
                </CardTitle>
                <Button size="sm" onClick={() => exportCsv(`ingresos_fiscal_${startDate}_${endDate}`, incomesFiscal as any)}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                       <TableRow>
                         <TableHead>#</TableHead>
                         <TableHead>Fecha y Hora</TableHead>
                         <TableHead>Cliente</TableHead>
                         <TableHead>Monto</TableHead>
                         <TableHead>IVA</TableHead>
                         <TableHead>ISR</TableHead>
                         <TableHead>Total</TableHead>
                         <TableHead>Categoría</TableHead>
                         <TableHead>Método</TableHead>
                         <TableHead>Factura</TableHead>
                         <TableHead>Descripción</TableHead>
                         <TableHead>Acciones</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {incomesQuery.isLoading && <TableRow><TableCell colSpan={12}>Cargando...</TableCell></TableRow>}
                       {!incomesQuery.isLoading && incomesFiscal.map((r: any) => <TableRow key={r.id}>
                           <TableCell>{r.income_number}</TableCell>
                           <TableCell>{formatDateTimeMexico(r.income_date)}</TableCell>
                           <TableCell className="max-w-[150px] truncate" title={r.client_name || 'N/A'}>{r.client_name || 'N/A'}</TableCell>
                           <TableCell>{Number(r.taxable_amount || r.amount).toLocaleString(undefined, {
                           style: 'currency',
                           currency: 'MXN'
                         })}</TableCell>
                           <TableCell className="text-green-600">
                             {r.vat_amount ? `${Number(r.vat_amount).toLocaleString(undefined, {
                           style: 'currency',
                           currency: 'MXN'
                         })} (${r.vat_rate}%)` : 'Sin IVA'}
                           </TableCell>
                           <TableCell className="text-amber-600">
                             {r.isr_withholding_amount && Number(r.isr_withholding_amount) > 0 ? `-${Number(r.isr_withholding_amount).toLocaleString(undefined, {
                           style: 'currency',
                           currency: 'MXN'
                         })} (${r.isr_withholding_rate}%)` : 'Sin ISR'}
                           </TableCell>
                           <TableCell className="font-semibold">
                             {Number(r.amount).toLocaleString(undefined, {
                           style: 'currency',
                           currency: 'MXN'
                         })}
                           </TableCell>
                           <TableCell>{r.category}</TableCell>
                           <TableCell>{r.payment_method}</TableCell>
                           <TableCell>{r.invoice_number || 'Sin factura'}</TableCell>
                           <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isAdmin && <>
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
                                  </>}
                              </div>
                            </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between bg-blue-50/50 dark:bg-blue-950/20">
                <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Ingresos - No Fiscal ({incomesNoFiscal.length}) · Total: {totINF.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}
                </CardTitle>
                <Button size="sm" onClick={() => exportCsv(`ingresos_no_fiscal_${startDate}_${endDate}`, incomesNoFiscal as any)}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                       <TableRow>
                         <TableHead>#</TableHead>
                         <TableHead>Fecha y Hora</TableHead>
                         <TableHead>Cliente</TableHead>
                         <TableHead>Monto</TableHead>
                         <TableHead>Categoría</TableHead>
                         <TableHead>Método</TableHead>
                         <TableHead>Factura</TableHead>
                         <TableHead>Descripción</TableHead>
                         <TableHead>Acciones</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {incomesQuery.isLoading && <TableRow><TableCell colSpan={9}>Cargando...</TableCell></TableRow>}
                       {!incomesQuery.isLoading && incomesNoFiscal.map((r: any) => <TableRow key={r.id}>
                           <TableCell>{r.income_number}</TableCell>
                            <TableCell>{formatDateTimeMexico(r.income_date)}</TableCell>
                           <TableCell className="max-w-[150px] truncate" title={r.client_name || 'N/A'}>{r.client_name || 'N/A'}</TableCell>
                           <TableCell>{Number(r.amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        })}</TableCell>
                           <TableCell>{r.category}</TableCell>
                           <TableCell>{r.payment_method}</TableCell>
                           <TableCell>{r.invoice_number || 'Sin factura'}</TableCell>
                           <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                             <TableCell>
                               <div className="flex items-center gap-2">
                                 {isAdmin && <>
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
                                  </>}
                              </div>
                            </TableCell>
                         </TableRow>)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fiscal">
          <div className="space-y-6">
            {/* Ingresos Fiscales */}
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between bg-orange-50/50 dark:bg-orange-950/20">
                <CardTitle className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  Ingresos Fiscales ({incomesFiscal.length}) · Total: {totIF.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}
                </CardTitle>
                <Button size="sm" onClick={() => exportCsv(`ingresos_fiscal_${startDate}_${endDate}`, incomesFiscal as any)}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                       <TableRow>
                         <TableHead>#</TableHead>
                         <TableHead>Fecha y Hora</TableHead>
                         <TableHead>Cliente</TableHead>
                         <TableHead>Monto</TableHead>
                         <TableHead>IVA</TableHead>
                         <TableHead>ISR</TableHead>
                         <TableHead>Total</TableHead>
                         <TableHead>Categoría</TableHead>
                         <TableHead>Método</TableHead>
                         <TableHead>Factura</TableHead>
                         <TableHead>Descripción</TableHead>
                         <TableHead>Acciones</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {incomesQuery.isLoading && <TableRow><TableCell colSpan={12}>Cargando...</TableCell></TableRow>}
                       {!incomesQuery.isLoading && incomesFiscal.map((r: any) => <TableRow key={r.id}>
                           <TableCell>{r.income_number}</TableCell>
                           <TableCell>{formatDateTimeMexico(r.income_date)}</TableCell>
                           <TableCell className="max-w-[150px] truncate" title={r.client_name || 'N/A'}>{r.client_name || 'N/A'}</TableCell>
                           <TableCell>{Number(r.taxable_amount || r.amount).toLocaleString(undefined, {
                           style: 'currency',
                           currency: 'MXN'
                         })}</TableCell>
                           <TableCell className="text-green-600">
                             {r.vat_amount ? `${Number(r.vat_amount).toLocaleString(undefined, {
                           style: 'currency',
                           currency: 'MXN'
                         })} (${r.vat_rate}%)` : 'Sin IVA'}
                           </TableCell>
                           <TableCell className="text-amber-600">
                             {r.isr_withholding_amount && Number(r.isr_withholding_amount) > 0 ? `-${Number(r.isr_withholding_amount).toLocaleString(undefined, {
                           style: 'currency',
                           currency: 'MXN'
                         })} (${r.isr_withholding_rate}%)` : 'Sin ISR'}
                           </TableCell>
                           <TableCell className="font-semibold">
                             {Number(r.amount).toLocaleString(undefined, {
                           style: 'currency',
                           currency: 'MXN'
                         })}
                           </TableCell>
                           <TableCell>{r.category}</TableCell>
                           <TableCell>{r.payment_method}</TableCell>
                           <TableCell>{r.invoice_number || 'Sin factura'}</TableCell>
                           <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isAdmin && <>
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
                                  </>}
                              </div>
                            </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Egresos Fiscales */}
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between bg-orange-50/50 dark:bg-orange-950/20">
                <CardTitle className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  Egresos Fiscales ({expensesFiscal.length}) · Total: {totEF.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}
                </CardTitle>
                <Button size="sm" onClick={() => exportCsv(`egresos_fiscal_${startDate}_${endDate}`, expensesFiscal as any)}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                         <TableHead>Fecha y Hora</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>IVA</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Factura</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesQuery.isLoading && <TableRow><TableCell colSpan={10}>Cargando...</TableCell></TableRow>}
                      {!expensesQuery.isLoading && expensesFiscal.map((r: any) => <TableRow key={r.id}>
                          <TableCell>{r.expense_number}</TableCell>
                           <TableCell>{formatDateTimeMexico(r.expense_date)}</TableCell>
                          <TableCell>{Number(r.taxable_amount || r.amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        })}</TableCell>
                          <TableCell className="text-red-600">
                            {r.vat_amount ? `${Number(r.vat_amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        })} (${r.vat_rate}%)` : 'Sin IVA'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {Number(r.amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        })}
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                          <TableCell>{r.invoice_number || 'Sin factura'}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                           <TableCell>
                             <div className="flex items-center gap-2">
                               {isAdmin && <>
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
                                 </>}
                             </div>
                           </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="no_fiscal">
          <div className="space-y-6">
            {/* Ingresos No Fiscales */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between bg-blue-50/50 dark:bg-blue-950/20">
                <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Ingresos No Fiscales ({incomesNoFiscal.length}) · Total: {totINF.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}
                </CardTitle>
                <Button size="sm" onClick={() => exportCsv(`ingresos_no_fiscal_${startDate}_${endDate}`, incomesNoFiscal as any)}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                       <TableRow>
                         <TableHead>#</TableHead>
                         <TableHead>Fecha y Hora</TableHead>
                         <TableHead>Cliente</TableHead>
                         <TableHead>Monto</TableHead>
                         <TableHead>Categoría</TableHead>
                         <TableHead>Método</TableHead>
                         <TableHead>Factura</TableHead>
                         <TableHead>Descripción</TableHead>
                         <TableHead>Acciones</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {incomesQuery.isLoading && <TableRow><TableCell colSpan={9}>Cargando...</TableCell></TableRow>}
                       {!incomesQuery.isLoading && incomesNoFiscal.map((r: any) => <TableRow key={r.id}>
                           <TableCell>{r.income_number}</TableCell>
                            <TableCell>{formatDateTimeMexico(r.income_date)}</TableCell>
                           <TableCell className="max-w-[150px] truncate" title={r.client_name || 'N/A'}>{r.client_name || 'N/A'}</TableCell>
                           <TableCell>{Number(r.amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        })}</TableCell>
                           <TableCell>{r.category}</TableCell>
                           <TableCell>{r.payment_method}</TableCell>
                           <TableCell>{r.invoice_number || 'Sin factura'}</TableCell>
                           <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                             <TableCell>
                               <div className="flex items-center gap-2">
                                 {isAdmin && <>
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
                                  </>}
                              </div>
                            </TableCell>
                         </TableRow>)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Egresos No Fiscales */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between bg-blue-50/50 dark:bg-blue-950/20">
                <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Egresos No Fiscales ({expensesNoFiscal.length}) · Total: {totENF.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'MXN'
                })}
                </CardTitle>
                <Button size="sm" onClick={() => exportCsv(`egresos_no_fiscal_${startDate}_${endDate}`, expensesNoFiscal as any)}>Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                         <TableHead>Fecha y Hora</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>IVA</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Factura</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesQuery.isLoading && <TableRow><TableCell colSpan={10}>Cargando...</TableCell></TableRow>}
                      {!expensesQuery.isLoading && expensesNoFiscal.map((r: any) => <TableRow key={r.id}>
                          <TableCell>{r.expense_number}</TableCell>
                           <TableCell>{formatDateTimeMexico(r.expense_date)}</TableCell>
                          <TableCell>{Number(r.taxable_amount || r.amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        })}</TableCell>
                          <TableCell className="text-red-600">
                            {r.vat_amount ? `${Number(r.vat_amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        })} (${r.vat_rate}%)` : 'Sin IVA'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {Number(r.amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        })}
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.payment_method}</TableCell>
                          <TableCell>{r.invoice_number || 'Sin factura'}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={r.description}>{r.description}</TableCell>
                          <TableCell>
                             <div className="flex items-center gap-2">
                               {isAdmin && <>
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
                                 </>}
                             </div>
                          </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Compras */}
        <TabsContent value="purchases" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Formulario de registro de compras */}
            <Card>
              <CardHeader>
                <CardTitle>{editingPurchase ? 'Editar Compra' : 'Registrar Compra'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-sm font-medium">Proveedor*</label>
                    <Select value={purchaseSupplier} onValueChange={setPurchaseSupplier}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar proveedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliersQuery.data?.map(supplier => <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.supplier_name}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowSupplierDialog(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Concepto*</label>
                  <Input value={purchaseConcept} onChange={e => setPurchaseConcept(e.target.value)} placeholder="Descripción de la compra" />
                </div>
                <div>
                  <label className="text-sm font-medium">Monto*</label>
                  <Input type="number" step="0.01" value={purchaseAmount} onChange={e => setPurchaseAmount(e.target.value)} placeholder="0.00" />
                  {purchaseAccount === "fiscal" && purchaseAmount && <div className="mt-1 text-xs text-muted-foreground">
                      Base: ${(Number(purchaseAmount) / 1.16).toFixed(2)} | 
                      IVA (16%): ${(Number(purchaseAmount) - Number(purchaseAmount) / 1.16).toFixed(2)}
                    </div>}
                </div>
                
                {/* Nueva sección para factura */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has-invoice" checked={purchaseHasInvoice} onCheckedChange={checked => setPurchaseHasInvoice(checked === true)} />
                    <label htmlFor="has-invoice" className="text-sm font-medium">
                      Esta compra tiene factura
                    </label>
                  </div>
                  {purchaseHasInvoice && <div>
                      <label className="text-sm font-medium">Número de factura</label>
                      <Input value={purchaseInvoiceNumber} onChange={e => setPurchaseInvoiceNumber(e.target.value)} placeholder="Ingrese número de factura" />
                    </div>}
                </div>
                <div>
                  <label className="text-sm font-medium">Cuenta</label>
                  <Select value={purchaseAccount} onValueChange={(v: "fiscal" | "no_fiscal") => setPurchaseAccount(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fiscal" disabled={!purchaseHasInvoice}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                          Fiscal {!purchaseHasInvoice && "(Requiere factura)"}
                        </div>
                      </SelectItem>
                      <SelectItem value="no_fiscal">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          No Fiscal
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Método de Pago</label>
                  <Select value={purchaseMethod} onValueChange={setPurchaseMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Fecha</label>
                  <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  {editingPurchase ? (
                    <>
                      <Button onClick={updatePurchase} className="flex-1" disabled={!purchaseSupplier || !purchaseConcept || !purchaseAmount}>
                        Actualizar Compra
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setEditingPurchase(null);
                        setPurchaseSupplier("");
                        setPurchaseConcept("");
                        setPurchaseAmount("");
                        setPurchaseMethod("");
                        setPurchaseHasInvoice(false);
                        setPurchaseInvoiceNumber("");
                      }}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button onClick={addPurchase} className="w-full" disabled={!purchaseSupplier || !purchaseConcept || !purchaseAmount}>
                      Registrar Compra
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Resumen de compras */}
            <Card>
              <CardHeader>
                <CardTitle>Resumen de Compras</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total de Compras:</span>
                    <span className="font-medium">
                      ${(purchasesQuery.data?.reduce((s, r) => s + (Number(r.total_amount) || 0), 0) ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Cuenta Fiscal:</span>
                    <span>
                      ${(purchasesQuery.data?.filter(r => r.account_type === 'fiscal').reduce((s, r) => s + (Number(r.total_amount) || 0), 0) ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Cuenta No Fiscal:</span>
                    <span>
                      ${(purchasesQuery.data?.filter(r => r.account_type === 'no_fiscal').reduce((s, r) => s + (Number(r.total_amount) || 0), 0) ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de compras */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Historial de Compras</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportCsv("compras", purchasesQuery.data?.map(r => ({
              numero: r.purchase_number,
              fecha: r.purchase_date,
              proveedor: r.supplier_name,
              concepto: r.concept,
              monto: r.total_amount,
              cuenta: r.account_type,
              metodo: r.payment_method,
              factura: r.has_invoice ? 'Sí' : 'No',
              numero_factura: r.invoice_number || ''
            })) ?? [])}>
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Factura</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchasesQuery.data?.map(purchase => <TableRow key={purchase.id}>
                        <TableCell>{purchase.purchase_date}</TableCell>
                        <TableCell>{purchase.supplier_name}</TableCell>
                        <TableCell>{purchase.concept}</TableCell>
                        <TableCell>{purchase.invoice_number || 'Sin factura'}</TableCell>
                        <TableCell>${Number(purchase.total_amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${purchase.account_type === 'fiscal' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                            {purchase.account_type === 'fiscal' ? 'Fiscal' : 'No Fiscal'}
                          </div>
                        </TableCell>
                        <TableCell>{purchase.payment_method || '-'}</TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <div className="flex gap-1 justify-end">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setEditingPurchase(purchase);
                                  setPurchaseSupplier(purchase.supplier_id);
                                  setPurchaseConcept(purchase.concept);
                                  setPurchaseAmount(purchase.total_amount.toString());
                                  setPurchaseAccount(purchase.account_type as "fiscal" | "no_fiscal");
                                  setPurchaseMethod(purchase.payment_method || "");
                                  setPurchaseDate(purchase.purchase_date);
                                  setPurchaseHasInvoice(purchase.has_invoice || false);
                                  setPurchaseInvoiceNumber(purchase.invoice_number || "");
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar compra?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se eliminará la compra, el egreso relacionado y cualquier retiro fiscal pendiente.
                                      Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deletePurchase(purchase.id)}>
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>)}
                    {(!purchasesQuery.data || purchasesQuery.data.length === 0) && <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No hay compras registradas
                        </TableCell>
                      </TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gastos Fijos */}
        <TabsContent value="fixed_expenses" className="space-y-4">
          <FixedExpensesManager />
        </TabsContent>

        <TabsContent value="withdrawals">
          {/* Sección de Pendientes de Retirar */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                Retiros Fiscales ({fiscalWithdrawalsQuery.data?.filter(fw => fw.amount > 0).length || 0})
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Facturas de compras pagadas desde cuenta no fiscal que requieren retiro desde cuenta fiscal
              </p>
               <div className="flex justify-between items-center gap-4 text-sm mt-2">
                <div className="flex gap-4">
                  <span className="text-orange-600">
                    Pendientes: {fiscalWithdrawalsQuery.data?.filter(fw => fw.withdrawal_status === 'available' && fw.amount > 0).length || 0}
                  </span>
                  <span className="text-green-600">
                    Retirados: {fiscalWithdrawalsQuery.data?.filter(fw => fw.withdrawal_status === 'withdrawn' && fw.amount > 0).length || 0}
                  </span>
                </div>
                <div>
                  <Button size="sm" onClick={() => setMultipleFiscalWithdrawalsDialog(true)} className="bg-green-600 hover:bg-green-700" disabled={(fiscalWithdrawalsQuery.data?.filter(fw => fw.withdrawal_status === 'available' && fw.amount > 0).length || 0) === 0}>
                    Retiros Múltiples
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Factura</TableHead>
                      <TableHead>Monto a Retirar</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fiscalWithdrawalsQuery.data?.filter(fw => fw.amount > 0).map(withdrawal => <TableRow key={withdrawal.id}>
                        <TableCell>{new Date(withdrawal.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="max-w-[300px] truncate" title={withdrawal.description}>
                          {withdrawal.description}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(withdrawal as any).purchases?.[0]?.invoice_number || 'N/A'}
                        </TableCell>
                        <TableCell className="font-medium text-orange-600">
                          ${Number(withdrawal.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {withdrawal.withdrawal_status === 'available' ? <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                              Pendiente
                            </span> : <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                              Retirado
                            </span>}
                        </TableCell>
                        <TableCell>
                          {withdrawal.withdrawal_status === 'available' ? (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => setFiscalWithdrawalDialog({
                                open: true,
                                withdrawal
                              })} className="bg-green-600 hover:bg-green-700">
                                Retirar Compra
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar retiro fiscal?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción eliminará permanentemente el retiro fiscal de ${Number(withdrawal.amount).toFixed(2)}.
                                      No se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={async () => {
                                        try {
                                          const { error } = await supabase
                                            .from("fiscal_withdrawals")
                                            .delete()
                                            .eq("id", withdrawal.id);
                                          if (error) throw error;
                                          toast({ title: "Retiro eliminado" });
                                          fiscalWithdrawalsQuery.refetch();
                                        } catch (error: any) {
                                          toast({
                                            title: "Error",
                                            description: error.message,
                                            variant: "destructive"
                                          });
                                        }
                                      }}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              {withdrawal.withdrawn_at && <span>Retirado {new Date(withdrawal.withdrawn_at).toLocaleDateString()}</span>}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>)}
                    {!fiscalWithdrawalsQuery.data?.filter(fw => fw.amount > 0).length && <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-4xl">📋</div>
                            <div className="font-medium">No hay retiros fiscales registrados</div>
                            <div className="text-sm">Los retiros aparecerán aquí cuando se registren compras con factura</div>
                          </div>
                        </TableCell>
                      </TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Nuevo Retiro Manual</CardTitle>
                <p className="text-sm text-muted-foreground">Retira dinero de cuentas fiscales o no fiscales por diferentes conceptos</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Concepto</label>
                  <Input value={feDesc} onChange={e => setFeDesc(e.target.value)} placeholder="Ej. Pago a proveedor, Gastos personales, etc." />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Monto</label>
                  <Input type="number" inputMode="decimal" value={feAmount} onChange={e => setFeAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Tipo de Cuenta</label>
                  <Select value={feAccount} onValueChange={v => setFeAccount(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tipo de cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fiscal">Fiscal</SelectItem>
                      <SelectItem value="no_fiscal">No Fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Método de retiro</label>
                  <Input value={feMethod} onChange={e => setFeMethod(e.target.value)} placeholder="Transferencia, Efectivo, Cheque, etc." />
                </div>
                {feAccount === 'fiscal' && feAmount && <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-sm font-medium text-orange-800 mb-1">Cálculo automático de IVA (16%)</div>
                    <div className="text-xs text-orange-600 space-y-1">
                      <div>Base gravable: ${(Number(feAmount) / 1.16).toFixed(2)}</div>
                      <div>IVA (16%): ${(Number(feAmount) - Number(feAmount) / 1.16).toFixed(2)}</div>
                      <div className="font-medium">Total: ${Number(feAmount).toFixed(2)}</div>
                    </div>
                  </div>}
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={processWithdrawal} disabled={!feDesc || !feAmount || !feAccount}>
                    💰 Procesar Retiro
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {feAccount === 'fiscal' ? 'Para cuentas fiscales, el IVA se calcula automáticamente (16%). Ingresa el monto total con IVA incluido.' : 'Este retiro se registrará como un egreso en la cuenta seleccionada con la fecha actual.'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registrar Egreso</CardTitle>
                <p className="text-sm text-muted-foreground">Registra gastos y egresos con cálculo automático de IVA para cuentas fiscales</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Descripción</label>
                  <Input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Ej. Compra de material, Servicios profesionales, etc." />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Monto {expAccount === 'fiscal' ? '(con IVA incluido)' : ''}</label>
                    <Input type="number" inputMode="decimal" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Fecha</label>
                    <Input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Tipo de Cuenta</label>
                    <Select value={expAccount} onValueChange={v => setExpAccount(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tipo de cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fiscal">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                            Fiscal (IVA 16% automático)
                          </span>
                        </SelectItem>
                        <SelectItem value="no_fiscal">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            No Fiscal
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Categoría</label>
                    <Select value={expCategory} onValueChange={setExpCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operativo">Gasto Operativo</SelectItem>
                        <SelectItem value="proveedor">Pago a Proveedor</SelectItem>
                        <SelectItem value="servicio">Servicio Profesional</SelectItem>
                        <SelectItem value="material">Material y Suministros</SelectItem>
                        <SelectItem value="transporte">Transporte</SelectItem>
                        <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Método de pago</label>
                  <Input value={expMethod} onChange={e => setExpMethod(e.target.value)} placeholder="Transferencia, Efectivo, Tarjeta, etc." />
                </div>
                {expAccount === 'fiscal' && <div>
                    <label className="text-sm text-muted-foreground">Número de Factura *</label>
                    <Input value={expInvoiceNumber} onChange={e => setExpInvoiceNumber(e.target.value)} placeholder="A001-001-000001" required={expAccount === 'fiscal'} />
                  </div>}
                {expAccount === 'fiscal' && expAmount && <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-sm font-medium text-orange-800 mb-1">Cálculo automático de IVA (16%)</div>
                    <div className="text-xs text-orange-600 space-y-1">
                      <div>Base gravable: ${(Number(expAmount) / 1.16).toFixed(2)}</div>
                      <div>IVA (16%): ${(Number(expAmount) - Number(expAmount) / 1.16).toFixed(2)}</div>
                      <div className="font-medium">Total: ${Number(expAmount).toFixed(2)}</div>
                    </div>
                  </div>}
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={addExpense} disabled={!expDesc || !expAmount || !expAccount || !expCategory || expAccount === 'fiscal' && !expInvoiceNumber.trim()}>
                    📝 Registrar Egreso
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {expAccount === 'fiscal' ? 'Para cuentas fiscales, el IVA se calcula automáticamente (16%) y se requiere número de factura.' : 'Este egreso se registrará sin IVA para cuenta no fiscal.'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-1 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Retiros Recientes</CardTitle>
                <p className="text-sm text-muted-foreground">Últimos retiros realizados en los últimos 30 días</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Cuenta</TableHead>
                        <TableHead>Método</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesQuery.isLoading && <TableRow><TableCell colSpan={5}>Cargando retiros...</TableCell></TableRow>}
                      {!expensesQuery.isLoading && (expensesQuery.data ?? []).filter((expense: any) => {
                      const expenseDate = new Date(expense.expense_date);
                      const thirtyDaysAgo = new Date();
                      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                      return expenseDate >= thirtyDaysAgo && expense.category !== 'reverso';
                    }).slice(0, 10).map((expense: any) => <TableRow key={expense.id}>
                              <TableCell>{formatDateTimeMexico(expense.expense_date)}</TableCell>
                              <TableCell className="max-w-48 truncate">{expense.description}</TableCell>
                              <TableCell className="font-medium text-red-600">
                                -${Number(expense.amount).toLocaleString('es-MX', {
                          minimumFractionDigits: 2
                        })}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${expense.account_type === 'fiscal' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {expense.account_type === 'fiscal' ? 'Fiscal' : 'No Fiscal'}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{expense.payment_method || 'N/A'}</TableCell>
                            </TableRow>)}
                      {!expensesQuery.isLoading && (expensesQuery.data ?? []).filter((expense: any) => {
                      const expenseDate = new Date(expense.expense_date);
                      const thirtyDaysAgo = new Date();
                      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                      return expenseDate >= thirtyDaysAgo && expense.category !== 'reverso';
                    }).length === 0 && <TableRow><TableCell colSpan={5}>No hay retiros recientes.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>



        <TabsContent value="vat-management">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Calculadora IVA */}
            <Card>
              <CardHeader>
                <CardTitle>Calculadora de IVA</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Herramienta para calcular IVA. El IVA se registra automáticamente al crear ingresos/egresos fiscales.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Monto base (sin IVA)</label>
                  <Input type="number" value={tempAmount} onChange={e => setTempAmount(e.target.value)} placeholder="0.00" />
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground">Tasa IVA (%)</label>
                  <Input type="number" value={tempVatRate} onChange={e => setTempVatRate(e.target.value)} placeholder="16" />
                </div>
                
                {tempAmount && tempVatRate && <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Monto base:</span>
                        <span>{Number(tempAmount).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'MXN'
                      })}</span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>IVA ({tempVatRate}%):</span>
                        <span>{calculateVat(Number(tempAmount), Number(tempVatRate)).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'MXN'
                      })}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-lg border-t pt-2">
                        <span>Total:</span>
                        <span>{calculateTotal(Number(tempAmount), Number(tempVatRate)).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'MXN'
                      })}</span>
                      </div>
                    </div>
                  </div>}
                
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    💡 <strong>Tip:</strong> Para registrar transacciones con IVA, ve a la sección de Ingresos o Egresos 
                    y configura el IVA al crear cada registro.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* IVA Neto */}
            <Card>
              <CardHeader>
                <CardTitle>IVA Neto</CardTitle>
                <p className="text-sm text-muted-foreground">Balance entre IVA trasladado (cobrado) y acreditable (pagado)</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-sm text-green-600 font-medium">IVA Trasladado</div>
                    <div className="text-xl font-bold text-green-700">
                      {incomesFiscal.reduce((sum, r) => sum + (Number(r.vat_amount) || 0), 0).toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'MXN'
                    })}
                    </div>
                    <div className="text-xs text-green-600">Cobrado en ventas fiscales</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-600 font-medium">IVA Acreditable</div>
                    <div className="text-xl font-bold text-blue-700">
                      {expensesFiscal.reduce((sum, r) => sum + (Number(r.vat_amount) || 0), 0).toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'MXN'
                    })}
                    </div>
                    <div className="text-xs text-blue-600">Pagado en compras fiscales</div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <div className="text-sm text-orange-600 font-medium">IVA a Pagar/Favor</div>
                    <div className={`text-2xl font-bold ${incomesFiscal.reduce((sum, r) => sum + (Number(r.vat_amount) || 0), 0) - expensesFiscal.reduce((sum, r) => sum + (Number(r.vat_amount) || 0), 0) >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {(incomesFiscal.reduce((sum, r) => sum + (Number(r.vat_amount) || 0), 0) - expensesFiscal.reduce((sum, r) => sum + (Number(r.vat_amount) || 0), 0)).toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'MXN'
                    })}
                    </div>
                    <div className="text-xs text-orange-600">
                      {incomesFiscal.reduce((sum, r) => sum + (Number(r.vat_amount) || 0), 0) - expensesFiscal.reduce((sum, r) => sum + (Number(r.vat_amount) || 0), 0) >= 0 ? 'A pagar al SAT' : 'A favor del contribuyente'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumen Fiscal */}
            

            <Card>
              <CardHeader>
                <CardTitle>Resumen Cuenta Fiscal</CardTitle>
                <p className="text-sm text-muted-foreground">Totales de ingresos y egresos fiscales</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-sm text-green-600 font-medium">Ingresos Fiscales</div>
                      <div className="text-2xl font-bold text-green-700">
                        {totIF.toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'MXN'
                      })}
                      </div>
                      <div className="text-xs text-green-600">{incomesFiscal.length} registros</div>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <div className="text-sm text-red-600 font-medium">Egresos Fiscales</div>
                      <div className="text-2xl font-bold text-red-700">
                        {totEF.toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'MXN'
                      })}
                      </div>
                      <div className="text-xs text-red-600">{expensesFiscal.length} registros</div>
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-600 font-medium">Balance Fiscal</div>
                    <div className={`text-2xl font-bold ${totIF - totEF >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {(totIF - totEF).toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'MXN'
                    })}
                    </div>
                    <div className="text-xs text-blue-600">
                      {totIF - totEF >= 0 ? 'Utilidad' : 'Pérdida'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Ingresos Fiscales ({incomesFiscal.length})</CardTitle>
                <Button size="sm" onClick={() => exportCsv(`ingresos_fiscal_${startDate}_${endDate}`, incomesFiscal as any)} disabled={!incomesFiscal.length}>
                  Exportar CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Factura</TableHead>
                        <TableHead>Factura</TableHead>
                        <TableHead>IVA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomesFiscal.map((r: any) => <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.income_number}</TableCell>
                          <TableCell>{r.income_date}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={r.description}>
                            {r.description}
                          </TableCell>
                          <TableCell className="font-mono">
                            {Number(r.amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.invoice_number || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-green-600">
                            {r.vat_amount ? Number(r.vat_amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        }) : '-'}
                          </TableCell>
                        </TableRow>)}
                      {incomesFiscal.length === 0 && <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No hay ingresos fiscales en el período seleccionado
                          </TableCell>
                        </TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Egresos Fiscales ({expensesFiscal.length})</CardTitle>
                <Button size="sm" onClick={() => exportCsv(`egresos_fiscal_${startDate}_${endDate}`, expensesFiscal as any)} disabled={!expensesFiscal.length}>
                  Exportar CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>IVA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesFiscal.map((r: any) => <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.expense_number}</TableCell>
                          <TableCell>{formatDateTimeMexico(r.expense_date)}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={r.description}>
                            {r.description}
                          </TableCell>
                          <TableCell className="font-mono">
                            {Number(r.amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.invoice_number || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-red-600">
                            {r.vat_amount ? Number(r.vat_amount).toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'MXN'
                        }) : '-'}
                          </TableCell>
                        </TableRow>)}
                      {expensesFiscal.length === 0 && <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No hay egresos fiscales en el período seleccionado
                          </TableCell>
                        </TableRow>}
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
                    {vatDetailsQuery.isLoading && <TableRow><TableCell colSpan={7}>Cargando...</TableCell></TableRow>}
                    {!vatDetailsQuery.isLoading && (vatDetailsQuery.data ?? []).map((vat: any, index: number) => <TableRow key={index}>
                        <TableCell>{vat.date}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${vat.type === 'ingresos' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {vat.type === 'ingresos' ? 'Ingreso' : 'Egreso'}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={vat.description}>
                          {vat.description}
                        </TableCell>
                        <TableCell>{Number(vat.taxable_amount || vat.amount).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'MXN'
                      })}</TableCell>
                        <TableCell>{vat.vat_rate || 0}%</TableCell>
                        <TableCell className={vat.type === 'ingresos' ? 'text-green-600' : 'text-red-600'}>
                          {Number(vat.vat_amount || 0).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'MXN'
                      })}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {Number(vat.amount).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'MXN'
                      })}
                        </TableCell>
                      </TableRow>)}
                    {!vatDetailsQuery.isLoading && (vatDetailsQuery.data ?? []).length === 0 && <TableRow><TableCell colSpan={7}>No hay registros con IVA para el período seleccionado.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nomina">
          <div className="space-y-6">
            <PayrollWithdrawals />
            <RecurringPayrollsManager />
          </div>
        </TabsContent>

        <TabsContent value="cobranza">
          <CollectionsManager />
        </TabsContent>

        <TabsContent value="loans">
          <LoansManager />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Historial de Movimientos ({financialHistoryQuery.data?.length || 0})</CardTitle>
              <Button size="sm" onClick={() => exportCsv(`historial_financiero_${startDate}_${endDate}`, financialHistoryQuery.data as any)} disabled={!financialHistoryQuery.data?.length}>
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
                    {financialHistoryQuery.isLoading && <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          Cargando historial...
                        </TableCell>
                      </TableRow>}
                    {financialHistoryQuery.data?.map((h: any) => <TableRow key={h.id}>
                        <TableCell>{h.operation_date}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${h.operation_type === 'create' ? 'bg-green-100 text-green-800' : h.operation_type === 'delete' ? 'bg-red-100 text-red-800' : h.operation_type === 'reverse' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                            {h.operation_type === 'create' ? 'Crear' : h.operation_type === 'delete' ? 'Eliminar' : h.operation_type === 'reverse' ? 'Revertir' : h.operation_type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${h.table_name === 'incomes' ? 'bg-blue-100 text-blue-800' : h.table_name === 'expenses' ? 'bg-orange-100 text-orange-800' : h.table_name === 'fixed_expenses' ? 'bg-purple-100 text-purple-800' : h.table_name === 'recurring_payrolls' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-800'}`}>
                            {h.table_name === 'incomes' ? 'Ingresos' : h.table_name === 'expenses' ? 'Egresos' : h.table_name === 'fixed_expenses' ? 'Gastos Fijos' : h.table_name === 'recurring_payrolls' ? 'Nóminas' : h.table_name}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate" title={h.operation_description}>
                          {h.operation_description}
                        </TableCell>
                        <TableCell className="font-mono">
                          {Number(h.amount).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'MXN'
                      })}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${h.account_type === 'fiscal' ? 'bg-green-100 text-green-800' : h.account_type === 'no_fiscal' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                            {h.account_type === 'fiscal' ? 'Fiscal' : h.account_type === 'no_fiscal' ? 'No Fiscal' : h.account_type || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {h.profiles?.full_name || 'Sistema'}
                        </TableCell>
                      </TableRow>)}
                    {!financialHistoryQuery.isLoading && (!financialHistoryQuery.data || financialHistoryQuery.data.length === 0) && <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-4xl">📋</div>
                            <div className="font-medium">No hay movimientos en el historial</div>
                            <div className="text-sm">Los movimientos aparecerán aquí conforme se vayan realizando</div>
                          </div>
                        </TableCell>
                      </TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consecutive">
          <AccountsConsecutiveReport startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="report">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Reporte Fiscal Detallado</h2>
                <p className="text-sm text-muted-foreground">
                  Consecutivo de cuenta para entrega al contador - Período: {new Date(startDate).toLocaleDateString('es-MX')} a {new Date(endDate).toLocaleDateString('es-MX')}
                </p>
              </div>
              <Button 
                onClick={() => {
                  const allFiscalData = [
                    ...(fiscalIncomesQuery.data ?? []).map(item => ({
                      tipo: 'INGRESO',
                      fecha: item.income_date,
                      numero: item.income_number,
                      concepto: item.description,
                      numero_factura: item.invoice_number || '-',
                      base: Number(item.taxable_amount || 0).toFixed(2),
                      iva: Number(item.vat_amount || 0).toFixed(2),
                      total: Number(item.amount).toFixed(2),
                      metodo_pago: item.payment_method,
                      categoria: item.category
                    })),
                    ...(fiscalExpensesQuery.data ?? []).map(item => ({
                      tipo: 'EGRESO',
                      fecha: item.expense_date,
                      numero: item.expense_number,
                      concepto: item.description,
                      numero_factura: item.invoice_number || '-',
                      base: Number(item.taxable_amount || 0).toFixed(2),
                      iva: Number(item.vat_amount || 0).toFixed(2),
                      total: Number(item.amount).toFixed(2),
                      metodo_pago: item.payment_method,
                      categoria: item.category
                    }))
                  ].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
                  exportCsv(`reporte_fiscal_${startDate}_${endDate}`, allFiscalData);
                }}
                disabled={!fiscalIncomesQuery.data?.length && !fiscalExpensesQuery.data?.length}
              >
                Exportar Reporte Completo
              </Button>
            </div>

            {/* Reporte Consolidado - Tabla Unificada */}
            <Card className="border-l-4 border-l-slate-500">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-950/20">
                <CardTitle className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                  Movimientos Fiscales Consolidados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead># Factura</TableHead>
                        <TableHead>Base Gravable</TableHead>
                        <TableHead>IVA</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Método Pago</TableHead>
                        <TableHead>Categoría</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fiscalIncomesQuery.isLoading || fiscalExpensesQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-4">Cargando...</TableCell>
                        </TableRow>
                      ) : (() => {
                        const allTransactions = [
                          ...(fiscalIncomesQuery.data ?? []).map(item => ({...item, type: 'INGRESO'})),
                          ...(fiscalExpensesQuery.data ?? []).map(item => ({...item, type: 'EGRESO', income_date: item.expense_date, income_number: item.expense_number}))
                         ].sort((a, b) => new Date(a.income_date).getTime() - new Date(b.income_date).getTime());
                        
                        return allTransactions.length > 0 ? allTransactions.map((transaction: any) => (
                          <TableRow key={transaction.id} className={transaction.type === 'INGRESO' ? 'bg-green-50/30 hover:bg-green-50/50' : 'bg-red-50/30 hover:bg-red-50/50'}>
                            <TableCell>
                              <div className={`px-2 py-1 rounded-full text-xs font-medium text-center ${
                                transaction.type === 'INGRESO' 
                                  ? 'bg-green-100 text-green-700 border border-green-200' 
                                  : 'bg-red-100 text-red-700 border border-red-200'
                              }`}>
                                {transaction.type}
                              </div>
                            </TableCell>
                            <TableCell>{formatDateTimeMexico(transaction.income_date)}</TableCell>
                            <TableCell className="font-mono">{transaction.income_number}</TableCell>
                            <TableCell className="max-w-[300px] truncate" title={transaction.description}>
                              {transaction.description}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {transaction.invoice_number || '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${Number(transaction.taxable_amount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${transaction.type === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                              ${Number(transaction.vat_amount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              ${Number(transaction.amount).toFixed(2)}
                            </TableCell>
                            <TableCell>{transaction.payment_method}</TableCell>
                            <TableCell>{transaction.category}</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                              No hay movimientos fiscales en el período seleccionado
                            </TableCell>
                          </TableRow>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Resumen Consolidado de IVA e ISR */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Balance de IVA Mejorado */}
              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="bg-purple-50/50 dark:bg-purple-950/20">
                  <CardTitle className="text-purple-700 dark:text-purple-300 flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    Balance de IVA del Período
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {currentVatSummaryQuery.isLoading ? (
                    <div className="text-center py-4">Calculando balance de IVA...</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="bg-green-50/80 border border-green-200/60 p-4 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div className="text-green-700 font-medium">IVA Cobrado (Ingresos)</div>
                            <div className="text-xl font-bold text-green-800">
                              ${(currentVatSummaryQuery.data?.totalVatIncome || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-red-50/80 border border-red-200/60 p-4 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div className="text-red-700 font-medium">IVA Pagado (Egresos)</div>
                            <div className="text-xl font-bold text-red-800">
                              -${(currentVatSummaryQuery.data?.totalVatExpense || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        
                        <div className={`${
                          (currentVatSummaryQuery.data?.vatBalance || 0) > 0 
                            ? 'bg-orange-100/80 border-orange-300/60' 
                            : 'bg-emerald-100/80 border-emerald-300/60'
                        } border-2 p-6 rounded-lg`}>
                          <div className="text-center">
                            <div className={`font-bold text-lg ${
                              (currentVatSummaryQuery.data?.vatBalance || 0) > 0 
                                ? 'text-orange-700' 
                                : 'text-emerald-700'
                            }`}>
                              SALDO IVA
                            </div>
                            <div className={`text-3xl font-bold mt-2 ${
                              (currentVatSummaryQuery.data?.vatBalance || 0) > 0 
                                ? 'text-orange-800' 
                                : 'text-emerald-800'
                            }`}>
                              ${Math.abs(currentVatSummaryQuery.data?.vatBalance || 0).toFixed(2)}
                            </div>
                            <div className={`text-lg font-semibold mt-1 ${
                              (currentVatSummaryQuery.data?.vatBalance || 0) > 0 
                                ? 'text-orange-600' 
                                : 'text-emerald-600'
                            }`}>
                              {(currentVatSummaryQuery.data?.vatBalance || 0) > 0 ? 'A PAGAR' : 'A FAVOR'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50/80 border border-gray-200/60 p-4 rounded-lg">
                        <div className="text-sm text-gray-700">
                          <p className="font-medium mb-2">💡 Interpretación del Balance:</p>
                          <ul className="space-y-1 text-xs">
                            <li>• <strong>Saldo A PAGAR:</strong> Debe declarar y pagar este monto al SAT</li>
                            <li>• <strong>Saldo A FAVOR:</strong> Puede solicitar devolución o aplicar a futuros pagos</li>
                            <li>• <strong>Fecha límite:</strong> Debe presentar declaración antes del día 17 del mes siguiente</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Retenciones de ISR Mejorado */}
              <Card className="border-l-4 border-l-yellow-500">
                <CardHeader className="bg-yellow-50/50 dark:bg-yellow-950/20">
                  <CardTitle className="text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    Retenciones de ISR del Período
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {isrRetentionsQuery.isLoading ? (
                    <div className="text-center py-4">Cargando retenciones de ISR...</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="bg-yellow-50/80 border border-yellow-200/60 p-4 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div className="text-yellow-700 font-medium">Ingresos Sujetos a ISR</div>
                            <div className="text-xl font-bold text-yellow-800">
                              ${(isrRetentionsQuery.data?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-yellow-100/80 border-2 border-yellow-300/60 p-6 rounded-lg">
                          <div className="text-center">
                            <div className="text-yellow-700 font-bold text-lg">
                              TOTAL ISR RETENIDO
                            </div>
                            <div className="text-3xl font-bold text-yellow-800 mt-2">
                              ${(isrRetentionsQuery.data?.reduce((sum, item) => sum + Number(item.isr_withholding_amount || 0), 0) || 0).toFixed(2)}
                            </div>
                            <div className="text-sm text-yellow-600 mt-1">
                              {isrRetentionsQuery.data?.length || 0} retención(es)
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-blue-50/80 border border-blue-200/60 p-4 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div className="text-blue-700 font-medium">Ingreso Neto Recibido</div>
                            <div className="text-xl font-bold text-blue-800">
                              ${((isrRetentionsQuery.data?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0) - 
                                  (isrRetentionsQuery.data?.reduce((sum, item) => sum + Number(item.isr_withholding_amount || 0), 0) || 0)).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50/80 border border-gray-200/60 p-4 rounded-lg">
                        <div className="text-sm text-gray-700">
                          <p className="font-medium mb-2">📋 Información sobre ISR:</p>
                          <ul className="space-y-1 text-xs">
                            <li>• <strong>ISR Retenido:</strong> Impuesto descontado por el cliente pagador</li>
                            <li>• <strong>Acreditable:</strong> Se puede descontar del ISR anual a pagar</li>
                            <li>• <strong>Constancia:</strong> El cliente debe entregar constancia de retención</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tabla Detallada de ISR (si hay retenciones) */}
            {(isrRetentionsQuery.data?.length || 0) > 0 && (
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="flex flex-row items-center justify-between bg-amber-50/50 dark:bg-amber-950/20">
                  <CardTitle className="text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    Detalle de Retenciones ISR
                  </CardTitle>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      const isrData = (isrRetentionsQuery.data ?? []).map(item => ({
                        fecha: item.income_date,
                        concepto: item.description,
                        monto_total: Number(item.amount).toFixed(2),
                        tasa_retencion: `${item.isr_withholding_rate}%`,
                        isr_retenido: Number(item.isr_withholding_amount).toFixed(2),
                        monto_neto: (Number(item.amount) - Number(item.isr_withholding_amount)).toFixed(2)
                      }));
                      exportCsv(`retenciones_isr_detalle_${startDate}_${endDate}`, isrData);
                    }}
                  >
                    Exportar Detalle ISR
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Concepto</TableHead>
                          <TableHead>Monto Total</TableHead>
                          <TableHead>Tasa ISR</TableHead>
                          <TableHead>ISR Retenido</TableHead>
                          <TableHead>Monto Neto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isrRetentionsQuery.data?.map((retention: any, index: number) => (
                          <TableRow key={index} className="hover:bg-amber-50/30">
                            <TableCell>{formatDateTimeMexico(retention.income_date)}</TableCell>
                            <TableCell className="max-w-[250px] truncate" title={retention.description}>
                              {retention.description}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${Number(retention.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                {retention.isr_withholding_rate}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-amber-600 font-semibold">
                              ${Number(retention.isr_withholding_amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              ${(Number(retention.amount) - Number(retention.isr_withholding_amount)).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ingresos Fiscales */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between bg-green-50/50 dark:bg-green-950/20">
                <CardTitle className="text-green-700 dark:text-green-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  Ingresos Fiscales ({fiscalIncomesQuery.data?.length || 0})
                </CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => exportCsv(`ingresos_fiscales_${startDate}_${endDate}`, fiscalIncomesQuery.data ?? [])}
                  disabled={!fiscalIncomesQuery.data?.length}
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
                        <TableHead>Número</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead># Factura</TableHead>
                        <TableHead>Base Gravable</TableHead>
                        <TableHead>IVA</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Método Pago</TableHead>
                        <TableHead>Categoría</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fiscalIncomesQuery.isLoading && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-4">Cargando...</TableCell>
                        </TableRow>
                      )}
                      {!fiscalIncomesQuery.isLoading && (fiscalIncomesQuery.data ?? []).map((income: any) => (
                        <TableRow key={income.id}>
                          <TableCell>{formatDateTimeMexico(income.income_date)}</TableCell>
                          <TableCell className="font-mono">{income.income_number}</TableCell>
                          <TableCell className="max-w-[300px] truncate" title={income.description}>
                            {income.description}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {income.invoice_number || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${Number(income.taxable_amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            ${Number(income.vat_amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            ${Number(income.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>{income.payment_method}</TableCell>
                          <TableCell>{income.category}</TableCell>
                        </TableRow>
                      ))}
                      {!fiscalIncomesQuery.isLoading && (!fiscalIncomesQuery.data || fiscalIncomesQuery.data.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No hay ingresos fiscales en el período seleccionado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {fiscalIncomesQuery.data && fiscalIncomesQuery.data.length > 0 && (
                  <div className="mt-4 p-4 bg-green-50/50 border border-green-200/50 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium text-green-700">Base Total</div>
                        <div className="text-lg font-bold text-green-800">
                          ${(fiscalIncomesQuery.data?.reduce((sum, item) => sum + Number(item.taxable_amount || 0), 0) || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-green-700">IVA Total</div>
                        <div className="text-lg font-bold text-green-800">
                          ${(fiscalIncomesQuery.data?.reduce((sum, item) => sum + Number(item.vat_amount || 0), 0) || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-green-700">Total General</div>
                        <div className="text-lg font-bold text-green-800">
                          ${(fiscalIncomesQuery.data?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Egresos Fiscales */}
            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="flex flex-row items-center justify-between bg-red-50/50 dark:bg-red-950/20">
                <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  Egresos Fiscales ({fiscalExpensesQuery.data?.length || 0})
                </CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => exportCsv(`egresos_fiscales_${startDate}_${endDate}`, fiscalExpensesQuery.data ?? [])}
                  disabled={!fiscalExpensesQuery.data?.length}
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
                        <TableHead>Número</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead># Factura</TableHead>
                        <TableHead>Base Gravable</TableHead>
                        <TableHead>IVA</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Método Pago</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Desglose</TableHead>
                      </TableRow>
                    </TableHeader>
                     <TableBody>
                       {fiscalExpensesQuery.isLoading && (
                         <TableRow>
                           <TableCell colSpan={10} className="text-center py-4">Cargando...</TableCell>
                         </TableRow>
                       )}
                       {!fiscalExpensesQuery.isLoading && (fiscalExpensesQuery.data ?? []).map((expense: any) => (
                         <TableRow key={expense.id}>
                           <TableCell>{formatDateTimeMexico(expense.expense_date)}</TableCell>
                           <TableCell className="font-mono">{expense.expense_number}</TableCell>
                           <TableCell className="max-w-[300px] truncate" title={expense.description}>
                             {expense.description}
                           </TableCell>
                           <TableCell className="font-mono text-sm">
                             {expense.invoice_number || '-'}
                           </TableCell>
                           <TableCell className="text-right font-mono">
                             ${Number(expense.taxable_amount || 0).toFixed(2)}
                           </TableCell>
                           <TableCell className="text-right font-mono text-red-600">
                             ${Number(expense.vat_amount || 0).toFixed(2)}
                           </TableCell>
                           <TableCell className="text-right font-mono font-semibold">
                             ${Number(expense.amount).toFixed(2)}
                           </TableCell>
                           <TableCell>{expense.payment_method}</TableCell>
                           <TableCell>{expense.category}</TableCell>
                           <TableCell>
                             {expense.description?.includes('Facturas:') ? (
                               <div className="text-xs text-muted-foreground">
                                 {expense.description.split('Facturas:')[1]?.split(',').map((factura: string, index: number) => (
                                   <div key={index} className="truncate max-w-[120px]" title={factura.trim()}>
                                     • {factura.trim()}
                                   </div>
                                 ))}
                               </div>
                             ) : (
                               <span className="text-xs text-muted-foreground">-</span>
                             )}
                           </TableCell>
                         </TableRow>
                       ))}
                       {!fiscalExpensesQuery.isLoading && (!fiscalExpensesQuery.data || fiscalExpensesQuery.data.length === 0) && (
                         <TableRow>
                           <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                             No hay egresos fiscales en el período seleccionado
                           </TableCell>
                         </TableRow>
                       )}
                    </TableBody>
                  </Table>
                </div>
                {fiscalExpensesQuery.data && fiscalExpensesQuery.data.length > 0 && (
                  <div className="mt-4 p-4 bg-red-50/50 border border-red-200/50 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium text-red-700">Base Total</div>
                        <div className="text-lg font-bold text-red-800">
                          ${(fiscalExpensesQuery.data?.reduce((sum, item) => sum + Number(item.taxable_amount || 0), 0) || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-red-700">IVA Total</div>
                        <div className="text-lg font-bold text-red-800">
                          ${(fiscalExpensesQuery.data?.reduce((sum, item) => sum + Number(item.vat_amount || 0), 0) || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-red-700">Total General</div>
                        <div className="text-lg font-bold text-red-800">
                          ${(fiscalExpensesQuery.data?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resumen General del Reporte */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20">
                <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Resumen General del Período
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="text-lg font-semibold text-green-700">Ingresos Fiscales</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Cantidad de registros:</span>
                        <span className="font-medium">{fiscalIncomesQuery.data?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total sin IVA:</span>
                        <span className="font-medium">
                          ${(fiscalIncomesQuery.data?.reduce((sum, item) => sum + Number(item.taxable_amount || 0), 0) || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA Cobrado:</span>
                        <span className="font-medium text-green-600">
                          ${(fiscalIncomesQuery.data?.reduce((sum, item) => sum + Number(item.vat_amount || 0), 0) || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Total:</span>
                        <span className="font-bold text-green-700">
                          ${(fiscalIncomesQuery.data?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="text-lg font-semibold text-red-700">Egresos Fiscales</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Cantidad de registros:</span>
                        <span className="font-medium">{fiscalExpensesQuery.data?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total sin IVA:</span>
                        <span className="font-medium">
                          ${(fiscalExpensesQuery.data?.reduce((sum, item) => sum + Number(item.taxable_amount || 0), 0) || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA Pagado:</span>
                        <span className="font-medium text-red-600">
                          ${(fiscalExpensesQuery.data?.reduce((sum, item) => sum + Number(item.vat_amount || 0), 0) || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Total:</span>
                        <span className="font-bold text-red-700">
                          ${(fiscalExpensesQuery.data?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Balance de IVA */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="bg-purple-50/50 dark:bg-purple-950/20">
                <CardTitle className="text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  Balance de IVA del Período
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {currentVatSummaryQuery.isLoading ? (
                  <div className="text-center py-4">Calculando balance de IVA...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-green-50/80 border border-green-200/60 p-4 rounded-lg text-center">
                        <div className="text-green-700 font-medium text-sm">IVA Cobrado</div>
                        <div className="text-xl font-bold text-green-800">
                          ${(currentVatSummaryQuery.data?.totalVatIncome || 0).toFixed(2)}
                        </div>
                      </div>
                      
                      <div className="bg-red-50/80 border border-red-200/60 p-4 rounded-lg text-center">
                        <div className="text-red-700 font-medium text-sm">IVA Pagado</div>
                        <div className="text-xl font-bold text-red-800">
                          ${(currentVatSummaryQuery.data?.totalVatExpense || 0).toFixed(2)}
                        </div>
                      </div>
                      
                      <div className={`${
                        (currentVatSummaryQuery.data?.vatBalance || 0) > 0 
                          ? 'bg-orange-50/80 border-orange-200/60' 
                          : 'bg-emerald-50/80 border-emerald-200/60'
                      } border p-4 rounded-lg text-center`}>
                        <div className={`font-medium text-sm ${
                          (currentVatSummaryQuery.data?.vatBalance || 0) > 0 
                            ? 'text-orange-700' 
                            : 'text-emerald-700'
                        }`}>
                          Saldo IVA
                        </div>
                        <div className={`text-xl font-bold ${
                          (currentVatSummaryQuery.data?.vatBalance || 0) > 0 
                            ? 'text-orange-800' 
                            : 'text-emerald-800'
                        }`}>
                          ${(currentVatSummaryQuery.data?.vatBalance || 0).toFixed(2)}
                        </div>
                        <div className={`text-xs mt-1 ${
                          (currentVatSummaryQuery.data?.vatBalance || 0) > 0 
                            ? 'text-orange-600' 
                            : 'text-emerald-600'
                        }`}>
                          {(currentVatSummaryQuery.data?.vatBalance || 0) > 0 ? 'A pagar' : 'A favor'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50/80 border border-gray-200/60 p-4 rounded-lg">
                      <div className="text-sm text-gray-700">
                        <p className="font-medium mb-2">Interpretación del Balance:</p>
                        <ul className="space-y-1 text-xs">
                          <li>• <strong>Saldo positivo (A pagar):</strong> Se debe más IVA del que se pagó en compras</li>
                          <li>• <strong>Saldo negativo (A favor):</strong> Se pagó más IVA en compras del que se cobró</li>
                          <li>• <strong>Nota:</strong> Este balance debe reportarse en la declaración mensual de IVA</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Retenciones de ISR */}
            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader className="flex flex-row items-center justify-between bg-yellow-50/50 dark:bg-yellow-950/20">
                <CardTitle className="text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  Retenciones de ISR del Período
                </CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    const isrData = (isrRetentionsQuery.data ?? []).map(item => ({
                      fecha: item.income_date,
                      concepto: item.description,
                      monto_total: Number(item.amount).toFixed(2),
                      tasa_retencion: `${item.isr_withholding_rate}%`,
                      isr_retenido: Number(item.isr_withholding_amount).toFixed(2)
                    }));
                    exportCsv(`retenciones_isr_${startDate}_${endDate}`, isrData);
                  }}
                  disabled={!isrRetentionsQuery.data?.length}
                >
                  Exportar ISR
                </Button>
              </CardHeader>
              <CardContent>
                {isrRetentionsQuery.isLoading ? (
                  <div className="text-center py-4">Cargando retenciones de ISR...</div>
                ) : (
                  <>
                    <div className="mb-4 p-4 bg-yellow-50/50 border border-yellow-200/50 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-yellow-700 font-medium text-sm">Número de Retenciones</div>
                          <div className="text-xl font-bold text-yellow-800">
                            {isrRetentionsQuery.data?.length || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-yellow-700 font-medium text-sm">Ingreso Total Sujeto</div>
                          <div className="text-xl font-bold text-yellow-800">
                            ${(isrRetentionsQuery.data?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-yellow-700 font-medium text-sm">Total ISR Retenido</div>
                          <div className="text-xl font-bold text-yellow-800">
                            ${(isrRetentionsQuery.data?.reduce((sum, item) => sum + Number(item.isr_withholding_amount || 0), 0) || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {(isrRetentionsQuery.data?.length || 0) > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Concepto</TableHead>
                              <TableHead>Monto Total</TableHead>
                              <TableHead>Tasa ISR</TableHead>
                              <TableHead>ISR Retenido</TableHead>
                              <TableHead>Monto Neto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {isrRetentionsQuery.data?.map((retention: any, index: number) => (
                              <TableRow key={index}>
                                <TableCell>{formatDateTimeMexico(retention.income_date)}</TableCell>
                                <TableCell className="max-w-[250px] truncate" title={retention.description}>
                                  {retention.description}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  ${Number(retention.amount).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {retention.isr_withholding_rate}%
                                </TableCell>
                                <TableCell className="text-right font-mono text-yellow-600">
                                  ${Number(retention.isr_withholding_amount).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold">
                                  ${(Number(retention.amount) - Number(retention.isr_withholding_amount)).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-4xl mb-2">🧾</div>
                        <div className="font-medium">No hay retenciones de ISR</div>
                        <div className="text-sm">No se encontraron retenciones de ISR en el período seleccionado</div>
                      </div>
                    )}

                    <div className="mt-4 bg-gray-50/80 border border-gray-200/60 p-4 rounded-lg">
                      <div className="text-sm text-gray-700">
                        <p className="font-medium mb-2">Información sobre ISR:</p>
                        <ul className="space-y-1 text-xs">
                          <li>• <strong>ISR Retenido:</strong> Impuesto que los clientes retuvieron al pagar facturas</li>
                          <li>• <strong>Monto Neto:</strong> Cantidad realmente recibida después de la retención</li>
                          <li>• <strong>Uso Contable:</strong> Las retenciones se pueden aplicar como pago a cuenta del ISR anual</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>


      {/* Diálogo para gestión de proveedores */}
      <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier ? 'Modifica los datos del proveedor' : 'Agrega un nuevo proveedor al sistema'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div>
              <label className="text-sm font-medium">Nombre del proveedor *</label>
              <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Nombre completo del proveedor" />
            </div>
            
            <div>
              <label className="text-sm font-medium">Persona de contacto</label>
              <Input value={supplierContact} onChange={e => setSupplierContact(e.target.value)} placeholder="Nombre del contacto" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)} placeholder="email@proveedor.com" />
              </div>
              <div>
                <label className="text-sm font-medium">Teléfono</label>
                <Input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} placeholder="555-0123" />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Dirección</label>
              <Input value={supplierAddress} onChange={e => setSupplierAddress(e.target.value)} placeholder="Dirección completa" />
            </div>
            
            <div>
              <label className="text-sm font-medium">RFC</label>
              <Input value={supplierRFC} onChange={e => setSupplierRFC(e.target.value)} placeholder="ABCD123456789" />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
            setShowSupplierDialog(false);
            setEditingSupplier(null);
            setSupplierName("");
            setSupplierContact("");
            setSupplierEmail("");
            setSupplierPhone("");
            setSupplierAddress("");
            setSupplierRFC("");
          }}>
              Cancelar
            </Button>
            <Button onClick={editingSupplier ? updateSupplier : addSupplier}>
              {editingSupplier ? 'Actualizar' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para retiro masivo */}
      <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirar Items Seleccionados</DialogTitle>
            <DialogDescription>
              Se crearán egresos fiscales por los {selectedWithdrawals.length} items seleccionados
              {fiscalWithdrawalsQuery.data && <>
                  {' '}por un total de ${fiscalWithdrawalsQuery.data.filter(fw => selectedWithdrawals.includes(fw.id)).reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString()}
                </>}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="withdrawal-concept">Concepto *</Label>
              <Input id="withdrawal-concept" value={withdrawalConcept} onChange={e => setWithdrawalConcept(e.target.value)} placeholder="Ej: Retiro facturas periodo diciembre 2024" />
            </div>
            
            <div>
              <Label htmlFor="withdrawal-description">Descripción adicional</Label>
              <Textarea id="withdrawal-description" value={withdrawalDescription} onChange={e => setWithdrawalDescription(e.target.value)} placeholder="Información adicional sobre el retiro (opcional)" rows={3} />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawalDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkWithdrawal} className="bg-orange-600 hover:bg-orange-700">
              Confirmar Retiro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      

        <FiscalWithdrawalDialog open={fiscalWithdrawalDialog.open} onOpenChange={open => setFiscalWithdrawalDialog({
      open,
      withdrawal: null
    })} withdrawal={fiscalWithdrawalDialog.withdrawal} onSuccess={() => {
      fiscalWithdrawalsQuery.refetch();
      expensesQuery.refetch();
    }} />

        <MultipleFiscalWithdrawalsDialog open={multipleFiscalWithdrawalsDialog} onOpenChange={setMultipleFiscalWithdrawalsDialog} withdrawals={fiscalWithdrawalsQuery.data?.filter(fw => fw.withdrawal_status === 'available' && fw.amount > 0).map(fw => ({
      id: fw.id,
      amount: fw.amount,
      description: fw.description,
      withdrawal_date: fw.created_at,
      withdrawal_status: fw.withdrawal_status
    })) || []} onSuccess={() => {
      fiscalWithdrawalsQuery.refetch();
      expensesQuery.refetch();
    }} />
    </AppLayout>;
}