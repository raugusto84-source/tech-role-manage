import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { formatHoursAndMinutes } from '@/utils/timeUtils';
import { Skeleton } from '@/components/ui/skeleton';

interface OrderStatusTimelineProps {
  orderId: string;
}

interface StatusLog {
  id: string;
  previous_status: string | null;
  new_status: string;
  changed_at: string;
  notes?: string;
}

interface StatusDuration {
  status: string;
  duration: number; // en horas
  startTime: string;
  endTime?: string;
  isCurrent: boolean;
}

export function OrderStatusTimeline({ orderId }: OrderStatusTimelineProps) {
  const [loading, setLoading] = useState(true);
  const [statusDurations, setStatusDurations] = useState<StatusDuration[]>([]);

  useEffect(() => {
    loadStatusTimeline();

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel(`status-timeline-${orderId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_status_logs',
        filter: `order_id=eq.${orderId}`
      }, () => {
        loadStatusTimeline();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const loadStatusTimeline = async () => {
    try {
      setLoading(true);

      const { data: logs, error } = await supabase
        .from('order_status_logs')
        .select('id, previous_status, new_status, changed_at, notes')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: true });

      if (error) throw error;

      if (!logs || logs.length === 0) {
        setStatusDurations([]);
        return;
      }

      // Calcular duraciones para cada estado
      const durations: StatusDuration[] = [];
      const now = new Date();

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const startTime = new Date(log.changed_at);
        const nextLog = logs[i + 1];
        const endTime = nextLog ? new Date(nextLog.changed_at) : now;
        const isCurrent = !nextLog;

        const durationMs = endTime.getTime() - startTime.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);

        durations.push({
          status: log.new_status,
          duration: durationHours,
          startTime: log.changed_at,
          endTime: nextLog?.changed_at,
          isCurrent
        });
      }

      setStatusDurations(durations);
    } catch (error) {
      console.error('Error loading status timeline:', error);
      setStatusDurations([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      pendiente_aprobacion: 'Pendiente Aprobación',
      pendiente_actualizacion: 'Pendiente Actualización',
      en_proceso: 'En Proceso',
      en_camino: 'En Camino',
      pendiente_entrega: 'Pendiente Entrega',
      finalizada: 'Finalizada',
      cancelada: 'Cancelada',
      rechazada: 'Rechazada'
    };
    return labels[status] || status.replace('_', ' ').toUpperCase();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pendiente':
      case 'pendiente_aprobacion':
      case 'pendiente_actualizacion':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'en_proceso':
      case 'en_camino':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'pendiente_entrega':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'finalizada':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'cancelada':
      case 'rechazada':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Tiempo Transcurrido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (statusDurations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Tiempo Transcurrido por Estado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {statusDurations.map((duration, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border ${getStatusColor(duration.status)} ${
              duration.isCurrent ? 'ring-2 ring-primary/20' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">
                {getStatusLabel(duration.status)}
              </span>
              {duration.isCurrent && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Actual
                </span>
              )}
            </div>
            <div className="text-lg font-bold">
              {formatHoursAndMinutes(duration.duration)}
            </div>
            {duration.isCurrent && (
              <div className="text-xs text-muted-foreground mt-1">
                En curso...
              </div>
            )}
          </div>
        ))}
        
        {statusDurations.length > 1 && (
          <div className="pt-2 mt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tiempo Total:</span>
              <span className="text-lg font-bold text-primary">
                {formatHoursAndMinutes(
                  statusDurations.reduce((sum, d) => sum + d.duration, 0)
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
