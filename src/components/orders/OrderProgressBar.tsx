import { Progress } from '@/components/ui/progress';
import { useOrderProgress } from '@/hooks/useOrderProgress';

interface OrderProgressBarProps {
  orderId: string;
  status: string;
  className?: string;
  showLabels?: boolean;
}

export function OrderProgressBar({ orderId, status, className = '', showLabels = false }: OrderProgressBarProps) {
  const { progress, loading } = useOrderProgress({ orderId });

  const getProgressColor = (progress: number, status: string) => {
    if (status === 'cancelada') return 'bg-red-500';
    if (progress === 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-purple-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getStatusLabel = (progress: number, status: string) => {
    if (status === 'cancelada') return 'Cancelada';
    if (progress === 100) return 'Finalizada';
    if (progress >= 75) return 'Casi terminada';
    if (progress >= 50) return 'En progreso';
    if (progress >= 25) return 'Iniciada';
    return 'Sin iniciar';
  };

  const color = getProgressColor(progress, status);
  const label = getStatusLabel(progress, status);

  if (loading) {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="relative">
          <Progress value={0} className="h-2 bg-muted animate-pulse" />
        </div>
        {showLabels && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Inicio</span>
            <span>Cargando...</span>
            <span>Completado</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="relative">
        <Progress 
          value={progress} 
          className="h-2 bg-muted"
        />
        <div 
          className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${progress}%` }}
        />
        {/* Mostrar porcentaje en el centro de la barra */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-white drop-shadow-sm">
            {progress}%
          </span>
        </div>
      </div>
      {showLabels && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Inicio</span>
          <span className={`font-medium ${progress === 100 ? 'text-green-600' : 'text-primary'}`}>
            {label}
          </span>
          <span>Completado</span>
        </div>
      )}
    </div>
  );
}