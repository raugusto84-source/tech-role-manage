import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Trash2,
  Clock,
  User,
  DollarSign,
  AlertCircle,
  Send,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { formatCOPCeilToTen } from "@/utils/currency";
import { formatHoursAndMinutes } from "@/utils/timeUtils";
import { getTimeCategory, getTimeLimitLabel, getTaskInfo, shouldAutoExpire } from "@/utils/quoteTimeCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  service_description: string;
  estimated_amount: number;
  status: "solicitud" | "enviada" | "aceptada" | "rechazada" | "seguimiento" | "pendiente_aprobacion" | "asignando";
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
  onQuoteSent?: () => void;
  canManage: boolean;
}

/**
 * Vista de lista de cotizaciones con tiempo transcurrido por estado
 * Incluye categorías de tiempo con colores y selector de recordatorio
 */
export function QuoteListView({
  quotes,
  getStatusInfo,
  onViewDetails,
  onDelete,
  onQuoteSent,
  canManage,
}: QuoteListViewProps) {
  const [quotesWithDurations, setQuotesWithDurations] = useState<QuoteWithDurations[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingQuote, setSendingQuote] = useState<string | null>(null);

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
      const quoteIds = quotes.map((q) => q.id);

      const { data: logs, error } = await supabase
        .from("quote_status_logs")
        .select("quote_id, previous_status, new_status, changed_at")
        .in("quote_id", quoteIds)
        .order("changed_at", { ascending: true });

      if (error) throw error;

      const now = new Date();
      const enrichedQuotes: QuoteWithDurations[] = quotes.map((quote) => {
        const quoteLogs = (logs || []).filter((l) => l.quote_id === quote.id);

        if (quoteLogs.length === 0) {
          const createdAt = new Date(quote.created_at);
          const durationMs = now.getTime() - createdAt.getTime();
          const durationHours = durationMs / (1000 * 60 * 60);

          return {
            ...quote,
            statusDurations: [
              {
                status: quote.status,
                duration: durationHours,
                isCurrent: true,
              },
            ],
            totalTime: durationHours,
          };
        }

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
            isCurrent,
          });
        }

        const totalTime = durations.reduce((sum, d) => sum + d.duration, 0);

        return {
          ...quote,
          statusDurations: durations,
          totalTime,
        };
      });

      setQuotesWithDurations(enrichedQuotes);
    } catch (error) {
      console.error("Error loading status durations:", error);
      setQuotesWithDurations(
        quotes.map((q) => ({
          ...q,
          statusDurations: [],
          totalTime: 0,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      solicitud: "Nueva",
      enviada: "Enviada",
      aceptada: "Aceptada",
      rechazada: "No Aceptada",
      seguimiento: "Seguimiento",
      pendiente_aprobacion: "Pendiente",
      asignando: "Asignando",
    };
    return labels[status] || status;
  };

  // Function to auto-expire quotes that are overdue
  const handleAutoExpire = async (quoteId: string) => {
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ status: "rechazada" })
        .eq("id", quoteId);

      if (error) throw error;

      // Log the status change
      await supabase.from("quote_status_logs").insert({
        quote_id: quoteId,
        previous_status: "enviada",
        new_status: "rechazada",
        notes: "Cotización marcada como No Aceptada automáticamente (vencida después de 7 días)"
      });

      toast({
        title: "Cotización vencida",
        description: "La cotización ha sido marcada como No Aceptada por vencimiento",
      });

      // Update local state
      setQuotesWithDurations((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, status: "rechazada" as const } : q)),
      );
    } catch (error) {
      console.error("Error expiring quote:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la cotización",
        variant: "destructive",
      });
    }
  };

  const handleSendQuote = async (quoteId: string, clientEmail: string, quoteNumber: string) => {
    if (!clientEmail) {
      toast({
        title: "Error",
        description: "El cliente no tiene correo electrónico registrado",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingQuote(quoteId);

      // Enviamos todos los datos a la Edge Function
      const { data, error } = await supabase.functions.invoke("send-quote-email", {
        body: {
          quoteId,
          clientEmail,
          quoteNumber,
        },
      });

      // Manejo de errores robusto
      if (error) throw error;
      if (!data) throw new Error("El servidor no devolvió ninguna respuesta");
      if (data.error || data.success === false) throw new Error(data.error || "Error interno al enviar el correo");

      toast({
        title: "¡Cotización enviada!",
        description: `Se envió la cotización ${quoteNumber} a ${clientEmail}`,
      });

      // Update local state to reflect sent status
      setQuotesWithDurations((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status: "enviada" as const } : q)));

      // Notify parent to refresh
      onQuoteSent?.();
    } catch (error: any) {
      console.error("Error sending quote:", error);
      toast({
        title: "Error al enviar",
        description: error.message || "No se pudo enviar la cotización",
        variant: "destructive",
      });
    } finally {
      setSendingQuote(null);
    }
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
                  <ClipboardList className="h-3 w-3" />
                  Tarea
                </div>
              </TableHead>
              <TableHead className="hidden md:table-cell">Creado por</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotesWithDurations.map((quote) => {
              const statusInfo = getStatusInfo(quote.status);
              const currentStatusDuration = quote.statusDurations.find((d) => d.isCurrent);

              // Categoría de tiempo y tarea basada en el estado actual
              const timeCategory = currentStatusDuration
                ? getTimeCategory(currentStatusDuration.duration, quote.status)
                : null;
              const timeLimit = getTimeLimitLabel(quote.status);
              
              // Get task info based on time in current status
              const taskInfo = currentStatusDuration 
                ? getTaskInfo(currentStatusDuration.duration, quote.status)
                : null;
              
              // Check if quote should auto-expire
              const shouldExpire = currentStatusDuration 
                ? shouldAutoExpire(currentStatusDuration.duration, quote.status)
                : false;

              return (
                <TableRow
                  key={quote.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onViewDetails(quote)}
                >
                  <TableCell className="font-medium text-xs sm:text-sm">{quote.quote_number}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px]">
                        {quote.client_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
                        {quote.client_email}
                      </div>
                      <div className="text-xs text-muted-foreground/70 truncate max-w-[120px] sm:max-w-[200px] italic">
                        {quote.service_description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                      <DollarSign className="h-3 w-3" />
                      {quote.estimated_amount ? formatCOPCeilToTen(quote.estimated_amount) : "Por definir"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusInfo.color} border text-xs`}>{getStatusLabel(quote.status)}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="space-y-1">
                          {currentStatusDuration && timeCategory && (
                            <div
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${timeCategory.bgClass} ${timeCategory.colorClass} border ${timeCategory.borderClass}`}
                            >
                              {timeCategory.isDelayed && <AlertCircle className="h-3 w-3" />}
                              {timeCategory.label}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">
                              {currentStatusDuration && formatHoursAndMinutes(currentStatusDuration.duration)}
                            </span>
                            {timeLimit && <span className="text-xs text-muted-foreground">/ {timeLimit}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total: {formatHoursAndMinutes(quote.totalTime)}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[280px]">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold">Tiempo por estado:</p>
                          {quote.statusDurations.map((sd, idx) => {
                            const cat = getTimeCategory(sd.duration, sd.status);
                            return (
                              <div key={idx} className="flex justify-between gap-4">
                                <span>{getStatusLabel(sd.status)}:</span>
                                <span className={`font-medium ${cat.colorClass}`}>
                                  {formatHoursAndMinutes(sd.duration)}
                                  {sd.isCurrent && " (actual)"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  {/* Task column - shows pending action based on time */}
                  <TableCell className="hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
                    {taskInfo && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="space-y-1">
                            <div
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${taskInfo.bgClass} ${taskInfo.colorClass} border ${taskInfo.borderClass}`}
                            >
                              {taskInfo.isDelayed && <AlertCircle className="h-3 w-3" />}
                              <ClipboardList className="h-3 w-3" />
                              <span className="truncate max-w-[100px]">{taskInfo.task}</span>
                            </div>
                            {/* Show expire button for quotes that need manual expiration */}
                            {shouldExpire && canManage && (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-6 text-xs w-full"
                                onClick={() => handleAutoExpire(quote.id)}
                              >
                                Marcar Vencida
                              </Button>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <div className="space-y-1 text-xs">
                            <p className="font-semibold">Tarea pendiente</p>
                            <p>{taskInfo.task}</p>
                            {taskInfo.isDelayed && (
                              <p className="text-amber-600">
                                ⚠ Atrasado: {formatHoursAndMinutes(taskInfo.hoursInStatus)} en este estado
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
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
                      {/* Send/Resend button - allow for quotes pending, sent or in follow-up */}
                      {canManage && (quote.status === "solicitud" || quote.status === "seguimiento" || quote.status === "enviada") && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => handleSendQuote(quote.id, quote.client_email, quote.quote_number)}
                              disabled={sendingQuote === quote.id}
                            >
                              {sendingQuote === quote.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{quote.status === "enviada" ? "Reenviar cotización" : "Enviar cotización por correo"}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewDetails(quote)}>
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
