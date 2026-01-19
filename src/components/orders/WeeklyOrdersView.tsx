import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Monitor, Shield, Building2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WeeklyOrderCard } from './WeeklyOrderCard';

interface Order {
  id: string;
  order_number: string;
  client_id: string;
  service_type: string;
  failure_description: string;
  requested_date?: string;
  delivery_date: string;
  estimated_cost?: number;
  status: 'en_espera' | 'pendiente_aprobacion' | 'en_proceso' | 'pendiente_actualizacion' | 'pendiente_entrega' | 'finalizada' | 'cancelada' | 'rechazada';
  assigned_technician?: string;
  created_at: string;
  estimated_delivery_date?: string | null;
  priority: 'baja' | 'media' | 'alta' | 'critica';
  order_priority?: number | null;
  is_policy_order?: boolean;
  is_development_order?: boolean;
  order_category?: string;
  special_price_enabled?: boolean;
  special_price?: number | null;
  service_types?: {
    name: string;
    description?: string;
    service_category?: string;
  } | null;
  clients?: {
    name: string;
    client_number: string;
    email: string;
    phone?: string;
    address: string;
  } | null;
  technician_profile?: {
    full_name: string;
    fleet_name?: string;
  } | null;
  order_items?: Array<{
    id: string;
    service_type_id: string;
    service_name: string;
    service_description?: string;
    quantity: number;
    unit_cost_price: number;
    unit_base_price: number;
    profit_margin_rate: number;
    subtotal: number;
    vat_rate: number;
    vat_amount: number;
    total_amount: number;
    item_type: string;
    status: string;
    service_types?: {
      name: string;
      description?: string;
      service_category?: string;
    } | null;
  }>;
}

interface WeeklyOrdersViewProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}

type CategoryType = 'sistemas' | 'seguridad' | 'fraccionamientos';

