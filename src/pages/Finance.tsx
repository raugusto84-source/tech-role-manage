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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { CollectionDialog } from "@/components/finance/CollectionDialog";
import { X, Plus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0,10));
  const [endDate, setEndDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().substring(0,10));
  const [accountType, setAccountType] = useState<string>("all"); // all | fiscal | no_fiscal
  
  // Estado para retiros
  const [selectedWithdrawals, setSelectedWithdrawals] = useState<string[]>([]);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [withdrawalConcept, setWithdrawalConcept] = useState('');
  const [withdrawalDescription, setWithdrawalDescription] = useState('');

  // Función para establecer mes actual rápidamente
  const setCurrentMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0,10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0,10);
    setStartDate(firstDay);
    setEndDate(lastDay);
  };

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

  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").eq("status", "active").order("supplier_name");
      if (error) throw error;
      return data || [];
    },
  });

  const purchasesQuery = useQuery({
    queryKey: ["purchases", startDate, endDate],
    queryFn: async () => {
      let q = supabase
        .from("purchases")
        .select(`
          *,
          supplier:suppliers(supplier_name)
        `)
        .order("purchase_date", { ascending: false });
      if (startDate) q = q.gte("purchase_date", startDate);
      if (endDate) q = q.lte("purchase_date", endDate);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
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
        .select("id,order_number,client_name,client_email,estimated_cost,delivery_date,total_paid,remaining_balance,total_vat_amount,subtotal_without_vat,total_with_vat")
        .order("delivery_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
  });

  // Query para retiros fiscales vinculados a órdenes
  const fiscalWithdrawalsQuery = useQuery({
    queryKey: ["fiscal_withdrawals"],
    queryFn: async () => {
      console.log('Fetching fiscal withdrawals...');
      const { data, error } = await supabase
        .from("fiscal_withdrawals")
        .select(`
          id,
          amount,
          description,
          withdrawal_status,
          created_at,
          withdrawn_at
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error('Error fetching fiscal withdrawals:', error);
        throw error;
      }
      
      console.log('Fiscal withdrawals fetched:', data);
      console.log('Available withdrawals:', data?.filter(fw => fw.withdrawal_status === 'available'));
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
        .select("id,description,amount,account_type,payment_method,next_run_date,active,day_of_month")
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
        .select("id,employee_name,base_salary,net_salary,account_type,payment_method,next_run_date,active,day_of_month")
        .order("next_run_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
  });

  const fixedIncomesQuery = useQuery({
    queryKey: ["fixed_incomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_incomes")
        .select("id,description,amount,account_type,payment_method,next_run_date,active,day_of_month")
        .order("next_run_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
  });
  
  const incomesTotal = useMemo(() => (incomesQuery.data?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0), [incomesQuery.data]);
  const expensesTotal = useMemo(() => (expensesQuery.data?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0), [expensesQuery.data]);

  // Cálculos para gastos fijos recurrentes mensuales
  const monthlyFixedExpenses = useMemo(() => {
    return (fixedExpensesQuery.data ?? [])
      .filter((fx: any) => fx.active)
      .reduce((total: number, fx: any) => total + (Number(fx.amount) || 0), 0);
  }, [fixedExpensesQuery.data]);

  const monthlyRecurringPayrolls = useMemo(() => {
    return (recurringPayrollsQuery.data ?? [])
      .filter((pr: any) => pr.active)
      .reduce((total: number, pr: any) => total + (Number(pr.net_salary) || 0), 0);
  }, [recurringPayrollsQuery.data]);

  // Cálculos para ingresos fijos mensuales
  const monthlyFixedIncomes = useMemo(() => {
    return (fixedIncomesQuery.data ?? [])
      .filter((fi: any) => fi.active)
      .reduce((total: number, fi: any) => total + (Number(fi.amount) || 0), 0);
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
  const [expDate, setExpDate] = useState<string>(new Date().toISOString().substring(0,10));

  // Estados para compras
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [purchaseConcept, setPurchaseConcept] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchaseAccount, setPurchaseAccount] = useState<"fiscal" | "no_fiscal">("no_fiscal");
  const [purchaseMethod, setPurchaseMethod] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().substring(0,10));
  const [purchaseHasInvoice, setPurchaseHasInvoice] = useState(false);
  const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState("");
  
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
      
      const { data, error } = await supabase.from("fixed_expenses").insert({
        description: feDesc,
        amount,
        account_type: feAccount as any,
        payment_method: feMethod || null,
        frequency: 'monthly',
        day_of_month: feDayOfMonth,
      } as any).select('*').single();
      
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation(
        'create',
        'fixed_expenses',
        data.id,
        data,
        `Creación de gasto fijo: ${feDesc}`,
        amount,
        feAccount as any
      );

      toast({ title: "Gasto fijo programado" });
      setFeDesc(""); setFeAmount(""); setFeMethod(""); setFeAccount("fiscal"); setFeDayOfMonth(1);
      fixedExpensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible agregar", variant: "destructive" });
    }
  };

  const addFixedIncome = async () => {
    try {
      const amount = Number(fiAmount);
      if (!fiDesc || !amount) throw new Error("Completa descripción y monto válido");
      
      const { data, error } = await supabase.from("fixed_incomes").insert({
        description: fiDesc,
        amount,
        account_type: fiAccount as any,
        payment_method: fiMethod || null,
        frequency: 'monthly',
        day_of_month: fiDayOfMonth,
      } as any).select('*').single();
      
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation(
        'create',
        'fixed_incomes',
        data.id,
        data,
        `Creación de ingreso fijo: ${fiDesc}`,
        amount,
        fiAccount as any
      );
      
      toast({ title: "Ingreso fijo programado" });
      setFiDesc(""); setFiAmount(""); setFiMethod(""); setFiAccount("fiscal"); setFiDayOfMonth(1);
      fixedIncomesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible agregar", variant: "destructive" });
    }
  };

  const addSupplier = async () => {
    try {
      if (!supplierName) throw new Error("El nombre del proveedor es obligatorio");
      
      const { data, error } = await supabase.from("suppliers").insert({
        supplier_name: supplierName,
        contact_person: supplierContact || null,
        email: supplierEmail || null,
        phone: supplierPhone || null,
        address: supplierAddress || null,
        tax_id: supplierRFC || null,
        status: 'active'
      }).select().single();
      
      if (error) throw error;

      toast({ title: "Proveedor agregado" });
      setSupplierName(""); setSupplierContact(""); setSupplierEmail(""); 
      setSupplierPhone(""); setSupplierAddress(""); setSupplierRFC("");
      setShowSupplierDialog(false);
      suppliersQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible agregar el proveedor", variant: "destructive" });
    }
  };

  const updateSupplier = async () => {
    try {
      if (!editingSupplier || !supplierName) throw new Error("Datos incompletos");
      
      const { error } = await supabase.from("suppliers").update({
        supplier_name: supplierName,
        contact_person: supplierContact || null,
        email: supplierEmail || null,
        phone: supplierPhone || null,
        address: supplierAddress || null,
        tax_id: supplierRFC || null,
      }).eq("id", editingSupplier.id);
      
      if (error) throw error;

      toast({ title: "Proveedor actualizado" });
      setSupplierName(""); setSupplierContact(""); setSupplierEmail(""); 
      setSupplierPhone(""); setSupplierAddress(""); setSupplierRFC("");
      setEditingSupplier(null);
      setShowSupplierDialog(false);
      suppliersQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible actualizar el proveedor", variant: "destructive" });
    }
  };

  const deleteSupplier = async (supplierId: string) => {
    try {
      const { error } = await supabase.from("suppliers").update({ status: 'inactive' }).eq("id", supplierId);
      if (error) throw error;
      toast({ title: "Proveedor eliminado" });
      suppliersQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible eliminar el proveedor", variant: "destructive" });
    }
  };

  const addPurchase = async () => {
    try {
      const amount = Number(purchaseAmount);
      if (!purchaseSupplier || !purchaseConcept || !amount) throw new Error("Completa todos los campos obligatorios");
      
      // Validar que si no tiene factura, solo se puede pagar con cuenta no fiscal
      if (!purchaseHasInvoice && purchaseAccount === 'fiscal') {
        throw new Error("Sin factura solo se puede pagar desde cuenta no fiscal");
      }
      
      // Calcular IVA si es cuenta fiscal
      // Si es fiscal, el monto incluye IVA, así que calculamos la base gravable
      const vatRate = purchaseAccount === "fiscal" ? 16 : 0;
      const taxableAmount = purchaseAccount === "fiscal" ? amount / 1.16 : amount;
      const vatAmount = purchaseAccount === "fiscal" ? amount - taxableAmount : 0;

      // Crear el gasto
      const { data: expense, error: expenseError } = await supabase.from("expenses").insert({
        amount: amount,
        description: `Compra - ${purchaseConcept}`,
        category: "compra",
        account_type: purchaseAccount as any,
        payment_method: purchaseMethod || null,
        expense_date: purchaseDate,
        vat_rate: vatRate || null,
        vat_amount: vatAmount || null,
        taxable_amount: taxableAmount || null,
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
        expense_id: expense.id,
      };

      const { data: purchase, error: purchaseError } = await supabase.from("purchases").insert(purchaseData).select().single();
      if (purchaseError) throw purchaseError;

      // Si tiene factura y se pagó de cuenta no fiscal, crear retiro fiscal disponible
      if (purchaseHasInvoice && purchaseAccount === 'no_fiscal') {
        console.log('Creating fiscal withdrawal for invoiced purchase from non-fiscal account');
        
        // Create a dummy income first since income_id is required
        const { data: dummyIncome, error: incomeError } = await supabase.from("incomes").insert({
          amount: 0,
          description: `Referencia fiscal para retiro de compra: ${purchaseConcept}`,
          category: "referencia",
          account_type: "fiscal"
        } as any).select().single();
        
        if (incomeError) {
          console.error('Error creating dummy income:', incomeError);
          throw incomeError;
        }
        
        if (dummyIncome) {
          console.log('Creating fiscal withdrawal with amount:', amount);
          const { data: withdrawal, error: withdrawalError } = await supabase.from("fiscal_withdrawals").insert({
            amount: amount,
            description: `Factura pendiente: ${purchaseConcept} - ${supplier?.supplier_name || 'Proveedor'}`,
            withdrawal_status: 'available',
            income_id: dummyIncome.id
          } as any).select().single();
          
          if (withdrawalError) {
            console.error("Error creating fiscal withdrawal:", withdrawalError);
            throw withdrawalError;
          } else {
            console.log("Fiscal withdrawal created successfully:", withdrawal);
          }
        }
      }

      // Log en historial financiero
      await logFinancialOperation(
        'create',
        'purchases',
        purchase.id,
        purchase,
        `Compra registrada: ${supplier?.supplier_name || 'Proveedor'} - ${purchaseConcept}${purchaseHasInvoice ? ' (Con factura)' : ' (Sin factura)'}`,
        amount,
        purchaseAccount,
        purchaseDate
      );

      toast({ title: "Compra registrada" });
      setPurchaseSupplier(""); setPurchaseConcept(""); setPurchaseAmount(""); 
      setPurchaseMethod(""); setPurchaseHasInvoice(false); setPurchaseInvoiceNumber("");
      expensesQuery.refetch();
      purchasesQuery.refetch();
      fiscalWithdrawalsQuery.refetch(); // Refrescar retiros fiscales
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible registrar la compra", variant: "destructive" });
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


  const deleteFixedIncome = async (id: string) => {
    if (!isAdmin) return;
    try {
      // Get record data before deletion for history
      const { data: recordData } = await supabase.from("fixed_incomes").select("*").eq("id", id).single();
      
      const { error } = await supabase.from("fixed_incomes").delete().eq("id", id);
      if (error) throw error;

      // Log deletion
      if (recordData) {
        await logFinancialOperation(
          'delete',
          'fixed_incomes',
          id,
          recordData,
          `Eliminación de ingreso fijo: ${recordData.description}`,
          recordData.amount,
          recordData.account_type
        );
      }

      toast({ title: "Ingreso fijo eliminado" });
      fixedIncomesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible eliminar", variant: "destructive" });
    }
  };

  const toggleFixedIncomeActive = async (row: any) => {
    try {
      const { error } = await supabase.from('fixed_incomes').update({ active: !row.active }).eq('id', row.id);
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation(
        'update',
        'fixed_incomes',
        row.id,
        { ...row, active: !row.active },
        `${row.active ? 'Desactivación' : 'Activación'} de ingreso fijo: ${row.description}`,
        row.amount,
        row.account_type
      );

      toast({ title: row.active ? 'Ingreso fijo desactivado' : 'Ingreso fijo activado' });
      fixedIncomesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No fue posible actualizar', variant: 'destructive' });
    }
  };

  const addExpense = async () => {
    try {
      const amount = Number(expAmount);
      if (!expDesc || !amount || !expAccount || !expCategory) throw new Error("Completa todos los campos requeridos");
      
      // Calcular IVA si es cuenta fiscal
      let vatRate = 0;
      let vatAmount = 0;
      let taxableAmount = amount;
      
      if (expAccount === 'fiscal') {
        vatRate = 16; // IVA del 16% para México
        taxableAmount = amount / 1.16; // Calcular base gravable
        vatAmount = amount - taxableAmount; // IVA incluido
      }
      
      const { data, error } = await supabase.from("expenses").insert({
        amount,
        description: expDesc,
        category: expCategory,
        account_type: expAccount as any,
        payment_method: expMethod || null,
        expense_date: expDate,
        vat_rate: expAccount === 'fiscal' ? vatRate : null,
        vat_amount: expAccount === 'fiscal' ? vatAmount : null,
        taxable_amount: expAccount === 'fiscal' ? taxableAmount : null,
      } as any).select('*').single();
      
      if (error) throw error;
      
      // Log en historial financiero
      await logFinancialOperation(
        'create',
        'expenses',
        data.id,
        data,
        `Creación de egreso: ${expDesc}`,
        amount,
        expAccount as any,
        expDate
      );
      
      toast({ 
        title: "Egreso registrado exitosamente", 
        description: expAccount === 'fiscal' && vatAmount > 0 
          ? `Base: $${taxableAmount.toFixed(2)}, IVA: $${vatAmount.toFixed(2)}, Total: $${amount.toFixed(2)}`
          : `Total: $${amount.toFixed(2)}`
      });
      
      // Clear form
      setExpDesc(""); 
      setExpAmount(""); 
      setExpMethod(""); 
      setExpCategory("");
      setExpAccount("fiscal");
      setExpDate(new Date().toISOString().substring(0,10));
      
      expensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible registrar el egreso", variant: "destructive" });
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
      const { error } = await supabase.from("expenses").insert({
        amount,
        description: `[Retiro] ${feDesc}`,
        category: 'retiro',
        account_type: feAccount as any,
        payment_method: feMethod || null,
        expense_date: today,
        vat_rate: feAccount === 'fiscal' ? vatRate : null,
        vat_amount: feAccount === 'fiscal' ? vatAmount : null,
        taxable_amount: feAccount === 'fiscal' ? taxableAmount : null,
      } as any);
      
      if (error) throw error;
      
      // Log the withdrawal operation
      await logFinancialOperation(
        'create',
        'expenses',
        '', // Will be filled by the system
        { description: `[Retiro] ${feDesc}`, amount, account_type: feAccount },
        `Retiro manual - ${feDesc}`,
        amount,
        feAccount as any,
        today
      );
      
      toast({ 
        title: "Retiro procesado exitosamente", 
        description: `Se retiró $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} de la cuenta ${feAccount === 'fiscal' ? 'fiscal' : 'no fiscal'}` 
      });
      
      // Clear form
      setFeDesc(""); 
      setFeAmount(""); 
      setFeMethod(""); 
      setFeAccount("fiscal");
      
      expensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible procesar el retiro", variant: "destructive" });
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
      
      // Calcular IVA si es cuenta fiscal
      let vatRate = 0;
      let vatAmount = 0;
      let taxableAmount = totalAmount;
      
      if (pAccount === 'fiscal') {
        vatRate = 16; // IVA del 16% para México
        taxableAmount = totalAmount / 1.16; // Calcular base gravable
        vatAmount = totalAmount - taxableAmount; // IVA incluido
      }
      
      const { error: expErr } = await supabase.from("expenses").insert({
        amount: totalAmount,
        description: `Nómina ${pEmployee} ${pMonth}/${pYear}${pBonusDesc ? ` - ${pBonusDesc}` : ''}`,
        category: "nomina",
        account_type: pAccount as any,
        payment_method: pMethod || null,
        vat_rate: pAccount === 'fiscal' ? vatRate : null,
        vat_amount: pAccount === 'fiscal' ? vatAmount : null,
        taxable_amount: pAccount === 'fiscal' ? taxableAmount : null,
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

      // Log en historial financiero
      await logFinancialOperation(
        'update',
        'fixed_expenses',
        row.id,
        { ...row, active: !row.active },
        `${row.active ? 'Desactivación' : 'Activación'} de gasto fijo: ${row.description}`,
        row.amount,
        row.account_type
      );

      toast({ title: row.active ? 'Gasto fijo desactivado' : 'Gasto fijo activado' });
      fixedExpensesQuery.refetch();
      financialHistoryQuery.refetch();
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
      
      const { data, error } = await supabase.from('recurring_payrolls').insert({
        employee_name: pEmployee,
        base_salary: baseSalary,
        net_salary: netSalary,
        account_type: pAccount as any,
        payment_method: pMethod || null,
        frequency: 'monthly',
      } as any).select('*').single();
      
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation(
        'create',
        'recurring_payrolls',
        data.id,
        data,
        `Creación de nómina recurrente: ${pEmployee}`,
        netSalary,
        pAccount as any
      );

      toast({ title: 'Nómina recurrente programada' });
      setPEmployee(''); setPBaseSalary(''); setPNetSalary(''); setPMethod(''); setPAccount('fiscal'); setPRecurring(false);
      recurringPayrollsQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'No fue posible programar', variant: 'destructive' });
    }
  };

  const toggleRecurringPayrollActive = async (row: any) => {
    try {
      const { error } = await supabase.from('recurring_payrolls').update({ active: !row.active }).eq('id', row.id);
      if (error) throw error;

      // Log en historial financiero
      await logFinancialOperation(
        'update',
        'recurring_payrolls',
        row.id,
        { ...row, active: !row.active },
        `${row.active ? 'Desactivación' : 'Activación'} de nómina recurrente: ${row.employee_name}`,
        row.net_salary,
        row.account_type
      );

      toast({ title: row.active ? 'Recurrente desactivado' : 'Recurrente activado' });
      recurringPayrollsQuery.refetch();
      financialHistoryQuery.refetch();
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
      
      // Log the reversal operation before deleting
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

      // Delete the original income (no expense counterpart needed)
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

  // Funciones para retiro de gastos fiscales - removidas

  const withdrawFiscalAmount = async (withdrawalId: string) => {
    try {
      // Get the withdrawal details first
      const { data: withdrawal, error: fetchError } = await supabase
        .from("fiscal_withdrawals")
        .select("*")
        .eq("id", withdrawalId)
        .single();

      if (fetchError) throw fetchError;

      // Skip if amount is 0 or null
      if (!withdrawal.amount || withdrawal.amount === 0) {
        toast({ title: "Error", description: "No se puede retirar un monto de $0", variant: "destructive" });
        return;
      }

      // Create the fiscal expense record
      const { error: expenseError } = await supabase.from("expenses").insert({
        amount: withdrawal.amount,
        description: `Retiro individual: ${withdrawal.description}`,
        category: 'retiro_fiscal',
        account_type: 'fiscal' as any,
        payment_method: 'transferencia',
        expense_date: new Date().toISOString().split('T')[0],
        status: 'pagado'
      } as any);

      if (expenseError) throw expenseError;

      // Update the withdrawal status
      const { error } = await supabase
        .from("fiscal_withdrawals")
        .update({
          withdrawal_status: "withdrawn",
          withdrawn_at: new Date().toISOString(),
          withdrawn_by: profile?.user_id
        })
        .eq("id", withdrawalId);
      
      if (error) throw error;

      toast({ title: "Retiro realizado exitosamente", description: `Se retiró $${withdrawal.amount.toLocaleString()} de la cuenta fiscal` });
      fiscalWithdrawalsQuery.refetch();
      expensesQuery.refetch();
      financialHistoryQuery.refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No fue posible realizar el retiro", variant: "destructive" });
    }
  };

  const handleBulkWithdrawal = async () => {
    if (selectedWithdrawals.length === 0) {
      toast({ title: "Error", description: "Selecciona al menos un item para retirar", variant: "destructive" });
      return;
    }
    
    if (!withdrawalConcept.trim()) {
      toast({ title: "Error", description: "El concepto es obligatorio", variant: "destructive" });
      return;
    }

    try {
      // Obtener los retiros seleccionados
      const selectedItems = fiscalWithdrawalsQuery.data?.filter(fw => 
        selectedWithdrawals.includes(fw.id) && fw.withdrawal_status === 'available'
      ) || [];

      if (selectedItems.length === 0) {
        toast({ title: "Error", description: "No hay items válidos para retirar", variant: "destructive" });
        return;
      }

      // Calcular el total a retirar
      const totalAmount = selectedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      // Crear el egreso fiscal por el total
      const { error: expenseError } = await supabase.from("expenses").insert({
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
      const { error: updateError } = await supabase
        .from("fiscal_withdrawals")
        .update({
          withdrawal_status: "withdrawn",
          withdrawn_by: (await supabase.auth.getUser()).data.user?.id,
          withdrawn_at: new Date().toISOString()
        })
        .in('id', selectedWithdrawals);

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
      toast({ title: "Error", description: e?.message || "No fue posible realizar el retiro", variant: "destructive" });
    }
  };

  const toggleWithdrawalSelection = (withdrawalId: string) => {
    setSelectedWithdrawals(prev => 
      prev.includes(withdrawalId) 
        ? prev.filter(id => id !== withdrawalId)
        : [...prev, withdrawalId]
    );
  };

  const selectAllWithdrawals = () => {
    const availableWithdrawals = fiscalWithdrawalsQuery.data?.filter(fw => fw.withdrawal_status === 'available' && fw.amount > 0) || [];
    if (selectedWithdrawals.length === availableWithdrawals.length) {
      setSelectedWithdrawals([]);
    } else {
      setSelectedWithdrawals(availableWithdrawals.map(fw => fw.id));
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

      <section className="mb-6">
        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <div>
            <label className="text-sm text-muted-foreground">Desde</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Hasta</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={setCurrentMonth} variant="outline" className="w-full">
              Mes Actual
            </Button>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-2">
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
                <div className="font-semibold text-orange-700 dark:text-orange-300">{totIF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Egresos</div>
                <div className="font-semibold text-orange-700 dark:text-orange-300">{totEF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Balance</div>
                <div className="font-semibold text-orange-700 dark:text-orange-300">{(totIF - totEF).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
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
                <div className="font-semibold text-blue-700 dark:text-blue-300">{totINF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Egresos</div>
                <div className="font-semibold text-blue-700 dark:text-blue-300">{totENF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Balance</div>
                <div className="font-semibold text-blue-700 dark:text-blue-300">{(totINF - totENF).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="incomes">
        <TabsList>
          <TabsTrigger value="incomes">Ingresos</TabsTrigger>
          <TabsTrigger value="expenses">Egresos</TabsTrigger>
          <TabsTrigger value="purchases">Compras</TabsTrigger>
          <TabsTrigger value="withdrawals">Retiros</TabsTrigger>
          <TabsTrigger value="recurring">Gastos Recurrentes</TabsTrigger>
          <TabsTrigger value="vat-management">Gestión IVA</TabsTrigger>
          <TabsTrigger value="collections">Cobranzas pendientes</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="incomes">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between bg-orange-50/50 dark:bg-orange-950/20">
                <CardTitle className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  Ingresos - Fiscal ({incomesFiscal.length}) · Total: {totIF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                </CardTitle>
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

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between bg-blue-50/50 dark:bg-blue-950/20">
                <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Ingresos - No Fiscal ({incomesNoFiscal.length}) · Total: {totINF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                </CardTitle>
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
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between bg-orange-50/50 dark:bg-orange-950/20">
                <CardTitle className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  Egresos - Fiscal ({expensesFiscal.length}) · Total: {totEF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                </CardTitle>
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

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between bg-blue-50/50 dark:bg-blue-950/20">
                <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Egresos - No Fiscal ({expensesNoFiscal.length}) · Total: {totENF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                </CardTitle>
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

        {/* Compras */}
        <TabsContent value="purchases" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Formulario de registro de compras */}
            <Card>
              <CardHeader>
                <CardTitle>Registrar Compra</CardTitle>
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
                        {suppliersQuery.data?.map(supplier => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.supplier_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowSupplierDialog(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Concepto*</label>
                  <Input
                    value={purchaseConcept}
                    onChange={(e) => setPurchaseConcept(e.target.value)}
                    placeholder="Descripción de la compra"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Monto*</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  {purchaseAccount === "fiscal" && purchaseAmount && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Base: ${(Number(purchaseAmount) / 1.16).toFixed(2)} | 
                      IVA (16%): ${(Number(purchaseAmount) - (Number(purchaseAmount) / 1.16)).toFixed(2)}
                    </div>
                  )}
                </div>
                
                {/* Nueva sección para factura */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="has-invoice"
                      checked={purchaseHasInvoice} 
                      onCheckedChange={(checked) => setPurchaseHasInvoice(checked === true)} 
                    />
                    <label htmlFor="has-invoice" className="text-sm font-medium">
                      Esta compra tiene factura
                    </label>
                  </div>
                  {purchaseHasInvoice && (
                    <div>
                      <label className="text-sm font-medium">Número de factura</label>
                      <Input 
                        value={purchaseInvoiceNumber} 
                        onChange={e => setPurchaseInvoiceNumber(e.target.value)} 
                        placeholder="Ingrese número de factura" 
                      />
                    </div>
                  )}
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
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
                <Button onClick={addPurchase} className="w-full">
                  Registrar Compra
                </Button>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCsv("compras", purchasesQuery.data?.map(r => ({
                  numero: r.purchase_number,
                  fecha: r.purchase_date,
                  proveedor: r.supplier_name,
                  concepto: r.concept,
                  monto: r.total_amount,
                  cuenta: r.account_type,
                  metodo: r.payment_method,
                  factura: r.has_invoice ? 'Sí' : 'No',
                  numero_factura: r.invoice_number || ''
                })) ?? [])}
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
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Método</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchasesQuery.data?.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell>{purchase.purchase_date}</TableCell>
                        <TableCell>{purchase.supplier_name}</TableCell>
                        <TableCell>{purchase.concept}</TableCell>
                        <TableCell>${Number(purchase.total_amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${purchase.account_type === 'fiscal' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                            {purchase.account_type === 'fiscal' ? 'Fiscal' : 'No Fiscal'}
                          </div>
                        </TableCell>
                        <TableCell>{purchase.payment_method || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {(!purchasesQuery.data || purchasesQuery.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No hay compras registradas
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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
              <div className="flex gap-4 text-sm mt-2">
                <span className="text-orange-600">
                  Pendientes: {fiscalWithdrawalsQuery.data?.filter(fw => fw.withdrawal_status === 'available' && fw.amount > 0).length || 0}
                </span>
                <span className="text-green-600">
                  Retirados: {fiscalWithdrawalsQuery.data?.filter(fw => fw.withdrawal_status === 'withdrawn' && fw.amount > 0).length || 0}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Monto a Retirar</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fiscalWithdrawalsQuery.data?.filter(fw => fw.amount > 0).map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell>{new Date(withdrawal.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="max-w-[300px] truncate" title={withdrawal.description}>
                          {withdrawal.description}
                        </TableCell>
                        <TableCell className="font-medium text-orange-600">
                          ${Number(withdrawal.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {withdrawal.withdrawal_status === 'available' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                              Pendiente
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                              Retirado
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {withdrawal.withdrawal_status === 'available' ? (
                            <Button
                              size="sm"
                              onClick={() => withdrawFiscalAmount(withdrawal.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Retirar
                            </Button>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              {withdrawal.withdrawn_at && (
                                <span>Retirado {new Date(withdrawal.withdrawn_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!fiscalWithdrawalsQuery.data?.filter(fw => fw.amount > 0).length) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-4xl">📋</div>
                            <div className="font-medium">No hay retiros fiscales registrados</div>
                            <div className="text-sm">Los retiros aparecerán aquí cuando se registren compras con factura</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
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
                  <Select value={feAccount} onValueChange={(v) => setFeAccount(v as any)}>
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
                {feAccount === 'fiscal' && feAmount && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-sm font-medium text-orange-800 mb-1">Cálculo automático de IVA (16%)</div>
                    <div className="text-xs text-orange-600 space-y-1">
                      <div>Base gravable: ${(Number(feAmount) / 1.16).toFixed(2)}</div>
                      <div>IVA (16%): ${(Number(feAmount) - (Number(feAmount) / 1.16)).toFixed(2)}</div>
                      <div className="font-medium">Total: ${Number(feAmount).toFixed(2)}</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={processWithdrawal} disabled={!feDesc || !feAmount || !feAccount}>
                    💰 Procesar Retiro
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {feAccount === 'fiscal' 
                    ? 'Para cuentas fiscales, el IVA se calcula automáticamente (16%). Ingresa el monto total con IVA incluido.'
                    : 'Este retiro se registrará como un egreso en la cuenta seleccionada con la fecha actual.'
                  }
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
                    <Select value={expAccount} onValueChange={(v) => setExpAccount(v as any)}>
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
                {expAccount === 'fiscal' && expAmount && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-sm font-medium text-orange-800 mb-1">Cálculo automático de IVA (16%)</div>
                    <div className="text-xs text-orange-600 space-y-1">
                      <div>Base gravable: ${(Number(expAmount) / 1.16).toFixed(2)}</div>
                      <div>IVA (16%): ${(Number(expAmount) - (Number(expAmount) / 1.16)).toFixed(2)}</div>
                      <div className="font-medium">Total: ${Number(expAmount).toFixed(2)}</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={addExpense} disabled={!expDesc || !expAmount || !expAccount || !expCategory}>
                    📝 Registrar Egreso
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {expAccount === 'fiscal' 
                    ? 'Para cuentas fiscales, el IVA se calcula automáticamente (16%). Ingresa el monto total con IVA incluido.'
                    : 'Este egreso se registrará sin IVA para cuenta no fiscal.'
                  }
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
                      {expensesQuery.isLoading && (
                        <TableRow><TableCell colSpan={5}>Cargando retiros...</TableCell></TableRow>
                      )}
                      {!expensesQuery.isLoading && 
                        (expensesQuery.data ?? [])
                          .filter((expense: any) => {
                            const expenseDate = new Date(expense.expense_date);
                            const thirtyDaysAgo = new Date();
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            return expenseDate >= thirtyDaysAgo && expense.category !== 'reverso';
                          })
                          .slice(0, 10)
                          .map((expense: any) => (
                            <TableRow key={expense.id}>
                              <TableCell>{new Date(expense.expense_date).toLocaleDateString()}</TableCell>
                              <TableCell className="max-w-48 truncate">{expense.description}</TableCell>
                              <TableCell className="font-medium text-red-600">
                                -${Number(expense.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                  expense.account_type === 'fiscal' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {expense.account_type === 'fiscal' ? 'Fiscal' : 'No Fiscal'}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{expense.payment_method || 'N/A'}</TableCell>
                            </TableRow>
                          ))
                      }
                      {!expensesQuery.isLoading && 
                        (expensesQuery.data ?? [])
                          .filter((expense: any) => {
                            const expenseDate = new Date(expense.expense_date);
                            const thirtyDaysAgo = new Date();
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            return expenseDate >= thirtyDaysAgo && expense.category !== 'reverso';
                          }).length === 0 && (
                        <TableRow><TableCell colSpan={5}>No hay retiros recientes.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recurring">
          {/* Summary Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Comparativa Mensual: Ingresos vs Gastos Fijos</CardTitle>
              <p className="text-sm text-muted-foreground">Análisis de flujo de efectivo fijo mensual proyectado</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-sm text-green-600 font-medium">Ingresos Fijos</div>
                  <div className="text-2xl font-bold text-green-700">
                    {monthlyFixedIncomes.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                  </div>
                  <div className="text-xs text-green-500 mt-1">
                    {(fixedIncomesQuery.data ?? []).filter((fi: any) => fi.active).length} conceptos activos
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-sm text-red-600 font-medium">Gastos Fijos</div>
                  <div className="text-2xl font-bold text-red-700">
                    {monthlyFixedExpenses.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                  </div>
                  <div className="text-xs text-red-500 mt-1">
                    {(fixedExpensesQuery.data ?? []).filter((fx: any) => fx.active).length} conceptos activos
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="text-sm text-orange-600 font-medium">Nóminas Recurrentes</div>
                  <div className="text-2xl font-bold text-orange-700">
                    {monthlyRecurringPayrolls.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                  </div>
                  <div className="text-xs text-orange-500 mt-1">
                    {(recurringPayrollsQuery.data ?? []).filter((pr: any) => pr.active).length} empleados activos
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg border ${netMonthlyFixedFlow >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                  <div className={`text-sm font-medium ${netMonthlyFixedFlow >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    Flujo Neto Mensual
                  </div>
                  <div className={`text-2xl font-bold ${netMonthlyFixedFlow >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {netMonthlyFixedFlow.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                  </div>
                  <div className={`text-xs mt-1 ${netMonthlyFixedFlow >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                    {netMonthlyFixedFlow >= 0 ? 'Superávit proyectado' : 'Déficit proyectado'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Gastos Fijos Recurrentes</CardTitle>
                <p className="text-sm text-muted-foreground">Configura gastos que se ejecutan automáticamente cada período</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Descripción</label>
                  <Input value={feDesc} onChange={e => setFeDesc(e.target.value)} placeholder="Ej. Renta, Luz, Internet, Seguro" />
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
                      <SelectItem value="no_fiscal">No Fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Método de pago</label>
                  <Input value={feMethod} onChange={e => setFeMethod(e.target.value)} placeholder="Transferencia, Efectivo, etc." />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Día del mes para ejecutar</label>
                  <Select value={feDayOfMonth.toString()} onValueChange={(v) => setFeDayOfMonth(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Día del mes" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <SelectItem key={day} value={day.toString()}>
                          Día {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={addFixedExpense}>📅 Programar Gasto</Button>
                  <Button variant="secondary" onClick={runFixedNow}>▶️ Ejecutar Ahora</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Los gastos se programan mensualmente. Puedes ejecutarlos manualmente o configurar automatización.
                </p>

                <div className="pt-4">
                  <div className="text-sm font-medium mb-2">Gastos Programados</div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Cuenta</TableHead>
                          <TableHead>Día del mes</TableHead>
                          <TableHead>Próxima ejecución</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fixedExpensesQuery.isLoading && (
                          <TableRow><TableCell colSpan={7}>Cargando...</TableCell></TableRow>
                        )}
                        {!fixedExpensesQuery.isLoading && (fixedExpensesQuery.data ?? []).map((fx: any) => (
                          <TableRow key={fx.id}>
                            <TableCell>{fx.description}</TableCell>
                            <TableCell>{Number(fx.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                fx.account_type === 'fiscal' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {fx.account_type === 'fiscal' ? 'Fiscal' : 'No Fiscal'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Día {fx.day_of_month || 1}
                              </span>
                            </TableCell>
                            <TableCell>{fx.next_run_date}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                fx.active 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {fx.active ? 'Activo' : 'Inactivo'}
                              </span>
                            </TableCell>
                             <TableCell>
                               <div className="flex items-center gap-2">
                                 <Button size="sm" variant="outline" onClick={() => toggleFixedActive(fx)}>
                                   {fx.active ? '⏸️' : '▶️'}
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
                                         <AlertDialogTitle>¿Eliminar gasto recurrente?</AlertDialogTitle>
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
                          <TableRow><TableCell colSpan={7}>Sin gastos fijos programados.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Nóminas Recurrentes</CardTitle>
                <p className="text-sm text-muted-foreground">Gestiona pagos de empleados de forma automática</p>
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
                        <SelectItem value="no_fiscal">No Fiscal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Método de pago</label>
                  <Input value={pMethod} onChange={e => setPMethod(e.target.value)} placeholder="Transferencia, Efectivo, etc." />
                </div>
                {pRecurring && (
                  <>
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
                    <div>
                      <label className="text-sm text-muted-foreground">Día del mes para ejecutar</label>
                      <Select value={pDayOfMonth.toString()} onValueChange={(v) => setPDayOfMonth(Number(v))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Día del mes" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <SelectItem key={day} value={day.toString()}>
                              Día {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox id="rec-pay" checked={pRecurring} onCheckedChange={(v) => setPRecurring(!!v)} />
                  <label htmlFor="rec-pay" className="text-sm">Programar como recurrente</label>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={pRecurring ? addRecurringPayroll : addPayroll}>
                    {pRecurring ? '📅 Programar Nómina' : '💰 Registrar Nómina'}
                  </Button>
                  <Button variant="secondary" onClick={runRecurringNow}>▶️ Ejecutar Recurrentes</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Si marcas recurrente, se programará para ejecución automática según la frecuencia seleccionada.
                </p>

                <div className="pt-4">
                  <div className="text-sm font-medium mb-2">Nóminas Programadas</div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empleado</TableHead>
                          <TableHead>Neto</TableHead>
                          <TableHead>Cuenta</TableHead>
                          <TableHead>Próxima ejecución</TableHead>
                          <TableHead>Estado</TableHead>
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
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                rp.account_type === 'fiscal' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {rp.account_type === 'fiscal' ? 'Fiscal' : 'No Fiscal'}
                              </span>
                            </TableCell>
                            <TableCell>{rp.next_run_date}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                rp.active 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {rp.active ? 'Activo' : 'Inactivo'}
                              </span>
                            </TableCell>
                             <TableCell>
                               <div className="flex items-center gap-2">
                                 <Button size="sm" variant="outline" onClick={() => toggleRecurringPayrollActive(rp)}>
                                   {rp.active ? '⏸️' : '▶️'}
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

            <Card>
              <CardHeader>
                <CardTitle>Ingresos Fijos Recurrentes</CardTitle>
                <p className="text-sm text-muted-foreground">Configura ingresos que se ejecutan automáticamente cada período</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Descripción</label>
                  <Input value={fiDesc} onChange={e => setFiDesc(e.target.value)} placeholder="Ej. Renta recibida, Dividendos, Intereses" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Monto</label>
                  <Input type="number" inputMode="decimal" value={fiAmount} onChange={e => setFiAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Cuenta</label>
                  <Select value={fiAccount} onValueChange={(v) => setFiAccount(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fiscal">Fiscal</SelectItem>
                      <SelectItem value="no_fiscal">No Fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Método de cobro</label>
                  <Input value={fiMethod} onChange={e => setFiMethod(e.target.value)} placeholder="Transferencia, Efectivo, etc." />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Día del mes para ejecutar</label>
                  <Select value={fiDayOfMonth.toString()} onValueChange={(v) => setFiDayOfMonth(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Día del mes" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <SelectItem key={day} value={day.toString()}>
                          Día {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={addFixedIncome}>📅 Programar Ingreso</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Los ingresos se programan mensualmente para un mejor control del flujo de efectivo.
                </p>

                <div className="pt-4">
                  <div className="text-sm font-medium mb-2">Ingresos Programados</div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Cuenta</TableHead>
                          <TableHead>Día del mes</TableHead>
                          <TableHead>Próx. Ejecut.</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(fixedIncomesQuery.data ?? []).map((fi: any) => (
                          <TableRow key={fi.id}>
                            <TableCell className="font-medium">{fi.description}</TableCell>
                            <TableCell>{Number(fi.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${fi.account_type === 'fiscal' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                {fi.account_type === 'fiscal' ? 'Fiscal' : 'No Fiscal'}
                              </span>
                            </TableCell>
                            <TableCell>Día {fi.day_of_month}</TableCell>
                            <TableCell>{new Date(fi.next_run_date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${fi.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {fi.active ? 'Activo' : 'Inactivo'}
                              </span>
                            </TableCell>
                             <TableCell>
                               <div className="flex items-center gap-2">
                                 {isAdmin && (
                                   <>
                                     <Button size="sm" variant="outline" onClick={() => toggleFixedIncomeActive(fi)}>
                                       {fi.active ? 'Desactivar' : 'Activar'}
                                     </Button>
                                     <AlertDialog>
                                       <AlertDialogTrigger asChild>
                                         <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                                           <X className="h-4 w-4" />
                                         </Button>
                                       </AlertDialogTrigger>
                                       <AlertDialogContent>
                                         <AlertDialogHeader>
                                           <AlertDialogTitle>¿Eliminar ingreso recurrente?</AlertDialogTitle>
                                           <AlertDialogDescription>
                                             Esta acción no se puede revertir. El ingreso fijo será eliminado permanentemente del sistema.
                                           </AlertDialogDescription>
                                         </AlertDialogHeader>
                                         <AlertDialogFooter>
                                           <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                           <AlertDialogAction onClick={() => deleteFixedIncome(fi.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                        {!fixedIncomesQuery.isLoading && (fixedIncomesQuery.data ?? []).length === 0 && (
                          <TableRow><TableCell colSpan={7}>Sin ingresos fijos programados.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
                <CardTitle>Resumen Cuenta Fiscal</CardTitle>
                <p className="text-sm text-muted-foreground">Totales de ingresos y egresos fiscales</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-sm text-green-600 font-medium">Ingresos Fiscales</div>
                      <div className="text-2xl font-bold text-green-700">
                        {totIF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                      </div>
                      <div className="text-xs text-green-600">{incomesFiscal.length} registros</div>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <div className="text-sm text-red-600 font-medium">Egresos Fiscales</div>
                      <div className="text-2xl font-bold text-red-700">
                        {totEF.toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                      </div>
                      <div className="text-xs text-red-600">{expensesFiscal.length} registros</div>
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-600 font-medium">Balance Fiscal</div>
                    <div className={`text-2xl font-bold ${(totIF - totEF) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {(totIF - totEF).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                    </div>
                    <div className="text-xs text-blue-600">
                      {(totIF - totEF) >= 0 ? 'Utilidad' : 'Pérdida'}
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
                <Button 
                  size="sm" 
                  onClick={() => exportCsv(`ingresos_fiscal_${startDate}_${endDate}`, incomesFiscal as any)}
                  disabled={!incomesFiscal.length}
                >
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
                      {incomesFiscal.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.income_number}</TableCell>
                          <TableCell>{r.income_date}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={r.description}>
                            {r.description}
                          </TableCell>
                          <TableCell className="font-mono">
                            {Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                          </TableCell>
                          <TableCell className="font-mono text-green-600">
                            {r.vat_amount ? Number(r.vat_amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' }) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {incomesFiscal.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No hay ingresos fiscales en el período seleccionado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Egresos Fiscales ({expensesFiscal.length})</CardTitle>
                <Button 
                  size="sm" 
                  onClick={() => exportCsv(`egresos_fiscal_${startDate}_${endDate}`, expensesFiscal as any)}
                  disabled={!expensesFiscal.length}
                >
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
                      {expensesFiscal.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.expense_number}</TableCell>
                          <TableCell>{r.expense_date}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={r.description}>
                            {r.description}
                          </TableCell>
                          <TableCell className="font-mono">
                            {Number(r.amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                          </TableCell>
                          <TableCell className="font-mono text-red-600">
                            {r.vat_amount ? Number(r.vat_amount).toLocaleString(undefined, { style: 'currency', currency: 'MXN' }) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {expensesFiscal.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No hay egresos fiscales en el período seleccionado
                          </TableCell>
                        </TableRow>
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
                       <TableHead>Subtotal</TableHead>
                       <TableHead>IVA</TableHead>
                       <TableHead>Total</TableHead>
                       <TableHead>Pagado</TableHead>
                       <TableHead>Saldo</TableHead>
                       <TableHead>Estado</TableHead>
                       <TableHead>Acciones</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {collectionsQuery.isLoading && (
                       <TableRow><TableCell colSpan={10}>Cargando cobranzas pendientes...</TableCell></TableRow>
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
                           {Number(order.subtotal_without_vat || 0).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                         </TableCell>
                         <TableCell className="text-blue-600 font-medium">
                           {Number(order.total_vat_amount || 0).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
                         </TableCell>
                         <TableCell className="font-medium">
                           {Number(order.total_with_vat || order.estimated_cost).toLocaleString(undefined, { style: 'currency', currency: 'MXN' })}
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
                         <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
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
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Nombre completo del proveedor"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Persona de contacto</label>
              <Input
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
                placeholder="Nombre del contacto"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={supplierEmail}
                  onChange={(e) => setSupplierEmail(e.target.value)}
                  placeholder="email@proveedor.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Teléfono</label>
                <Input
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="555-0123"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Dirección</label>
              <Input
                value={supplierAddress}
                onChange={(e) => setSupplierAddress(e.target.value)}
                placeholder="Dirección completa"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">RFC</label>
              <Input
                value={supplierRFC}
                onChange={(e) => setSupplierRFC(e.target.value)}
                placeholder="ABCD123456789"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowSupplierDialog(false);
              setEditingSupplier(null);
              setSupplierName(""); setSupplierContact(""); setSupplierEmail("");
              setSupplierPhone(""); setSupplierAddress(""); setSupplierRFC("");
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
              {fiscalWithdrawalsQuery.data && (
                <>
                  {' '}por un total de ${fiscalWithdrawalsQuery.data
                    .filter(fw => selectedWithdrawals.includes(fw.id))
                    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
                    .toLocaleString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="withdrawal-concept">Concepto *</Label>
              <Input
                id="withdrawal-concept"
                value={withdrawalConcept}
                onChange={(e) => setWithdrawalConcept(e.target.value)}
                placeholder="Ej: Retiro facturas periodo diciembre 2024"
              />
            </div>
            
            <div>
              <Label htmlFor="withdrawal-description">Descripción adicional</Label>
              <Textarea
                id="withdrawal-description"
                value={withdrawalDescription}
                onChange={(e) => setWithdrawalDescription(e.target.value)}
                placeholder="Información adicional sobre el retiro (opcional)"
                rows={3}
              />
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
    </AppLayout>
  );
}
