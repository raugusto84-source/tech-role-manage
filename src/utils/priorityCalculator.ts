/**
 * Calcula la prioridad de una orden basándose en el tiempo transcurrido
 * vs el tiempo estimado de entrega
 */

export type OrderPriority = 'baja' | 'media' | 'alta' | 'critica';

export function calculateOrderPriority(
  createdAt: string,
  estimatedDeliveryDate: string | null,
  deliveryDate: string
): OrderPriority {
  const now = new Date();
  const created = new Date(createdAt);
  const targetDate = estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : new Date(deliveryDate);
  
  // Calcular tiempo total estimado en milisegundos
  const totalEstimatedTime = targetDate.getTime() - created.getTime();
  
  // Calcular tiempo transcurrido en milisegundos
  const elapsedTime = now.getTime() - created.getTime();
  
  // Calcular porcentaje
  const percentage = (elapsedTime / totalEstimatedTime) * 100;
  
  // Asignar prioridad basándose en el porcentaje
  if (percentage < 30) {
    return 'baja';
  } else if (percentage < 60) {
    return 'media';
  } else if (percentage < 90) {
    return 'alta';
  } else {
    return 'critica';
  }
}

export function getPriorityBadgeClass(priority: OrderPriority): string {
  const variants = {
    'baja': 'bg-green-100 text-green-800 border-green-200',
    'media': 'bg-orange-100 text-orange-800 border-orange-200',
    'alta': 'bg-orange-600 text-white border-orange-700',
    'critica': 'bg-red-600 text-white border-red-700'
  };
  return variants[priority];
}

export function getPriorityLabel(priority: OrderPriority): string {
  const labels = {
    'baja': 'Normal',
    'media': 'Media',
    'alta': 'Alta',
    'critica': 'Crítica'
  };
  return labels[priority];
}
