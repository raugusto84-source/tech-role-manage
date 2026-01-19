import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Monitor, Shield, Building2, AlertTriangle, GripVertical } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO, isToday, isBefore, startOfDay, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WeeklyOrderCard } from './WeeklyOrderCard';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  onOrdersChange?: () => void;
}

type CategoryType = 'sistemas' | 'seguridad' | 'fraccionamientos';

// Working hours: 8 AM to 4 PM (8 hours)
const WORK_HOURS = [8, 9, 10, 11, 12, 13, 14, 15]; // 8AM to 3PM (last slot starts at 3PM, ends at 4PM)

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

export function WeeklyOrdersView({ orders, onSelectOrder, onOrdersChange }: WeeklyOrdersViewProps) {
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [isDragging, setIsDragging] = useState(false);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Determinar la categoría de una orden
  const getOrderCategory = (order: Order): CategoryType => {
    if (order.order_category) {
      if (order.order_category === 'seguridad') return 'seguridad';
      if (order.order_category === 'fraccionamientos') return 'fraccionamientos';
      if (order.order_category === 'sistemas') return 'sistemas';
    }
    
    if (order.is_development_order) return 'fraccionamientos';
    
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

    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      result.sistemas[dayKey] = [];
      result.seguridad[dayKey] = [];
      result.fraccionamientos[dayKey] = [];
    });

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

  const activeOrdersCount = useMemo(() => {
    return weekOrders.filter(o => 
      o.status !== 'finalizada' && o.status !== 'cancelada' && o.status !== 'rechazada'
    ).length;
  }, [weekOrders]);

  // Órdenes atrasadas
  const overdueOrders = useMemo(() => {
    if (!isCurrentWeek) return [];
    
    const today = startOfDay(new Date());
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    
    return orders.filter(order => {
      if (order.status === 'finalizada' || order.status === 'cancelada' || order.status === 'rechazada') {
        return false;
      }
      
      const deliveryDate = order.estimated_delivery_date || order.delivery_date;
      if (!deliveryDate) return false;
      
      try {
        const orderDate = parseISO(deliveryDate);
        return isBefore(orderDate, thisWeekStart);
      } catch {
        return false;
      }
    });
  }, [orders, isCurrentWeek]);

  const overdueByCategory = useMemo(() => {
    const result: Record<CategoryType, Order[]> = {
      sistemas: [],
      seguridad: [],
      fraccionamientos: [],
    };
    
    overdueOrders.forEach(order => {
      const category = getOrderCategory(order);
      result[category].push(order);
    });
    
    return result;
  }, [overdueOrders]);

  // Handle drag end
  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false);
    
    if (!result.destination) return;

    const { draggableId, destination } = result;
    
    // Parse destination: format is "category-dayKey-hour" or "category-dayKey" for day-only drops
    const destParts = destination.droppableId.split('-');
    if (destParts.length < 3) return;
    
    const destCategory = destParts[0] as CategoryType;
    const destDayKey = `${destParts[1]}-${destParts[2]}-${destParts[3]}`;
    const destHour = destParts[4] ? parseInt(destParts[4], 10) : 8;

    // Find the order being moved
    const order = orders.find(o => o.id === draggableId);
    if (!order) return;

    // Check if order category matches destination category
    const orderCategory = getOrderCategory(order);
    if (orderCategory !== destCategory) {
      toast({
        title: "No permitido",
        description: `No se puede mover una orden de ${orderCategory} a ${destCategory}`,
        variant: "destructive"
      });
      return;
    }

    // Create new delivery date with hour
    const newDeliveryDate = setMinutes(setHours(parseISO(destDayKey), destHour), 0);
    const newDeliveryDateStr = newDeliveryDate.toISOString();

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          delivery_date: newDeliveryDateStr,
          estimated_delivery_date: newDeliveryDateStr
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "Orden reprogramada",
        description: `Orden #${order.order_number} movida a ${format(newDeliveryDate, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}`,
      });

      onOrdersChange?.();
    } catch (error) {
      console.error('Error updating order date:', error);
      toast({
        title: "Error",
        description: "No se pudo reprogramar la orden",
        variant: "destructive"
      });
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
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
                {isDragging && (
                  <Badge className="mt-1 ml-2 bg-primary animate-pulse">
                    Arrastrando...
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
                {!isCurrentWeek && overdueOrders.length > 0 && (
                  <Badge className="ml-1 bg-red-500 text-white">{overdueOrders.length}</Badge>
                )}
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
                  {/* Overdue Orders Section */}
                  {isCurrentWeek && overdueByCategory[category].length > 0 && (
                    <Droppable droppableId={`${category}-overdue`}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "p-3 border-b-2 border-red-300 dark:border-red-800",
                            snapshot.isDraggingOver 
                              ? "bg-red-200 dark:bg-red-900/70" 
                              : "bg-red-100 dark:bg-red-950/50"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            <span className="font-bold text-red-700 dark:text-red-300">
                              ATRASADAS
                            </span>
                            <Badge className="bg-red-600 text-white">
                              {overdueByCategory[category].length}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {overdueByCategory[category].map((order, index) => (
                              <Draggable key={order.id} draggableId={order.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={cn(
                                      "relative",
                                      snapshot.isDragging && "z-50 rotate-2 scale-105"
                                    )}
                                  >
                                    <div 
                                      {...provided.dragHandleProps}
                                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing z-10"
                                    >
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <WeeklyOrderCard
                                      order={order}
                                      onClick={() => !snapshot.isDragging && onSelectOrder(order)}
                                      category={category}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </div>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                  
                  <div className="divide-y divide-border/50">
                    {weekDays.map(day => {
                      const dayKey = format(day, 'yyyy-MM-dd');
                      const dayOrders = groupedOrders[category][dayKey] || [];
                      const dayIsToday = isToday(day);
                      
                      return (
                        <div 
                          key={dayKey}
                          className={cn(
                            "transition-colors",
                            dayIsToday && "bg-primary/5 ring-2 ring-inset ring-primary/20"
                          )}
                        >
                          {/* Day Header */}
                          <div className="flex items-center justify-between p-3 pb-1">
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

                          {/* Hour Slots */}
                          <div className="px-2 pb-2">
                            {WORK_HOURS.map((hour, hourIndex) => {
                              // For the first slot (8 AM), also include orders with no specific hour set
                              // (midnight, or hours outside work hours)
                              const hourOrders = dayOrders.filter(order => {
                                const deliveryDate = order.estimated_delivery_date || order.delivery_date;
                                if (!deliveryDate) return false;
                                try {
                                  const orderDate = parseISO(deliveryDate);
                                  const orderHour = orderDate.getHours();
                                  
                                  // Exact hour match
                                  if (orderHour === hour) return true;
                                  
                                  // For first slot, include orders with hours outside work range
                                  if (hourIndex === 0 && (orderHour < 8 || orderHour >= 16)) return true;
                                  
                                  return false;
                                } catch {
                                  // If parsing fails but order is in this day, show in first slot
                                  return hourIndex === 0;
                                }
                              });
                              
                              const droppableId = `${category}-${dayKey}-${hour}`;
                              
                              return (
                                <Droppable key={droppableId} droppableId={droppableId}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      className={cn(
                                        "min-h-[40px] py-1 px-2 rounded-md mb-1 transition-all",
                                        "border border-transparent",
                                        snapshot.isDraggingOver 
                                          ? "bg-primary/20 border-primary border-dashed scale-[1.02]" 
                                          : "hover:bg-muted/50",
                                        hourOrders.length === 0 && !isDragging && "opacity-60"
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className={cn(
                                          "text-xs font-mono w-12 shrink-0",
                                          snapshot.isDraggingOver ? "text-primary font-bold" : "text-muted-foreground"
                                        )}>
                                          {hour.toString().padStart(2, '0')}:00
                                        </span>
                                        
                                        <div className="flex-1 space-y-1">
                                          {hourOrders.map((order, index) => (
                                            <Draggable 
                                              key={order.id} 
                                              draggableId={order.id} 
                                              index={index}
                                            >
                                              {(provided, snapshot) => (
                                                <div
                                                  ref={provided.innerRef}
                                                  {...provided.draggableProps}
                                                  className={cn(
                                                    "relative",
                                                    snapshot.isDragging && "z-50 rotate-1 scale-105 shadow-2xl"
                                                  )}
                                                >
                                                  <div 
                                                    {...provided.dragHandleProps}
                                                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing z-10 p-1 bg-card rounded"
                                                  >
                                                    <GripVertical className="h-4 w-4" />
                                                  </div>
                                                  <WeeklyOrderCard
                                                    order={order}
                                                    onClick={() => !snapshot.isDragging && onSelectOrder(order)}
                                                    category={category}
                                                  />
                                                </div>
                                              )}
                                            </Draggable>
                                          ))}
                                          
                                          {hourOrders.length === 0 && isDragging && (
                                            <div className="h-6 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-muted-foreground/30 rounded">
                                              Soltar aquí
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              );
                            })}
                          </div>
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
    </DragDropContext>
  );
}
