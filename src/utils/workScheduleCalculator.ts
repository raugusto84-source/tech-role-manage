interface WorkSchedule {
  work_days: number[];
  start_time: string;
  end_time: string;
  break_duration_minutes: number;
}

interface TechnicianWorkload {
  technician_id: string;
  current_orders: number;
  total_hours: number;
}

interface OrderItem {
  id: string;
  estimated_hours: number;
  shared_time: boolean;
  status?: 'pendiente' | 'en_proceso' | 'completado'; // Make status optional to match OrderItemsList
  service_type_id?: string;
  quantity?: number;
}

interface DeliveryCalculationParams {
  orderItems: OrderItem[];
  primaryTechnicianSchedule: WorkSchedule;
  supportTechnicianSchedule?: WorkSchedule;
  creationDate: Date;
  currentWorkload?: number;
}

export function calculateSharedTimeHours(items: OrderItem[]): number {
  let totalHours = 0;

  // Agrupar items por shared_time
  const sharedItems = items.filter(item => item.shared_time);
  const individualItems = items.filter(item => !item.shared_time);

  // Para items individuales, sumar normalmente
  individualItems.forEach(item => {
    totalHours += item.estimated_hours || 0;
  });

  // Para items con tiempo compartido, aplicar lógica simple por servicio
  const sharedItemsByService = new Map<string, OrderItem[]>();
  
  sharedItems.forEach(item => {
    const serviceKey = item.service_type_id || 'unknown';
    if (!sharedItemsByService.has(serviceKey)) {
      sharedItemsByService.set(serviceKey, []);
    }
    sharedItemsByService.get(serviceKey)!.push(item);
  });

  // Para cada tipo de servicio con tiempo compartido
  sharedItemsByService.forEach((serviceItems) => {
    // Expandir los items por cantidad para aplicar correctamente los porcentajes
    const expandedItems: { baseTime: number; itemId: string }[] = [];
    
    serviceItems.forEach(item => {
      const baseTimePerUnit = (item.estimated_hours || 0) / (item.quantity || 1);
      for (let i = 0; i < (item.quantity || 1); i++) {
        expandedItems.push({ baseTime: baseTimePerUnit, itemId: item.id });
      }
    });

    // Aplicar porcentajes a cada unidad expandida
    expandedItems.forEach((expandedItem, index) => {
      // Calcular porcentaje según posición: 1ro=100%, 2do=20%, 3ro=20%, 4to=100%, etc.
      let percentage = 1.0; // 100% por defecto
      const position = (index % 3) + 1; // Ciclo de 3: posición 1, 2, 3, luego vuelve a 1
      
      if (position === 2 || position === 3) {
        percentage = 0.2; // 20%
      }
      
      totalHours += expandedItem.baseTime * percentage;
    });
  });

  return totalHours;
}

