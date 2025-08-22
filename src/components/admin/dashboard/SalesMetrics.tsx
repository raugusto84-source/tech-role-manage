import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Clock, CheckCircle, XCircle } from 'lucide-react';

interface SalesData {
  pendingQuotes: number;
  sentQuotes: number;
  acceptedQuotes: number;
  rejectedQuotes: number;
  totalQuotesValue: number;
  conversionRate: number;
}

interface SalesMetricsProps {
  compact?: boolean;
}

export function SalesMetrics({ compact = false }: SalesMetricsProps) {
  const [data, setData] = useState<SalesData>({
    pendingQuotes: 0,
    sentQuotes: 0,
    acceptedQuotes: 0,
    rejectedQuotes: 0,
    totalQuotesValue: 0,
    conversionRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSalesData();
  }, []);

  const loadSalesData = async () => {
    try {
      const { data: quotes } = await supabase
        .from('quotes')
        .select('status, estimated_amount, created_at')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      const pendingQuotes = quotes?.filter(q => q.status === 'pendiente_aprobacion').length || 0;
      const sentQuotes = quotes?.filter(q => q.status === 'enviada').length || 0;
      const acceptedQuotes = quotes?.filter(q => q.status === 'aceptada').length || 0;
      const rejectedQuotes = quotes?.filter(q => q.status === 'rechazada').length || 0;
      const totalQuotesValue = quotes?.reduce((sum, quote) => sum + (quote.estimated_amount || 0), 0) || 0;
      
      const totalQuotes = quotes?.length || 0;
      const conversionRate = totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0;

      setData({
        pendingQuotes,
        sentQuotes,
        acceptedQuotes,
        rejectedQuotes,
        totalQuotesValue,
        conversionRate
      });
    } catch (error) {
      console.error('Error loading sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ventas</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.pendingQuotes}</div>
          <p className="text-xs text-muted-foreground">
            Cotizaciones pendientes
          </p>
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              {data.conversionRate.toFixed(1)}% conversión
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
            <CardTitle className="text-sm font-medium">Cotizaciones Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{data.pendingQuotes}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{data.sentQuotes}</div>
            <p className="text-xs text-muted-foreground">
              Esperando respuesta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aceptadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.acceptedQuotes}</div>
            <p className="text-xs text-muted-foreground">
              Convertidas en órdenes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rechazadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.rejectedQuotes}</div>
            <p className="text-xs text-muted-foreground">
              No convertidas
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Valor Total de Cotizaciones</CardTitle>
            <CardDescription>Valor total del mes actual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${data.totalQuotesValue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasa de Conversión</CardTitle>
            <CardDescription>Cotizaciones aceptadas vs total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{data.conversionRate.toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground mt-2">
              {data.acceptedQuotes} de {data.pendingQuotes + data.sentQuotes + data.acceptedQuotes + data.rejectedQuotes} cotizaciones
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}