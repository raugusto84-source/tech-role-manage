import { Bell, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useAuth } from '@/hooks/useAuth';

export function OrderNotifications() {
  const { profile } = useAuth();
  const counts = useUnreadCounts();

  // Only show for admin and staff roles
  if (!profile || !['administrador', 'vendedor', 'supervisor'].includes(profile.role)) {
    return null;
  }

  const totalNotifications = counts.ordersPendingAuth + counts.ordersInProcess + counts.ordersFinalized;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {totalNotifications > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {totalNotifications > 99 ? '99+' : totalNotifications}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">Notificaciones de Órdenes</h4>
          
          <div className="space-y-3">
            {/* Pending Authorization */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium">Pendientes de Autorización</p>
                  <p className="text-xs text-muted-foreground">Órdenes esperando aprobación</p>
                </div>
              </div>
              <Badge variant="secondary">{counts.ordersPendingAuth}</Badge>
            </div>

            {/* In Process */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">En Proceso</p>
                  <p className="text-xs text-muted-foreground">Órdenes en ejecución</p>
                </div>
              </div>
              <Badge variant="secondary">{counts.ordersInProcess}</Badge>
            </div>

            {/* Finalized */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Pendientes de Cobro</p>
                  <p className="text-xs text-muted-foreground">Órdenes finalizadas sin cobrar</p>
                </div>
              </div>
              <Badge variant="secondary">{counts.ordersFinalized}</Badge>
            </div>
          </div>

          {totalNotifications === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No hay notificaciones pendientes</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}