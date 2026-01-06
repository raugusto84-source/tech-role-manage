/**
 * Utilidades para manejar los colores e iconos de categorías de servicio (Sistemas/Seguridad/Fraccionamientos)
 */

export const getServiceCategoryInfo = (category: string) => {
  const isSistemas = category === 'sistemas';
  const isFraccionamientos = category === 'fraccionamientos';
  const isSeguridad = category === 'seguridad';
  
  if (isFraccionamientos) {
    return {
      isSistemas: false,
      isFraccionamientos: true,
      isSeguridad: false,
      icon: '🏘️',
      label: 'FRACCIONAMIENTOS',
      colors: {
        cardBackground: 'bg-amber-50 dark:bg-amber-950/20',
        cardBorder: 'border-amber-200 dark:border-amber-800',
        titleText: 'text-amber-700 dark:text-amber-300',
        border: 'border-l-amber-500',
        background: 'bg-amber-50/50',
        fullCard: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
        section: 'bg-amber-50',
        text: 'text-amber-700',
        calendarHighlight: { backgroundColor: "hsl(45, 93%, 85%)", color: "hsl(45, 93%, 30%)" }
      }
    };
  }
  
  return {
    isSistemas,
    isFraccionamientos: false,
    isSeguridad,
    icon: isSistemas ? '💻' : '🛡️',
    label: isSistemas ? 'SISTEMAS' : 'SEGURIDAD',
    colors: {
      // Colores para cards
      cardBackground: isSistemas 
        ? 'bg-blue-50 dark:bg-blue-950/20' 
        : 'bg-red-50 dark:bg-red-950/20',
      cardBorder: isSistemas 
        ? 'border-blue-200 dark:border-blue-800'
        : 'border-red-200 dark:border-red-800',
      // Colores para texto del título
      titleText: isSistemas 
        ? 'text-blue-700 dark:text-blue-300'
        : 'text-red-700 dark:text-red-300',
      // Colores para bordes laterales
      border: isSistemas ? 'border-l-blue-500' : 'border-l-red-500',
      // Colores para fondos sutiles
      background: isSistemas ? 'bg-blue-50/50' : 'bg-red-50/50',
      // Colores para cards completos con borde
      fullCard: isSistemas 
        ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
        : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
      // Colores para tabs y secciones
      section: isSistemas ? 'bg-blue-50' : 'bg-red-50',
      text: isSistemas ? 'text-blue-700' : 'text-red-700',
      // Para calendarios
      calendarHighlight: isSistemas 
        ? { backgroundColor: "hsl(217, 91%, 85%)", color: "hsl(217, 91%, 30%)" }
        : { backgroundColor: "hsl(0, 84%, 85%)", color: "hsl(0, 84%, 30%)" }
    }
  };
};

// Para compatibilidad con código existente
export const getServiceCategoryColors = (category: string) => {
  return getServiceCategoryInfo(category).colors;
};

export const getServiceCategoryLabel = (category: string) => {
  const info = getServiceCategoryInfo(category);
  return `${info.icon} ${info.label}`;
};