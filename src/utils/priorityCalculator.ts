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
    'baja': 'bg-priority-baja text-priority-baja-foreground hover:bg-priority-baja/90',
    'media': 'bg-priority-media text-priority-media-foreground hover:bg-priority-media/90',
    'alta': 'bg-priority-alta text-priority-alta-foreground hover:bg-priority-alta/90',
    'critica': 'bg-priority-critica text-priority-critica-foreground hover:bg-priority-critica/90'
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
