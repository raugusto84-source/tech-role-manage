import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Shield, DollarSign, Calendar, AlertTriangle } from 'lucide-react';

interface PolicyData {
  activePolicies: number;
  totalPolicyValue: number;
  upcomingPayments: number;
  expiringSoon: number;
  monthlyRecurring: number;
}

interface PolicyMetricsProps {
  compact?: boolean;
}

export function PolicyMetrics({ compact = false }: PolicyMetricsProps) {
  const [data, setData] = useState<PolicyData>({
    activePolicies: 0,
    totalPolicyValue: 0,
    upcomingPayments: 0,
    expiringSoon: 0,
    monthlyRecurring: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPolicyData();
  }, []);

  const loadPolicyData = async () => {
    try {
      // Mock data for policies since tables don't exist yet
      const policies = [
        { id: '1', policy_value: 50000, end_date: '2024-12-31' },
        { id: '2', policy_value: 75000, end_date: '2025-03-15' },
        { id: '3', policy_value: 100000, end_date: '2025-06-30' }
      ];

      const payments = [
        { id: '1', amount: 5000 },
        { id: '2', amount: 7500 },
        { id: '3', amount: 10000 }
      ];

      // Calculate metrics
      const twoMonthsFromNow = new Date();
      twoMonthsFromNow.setDate(twoMonthsFromNow.getDate() + 60);

      const expiringPolicies = policies.filter(p => 
        new Date(p.end_date) <= twoMonthsFromNow
      ).length;

      const activePolicies = policies.length;
      const totalPolicyValue = policies.reduce((sum, policy) => sum + policy.policy_value, 0);
      const upcomingPayments = payments.length;
      const monthlyRecurring = payments.reduce((sum, payment) => sum + payment.amount, 0);

      setData({
        activePolicies,
        totalPolicyValue,
        upcomingPayments,
        expiringSoon: expiringPolicies,
        monthlyRecurring
      });
    } catch (error) {
      console.error('Error loading policy data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pólizas</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.activePolicies}</div>
          <p className="text-xs text-muted-foreground">
            Pólizas activas
          </p>
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              {data.upcomingPayments} pagos próximos
            </Badge>
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
            <CardTitle className="text-sm font-medium">Pólizas Activas</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{data.activePolicies}</div>
            <p className="text-xs text-muted-foreground">
              En vigencia
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${data.totalPolicyValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Valor asegurado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Próximos</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{data.upcomingPayments}</div>
            <p className="text-xs text-muted-foreground">
              Próximos 30 días
            </p>
            <div className="mt-1">
              <p className="text-xs font-medium">${data.monthlyRecurring.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.expiringSoon}</div>
            <p className="text-xs text-muted-foreground">
              Próximos 60 días
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos Recurrentes</CardTitle>
            <CardDescription>Pagos programados por pólizas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">${data.monthlyRecurring.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {data.upcomingPayments} pagos pendientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de Pólizas</CardTitle>
            <CardDescription>Resumen del portafolio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Activas:</span>
                <Badge variant="default">{data.activePolicies}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Por vencer:</span>
                <Badge variant="destructive">{data.expiringSoon}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Valor promedio:</span>
                <Badge variant="outline">
                  ${data.activePolicies > 0 ? (data.totalPolicyValue / data.activePolicies).toLocaleString() : '0'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}