/**
 * Utilidades para categorizar el tiempo transcurrido en cotizaciones
 * Base: 4 horas para enviar al cliente, después es atraso
 */

export interface TimeCategory {
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  isDelayed: boolean;
  severity: 'ok' | 'warning' | 'danger' | 'critical';
}

// Límites de tiempo en horas para cada estado
export const STATUS_TIME_LIMITS: Record<string, number> = {
  solicitud: 4,      // 4 horas para enviar
  pendiente_aprobacion: 4,
  asignando: 8,      // 8 horas para asignar material
  enviada: 24,       // 24 horas para respuesta del cliente
  seguimiento: 48,   // 48 horas para dar seguimiento
  aceptada: 4,       // 4 horas para procesar
  rechazada: 0,      // No aplica
};

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