export function calculateAdvancedDeliveryDate(params: DeliveryCalculationParams): { 
  deliveryDate: Date; 
  deliveryTime: string; 
  breakdown: string;
  effectiveHours: number;
} {
  const { 
    orderItems, 
    primaryTechnicianSchedule, 
    supportTechnicianSchedule, 
    creationDate,
    currentWorkload = 0
  } = params;

  const effectiveHours = calculateSharedTimeHours(orderItems);
  
  if (effectiveHours <= 0) {
    return {
      deliveryDate: new Date(creationDate.getTime() + 24 * 60 * 60 * 1000),
      deliveryTime: primaryTechnicianSchedule.end_time,
      breakdown: 'No hay horas de trabajo estimadas',
      effectiveHours: 0
    };
  }

  const getWorkingHoursPerDay = (schedule: WorkSchedule): number => {
    const startTime = new Date(`1970-01-01T${schedule.start_time}`);
    const endTime = new Date(`1970-01-01T${schedule.end_time}`);
    const workingMinutes = (endTime.getTime() - startTime.getTime()) / 60000;
    // Horario corrido: no restar tiempo de descanso
    return Math.max(0, workingMinutes / 60);
  };

  const primaryHoursPerDay = getWorkingHoursPerDay(primaryTechnicianSchedule);
  
  // Si hay técnico de apoyo, aplicar reducción del 20% en el tiempo total
  let effectiveWorkingHours = effectiveHours;
  if (supportTechnicianSchedule) {
    effectiveWorkingHours = effectiveHours * 0.8; // Reducción del 20%
  }

  const totalHoursPerDay = primaryHoursPerDay;

  if (totalHoursPerDay <= 0) {
    return {
      deliveryDate: new Date(creationDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      deliveryTime: primaryTechnicianSchedule.end_time,
      breakdown: 'No se pudo calcular debido a horarios inválidos',
      effectiveHours
    };
  }

  // Considerar la carga de trabajo actual del técnico
  let adjustedHours = effectiveWorkingHours;
  if (currentWorkload > 0) {
    // Si el técnico tiene carga previa, esta orden se procesará después
    adjustedHours += currentWorkload;
  }

  const workingDays = primaryTechnicianSchedule.work_days;
  let currentDate = new Date(creationDate);
  // Crear una nueva fecha para no modificar la fecha original
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  
  let remainingHours = adjustedHours;
  let daysAdded = 0;

  // Avanzar al siguiente día laboral si empezamos en fin de semana
  while (!workingDays.includes(currentDate.getDay())) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calcular tiempo de creación y horarios de trabajo en minutos
  const creationTime = creationDate.getHours() * 60 + creationDate.getMinutes();
  const workStartTime = parseInt(primaryTechnicianSchedule.start_time.split(':')[0]) * 60 + 
                       parseInt(primaryTechnicianSchedule.start_time.split(':')[1]);
  const workEndTime = parseInt(primaryTechnicianSchedule.end_time.split(':')[0]) * 60 + 
                     parseInt(primaryTechnicianSchedule.end_time.split(':')[1]);
  const breakMinutes = primaryTechnicianSchedule.break_duration_minutes || 0;

  let startFromNextDay = false;
  let remainingHoursToday = 0;
  let hoursWorkedToday = 0;
  
  // Siempre programar para el siguiente día laboral, sin considerar la hora actual
  startFromNextDay = true;
  remainingHoursToday = 0; // No usar horas del día actual

  // Avanzar al siguiente día laboral
  currentDate.setDate(currentDate.getDate() + 1);
  while (!workingDays.includes(currentDate.getDay())) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calcular día por día considerando tiempo muerto
  let accumulatedHours = 0;
  
  while (remainingHours > 0) {
    const dayOfWeek = currentDate.getDay();
    
    if (workingDays.includes(dayOfWeek)) {
      let availableHoursToday = totalHoursPerDay;
      
      // En el primer día de trabajo, usar las horas restantes calculadas anteriormente
      if (daysAdded === 0 && !startFromNextDay) {
        availableHoursToday = remainingHoursToday;
      }
      
      const hoursToSubtract = Math.min(remainingHours, availableHoursToday);
      remainingHours -= hoursToSubtract;
      accumulatedHours += hoursToSubtract;
      daysAdded++;
      
      if (remainingHours <= 0) {
        hoursWorkedToday = hoursToSubtract;
        break;
      }
      
      // Solo avanzar al siguiente día si aún quedan horas por trabajar
      currentDate.setDate(currentDate.getDate() + 1);
    } else {
      // Día no laboral = tiempo muerto, solo avanzar la fecha
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // Calcular hora estimada de entrega (horario corrido sin descansos)
  let deliveryTime = primaryTechnicianSchedule.end_time;
  
  // Para cualquier trabajo que se complete en un día
  if (daysAdded === 1) {
    const startTime = new Date(`1970-01-01T${primaryTechnicianSchedule.start_time}`);
    
    // Usar las horas ajustadas (incluyendo carga previa) para el cálculo del tiempo
    const totalMinutes = adjustedHours * 60;
    const endTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);
    
    deliveryTime = endTime.toLocaleTimeString('es-CO', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  } else if (hoursWorkedToday > 0) {
    // Para trabajos de múltiples días, usar las horas del último día
    const startTime = new Date(`1970-01-01T${primaryTechnicianSchedule.start_time}`);
    const totalMinutes = hoursWorkedToday * 60;
    
    const endTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);
    
    deliveryTime = endTime.toLocaleTimeString('es-CO', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  } else {
    // Formatear la hora de fin con AM/PM como respaldo
    const endTime = new Date(`1970-01-01T${primaryTechnicianSchedule.end_time}`);
    deliveryTime = endTime.toLocaleTimeString('es-CO', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  }

  // Calcular días no laborales para el breakdown
  const totalDays = Math.ceil((currentDate.getTime() - creationDate.getTime()) / (24 * 60 * 60 * 1000));
  const deadDays = totalDays - daysAdded;
  
  const breakdown = ''; // Texto detallado removido por solicitud del usuario

  return {
    deliveryDate: currentDate,
    deliveryTime,
    breakdown,
    effectiveHours
  };
}

// Función legacy para mantener compatibilidad
export function calculateDeliveryDate(
  totalHours: number,
  primaryTechnicianSchedule: WorkSchedule,
  supportTechnicianSchedule?: WorkSchedule,
  startDate: Date = new Date()
): { deliveryDate: Date; deliveryTime: string; breakdown: string } {
  
  const getWorkingHoursPerDay = (schedule: WorkSchedule): number => {
    const startTime = new Date(`1970-01-01T${schedule.start_time}`);
    const endTime = new Date(`1970-01-01T${schedule.end_time}`);
    const workingMinutes = (endTime.getTime() - startTime.getTime()) / 60000;
    const breakMinutes = schedule.break_duration_minutes || 0;
    return Math.max(0, (workingMinutes - breakMinutes) / 60);
  };

  const primaryHoursPerDay = getWorkingHoursPerDay(primaryTechnicianSchedule);
  let supportHoursPerDay = 0;
  
  if (supportTechnicianSchedule) {
    supportHoursPerDay = getWorkingHoursPerDay(supportTechnicianSchedule);
  }

  const totalHoursPerDay = primaryHoursPerDay + supportHoursPerDay;

  if (totalHoursPerDay <= 0) {
    return {
      deliveryDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 días por defecto
      deliveryTime: primaryTechnicianSchedule.end_time,
      breakdown: 'No se pudo calcular debido a horarios inválidos'
    };
  }

  const workingDays = primaryTechnicianSchedule.work_days;
  let currentDate = new Date(startDate);
  let remainingHours = totalHours;
  let daysAdded = 0;

  // Avanzar al siguiente día laboral si empezamos en fin de semana
  while (!workingDays.includes(currentDate.getDay())) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  while (remainingHours > 0) {
    const dayOfWeek = currentDate.getDay();
    
    if (workingDays.includes(dayOfWeek)) {
      const hoursToSubtract = Math.min(remainingHours, totalHoursPerDay);
      remainingHours -= hoursToSubtract;
      daysAdded++;
      
      if (remainingHours <= 0) break;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calcular hora estimada de entrega
  const remainingHoursOnLastDay = totalHours % totalHoursPerDay;
  const startTime = new Date(`1970-01-01T${primaryTechnicianSchedule.start_time}`);
  const endTime = new Date(startTime.getTime() + (remainingHoursOnLastDay || totalHoursPerDay) * 60 * 60 * 1000);
  const deliveryTime = endTime.toTimeString().slice(0, 5);

  const breakdown = supportTechnicianSchedule 
    ? `${totalHours}h totales / ${totalHoursPerDay}h por día (${primaryHoursPerDay}h técnico principal + ${supportHoursPerDay}h técnico apoyo) = ${daysAdded} días laborales`
    : `${totalHours}h totales / ${primaryHoursPerDay}h por día = ${daysAdded} días laborales`;

  return {
    deliveryDate: currentDate,
    deliveryTime,
    breakdown
  };
}

export function calculateTechnicianWorkload(
  orders: Array<{
    assigned_technician: string;
    average_service_time: number;
    status: string;
  }>
): Record<string, TechnicianWorkload> {
  const workloadMap: Record<string, TechnicianWorkload> = {};

  orders.forEach(order => {
    if (!order.assigned_technician || order.status === 'finalizada') return;

    if (!workloadMap[order.assigned_technician]) {
      workloadMap[order.assigned_technician] = {
        technician_id: order.assigned_technician,
        current_orders: 0,
        total_hours: 0
      };
    }

    workloadMap[order.assigned_technician].current_orders++;
    workloadMap[order.assigned_technician].total_hours += order.average_service_time || 0;
  });

  return workloadMap;
}

export async function getTechnicianCurrentWorkload(technicianId: string): Promise<number> {
  const { supabase } = await import('../integrations/supabase/client');
  
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    // Get all active orders for this technician with service type details
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_items!inner(
          id,
          service_type_id,
          quantity,
          service_types!inner(
            estimated_hours,
            shared_time
          )
        )
      `)
      .eq('assigned_technician', technicianId)
      .in('status', ['pendiente', 'en_proceso', 'en_camino'])
      .abortSignal(controller.signal);

    clearTimeout(timeoutId);

    if (error) {
      console.error('Error getting technician workload:', error);
      return 0; // Return 0 instead of throwing to prevent blocking
    }

    if (!orders || orders.length === 0) {
      return 0;
    }

    // Calculate total workload from all active orders
    let totalWorkload = 0;
    
    orders.forEach(order => {
      if (order.order_items && order.order_items.length > 0) {
        const orderItems = order.order_items.map(item => ({
          id: item.id,
          estimated_hours: item.service_types?.estimated_hours || 0,
          shared_time: item.service_types?.shared_time || false,
          service_type_id: item.service_type_id,
          quantity: item.quantity || 1
        }));
        
        // Calculate effective hours for this order using shared time logic
        totalWorkload += calculateSharedTimeHours(orderItems);
      }
    });

    return totalWorkload;
  } catch (error: any) {
    // Handle abort errors gracefully
    if (error.name === 'AbortError') {
      console.warn('Workload calculation timed out for technician:', technicianId);
    } else {
      console.error('Failed to get technician workload:', error);
    }
    return 0; // Always return 0 to allow calculation to continue
  }
}

export function suggestSupportTechnician(
  primaryTechnicianId: string,
  totalHours: number,
  availableTechnicians: Array<{
    user_id: string;
    full_name: string;
  }>,
  technicianWorkloads: Record<string, TechnicianWorkload>
): { suggested: boolean; technician?: any; reason: string } {
  
  // Si el trabajo es menor a 8 horas, no sugerir apoyo
  if (totalHours < 8) {
    return {
      suggested: false,
      reason: 'El trabajo requiere menos de 8 horas, no se necesita apoyo'
    };
  }

  // Si el trabajo es mayor a 16 horas, definitivamente sugerir apoyo
  if (totalHours > 16) {
    const availableSupport = availableTechnicians
      .filter(tech => tech.user_id !== primaryTechnicianId)
      .sort((a, b) => {
        const workloadA = technicianWorkloads[a.user_id]?.total_hours || 0;
        const workloadB = technicianWorkloads[b.user_id]?.total_hours || 0;
        return workloadA - workloadB;
      });

    if (availableSupport.length > 0) {
      return {
        suggested: true,
        technician: availableSupport[0],
        reason: `El trabajo requiere ${totalHours} horas. Se recomienda apoyo para reducir tiempo de entrega`
      };
    }
  }

  // Para trabajos de 8-16 horas, sugerir apoyo si el técnico principal tiene mucha carga
  const primaryWorkload = technicianWorkloads[primaryTechnicianId];
  if (primaryWorkload && primaryWorkload.total_hours > 20) {
    const availableSupport = availableTechnicians
      .filter(tech => tech.user_id !== primaryTechnicianId)
      .filter(tech => (technicianWorkloads[tech.user_id]?.total_hours || 0) < 15)
      .sort((a, b) => {
        const workloadA = technicianWorkloads[a.user_id]?.total_hours || 0;
        const workloadB = technicianWorkloads[b.user_id]?.total_hours || 0;
        return workloadA - workloadB;
      });

    if (availableSupport.length > 0) {
      return {
        suggested: true,
        technician: availableSupport[0],
        reason: `El técnico principal tiene alta carga de trabajo (${primaryWorkload.total_hours}h). Se recomienda apoyo`
      };
    }
  }

  return {
    suggested: false,
    reason: 'No se requiere técnico de apoyo para este trabajo'
  };
}