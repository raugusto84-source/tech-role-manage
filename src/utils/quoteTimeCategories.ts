/**
 * Utilidades para categorizar el tiempo transcurrido en cotizaciones
 * y asignar tareas pendientes según el estado
 */

export interface TimeCategory {
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  isDelayed: boolean;
  severity: 'ok' | 'warning' | 'danger' | 'critical';
}

export interface TaskInfo {
  task: string;
  isDelayed: boolean;
  severity: 'ok' | 'warning' | 'danger' | 'critical' | 'expired';
  colorClass: string;
  bgClass: string;
  borderClass: string;
  hoursInStatus: number;
}

// Límites de tiempo en horas para cada estado
export const STATUS_TIME_LIMITS: Record<string, number> = {
  solicitud: 4,      // 4 horas para revisar y enviar
  pendiente_aprobacion: 4,
  asignando: 8,      // 8 horas para asignar material
  enviada: 24,       // 24 horas para que cliente responda, luego contactar
  seguimiento: 48,   // 48 horas para dar seguimiento
  aceptada: 4,       // 4 horas para procesar
  rechazada: 0,      // No aplica
};

// 7 días en horas para expiración automática
const EXPIRATION_HOURS = 7 * 24; // 168 horas

/**
 * Obtiene la información de tarea basada en el estado y tiempo transcurrido
 * @param hours - Horas transcurridas en el estado actual
 * @param status - Estado actual de la cotización
 */
export function getTaskInfo(hours: number, status: string): TaskInfo {
  const limit = STATUS_TIME_LIMITS[status] || 4;
  
  // Caso especial: Enviada > 7 días = Vencida
  if (status === 'enviada' && hours >= EXPIRATION_HOURS) {
    return {
      task: 'Marcar como No Aceptada (vencida)',
      isDelayed: true,
      severity: 'expired',
      colorClass: 'text-gray-700',
      bgClass: 'bg-gray-100',
      borderClass: 'border-gray-400',
      hoursInStatus: hours
    };
  }
  
  // Nueva > 4 horas = Atrasado, Tarea: Revisar y Enviar
  if (status === 'solicitud') {
    if (hours <= limit) {
      return {
        task: 'Revisar y Enviar',
        isDelayed: false,
        severity: 'ok',
        colorClass: 'text-emerald-700',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
        hoursInStatus: hours
      };
    }
    return {
      task: 'Revisar y Enviar',
      isDelayed: true,
      severity: hours > limit * 2 ? 'critical' : 'warning',
      colorClass: hours > limit * 2 ? 'text-red-700' : 'text-amber-700',
      bgClass: hours > limit * 2 ? 'bg-red-50' : 'bg-amber-50',
      borderClass: hours > limit * 2 ? 'border-red-300' : 'border-amber-300',
      hoursInStatus: hours
    };
  }
  
  // Enviada > 24 horas = Atrasado, Tarea: Hablar con cliente
  if (status === 'enviada') {
    if (hours <= limit) {
      return {
        task: 'Esperando respuesta',
        isDelayed: false,
        severity: 'ok',
        colorClass: 'text-blue-700',
        bgClass: 'bg-blue-50',
        borderClass: 'border-blue-200',
        hoursInStatus: hours
      };
    }
    // > 24h pero < 7 días
    return {
      task: 'Hablar con cliente',
      isDelayed: true,
      severity: hours > limit * 3 ? 'critical' : 'warning',
      colorClass: hours > limit * 3 ? 'text-red-700' : 'text-amber-700',
      bgClass: hours > limit * 3 ? 'bg-red-50' : 'bg-amber-50',
      borderClass: hours > limit * 3 ? 'border-red-300' : 'border-amber-300',
      hoursInStatus: hours
    };
  }
  
  // Otros estados - usar lógica genérica
  if (hours <= limit) {
    return {
      task: 'En proceso',
      isDelayed: false,
      severity: 'ok',
      colorClass: 'text-emerald-700',
      bgClass: 'bg-emerald-50',
      borderClass: 'border-emerald-200',
      hoursInStatus: hours
    };
  }
  
  return {
    task: 'Requiere atención',
    isDelayed: true,
    severity: hours > limit * 2 ? 'critical' : 'warning',
    colorClass: hours > limit * 2 ? 'text-red-700' : 'text-amber-700',
    bgClass: hours > limit * 2 ? 'bg-red-50' : 'bg-amber-50',
    borderClass: hours > limit * 2 ? 'border-red-300' : 'border-amber-300',
    hoursInStatus: hours
  };
}

/**
 * Obtiene la categoría de tiempo basada en las horas transcurridas
 * @param hours - Horas transcurridas en el estado actual
 * @param status - Estado actual de la cotización
 */
export function getTimeCategory(hours: number, status: string): TimeCategory {
  const limit = STATUS_TIME_LIMITS[status] || 4;
  
  // Categorías basadas en múltiplos del límite
  if (hours <= limit) {
    // Dentro del tiempo esperado
    return {
      label: 'En tiempo',
      colorClass: 'text-emerald-700',
      bgClass: 'bg-emerald-50',
      borderClass: 'border-emerald-200',
      isDelayed: false,
      severity: 'ok'
    };
  }
  
  if (hours <= limit * 2) {
    // 1 día de atraso (hasta 2x el límite)
    return {
      label: '1 día atraso',
      colorClass: 'text-amber-700',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-300',
      isDelayed: true,
      severity: 'warning'
    };
  }
  
  if (hours <= limit * 3) {
    // 2 días de atraso (hasta 3x el límite)
    return {
      label: '2 días atraso',
      colorClass: 'text-orange-700',
      bgClass: 'bg-orange-50',
      borderClass: 'border-orange-300',
      isDelayed: true,
      severity: 'danger'
    };
  }
  
  // 3+ días de atraso (más de 3x el límite)
  return {
    label: '3+ días atraso',
    colorClass: 'text-red-700',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-300',
    isDelayed: true,
    severity: 'critical'
  };
}

/**
 * Obtiene el tiempo límite formateado para mostrar al usuario
 */
export function getTimeLimitLabel(status: string): string {
  const limit = STATUS_TIME_LIMITS[status];
  if (!limit) return '';
  
  if (limit < 24) {
    return `${limit}h límite`;
  }
  
  const days = Math.floor(limit / 24);
  return `${days}d límite`;
}

/**
 * Calcula el porcentaje de tiempo usado respecto al límite
 */
export function getTimePercentage(hours: number, status: string): number {
  const limit = STATUS_TIME_LIMITS[status] || 4;
  return Math.min((hours / limit) * 100, 100);
}

/**
 * Verifica si una cotización enviada debería expirar automáticamente
 */
export function shouldAutoExpire(hours: number, status: string): boolean {
  return status === 'enviada' && hours >= EXPIRATION_HOURS;
}
