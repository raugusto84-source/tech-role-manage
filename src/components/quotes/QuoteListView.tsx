import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, Clock, Bell, Calendar, User, DollarSign, AlertCircle } from 'lucide-react';
import { formatCOPCeilToTen } from '@/utils/currency';
import { formatHoursAndMinutes } from '@/utils/timeUtils';
import { formatDateMexico } from '@/utils/dateUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  service_description: string;
  estimated_amount: number;
  status: 'solicitud' | 'enviada' | 'aceptada' | 'rechazada' | 'seguimiento' | 'pendiente_aprobacion' | 'asignando';
  request_date: string;
  created_at: string;
  created_by_name?: string;
  follow_up_date?: string;
}

interface StatusDuration {
  status: string;
  duration: number;
  isCurrent: boolean;
}

interface QuoteWithDurations extends Quote {
  statusDurations: StatusDuration[];
  totalTime: number;
}

interface QuoteListViewProps {
  quotes: Quote[];
  getStatusInfo: (status: string) => { 
    label: string; 
    color: string; 
    bgColor: string; 
    icon: string; 
  };
  onViewDetails: (quote: Quote) => void;
  onDelete: (quoteId: string) => void;
  canManage: boolean;
}

/**
 * Vista de lista de cotizaciones con tiempo transcurrido por estado
 * Muestra todas las cotizaciones en formato tabla con duración en cada estado
 */
export function QuoteListView({ 
  quotes, 
  getStatusInfo, 
  onViewDetails, 
  onDelete, 
  canManage 
}: QuoteListViewProps) {
  const [quotesWithDurations, setQuotesWithDurations] = useState<QuoteWithDurations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatusDurations();
  }, [quotes]);

  const loadStatusDurations = async () => {
    if (quotes.length === 0) {
      setQuotesWithDurations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const quoteIds = quotes.map(q => q.id);
      
      const { data: logs, error } = await supabase
        .from('quote_status_logs')
        .select('quote_id, previous_status, new_status, changed_at')
        .in('quote_id', quoteIds)
        .order('changed_at', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const enrichedQuotes: QuoteWithDurations[] = quotes.map(quote => {
        const quoteLogs = (logs || []).filter(l => l.quote_id === quote.id);
        
        if (quoteLogs.length === 0) {
          // Si no hay logs, calcular desde created_at
          const createdAt = new Date(quote.created_at);
          const durationMs = now.getTime() - createdAt.getTime();
          const durationHours = durationMs / (1000 * 60 * 60);
          
          return {
            ...quote,
            statusDurations: [{
              status: quote.status,
              duration: durationHours,
              isCurrent: true
            }],
            totalTime: durationHours
          };
        }

        // Calcular duraciones para cada estado
        const durations: StatusDuration[] = [];
        
        for (let i = 0; i < quoteLogs.length; i++) {
          const log = quoteLogs[i];
          const startTime = new Date(log.changed_at);
          const nextLog = quoteLogs[i + 1];
          const endTime = nextLog ? new Date(nextLog.changed_at) : now;
          const isCurrent = !nextLog;

          const durationMs = endTime.getTime() - startTime.getTime();
          const durationHours = durationMs / (1000 * 60 * 60);

          durations.push({
            status: log.new_status,
            duration: durationHours,
            isCurrent
          });
        }

        const totalTime = durations.reduce((sum, d) => sum + d.duration, 0);

        return {
          ...quote,
          statusDurations: durations,
          totalTime
        };
      });

      setQuotesWithDurations(enrichedQuotes);
    } catch (error) {
      console.error('Error loading status durations:', error);
      // En caso de error, mostrar cotizaciones sin duraciones
      setQuotesWithDurations(quotes.map(q => ({
        ...q,
        statusDurations: [],
        totalTime: 0
      })));
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      solicitud: 'Nueva',
      enviada: 'Enviada',
      aceptada: 'Aceptada',
      rechazada: 'No Aceptada',
      seguimiento: 'Seguimiento',
      pendiente_aprobacion: 'Pendiente',
      asignando: 'Asignando'
    };
    return labels[status] || status;
  };

  const isFollowUpOverdue = (followUpDate: string | undefined): boolean => {
    if (!followUpDate) return false;
    return new Date(followUpDate) < new Date();
  };

  const isFollowUpToday = (followUpDate: string | undefined): boolean => {
    if (!followUpDate) return false;
    const today = new Date();
    const followUp = new Date(followUpDate);
    return followUp.toDateString() === today.toDateString();
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (quotesWithDurations.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Tiempo
                </div>
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                <div className="flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  Recordatorio
                </div>
              </TableHead>
              <TableHead className="hidden md:table-cell">Creado por</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotesWithDurations.map((quote) => {
              const statusInfo = getStatusInfo(quote.status);
              const currentStatusDuration = quote.statusDurations.find(d => d.isCurrent);
              const followUpOverdue = isFollowUpOverdue(quote.follow_up_date);
              const followUpToday = isFollowUpToday(quote.follow_up_date);
              
              return (
                <TableRow 
                  key={quote.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onViewDetails(quote)}
                >
                  <TableCell className="font-medium text-xs sm:text-sm">
                    {quote.quote_number}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px]">
                        {quote.client_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
                        {quote.service_description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                      <DollarSign className="h-3 w-3" />
                      {quote.estimated_amount 
                        ? formatCOPCeilToTen(quote.estimated_amount) 
                        : 'Por definir'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusInfo.color} border text-xs`}>
                      {getStatusLabel(quote.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="space-y-1">
                          {currentStatusDuration && (
                            <div className="text-xs font-medium">
                              {formatHoursAndMinutes(currentStatusDuration.duration)}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Total: {formatHoursAndMinutes(quote.totalTime)}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[250px]">
                        <div className="space-y-1.5 text-xs">
                          <p className="font-semibold">Tiempo por estado:</p>
                          {quote.statusDurations.map((sd, idx) => (
                            <div key={idx} className="flex justify-between gap-4">
                              <span>{getStatusLabel(sd.status)}:</span>
                      <span className="font-medium text-primary">
                        {formatHoursAndMinutes(sd.duration)}
                        {sd.isCurrent && ' (actual)'}
                      </span>
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {quote.follow_up_date ? (
                      <div className={`flex items-center gap-1 text-xs ${
                        followUpOverdue 
                          ? 'text-destructive font-medium' 
                          : followUpToday 
                            ? 'text-amber-600 font-medium'
                            : 'text-muted-foreground'
                      }`}>
                        {followUpOverdue && <AlertCircle className="h-3 w-3" />}
                        <Calendar className="h-3 w-3" />
                        {formatDateMexico(quote.follow_up_date, 'dd/MM/yy')}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {quote.created_by_name ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="truncate max-w-[100px]">{quote.created_by_name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onViewDetails(quote)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {canManage && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => onDelete(quote.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
