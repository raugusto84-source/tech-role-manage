import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X, AlertCircle, TrendingUp, DollarSign, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'fiscal_withdrawal': return FileText;
    case 'loan_overdue': return AlertCircle;
    case 'payroll_unpaid': return Users;
    case 'collection_pending': return DollarSign;
    case 'overdue_payment': return AlertCircle;
    case 'vat_status': return TrendingUp;
    default: return Bell;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'destructive';
    case 'high': return 'destructive';
    case 'normal': return 'default';
    case 'low': return 'secondary';
    default: return 'default';
  }
};

export function FinancialNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['financial-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Query para órdenes con pagos vencidos
  const { data: overdueOrders } = useQuery({
    queryKey: ['overdue-order-payments'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('pending_collections')
        .select('*')
        .eq('collection_type', 'order_payment')
        .eq('status', 'pending')
        .lt('due_date', today);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;
  const overdueCount = overdueOrders?.length || 0;
  const totalNotifications = unreadCount + (overdueCount > 0 ? 1 : 0);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('financial_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('financial_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-notifications'] });
    },
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalNotifications > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalNotifications}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notificaciones Financieras</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
            >
              Marcar todas como leídas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Cargando notificaciones...
            </div>
          ) : (notifications && notifications.length > 0) || overdueCount > 0 ? (
            <div className="divide-y">
              {/* Mostrar notificación de pagos vencidos primero */}
              {overdueCount > 0 && (
                <Card className="border-0 rounded-none bg-destructive/10">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="text-destructive mt-1">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-destructive">
                              {overdueCount} {overdueCount === 1 ? 'Orden' : 'Órdenes'} con Pagos Vencidos
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Requiere atención inmediata en la gestión de cobranza
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Ahora
                            </p>
                          </div>
                          <Badge variant="destructive">
                            urgent
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {notifications?.map((notification) => {
                const Icon = getNotificationIcon(notification.notification_type);
                return (
                  <Card
                    key={notification.id}
                    className={`border-0 rounded-none ${!notification.is_read ? 'bg-muted/50' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <div className={`mt-1 ${!notification.is_read ? 'text-primary' : 'text-muted-foreground'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{notification.title}</p>
                              {notification.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {notification.description}
                                </p>
                              )}
                              {notification.amount && (
                                <p className="text-sm font-semibold mt-1">
                                  ${notification.amount.toFixed(2)}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDistanceToNow(new Date(notification.created_at), {
                                  addSuffix: true,
                                  locale: es,
                                })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getPriorityColor(notification.priority)}>
                                {notification.priority}
                              </Badge>
                              {!notification.is_read && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => markAsReadMutation.mutate(notification.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No hay notificaciones</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}