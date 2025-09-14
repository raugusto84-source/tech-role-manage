/**
 * Utilidades para manejar los colores e iconos de servicios y productos
 */

export const getItemTypeInfo = (itemType: string) => {
  const isService = itemType === 'servicio';
  
  return {
    isService,
    icon: isService ? '🔧' : '📦',
    label: isService ? 'Servicio' : 'Producto',
    colors: {
      // Colores para badges
      badge: isService 
        ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
        : 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200',
      // Colores para bordes laterales
      border: isService ? 'border-l-blue-500' : 'border-l-green-500',
      // Colores para fondos
      background: isService ? 'bg-blue-50/50' : 'bg-green-50/50',
      // Colores para cards completos
      card: isService 
        ? 'border-l-blue-500 bg-blue-50/30'
        : 'border-l-green-500 bg-green-50/30',
      // Colores para tabs y secciones
      section: isService ? 'bg-blue-50' : 'bg-green-50',
      text: isService ? 'text-blue-700' : 'text-green-700',
    }
  };
};

// Para compatibilidad con código existente
export const getItemTypeBadgeClass = (itemType: string) => {
  return getItemTypeInfo(itemType).colors.badge;
};

export const getItemTypeLabel = (itemType: string) => {
  const info = getItemTypeInfo(itemType);
  return `${info.icon} ${info.label}`;
};