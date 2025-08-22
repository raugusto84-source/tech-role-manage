import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, TrendingDown, Target, Clock } from 'lucide-react';

interface FinanceData {
  totalIncome: number;
  totalExpenses: number;
  fiscalIncome: number;
  nonFiscalIncome: number;
  fiscalExpenses: number;
  nonFiscalExpenses: number;
  weeklyTarget: number;
  monthlyTarget: number;
  weeklyProgress: number;
  monthlyProgress: number;
  pendingCollection: number;
}

interface FinanceMetricsProps {
  compact?: boolean;
}

export function FinanceMetrics({ compact = false }: FinanceMetricsProps) {
  const [data, setData] = useState<FinanceData>({
    totalIncome: 0,
    totalExpenses: 0,
    fiscalIncome: 0,
    nonFiscalIncome: 0,
    fiscalExpenses: 0,
    nonFiscalExpenses: 0,
    weeklyTarget: 50000,
    monthlyTarget: 200000,
    weeklyProgress: 0,
    monthlyProgress: 0,
    pendingCollection: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinanceData();
  }, []);

  const loadFinanceData = async () => {
    try {
      const currentDate = new Date();
      const startOfWeek = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay()));
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      // Get income data
      const { data: incomes } = await supabase
        .from('incomes')
        .select('amount, account_type, income_date')
        .gte('income_date', startOfMonth.toISOString().split('T')[0]);

      // Get expense data
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, account_type, expense_date')
        .gte('expense_date', startOfMonth.toISOString().split('T')[0]);

      // Get pending collections (finalized orders)
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('estimated_cost')
        .eq('status', 'finalizada');

      const totalIncome = incomes?.reduce((sum, income) => sum + income.amount, 0) || 0;
      const totalExpenses = expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;
      const fiscalIncome = incomes?.filter(i => i.account_type === 'fiscal').reduce((sum, income) => sum + income.amount, 0) || 0;
      const nonFiscalIncome = incomes?.filter(i => i.account_type === 'no_fiscal').reduce((sum, income) => sum + income.amount, 0) || 0;
      const fiscalExpenses = expenses?.filter(e => e.account_type === 'fiscal').reduce((sum, expense) => sum + expense.amount, 0) || 0;
      const nonFiscalExpenses = expenses?.filter(e => e.account_type === 'no_fiscal').reduce((sum, expense) => sum + expense.amount, 0) || 0;

      // Calculate weekly income
      const weeklyIncome = incomes?.filter(i => new Date(i.income_date) >= startOfWeek).reduce((sum, income) => sum + income.amount, 0) || 0;
      
      const pendingCollection = pendingOrders?.reduce((sum, order) => sum + order.estimated_cost, 0) || 0;

      setData({
        totalIncome,
        totalExpenses,
        fiscalIncome,
        nonFiscalIncome,
        fiscalExpenses,
        nonFiscalExpenses,
        weeklyTarget: 50000,
        monthlyTarget: 200000,
        weeklyProgress: (weeklyIncome / 50000) * 100,
        monthlyProgress: (totalIncome / 200000) * 100,
        pendingCollection
      });
    } catch (error) {
      console.error('Error loading finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Finanzas</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${data.totalIncome.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Ingresos del mes
          </p>
          <div className="mt-2">
            <Progress value={data.monthlyProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {data.monthlyProgress.toFixed(1)}% de la meta mensual
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${data.totalIncome.toLocaleString()}</div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Fiscal:</span>
                <Badge variant="outline">${data.fiscalIncome.toLocaleString()}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>No Fiscal:</span>
                <Badge variant="secondary">${data.nonFiscalIncome.toLocaleString()}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egresos Totales</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${data.totalExpenses.toLocaleString()}</div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Fiscal:</span>
                <Badge variant="outline">${data.fiscalExpenses.toLocaleString()}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>No Fiscal:</span>
                <Badge variant="secondary">${data.nonFiscalExpenses.toLocaleString()}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meta Semanal</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.weeklyProgress.toFixed(1)}%</div>
            <Progress value={data.weeklyProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              ${(data.weeklyTarget * data.weeklyProgress / 100).toLocaleString()} de ${data.weeklyTarget.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meta Mensual</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.monthlyProgress.toFixed(1)}%</div>
            <Progress value={data.monthlyProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              ${data.totalIncome.toLocaleString()} de ${data.monthlyTarget.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendientes de Cobrar</CardTitle>
          <Clock className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">${data.pendingCollection.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Órdenes finalizadas sin cobrar
          </p>
        </CardContent>
      </Card>
    </div>
  );
}