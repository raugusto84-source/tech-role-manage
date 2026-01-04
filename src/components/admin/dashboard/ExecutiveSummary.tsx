import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  Wrench, Shield, DollarSign, TrendingUp, TrendingDown, 
  Clock, AlertTriangle, Wallet, Building, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FleetSummary {
  name: string;
  category: 'sistemas' | 'seguridad';
  activeOrders: number;
  pendingOrders: number;
  technicianName: string;
}

interface FinancialSummary {
  pendingPayments: number; // Pagos pendientes de pólizas
  overduePayments: number; // Pagos vencidos
  pendingCollections: number; // Cobros pendientes de órdenes
  pendingCollectionsCount: number;
  availableForWithdrawal: number; // Disponible para retiros
  monthlyExpenses: number; // Gastos del mes
  monthlyIncomes: number; // Ingresos del mes
  fixedExpenses: number; // Gastos fijos mensuales
  fixedIncomes: number; // Ingresos fijos (pólizas)
  activePolicies: number;
  pendingPayrolls: number;
  developmentPayments: number; // Pagos pendientes de fraccionamientos
}

interface SystemStatus {
  isOperational: boolean;
  lastUpdate: Date;
  activeAlerts: number;
}

export function ExecutiveSummary() {
  const [fleets, setFleets] = useState<FleetSummary[]>([]);
  const [financial, setFinancial] = useState<FinancialSummary>({
    pendingPayments: 0,
    overduePayments: 0,
    pendingCollections: 0,
    pendingCollectionsCount: 0,
    availableForWithdrawal: 0,
    monthlyExpenses: 0,
    monthlyIncomes: 0,
    fixedExpenses: 0,
    fixedIncomes: 0,
    activePolicies: 0,
    pendingPayrolls: 0,
    developmentPayments: 0
  });
  const [status, setStatus] = useState<SystemStatus>({
    isOperational: true,
    lastUpdate: new Date(),
    activeAlerts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
    // Actualizar cada 5 minutos
    const interval = setInterval(loadAllData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadFleetData(),
      loadFinancialData()
    ]);
    setStatus(prev => ({ ...prev, lastUpdate: new Date() }));
    setLoading(false);
  };

  const loadFleetData = async () => {
    try {
      // Obtener técnicos asignados a flotillas
      const { data: fleetTechnicians } = await supabase
        .from('fleet_group_technicians')
        .select(`
          fleet_group_id,
          technician_id,
          fleet_groups!inner(id, name, category),
          profiles!fleet_group_technicians_technician_id_fkey(full_name)
        `)
        .eq('is_active', true);

      // Obtener órdenes activas
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, service_category, assigned_fleet, assigned_technician')
        .is('deleted_at', null)
        .not('status', 'in', '("finalizada","cancelada","rechazada")');

      // Agrupar por categoría de servicio (sistemas / seguridad)
      const sistemasOrders = orders?.filter(o => o.service_category === 'sistemas') || [];
      const seguridadOrders = orders?.filter(o => o.service_category === 'seguridad') || [];

      // Buscar técnicos por categoría
      const sistemasTech = fleetTechnicians?.find(ft => {
        const group = ft.fleet_groups as any;
        return group?.category === 'sistemas';
      });
      const seguridadTech = fleetTechnicians?.find(ft => {
        const group = ft.fleet_groups as any;
        return group?.category === 'seguridad';
      });

      // Si no hay flotillas configuradas, obtener técnicos directamente
      let sistemasName = 'Sin asignar';
      let seguridadName = 'Sin asignar';

      if (sistemasTech) {
        sistemasName = (sistemasTech.profiles as any)?.full_name || 'Sin asignar';
      }
      if (seguridadTech) {
        seguridadName = (seguridadTech.profiles as any)?.full_name || 'Sin asignar';
      }

      // Si no hay técnicos en flotillas, buscar por rol
      if (!sistemasTech || !seguridadTech) {
        const { data: technicians } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .eq('role', 'tecnico');

        if (technicians && technicians.length > 0) {
          if (!sistemasTech && technicians[0]) {
            sistemasName = technicians[0].full_name;
          }
          if (!seguridadTech && technicians[1]) {
            seguridadName = technicians[1]?.full_name || sistemasName;
          } else if (!seguridadTech) {
            seguridadName = sistemasName;
          }
        }
      }

      setFleets([
        {
          name: 'Flotilla Sistemas',
          category: 'sistemas',
          activeOrders: sistemasOrders.filter(o => o.status === 'en_proceso' || o.status === 'en_camino').length,
          pendingOrders: sistemasOrders.filter(o => o.status === 'pendiente').length,
          technicianName: sistemasName
        },
        {
          name: 'Flotilla Seguridad',
          category: 'seguridad',
          activeOrders: seguridadOrders.filter(o => o.status === 'en_proceso' || o.status === 'en_camino').length,
          pendingOrders: seguridadOrders.filter(o => o.status === 'pendiente').length,
          technicianName: seguridadName
        }
      ]);
    } catch (error) {
      console.error('Error loading fleet data:', error);
    }
  };

  const loadFinancialData = async () => {
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      // Ejecutar todas las consultas en paralelo
      const [
        policyPaymentsResult,
        pendingCollectionsResult,
        monthlyIncomesResult,
        monthlyExpensesResult,
        fixedExpensesResult,
        policiesResult,
        payrollsResult,
        developmentPaymentsResult,
        availableForWithdrawalResult
      ] = await Promise.all([
        // Pagos pendientes de pólizas
        supabase
          .from('policy_payments')
          .select('amount, due_date, is_paid')
          .eq('is_paid', false),
        
        // Cobros pendientes de órdenes
        supabase
          .from('orders')
          .select('id, approved_total')
          .eq('status', 'finalizada')
          .eq('skip_payment', false)
          .is('deleted_at', null)
          .gt('approved_total', 0),
        
        // Ingresos del mes
        supabase
          .from('incomes')
          .select('amount, account_type')
          .gte('income_date', startOfMonth)
          .is('deleted_at', null)
          .eq('is_reversed', false),
        
        // Gastos del mes
        supabase
          .from('expenses')
          .select('amount, account_type')
          .gte('expense_date', startOfMonth)
          .is('deleted_at', null)
          .eq('is_reversed', false),
        
        // Gastos fijos mensuales
        supabase
          .from('fixed_expenses')
          .select('amount')
          .eq('active', true),
        
        // Pólizas activas (ingresos fijos)
        supabase
          .from('policies')
          .select('monthly_cost')
          .eq('status', 'active'),
        
        // Nóminas pendientes
        supabase
          .from('employee_payments')
          .select('amount')
          .eq('status', 'pendiente'),
        
        // Pagos pendientes de fraccionamientos
        supabase
          .from('access_development_payments')
          .select('amount')
          .eq('status', 'pending'),
        
        // Disponible para retiro (ingresos fiscales no retirados)
        supabase
          .from('incomes')
          .select('taxable_amount, vat_amount, isr_withholding_amount')
          .eq('account_type', 'fiscal')
          .eq('status', 'recibido')
          .neq('category', 'referencia')
          .eq('is_reversed', false)
          .is('deleted_at', null)
      ]);

      // Verificar órdenes que ya tienen pagos
      const ordersWithPayments = pendingCollectionsResult.data?.length ? 
        await supabase
          .from('order_payments')
          .select('order_id')
          .in('order_id', pendingCollectionsResult.data.map(o => o.id)) : { data: [] };

      const paidOrderIds = new Set(ordersWithPayments.data?.map(p => p.order_id) || []);
      const unpaidOrders = pendingCollectionsResult.data?.filter(o => !paidOrderIds.has(o.id)) || [];

      // Calcular totales
      const policyPayments = policyPaymentsResult.data || [];
      const pendingPayments = policyPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const overduePayments = policyPayments
        .filter(p => p.due_date && new Date(p.due_date) < new Date(today))
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const pendingCollections = unpaidOrders.reduce((sum, o) => sum + (o.approved_total || 0), 0);
      const monthlyIncomes = (monthlyIncomesResult.data || []).reduce((sum, i) => sum + (i.amount || 0), 0);
      const monthlyExpenses = (monthlyExpensesResult.data || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      const fixedExpenses = (fixedExpensesResult.data || []).reduce((sum, f) => sum + (f.amount || 0), 0);
      const fixedIncomes = (policiesResult.data || []).reduce((sum, p) => sum + (p.monthly_cost || 0), 0);
      const pendingPayrolls = (payrollsResult.data || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const developmentPayments = (developmentPaymentsResult.data || []).reduce((sum, d) => sum + (d.amount || 0), 0);

      // Calcular disponible para retiro
      const incomeData = availableForWithdrawalResult.data || [];
      const totalTaxable = incomeData.reduce((sum, i) => sum + (i.taxable_amount || 0), 0);
      const totalVat = incomeData.reduce((sum, i) => sum + (i.vat_amount || 0), 0);
      const totalIsr = incomeData.reduce((sum, i) => sum + (i.isr_withholding_amount || 0), 0);
      // Disponible = base gravable - IVA que hay que pagar - ISR retenido
      const availableForWithdrawal = totalTaxable - totalVat - totalIsr;

      // Contar alertas
      let alerts = 0;
      if (overduePayments > 0) alerts++;
      if (unpaidOrders.length > 5) alerts++;
      if (pendingPayrolls > 0) alerts++;

      setFinancial({
        pendingPayments,
        overduePayments,
        pendingCollections,
        pendingCollectionsCount: unpaidOrders.length,
        availableForWithdrawal: Math.max(0, availableForWithdrawal),
        monthlyExpenses,
        monthlyIncomes,
        fixedExpenses,
        fixedIncomes,
        activePolicies: policiesResult.data?.length || 0,
        pendingPayrolls,
        developmentPayments
      });

      setStatus(prev => ({ ...prev, activeAlerts: alerts }));
    } catch (error) {
      console.error('Error loading financial data:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calcular punto de equilibrio
  const breakEvenBalance = financial.fixedIncomes - financial.fixedExpenses;
  const breakEvenPercentage = financial.fixedExpenses > 0 
    ? (financial.fixedIncomes / financial.fixedExpenses) * 100 
    : 100;
  const isBreakEvenPositive = breakEvenBalance >= 0;

  // Balance del mes
  const monthlyBalance = financial.monthlyIncomes - financial.monthlyExpenses;

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con estado del sistema */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status.isOperational ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
          <span className="text-sm text-muted-foreground">
            Sistema operativo • Última actualización: {status.lastUpdate.toLocaleTimeString()}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Alertas activas */}
      {status.activeAlerts > 0 && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span className="text-orange-800 dark:text-orange-200">
              {status.activeAlerts} {status.activeAlerts === 1 ? 'alerta activa' : 'alertas activas'} requieren atención
            </span>
          </CardContent>
        </Card>
      )}

      {/* Resumen de flotillas (2 técnicos por departamento) */}
      <div className="grid gap-4 md:grid-cols-2">
        {fleets.map((fleet) => (
          <Card key={fleet.category} className={fleet.category === 'sistemas' ? 'border-blue-200' : 'border-green-200'}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {fleet.category === 'sistemas' ? (
                  <Wrench className="h-5 w-5 text-blue-600" />
                ) : (
                  <Shield className="h-5 w-5 text-green-600" />
                )}
                {fleet.name}
              </CardTitle>
              <CardDescription>Técnico: {fleet.technicianName}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-2xl font-bold">{fleet.activeOrders}</p>
                  <p className="text-xs text-muted-foreground">Órdenes activas</p>
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-orange-600">{fleet.pendingOrders}</p>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resumen financiero */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Cobros pendientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobros Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(financial.pendingCollections)}</div>
            <p className="text-xs text-muted-foreground">
              {financial.pendingCollectionsCount} órdenes por cobrar
            </p>
          </CardContent>
        </Card>

        {/* Pagos pendientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(financial.pendingPayments)}</div>
            <p className="text-xs text-muted-foreground">
              {financial.overduePayments > 0 && (
                <span className="text-red-500">{formatCurrency(financial.overduePayments)} vencidos</span>
              )}
              {financial.overduePayments === 0 && 'Pólizas'}
            </p>
          </CardContent>
        </Card>

        {/* Disponible para retiro */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponible Retiro</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(financial.availableForWithdrawal)}</div>
            <p className="text-xs text-muted-foreground">
              Fiscal neto disponible
            </p>
          </CardContent>
        </Card>

        {/* Gastos del mes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos del Mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financial.monthlyExpenses)}</div>
            <p className="text-xs text-muted-foreground">
              Ingresos: {formatCurrency(financial.monthlyIncomes)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Punto de equilibrio: Gastos Fijos vs Ingresos Fijos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Punto de Equilibrio Mensual
          </CardTitle>
          <CardDescription>
            Gastos fijos vs Ingresos recurrentes (pólizas)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Gastos Fijos */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Gastos Fijos</span>
                <Badge variant="destructive">{formatCurrency(financial.fixedExpenses)}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                + Nóminas pendientes: {formatCurrency(financial.pendingPayrolls)}
              </div>
            </div>

            {/* Ingresos Fijos */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Ingresos Fijos</span>
                <Badge variant="default" className="bg-green-600">{formatCurrency(financial.fixedIncomes)}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {financial.activePolicies} pólizas activas
              </div>
            </div>

            {/* Balance */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Balance Base</span>
                <Badge 
                  variant={isBreakEvenPositive ? "default" : "destructive"}
                  className={isBreakEvenPositive ? "bg-green-600" : ""}
                >
                  {isBreakEvenPositive ? '+' : ''}{formatCurrency(breakEvenBalance)}
                </Badge>
              </div>
              <Progress 
                value={Math.min(breakEvenPercentage, 100)} 
                className={`h-2 ${isBreakEvenPositive ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500'}`}
              />
              <div className="flex items-center gap-2 text-xs">
                {isBreakEvenPositive ? (
                  <>
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">Cobertura: {breakEvenPercentage.toFixed(0)}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3 text-red-600" />
                    <span className="text-red-600">Déficit de cobertura</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Resumen del mes */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="font-medium">Balance del Mes Actual</span>
              <div className="flex items-center gap-2">
                {monthlyBalance >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-xl font-bold ${monthlyBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {monthlyBalance >= 0 ? '+' : ''}{formatCurrency(monthlyBalance)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fraccionamientos si hay datos */}
      {financial.developmentPayments > 0 && (
        <Card className="border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building className="h-5 w-5 text-purple-600" />
              Fraccionamientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(financial.developmentPayments)}</div>
            <p className="text-xs text-muted-foreground">Pagos pendientes</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
