import { Progress } from '@/components/ui/progress';

interface OrderProgressBarProps {
  status: string;
  className?: string;
  showLabels?: boolean;
}

export function OrderProgressBar({ status, className = '', showLabels = false }: OrderProgressBarProps) {
  const getProgressData = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion':
        return { progress: 25, label: 'Pendiente de Aprobación', color: 'bg-yellow-500' };
      case 'en_proceso':
        return { progress: 50, label: 'En Proceso', color: 'bg-blue-500' };
      case 'pendiente_actualizacion':
        return { progress: 40, label: 'Pendiente de Actualización', color: 'bg-orange-500' };
      case 'pendiente_entrega':
        return { progress: 75, label: 'Pendiente de Entrega', color: 'bg-purple-500' };
      case 'finalizada':
        return { progress: 100, label: 'Finalizada', color: 'bg-green-500' };
      case 'cancelada':
        return { progress: 0, label: 'Cancelada', color: 'bg-red-500' };
      default:
        return { progress: 0, label: 'Sin estado', color: 'bg-gray-500' };
    }
  };

  const { progress, label, color } = getProgressData(status);

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="relative">
        <Progress 
          value={progress} 
          className="h-2 bg-muted"
        />
        <div 
          className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {showLabels && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Inicio</span>
          <span className={`font-medium ${progress === 100 ? 'text-green-600' : 'text-primary'}`}>
            {label}
          </span>
          <span>Entregado</span>
        </div>
      )}
    </div>
  );
}