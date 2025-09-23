import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';

// Zona horaria de México City
export const MEXICO_TIMEZONE = 'America/Mexico_City';

// Obtener la fecha actual en México City en formato YYYY-MM-DD
export const getCurrentDateMexico = (): string => {
  return formatInTimeZone(new Date(), MEXICO_TIMEZONE, 'yyyy-MM-dd');
};

// Obtener la fecha y hora actual en México City en formato ISO
export const getCurrentDateTimeMexico = (): string => {
  return formatInTimeZone(new Date(), MEXICO_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
};

// Formatear una fecha en zona horaria de México
export const formatDateMexico = (date: Date | string, pattern: string = 'dd/MM/yyyy'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, MEXICO_TIMEZONE, pattern, { locale: es });
};

// Formatear fecha y hora en zona horaria de México
export const formatDateTimeMexico = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, MEXICO_TIMEZONE, 'dd/MM/yyyy HH:mm', { locale: es });
};

// Convertir una fecha a zona horaria de México
export const toMexicoTime = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(dateObj, MEXICO_TIMEZONE);
};

// Obtener el inicio del día en México City
export const getStartOfDayMexico = (): string => {
  return formatInTimeZone(new Date(), MEXICO_TIMEZONE, "yyyy-MM-dd'T'00:00:00.000xxx");
};

// Obtener el fin del día en México City
export const getEndOfDayMexico = (): string => {
  return formatInTimeZone(new Date(), MEXICO_TIMEZONE, "yyyy-MM-dd'T'23:59:59.999xxx");
};