const CATEGORY_CONFIG: Record<CategoryType, {
  icon: React.ReactNode;
  label: string;
  gradient: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
}> = {
  sistemas: {
    icon: <Monitor className="h-5 w-5" />,
    label: 'SISTEMAS',
    gradient: 'from-blue-600 to-cyan-500',
    bgLight: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  seguridad: {
    icon: <Shield className="h-5 w-5" />,
    label: 'SEGURIDAD',
    gradient: 'from-red-600 to-rose-500',
    bgLight: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-500',
    textColor: 'text-red-700 dark:text-red-300',
  },
  fraccionamientos: {
    icon: <Building2 className="h-5 w-5" />,
    label: 'FRACCIONAMIENTOS',
    gradient: 'from-amber-600 to-orange-500',
    bgLight: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
};

export function WeeklyOrdersView({ orders, onSelectOrder }: WeeklyOrdersViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Determinar la categoría de una orden
  const getOrderCategory = (order: Order): CategoryType => {
    // Primero usar order_category si está definido
    if (order.order_category) {
      if (order.order_category === 'seguridad') return 'seguridad';
      if (order.order_category === 'fraccionamientos') return 'fraccionamientos';
      if (order.order_category === 'sistemas') return 'sistemas';
    }
    
    // Si es orden de fraccionamiento
    if (order.is_development_order) return 'fraccionamientos';
    
    // Obtener de la categoría del servicio principal
    const serviceCategory = order.service_types?.service_category;
    if (serviceCategory === 'seguridad') return 'seguridad';
    if (serviceCategory === 'fraccionamientos') return 'fraccionamientos';
    
    return 'sistemas';
  };

  // Filtrar órdenes de la semana actual
  const weekOrders = useMemo(() => {
    return orders.filter(order => {
      const deliveryDate = order.estimated_delivery_date || order.delivery_date;
      if (!deliveryDate) return false;
      
      try {
        const orderDate = parseISO(deliveryDate);
        return orderDate >= currentWeekStart && orderDate <= weekEnd;
      } catch {
        return false;
      }
    });
  }, [orders, currentWeekStart, weekEnd]);

  // Agrupar por categoría y día
  const groupedOrders = useMemo(() => {
    const result: Record<CategoryType, Record<string, Order[]>> = {
      sistemas: {},
      seguridad: {},
      fraccionamientos: {},
    };

    // Inicializar días
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      result.sistemas[dayKey] = [];
      result.seguridad[dayKey] = [];
      result.fraccionamientos[dayKey] = [];
    });

    // Agrupar órdenes
    weekOrders.forEach(order => {
      const category = getOrderCategory(order);
      const deliveryDate = order.estimated_delivery_date || order.delivery_date;
      if (!deliveryDate) return;
      
      try {
        const dayKey = format(parseISO(deliveryDate), 'yyyy-MM-dd');
        if (result[category][dayKey]) {
          result[category][dayKey].push(order);
        }
      } catch {
        // Ignore invalid dates
      }
    });

    return result;
  }, [weekOrders, weekDays]);

  // Contar órdenes por categoría
  const categoryCounts = useMemo(() => ({
    sistemas: weekOrders.filter(o => getOrderCategory(o) === 'sistemas').length,
    seguridad: weekOrders.filter(o => getOrderCategory(o) === 'seguridad').length,
    fraccionamientos: weekOrders.filter(o => getOrderCategory(o) === 'fraccionamientos').length,
  }), [weekOrders]);

  const isCurrentWeek = isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));
  const isPastWeek = currentWeekStart < startOfWeek(new Date(), { weekStartsOn: 1 });

  // Contar órdenes activas (pendientes) en semanas pasadas
  const activeOrdersCount = useMemo(() => {
    return weekOrders.filter(o => 
      o.status !== 'finalizada' && o.status !== 'cancelada' && o.status !== 'rechazada'
    ).length;
  }, [weekOrders]);

  return (
    <div className="space-y-4">
      {/* Week Navigation Header */}
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousWeek}
                className="h-10 w-10"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextWeek}
                className="h-10 w-10"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">
                  {format(currentWeekStart, "d 'de' MMMM", { locale: es })} — {format(weekEnd, "d 'de' MMMM, yyyy", { locale: es })}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {weekOrders.length} órdenes esta semana
                {isPastWeek && activeOrdersCount > 0 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                    ({activeOrdersCount} pendientes)
                  </span>
                )}
              </p>
              {isPastWeek && (
                <Badge variant="outline" className="mt-1 border-amber-500 text-amber-600 dark:text-amber-400">
                  Semana Anterior
                </Badge>
              )}
            </div>

            <Button
              variant={isCurrentWeek ? "secondary" : "default"}
              onClick={goToCurrentWeek}
              disabled={isCurrentWeek}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Semana Actual
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(['sistemas', 'seguridad', 'fraccionamientos'] as CategoryType[]).map(category => {
          const config = CATEGORY_CONFIG[category];
          
          return (
            <Card 
              key={category} 
              className={cn(
                "overflow-hidden border-2",
                config.borderColor,
                "shadow-lg"
              )}
            >
              {/* Category Header */}
              <div className={cn(
                "bg-gradient-to-r p-4 text-white",
                config.gradient
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      {config.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg tracking-wide">{config.label}</h3>
                      <p className="text-white/80 text-sm">
                        {categoryCounts[category]} órdenes
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 text-lg font-bold px-3 py-1">
                    {categoryCounts[category]}
                  </Badge>
                </div>
              </div>

              {/* Days List */}
              <CardContent className={cn("p-0", config.bgLight)}>
                <div className="divide-y divide-border/50">
                  {weekDays.map(day => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayOrders = groupedOrders[category][dayKey] || [];
                    const dayIsToday = isToday(day);
                    
                    return (
                      <div 
                        key={dayKey}
                        className={cn(
                          "p-3 transition-colors",
                          dayIsToday && "bg-primary/5 ring-2 ring-inset ring-primary/20"
                        )}
                      >
                        {/* Day Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-2xl font-bold",
                              dayIsToday ? "text-primary" : "text-foreground"
                            )}>
                              {format(day, 'd')}
                            </span>
                            <div>
                              <span className={cn(
                                "text-sm font-medium capitalize",
                                dayIsToday ? "text-primary" : "text-muted-foreground"
                              )}>
                                {format(day, 'EEEE', { locale: es })}
                              </span>
                              {dayIsToday && (
                                <Badge className="ml-2 bg-primary text-primary-foreground text-xs">
                                  HOY
                                </Badge>
                              )}
                            </div>
                          </div>
                          {dayOrders.length > 0 && (
                            <Badge variant="outline" className={cn(config.textColor, "font-semibold")}>
                              {dayOrders.length}
                            </Badge>
                          )}
                        </div>

                        {/* Orders for this day */}
                        {dayOrders.length > 0 ? (
                          <div className="space-y-2">
                            {dayOrders.map(order => (
                              <WeeklyOrderCard
                                key={order.id}
                                order={order}
                                onClick={() => onSelectOrder(order)}
                                category={category}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-3 text-muted-foreground text-sm italic">
                            Sin órdenes
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
