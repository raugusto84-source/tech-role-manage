/**
 * Utilidades para formatear tiempo
 */

/**
 * Convierte horas decimales a formato "Xh Ym"
 * @param hours - Horas en formato decimal (ej: 8.5)
 * @returns Formato legible "8h 30m"
 */
export function formatHoursAndMinutes(hours: number): string {
  if (hours === 0) return '0h 0m';
  
  // Si son más de 24 horas, mostrar en días
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    const minutes = Math.round((hours - Math.floor(hours)) * 60);
    
    if (remainingHours === 0 && minutes === 0) {
      return `${days}d`;
    }
    if (remainingHours === 0) {
      return `${days}d ${minutes}m`;
    }
    if (minutes === 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d ${remainingHours}h ${minutes}m`;
  }
  
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (wholeHours === 0) {
    return `${minutes}m`;
  }
  
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  
  return `${wholeHours}h ${minutes}m`;
}

/**
 * Convierte horas decimales a formato compacto "X:XX"
 * @param hours - Horas en formato decimal (ej: 8.5)
 * @returns Formato "8:30"
 */
export function formatHoursCompact(hours: number): string {
  if (hours === 0) return '0:00';
  
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Calcula la diferencia en horas entre dos timestamps
 * @param startTime - Hora de inicio
 * @param endTime - Hora de fin
 * @returns Horas trabajadas en decimal
 */
export function calculateWorkHours(startTime: string, endTime: string): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60); // Convertir a horas
}

/**
 * Obtiene el rango de la semana actual
 * @param date - Fecha de referencia
 * @returns Objeto con fecha de inicio y fin de semana
 */
export function getWeekRange(date: Date) {
  const monday = new Date(date);
  monday.setDate(date.getDate() - date.getDay() + 1);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: monday,
    end: sunday,
    startString: monday.toISOString().split('T')[0],
    endString: sunday.toISOString().split('T')[0]
  };
}