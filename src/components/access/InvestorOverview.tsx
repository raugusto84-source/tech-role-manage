import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AccessDevelopment } from './AccessDevelopmentsManager';
import { Users, TrendingUp, DollarSign, Clock } from 'lucide-react';

interface InvestorLoan {
  id: string;
  development_id: string;
  investor_name: string;
  amount: number;
  profit_percent: number;
  recovery_months: number;
  amount_recovered: number;
  amount_earned: number;
  status: string;
}

interface Props {
  developments: AccessDevelopment[];
}

export function InvestorOverview({ developments }: Props) {
  const [loans, setLoans] = useState<InvestorLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('access_investor_loans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (error) {
      console.error('Error loading loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDevelopment = (id: string) => {
    return developments.find(d => d.id === id);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'secondary',
      recovered: 'default',
      earning: 'outline',
      completed: 'outline'
    };
    const labels: Record<string, string> = {
      active: 'Recuperando',
      recovered: 'Capital Recuperado',
      earning: 'Generando Ganancias',
      completed: 'Completado'
    };
    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
  };

  const totals = {
    invested: loans.reduce((s, l) => s + l.amount, 0),
    recovered: loans.reduce((s, l) => s + l.amount_recovered, 0),
    earned: loans.reduce((s, l) => s + l.amount_earned, 0),
    pending: loans.reduce((s, l) => s + Math.max(0, l.amount - l.amount_recovered), 0)
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  if (developments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No hay inversionistas</h3>
          <p className="text-muted-foreground">Los fraccionamientos con inversionistas aparecerán aquí</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invertido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totals.invested.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capital Recuperado</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totals.recovered.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.invested > 0 ? Math.round((totals.recovered / totals.invested) * 100) : 0}% del total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganancias Pagadas</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${totals.earned.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente por Recuperar</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${totals.pending.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Investor Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {loans.map(loan => {
          const dev = getDevelopment(loan.development_id);
          const recoveryProgress = loan.amount > 0 ? (loan.amount_recovered / loan.amount) * 100 : 0;
          const remainingMonths = Math.max(0, loan.recovery_months - Math.floor(loan.amount_recovered / (dev?.monthly_payment || 1)));

          return (
            <Card key={loan.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{loan.investor_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{dev?.name || 'Fraccionamiento'}</p>
                  </div>
                  {getStatusBadge(loan.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Inversión</p>
                    <p className="font-semibold">${loan.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recuperado</p>
                    <p className="font-semibold text-green-600">
                      ${loan.amount_recovered.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">% Ganancia Post-Recuperación</p>
                    <p className="font-semibold">{loan.profit_percent}% mensual</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ganancias Pagadas</p>
                    <p className="font-semibold text-blue-600">
                      ${loan.amount_earned.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progreso de Recuperación</span>
                    <span>{Math.min(100, Math.round(recoveryProgress))}%</span>
                  </div>
                  <Progress value={Math.min(100, recoveryProgress)} className="h-2" />
                  {loan.status === 'active' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ~{remainingMonths} meses restantes para recuperar inversión
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
