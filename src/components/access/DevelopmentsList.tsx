import { AccessDevelopment } from './AccessDevelopmentsManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, DollarSign, Eye, Edit, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  developments: AccessDevelopment[];
  loading: boolean;
  onSelect: (d: AccessDevelopment) => void;
  onEdit: (d: AccessDevelopment) => void;
  onRefresh: () => void;
}

export function DevelopmentsList({ developments, loading, onSelect, onEdit }: Props) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      suspended: 'secondary',
      cancelled: 'destructive',
      completed: 'outline'
    };
    const labels: Record<string, string> = {
      active: 'Activo',
      suspended: 'Suspendido',
      cancelled: 'Cancelado',
      completed: 'Completado'
    };
    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
  };

  const getContractEndDate = (startDate: string, months: number) => {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + months);
    return date;
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (developments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No hay fraccionamientos</h3>
          <p className="text-muted-foreground">Comienza agregando tu primer fraccionamiento</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {developments.map((dev) => {
        const endDate = getContractEndDate(dev.contract_start_date, dev.contract_duration_months);
        const isExpiringSoon = endDate.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

        return (
          <Card key={dev.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {dev.name}
                </CardTitle>
                {getStatusBadge(dev.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  ${dev.monthly_payment.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-muted-foreground">/ mes</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Servicio día {dev.service_day} • Cobro día {dev.payment_day}
                </span>
              </div>

              <div className="text-sm text-muted-foreground">
                Contrato: {new Date(dev.contract_start_date).toLocaleDateString('es-MX')} - {endDate.toLocaleDateString('es-MX')}
                {isExpiringSoon && dev.status === 'active' && (
                  <Badge variant="outline" className="ml-2 text-orange-600 border-orange-600">
                    Próximo a vencer
                  </Badge>
                )}
              </div>

              {dev.has_investor && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Users className="h-4 w-4" />
                  <span>Inversionista: {dev.investor_name}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => onSelect(dev)} className="flex-1">
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </Button>
                <Button variant="outline" size="sm" onClick={() => onEdit(dev)} className="flex-1">
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
