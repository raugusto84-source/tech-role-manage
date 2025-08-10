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

export function calculateDeliveryDate(
  totalHours: number,
  primaryTechnicianSchedule: WorkSchedule,
  supportTechnicianSchedule?: WorkSchedule,
  startDate: Date = new Date()
): { deliveryDate: Date; breakdown: string } {
  
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

  const breakdown = supportTechnicianSchedule 
    ? `${totalHours}h totales / ${totalHoursPerDay}h por día (${primaryHoursPerDay}h técnico principal + ${supportHoursPerDay}h técnico apoyo) = ${daysAdded} días laborales`
    : `${totalHours}h totales / ${primaryHoursPerDay}h por día = ${daysAdded} días laborales`;

  return {
    deliveryDate: currentDate,
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