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

export function calculateAdvancedDeliveryDate(params: DeliveryCalculationParams & { 
  effectiveHoursOverride?: number
}): { 
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

  const effectiveHours = typeof params.effectiveHoursOverride === 'number'
    ? params.effectiveHoursOverride
    : calculateSharedTimeHours(orderItems);
  
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
  // Crear una nueva fecha para no modificar la fecha original
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  
  let remainingHours = adjustedHours;
  let daysAdded = 0;

  // Calcular tiempo de creación y horarios de trabajo en minutos
  const creationTime = creationDate.getHours() * 60 + creationDate.getMinutes();
  const workStartTime = parseInt(primaryTechnicianSchedule.start_time.split(':')[0]) * 60 + 
                       parseInt(primaryTechnicianSchedule.start_time.split(':')[1]);
  const workEndTime = parseInt(primaryTechnicianSchedule.end_time.split(':')[0]) * 60 + 
                     parseInt(primaryTechnicianSchedule.end_time.split(':')[1]);

  let startFromNextDay = false;
  let remainingHoursToday = 0;
  let hoursWorkedToday = 0;
  
  // CAMBIO CLAVE: Verificar si podemos trabajar hoy
  const today = currentDate.getDay();
  const isWorkingDay = workingDays.includes(today);
  
  if (isWorkingDay && creationTime < workEndTime) {
    // Si es día laboral y aún hay tiempo disponible, calcular horas restantes hoy
    const availableMinutesToday = workEndTime - Math.max(creationTime, workStartTime);
    remainingHoursToday = Math.max(0, availableMinutesToday / 60);
    
    // Si tenemos suficiente tiempo hoy para completar el trabajo, no avanzar al siguiente día
    if (remainingHoursToday >= remainingHours) {
      startFromNextDay = false;
    } else {
      // Si no alcanza el tiempo de hoy, usar lo que queda y continuar mañana
      startFromNextDay = true;
      remainingHours -= remainingHoursToday;
    }
  } else {
    // No es día laboral o ya se acabó el horario, empezar mañana
    startFromNextDay = true;
    remainingHoursToday = 0;
  }

  // Si necesitamos empezar desde el siguiente día, avanzar al siguiente día laboral
  if (startFromNextDay) {
    currentDate.setDate(currentDate.getDate() + 1);
    while (!workingDays.includes(currentDate.getDay())) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
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
  if (daysAdded === 1 || (!startFromNextDay && remainingHours <= 0)) {
    const startTime = new Date(`1970-01-01T${primaryTechnicianSchedule.start_time}`);
    
    // Si estamos trabajando hoy, empezar desde la hora actual o de inicio
    if (!startFromNextDay) {
      const currentTimeMinutes = Math.max(creationTime, workStartTime);
      const currentHour = Math.floor(currentTimeMinutes / 60);
      const currentMinute = currentTimeMinutes % 60;
      const startTime = new Date(`1970-01-01T${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`);
      
      // Horario corrido: solo sumar las horas efectivas sin descansos
      const totalMinutes = effectiveHours * 60;
      const endTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);
      
      deliveryTime = endTime.toLocaleTimeString('es-CO', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
    } else {
      // Horario corrido: solo sumar las horas efectivas sin descansos
      const totalMinutes = effectiveHours * 60;
      const endTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);
      
      deliveryTime = endTime.toLocaleTimeString('es-CO', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
    }
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

/**
 * Calcula la carga de trabajo adicional considerando tiempo compartido de órdenes activas
 * Esta función es síncrona y se ejecuta en el contexto de cálculo de entrega
 */
export async function calculateTechnicianActiveWorkload(
  technicianId: string,
  newOrderItems: OrderItem[]
): Promise<number> {
  try {
    // Obtener órdenes activas del técnico
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { data: activeOrders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_items!inner(
          estimated_hours,
          service_type_id,
          quantity,
          service_types!inner(shared_time)
        )
      `)
      .eq('assigned_technician', technicianId)
      .in('status', ['pendiente', 'en_proceso', 'en_camino']);

    if (error) {
      console.error('Error fetching active orders:', error);
      return 0;
    }

    // Construir contexto por servicio: clientes distintos y unidades (cantidades)
    const serviceClientSets = new Map<string, Set<string>>();
    const serviceUnits = new Map<string, number>();
    const serviceSharedHours = new Map<string, number>();
    let nonSharedHours = 0;

    activeOrders?.forEach(order => {
      order.order_items?.forEach((item: any) => {
        const serviceId = item.service_type_id || 'unknown';
        const qty = item.quantity || 1;
        const hrs = item.estimated_hours || 0;
        const isShared = item.service_types?.shared_time || false;

        if (isShared) {
          if (!serviceClientSets.has(serviceId)) serviceClientSets.set(serviceId, new Set<string>());
          serviceClientSets.get(serviceId)!.add(order.id);

          serviceUnits.set(serviceId, (serviceUnits.get(serviceId) || 0) + qty);
          serviceSharedHours.set(serviceId, (serviceSharedHours.get(serviceId) || 0) + hrs);
        } else {
          nonSharedHours += hrs;
        }
      });
    });

    // Si no hay órdenes activas, no hay carga adicional
    if ((serviceClientSets.size === 0 && nonSharedHours === 0)) {
      return 0;
    }

    // Calcular horas efectivas aplicando tope: máximo 3 clientes o 5 servicios (lo que ocurra primero)
    let effectiveSharedHoursTotal = 0;

    serviceSharedHours.forEach((totalHours, serviceId) => {
      const clients = serviceClientSets.get(serviceId)?.size || 0;
      const units = serviceUnits.get(serviceId) || 0;
      const sharingFactor = Math.max(1, Math.min(3, clients, 5, units));
      effectiveSharedHoursTotal += totalHours / sharingFactor;
    });

    const activeWorkloadTime = nonSharedHours + effectiveSharedHoursTotal;
    
    return Math.max(0, activeWorkloadTime);
    
  } catch (error) {
    console.error('Error calculating technician workload:', error);
    return 0;
  }
}

/**
 * Función mejorada para calcular fecha de entrega que incluye carga activa automáticamente
 */
export async function calculateAdvancedDeliveryDateWithWorkload(params: DeliveryCalculationParams & { technicianId?: string }): Promise<{ 
  deliveryDate: Date; 
  deliveryTime: string; 
  breakdown: string;
  effectiveHours: number;
}> {
  const { technicianId, ...baseParams } = params;
  
  let currentWorkload = baseParams.currentWorkload || 0;
  let effectiveHoursOverride = calculateSharedTimeHours(baseParams.orderItems) + 0.5; // +0.5h tiempo muerto por orden
  
  if (technicianId) {
    try {
      const { supabase } = await import('@/integrations/supabase/client');

      const { data: activeOrders, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_items!inner(
            estimated_hours,
            service_type_id,
            quantity,
            service_types!inner(shared_time)
          )
        `)
        .eq('assigned_technician', technicianId)
        .in('status', ['pendiente', 'en_proceso', 'en_camino']);

      if (!error) {
        // Contexto activo por servicio
        const serviceClientSets = new Map<string, Set<string>>();
        const serviceUnits = new Map<string, number>();
        const serviceSharedHours = new Map<string, number>();
        let nonSharedHours = 0;

        activeOrders?.forEach(order => {
          order.order_items?.forEach((item: any) => {
            const serviceId = item.service_type_id || 'unknown';
            const qty = item.quantity || 1;
            const hrs = item.estimated_hours || 0;
            const isShared = item.service_types?.shared_time || false;

            if (isShared) {
              if (!serviceClientSets.has(serviceId)) serviceClientSets.set(serviceId, new Set<string>());
              serviceClientSets.get(serviceId)!.add(order.id);

              serviceUnits.set(serviceId, (serviceUnits.get(serviceId) || 0) + qty);
              serviceSharedHours.set(serviceId, (serviceSharedHours.get(serviceId) || 0) + hrs);
            } else {
              nonSharedHours += hrs;
            }
          });
        });

        // Carga activa efectiva
        let effectiveSharedHoursTotal = 0;
        serviceSharedHours.forEach((totalHours, serviceId) => {
          const clients = serviceClientSets.get(serviceId)?.size || 0;
          const units = serviceUnits.get(serviceId) || 0;
          const sharingFactor = Math.max(1, Math.min(3, clients, 5, units));
          effectiveSharedHoursTotal += totalHours / sharingFactor;
        });
        currentWorkload = nonSharedHours + effectiveSharedHoursTotal;
        // +0.5h por orden activa (tiempo muerto)
        currentWorkload += (activeOrders?.length || 0) * 0.5;
        // Total de unidades compartidas activas (global)
        const totalActiveSharedUnits = Array.from(serviceUnits.values()).reduce((sum, v) => sum + v, 0);

        // Calcular horas efectivas de la nueva orden aplicando el contexto activo
        const clientAddedForService = new Set<string>();
        const addedUnitsMap = new Map<string, number>();
        let newEffective = 0;
        let remainingSharedSlots = Math.max(0, 3 - totalActiveSharedUnits);

        (baseParams.orderItems || []).forEach((item) => {
          const serviceId = item.service_type_id || 'unknown';
          const qty = item.quantity || 1;
          const baseHours = item.estimated_hours || 0;

          if (item.shared_time) {
            const perUnit = baseHours / qty;
            const existingClients = serviceClientSets.get(serviceId)?.size || 0;
            const existingUnits = serviceUnits.get(serviceId) || 0;

            let addedUnits = addedUnitsMap.get(serviceId) || 0;
            const clientIncrement = clientAddedForService.has(serviceId) ? 0 : 1;

            for (let i = 0; i < qty; i++) {
              const unitsCount = existingUnits + addedUnits + 1; // incluir esta unidad
              let sharingFactor: number;
              const canShareGlobally = remainingSharedSlots > 0;

              if (!canShareGlobally) {
                // Tope global alcanzado (3 artículos compartidos)
                sharingFactor = 1;
              } else if ((existingClients >= 3) || ((existingUnits + addedUnits) >= 5)) {
                // Tope por servicio alcanzado
                sharingFactor = 1;
              } else {
                sharingFactor = Math.max(1, Math.min(3, existingClients + clientIncrement, 5, unitsCount));
              }

              newEffective += perUnit / sharingFactor;

              if (canShareGlobally && sharingFactor > 1) {
                remainingSharedSlots--; // consumimos un cupo global de compartido
              }

              addedUnits++;
            }

            addedUnitsMap.set(serviceId, addedUnits);
            clientAddedForService.add(serviceId);
          } else {
            newEffective += baseHours;
          }
        });

        // +0.5h por tiempo muerto de la nueva orden
        effectiveHoursOverride = newEffective + 0.5;
        console.log(`Carga activa: ${currentWorkload}h (+${(activeOrders?.length || 0)*0.5}h tiempo muerto), Horas efectivas nueva orden (+0.5h tiempo muerto): ${effectiveHoursOverride}h`);
      }
    } catch (error) {
      console.error('Error calculando carga y horas compartidas con tope:', error);
    }
  }

  return calculateAdvancedDeliveryDate({
    ...baseParams,
    currentWorkload,
    effectiveHoursOverride
  });
}
