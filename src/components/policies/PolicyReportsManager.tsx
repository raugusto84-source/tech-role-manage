import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, TrendingUp, DollarSign, Calendar, Users } from "lucide-react";

interface PolicyExpense {
  id: string;
  expense_month: number;
  expense_year: number;
  service_cost: number;
  product_cost: number;
  total_cost: number;
  policy_clients: {
    clients: {
      name: string;
      email: string;
    };
    insurance_policies: {
      policy_name: string;
      policy_number: string;
      monthly_fee: number;
    };
  };
}

interface MonthlyReport {
  month: number;
  year: number;
  client_name: string;
  policy_name: string;
  monthly_fee: number;
  services_cost: number;
  products_cost: number;
  total_expenses: number;
  payment_status: string;
}

export function PolicyReportsManager() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<PolicyExpense[]>([]);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState({
    total_clients: 0,
    total_services: 0,
    total_products: 0,
    total_revenue: 0,
  });

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load policy expenses for selected month/year
      const { data: expensesData, error: expensesError } = await supabase
        .from('policy_order_expenses')
        .select(`
          *,
          policy_clients(
            clients(name, email),
            insurance_policies(policy_name, policy_number, monthly_fee)
          )
        `)
        .eq('expense_month', selectedMonth)
        .eq('expense_year', selectedYear)
        .order('created_at', { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);

      // Load payment status for the period
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('policy_payments')
        .select(`
          policy_client_id,
          payment_status,
          is_paid,
          policy_clients(
            clients(name, email),
            insurance_policies(policy_name, policy_number, monthly_fee)
          )
        `)
        .eq('payment_month', selectedMonth)
        .eq('payment_year', selectedYear);

      if (paymentsError) throw paymentsError;

      // Combine expenses with payment status
      const combinedReports: MonthlyReport[] = [];
      const clientExpenseMap = new Map();

      // Group expenses by client
      expensesData?.forEach(expense => {
        const clientId = expense.policy_clients.clients.name;
        if (!clientExpenseMap.has(clientId)) {
          clientExpenseMap.set(clientId, {
            client_name: expense.policy_clients.clients.name,
            policy_name: expense.policy_clients.insurance_policies.policy_name,
            monthly_fee: expense.policy_clients.insurance_policies.monthly_fee,
            services_cost: 0,
            products_cost: 0,
            total_expenses: 0,
            payment_status: 'sin_pago',
          });
        }
        
        const clientData = clientExpenseMap.get(clientId);
        clientData.services_cost += expense.service_cost;
        clientData.products_cost += expense.product_cost;
        clientData.total_expenses += expense.total_cost;
      });

      // Add payment status
      paymentsData?.forEach(payment => {
        const clientId = payment.policy_clients.clients.name;
        if (clientExpenseMap.has(clientId)) {
          const clientData = clientExpenseMap.get(clientId);
          clientData.payment_status = payment.is_paid ? 'pagado' : payment.payment_status;
        } else {
          // Client with payment but no expenses this month
          clientExpenseMap.set(clientId, {
            client_name: payment.policy_clients.clients.name,
            policy_name: payment.policy_clients.insurance_policies.policy_name,
            monthly_fee: payment.policy_clients.insurance_policies.monthly_fee,
            services_cost: 0,
            products_cost: 0,
            total_expenses: 0,
            payment_status: payment.is_paid ? 'pagado' : payment.payment_status,
          });
        }
      });

      // Convert map to array and add month/year
      const reportsArray = Array.from(clientExpenseMap.values()).map(report => ({
        ...report,
        month: selectedMonth,
        year: selectedYear,
      }));

      setReports(reportsArray);

      // Calculate stats
      const totalServices = reportsArray.reduce((sum, r) => sum + r.services_cost, 0);
      const totalProducts = reportsArray.reduce((sum, r) => sum + r.products_cost, 0);
      const totalRevenue = reportsArray.reduce((sum, r) => sum + r.monthly_fee, 0);

      setStats({
        total_clients: reportsArray.length,
        total_services: totalServices,
        total_products: totalProducts,
        total_revenue: totalRevenue,
      });

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los reportes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Cliente',
      'Póliza',
      'Cuota Mensual',
      'Servicios Utilizados',
      'Productos Comprados',
      'Total Gastos',
      'Estado de Pago'
    ];

    const csvContent = [
      headers.join(','),
      ...reports.map(report => [
        report.client_name,
        report.policy_name,
        report.monthly_fee,
        report.services_cost,
        report.products_cost,
        report.total_expenses,
        report.payment_status === 'pagado' ? 'Pagado' : report.payment_status === 'pendiente' ? 'Pendiente' : 'Vencido'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_polizas_${selectedMonth}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Éxito",
      description: "Reporte exportado correctamente",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'pagado':
        return <Badge variant="default">Pagado</Badge>;
      case 'pendiente':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'vencido':
        return <Badge variant="destructive">Vencido</Badge>;
      default:
        return <Badge variant="outline">Sin Pago</Badge>;
    }
  };

  if (loading) {
    return <div>Cargando reportes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Reportes de Pólizas</h2>
          <p className="text-muted-foreground">
            Reportes mensuales de gastos y utilización por cliente
          </p>
        </div>
        
        <Button onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Period Selection */}
      <div className="flex space-x-4">
        <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month, index) => (
              <SelectItem key={index + 1} value={(index + 1).toString()}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_clients}</div>
            <p className="text-xs text-muted-foreground">
              Con actividad en {months[selectedMonth - 1]}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Utilizados</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_services)}</div>
            <p className="text-xs text-muted-foreground">Costo total de servicios</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Vendidos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_products)}</div>
            <p className="text-xs text-muted-foreground">Valor de productos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos por Cuotas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_revenue)}</div>
            <p className="text-xs text-muted-foreground">Cuotas mensuales</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reporte Mensual - {months[selectedMonth - 1]} {selectedYear}</CardTitle>
          <CardDescription>
            Detalle de gastos y utilización por cliente con póliza
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay datos para el período seleccionado.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Cuota Mensual</TableHead>
                  <TableHead>Servicios</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Total Gastos</TableHead>
                  <TableHead>Estado Pago</TableHead>
                  <TableHead>Ahorro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report, index) => {
                  const totalSavings = report.services_cost; // Services are free/discounted for policy clients
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="font-medium">{report.client_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{report.policy_name}</div>
                      </TableCell>
                      <TableCell>{formatCurrency(report.monthly_fee)}</TableCell>
                      <TableCell>
                        <div className="text-green-600">
                          {formatCurrency(report.services_cost)}
                        </div>
                        <div className="text-xs text-muted-foreground">Gratuito/Descuento</div>
                      </TableCell>
                      <TableCell>{formatCurrency(report.products_cost)}</TableCell>
                      <TableCell>{formatCurrency(report.total_expenses)}</TableCell>
                      <TableCell>{getPaymentStatusBadge(report.payment_status)}</TableCell>
                      <TableCell>
                        <div className="text-green-600 font-medium">
                          {formatCurrency(totalSavings)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Summary Row */}
                <TableRow className="font-medium bg-muted/50">
                  <TableCell colSpan={2}>TOTALES</TableCell>
                  <TableCell>{formatCurrency(stats.total_revenue)}</TableCell>
                  <TableCell className="text-green-600">{formatCurrency(stats.total_services)}</TableCell>
                  <TableCell>{formatCurrency(stats.total_products)}</TableCell>
                  <TableCell>{formatCurrency(stats.total_services + stats.total_products)}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell className="text-green-600">{formatCurrency(stats.total_services)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}