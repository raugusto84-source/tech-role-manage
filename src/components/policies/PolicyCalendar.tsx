import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { Calendar as CalendarIcon, Clock, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, addDays, isWithinInterval } from 'date-fns';
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
  type: 'service' | 'payment' | 'projected_order';
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
      
      // Rango para órdenes proyectadas (próximas 2 semanas desde hoy)
      const today = new Date();
      const projectionEndDate = addDays(today, 14);
      
      // Cargar servicios programados actuales
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

      // Cargar configuraciones de servicios de pólizas para calcular proyecciones
      const { data: policyServiceConfigs, error: configsError } = await supabase
        .from('policy_service_configurations')
        .select(`
          id,
          frequency_days,
          frequency_weeks,
          day_of_week,
          policy_clients!inner(
            clients!inner(
              name,
              email
            )
          ),
          service_types!inner(
            name,
            service_category
          )
        `)
        .eq('is_active', true);

      if (configsError) throw configsError;

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

      // Generar órdenes proyectadas para las próximas 2 semanas
      const projectedOrders: CalendarEvent[] = [];
      
      // Función para encontrar la próxima fecha de un día específico de la semana
      const getNextDateForWeekday = (startDate: Date, weekDay: number, weeksInterval: number = 1): Date => {
        const date = new Date(startDate);
        const currentDay = date.getDay();
        const daysUntilTarget = (weekDay - currentDay + 7) % 7;
        
        if (daysUntilTarget === 0) {
          // Si ya es el día correcto, tomar la siguiente ocurrencia
          date.setDate(date.getDate() + (7 * weeksInterval));
        } else {
          // Ir al próximo día de la semana especificado
          date.setDate(date.getDate() + daysUntilTarget);
        }
        
        return date;
      };
      
      (policyServiceConfigs || []).forEach(config => {
        const targetWeekDay = config.day_of_week || 1; // Default to Monday if not specified
        const weeksInterval = config.frequency_weeks || 1;
        
        // Comenzar desde hoy para calcular las próximas fechas
        let currentDate = getNextDateForWeekday(today, targetWeekDay);
        let counter = 0;
        
        // Generar hasta 10 fechas futuras para evitar bucles infinitos
        while (counter < 10 && currentDate <= projectionEndDate) {
          // Solo incluir si está en el rango de visualización Y dentro de las 2 semanas
          if (isWithinInterval(currentDate, { start: startDate, end: endDate }) &&
              isWithinInterval(currentDate, { start: today, end: projectionEndDate })) {
            
            const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            
            projectedOrders.push({
              id: `projected-${config.id}-${counter}`,
              date: currentDate,
              type: 'projected_order',
              title: config.policy_clients?.clients?.name || 'Cliente',
              subtitle: `⚡ ${config.service_types?.name || 'Servicio'} (${daysOfWeek[targetWeekDay]})`,
              priority: 2.5, // Prioridad media para órdenes proyectadas
              status: 'projected',
              details: {
                ...config,
                projected_date: currentDate.toISOString(),
                days_until: Math.ceil((currentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
                target_weekday: daysOfWeek[targetWeekDay]
              }
            });
          }
          
          // Calcular siguiente fecha basada en la frecuencia en semanas
          currentDate = addDays(currentDate, 7 * weeksInterval);
          counter++;
        }
      });

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

      setEvents([...serviceEvents, ...paymentEvents, ...projectedOrders]);
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
    
    if (event.type === 'projected_order') {
      return 'bg-info/60 text-info-foreground border border-info/30';
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
            Vista visual de servicios programados, pagos pendientes y órdenes proyectadas (próximas 2 semanas)
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
              <SelectItem value="projected_order">Órdenes Proyectadas</SelectItem>
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
                              ) : event.type === 'projected_order' ? (
                                <CalendarIcon className="h-3 w-3" />
                              ) : (
                                <AlertTriangle className="h-3 w-3" />
                              )}
                              <span className="text-xs">
                                {event.type === 'service' ? 'Servicio' : 
                                 event.type === 'projected_order' ? 'Orden Proyectada' : 'Pago'}
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

                        {event.type === 'projected_order' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span className="text-sm">Cliente: {event.details.policy_clients?.clients?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4" />
                              <span className="text-sm">
                                Día programado: {event.details.target_weekday} (en {event.details.days_until} día(s))
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span className="text-sm">Frecuencia: cada {event.details.frequency_weeks} semana(s)</span>
                            </div>
                            <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                              💡 Esta orden se generará automáticamente según la configuración de la póliza
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