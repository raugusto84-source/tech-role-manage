import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { Calendar as CalendarIcon, Clock, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, parseISO, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ScheduledService {
  id: string;
  next_service_date: string;
  priority: number;
  frequency_days: number;
  policy_clients: {
    clients: {
      name: string;
      email: string;
    };
  };
  scheduled_service_items: Array<{
    service_types: {
      name: string;
      service_category: string;
    };
  }>;
}

interface PolicyPayment {
  id: string;
  due_date: string;
  amount: number;
  payment_status: string;
  policy_clients: {
    clients: {
      name: string;
    };
    insurance_policies: {
      policy_name: string;
    };
  };
}

interface CalendarEvent {
  id: string;
  date: Date;
  type: 'service' | 'payment';
  title: string;
  subtitle: string;
  priority: number;
  status: string;
  details: any;
}

export function PolicyCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  useEffect(() => {
    loadCalendarData();
  }, [selectedDate]);

  useEffect(() => {
    applyFilters();
  }, [events, filterType, filterPriority]);

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      
      const startDate = startOfMonth(selectedDate);
      const endDate = endOfMonth(selectedDate);
      
      // Cargar servicios programados
      const { data: services, error: servicesError } = await supabase
        .from('scheduled_services')
        .select(`
          id,
          next_service_date,
          priority,
          frequency_days,
          policy_clients!inner(
            clients!inner(
              name,
              email
            )
          ),
          scheduled_service_items(
            service_types(
              name,
              service_category
            )
          )
        `)
        .gte('next_service_date', startDate.toISOString())
        .lte('next_service_date', endDate.toISOString())
        .eq('is_active', true);

      if (servicesError) throw servicesError;

      // Cargar pagos pendientes/vencidos
      const { data: payments, error: paymentsError } = await supabase
        .from('policy_payments')
        .select(`
          id,
          due_date,
          amount,
          payment_status,
          policy_clients!inner(
            clients!inner(
              name
            ),
            insurance_policies!inner(
              policy_name
            )
          )
        `)
        .gte('due_date', startDate.toISOString())
        .lte('due_date', endDate.toISOString())
        .in('payment_status', ['pendiente', 'vencido']);

      if (paymentsError) throw paymentsError;

      // Convertir a eventos del calendario
      const serviceEvents: CalendarEvent[] = (services || []).map(service => ({
        id: `service-${service.id}`,
        date: parseISO(service.next_service_date),
        type: 'service',
        title: service.policy_clients?.clients?.name || 'Cliente',
        subtitle: service.scheduled_service_items?.[0]?.service_types?.name || 'Servicio',
        priority: service.priority || 1,
        status: 'scheduled',
        details: service
      }));

      const paymentEvents: CalendarEvent[] = (payments || []).map(payment => ({
        id: `payment-${payment.id}`,
        date: parseISO(payment.due_date),
        type: 'payment',
        title: payment.policy_clients?.clients?.name || 'Cliente',
        subtitle: `Pago $${payment.amount}`,
        priority: payment.payment_status === 'vencido' ? 5 : 2,
        status: payment.payment_status,
        details: payment
      }));

      setEvents([...serviceEvents, ...paymentEvents]);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = events;

    if (filterType !== 'all') {
      filtered = filtered.filter(event => event.type === filterType);
    }

    if (filterPriority !== 'all') {
      const priority = parseInt(filterPriority);
      filtered = filtered.filter(event => event.priority === priority);
    }

    setFilteredEvents(filtered);
  };

  const getEventColor = (event: CalendarEvent) => {
    if (event.type === 'payment' && event.status === 'vencido') {
      return 'bg-error text-error-foreground';
    }
    
    switch (event.priority) {
      case 1:
        return 'bg-success text-success-foreground';
      case 2:
      case 3:
        return 'bg-warning text-warning-foreground';
      case 4:
      case 5:
        return 'bg-error text-error-foreground';
      default:
        return 'bg-info text-info-foreground';
    }
  };

  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => isSameDay(event.date, date));
  };

  const getDayContent = (date: Date) => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length === 0) return null;

    return (
      <div className="absolute bottom-0 left-0 right-0 flex justify-center">
        <div className="flex gap-1 max-w-full overflow-hidden">
          {dayEvents.slice(0, 3).map((event, index) => (
            <div
              key={event.id}
              className={cn(
                "w-2 h-2 rounded-full",
                getEventColor(event).split(' ')[0]
              )}
            />
          ))}
          {dayEvents.length > 3 && (
            <div className="w-2 h-2 rounded-full bg-muted-foreground opacity-60" />
          )}
        </div>
      </div>
    );
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Calendario de Servicios y Pagos</h2>
          <p className="text-muted-foreground">
            Vista visual de servicios programados y pagos pendientes
          </p>
        </div>
        
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="service">Servicios</SelectItem>
              <SelectItem value="payment">Pagos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="1">Normal</SelectItem>
              <SelectItem value="2">Importante</SelectItem>
              <SelectItem value="3">Alta</SelectItem>
              <SelectItem value="4">Crítica</SelectItem>
              <SelectItem value="5">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario Principal */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {format(selectedDate, 'MMMM yyyy', { locale: es })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="w-full pointer-events-auto"
                components={{
                  Day: ({ date, ...props }) => (
                    <div className="relative w-full h-full">
                      <button
                        {...props}
                        className={cn(
                          "relative w-full h-full p-2 text-sm",
                          "hover:bg-accent rounded-md transition-colors",
                          isSameDay(date, selectedDate) && "bg-primary text-primary-foreground"
                        )}
                      >
                        {date.getDate()}
                        {getDayContent(date)}
                      </button>
                    </div>
                  )
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Panel de Eventos del Día Seleccionado */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {format(selectedDate, 'dd \'de\' MMMM', { locale: es })}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedDateEvents.length} evento(s) programado(s)
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDateEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay eventos programados</p>
                </div>
              ) : (
                selectedDateEvents.map((event) => (
                  <Popover key={event.id}>
                    <PopoverTrigger asChild>
                      <div
                        className={cn(
                          "p-3 rounded-lg cursor-pointer transition-all hover:shadow-md",
                          getEventColor(event)
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{event.title}</p>
                            <p className="text-sm opacity-90 truncate">{event.subtitle}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {event.type === 'service' ? (
                                <Clock className="h-3 w-3" />
                              ) : (
                                <AlertTriangle className="h-3 w-3" />
                              )}
                              <span className="text-xs">
                                {event.type === 'service' ? 'Servicio' : 'Pago'}
                              </span>
                            </div>
                          </div>
                          <Badge variant="secondary" className="ml-2">
                            P{event.priority}
                          </Badge>
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold">{event.title}</h4>
                          <p className="text-sm text-muted-foreground">{event.subtitle}</p>
                        </div>
                        
                        {event.type === 'service' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span className="text-sm">Cliente: {event.details.policy_clients?.clients?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span className="text-sm">Frecuencia: cada {event.details.frequency_days} días</span>
                            </div>
                          </div>
                        )}
                        
                        {event.type === 'payment' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span className="text-sm">Cliente: {event.details.policy_clients?.clients?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm">
                                Estado: {event.details.payment_status === 'vencido' ? 'Vencido' : 'Pendiente'}
                              </span>
                            </div>
                            <div className="text-sm">
                              Monto: <span className="font-semibold">${event.details.amount}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}