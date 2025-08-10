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

  // Para items con tiempo compartido, aplicar lógica de límite de 3 combinaciones
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
    if (serviceItems.length > 0) {
      // Calcular tiempo base por unidad del servicio
      const baseTimePerUnit = serviceItems[0].estimated_hours / (serviceItems[0].quantity || 1);
      
      // Calcular cantidad total de artículos de este servicio
      const totalQuantity = serviceItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
      
      // Aplicar límite de 3 combinaciones: máximo beneficio hasta 3 artículos
      const effectiveQuantity = Math.min(totalQuantity, 3);
      
      // El tiempo compartido se calcula usando solo el tiempo de la primera unidad
      // más incrementos menores para artículos adicionales (hasta 3)
      let sharedServiceHours = baseTimePerUnit; // Tiempo base
      
      if (effectiveQuantity > 1) {
        // Agregar tiempo adicional: 20% del tiempo base por cada artículo adicional
        const additionalTime = (effectiveQuantity - 1) * (baseTimePerUnit * 0.2);
        sharedServiceHours += additionalTime;
      }
      
      // Si hay más de 3 artículos, los restantes se calculan con tiempo completo
      if (totalQuantity > 3) {
        const remainingQuantity = totalQuantity - 3;
        sharedServiceHours += remainingQuantity * baseTimePerUnit;
      }
      
      totalHours += sharedServiceHours;
    }
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
      deliveryDate: new Date(creationDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      deliveryTime: primaryTechnicianSchedule.end_time,
      breakdown: 'No se pudo calcular debido a horarios inválidos',
      effectiveHours
    };
  }

  // Considerar la carga de trabajo actual del técnico
  let adjustedHours = effectiveHours;
  if (currentWorkload > 0) {
    // Si el técnico tiene carga previa, esta orden se procesará después
    adjustedHours += currentWorkload;
  }

  const workingDays = primaryTechnicianSchedule.work_days;
  let currentDate = new Date(creationDate);
  let remainingHours = adjustedHours;
  let daysAdded = 0;

  // Avanzar al siguiente día laboral si empezamos en fin de semana
  while (!workingDays.includes(currentDate.getDay())) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Si la orden se crea después del horario laboral, empezar al día siguiente
  const creationTime = creationDate.getHours() * 60 + creationDate.getMinutes();
  const workStartTime = parseInt(primaryTechnicianSchedule.start_time.split(':')[0]) * 60 + 
                       parseInt(primaryTechnicianSchedule.start_time.split(':')[1]);
  const workEndTime = parseInt(primaryTechnicianSchedule.end_time.split(':')[0]) * 60 + 
                     parseInt(primaryTechnicianSchedule.end_time.split(':')[1]);

  let startFromNextDay = false;
  if (creationTime > workEndTime || creationTime < workStartTime) {
    startFromNextDay = true;
  }

  if (startFromNextDay) {
    currentDate.setDate(currentDate.getDate() + 1);
    while (!workingDays.includes(currentDate.getDay())) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  while (remainingHours > 0) {
    const dayOfWeek = currentDate.getDay();
    
    if (workingDays.includes(dayOfWeek)) {
      let availableHoursToday = totalHoursPerDay;
      
      // En el primer día de trabajo, considerar las horas restantes del día
      if (daysAdded === 0 && !startFromNextDay) {
        const remainingMinutesToday = workEndTime - Math.max(creationTime, workStartTime);
        availableHoursToday = Math.max(0, remainingMinutesToday / 60);
        availableHoursToday = Math.min(availableHoursToday, totalHoursPerDay);
      }
      
      const hoursToSubtract = Math.min(remainingHours, availableHoursToday);
      remainingHours -= hoursToSubtract;
      daysAdded++;
      
      if (remainingHours <= 0) break;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calcular hora estimada de entrega
  const finalDayHours = adjustedHours % totalHoursPerDay;
  const hoursOnFinalDay = finalDayHours || (adjustedHours > 0 ? totalHoursPerDay : 0);
  
  const startTime = new Date(`1970-01-01T${primaryTechnicianSchedule.start_time}`);
  const endTime = new Date(startTime.getTime() + hoursOnFinalDay * 60 * 60 * 1000);
  const deliveryTime = endTime.toTimeString().slice(0, 5);

  const breakdown = supportTechnicianSchedule 
    ? `${effectiveHours}h efectivas (${adjustedHours}h con carga previa) / ${totalHoursPerDay}h por día (${primaryHoursPerDay}h técnico principal + ${supportHoursPerDay}h técnico apoyo) = ${daysAdded} días laborales`
    : `${effectiveHours}h efectivas (${adjustedHours}h con carga previa) / ${primaryHoursPerDay}h por día = ${daysAdded} días laborales`;

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