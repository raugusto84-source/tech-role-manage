import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, AlertTriangle, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderModification {
  id: string;
  modification_type: string;
  items_added: any;
  created_at: string;
  client_approved: boolean | null;
}

interface OrderModificationApprovalProps {
  orderId: string;
  clientName: string;
  onApprovalComplete: () => void;
}

export function OrderModificationApproval({ orderId, clientName, onApprovalComplete }: OrderModificationApprovalProps) {
  const { toast } = useToast();
  const [modifications, setModifications] = useState<OrderModification[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderTotal, setOrderTotal] = useState<number>(0);

  useEffect(() => {
    loadPendingModifications();
    calculateOrderTotal();
  }, [orderId]);

  const loadPendingModifications = async () => {
    const { data, error } = await supabase
      .from('order_modifications')
      .select('*')
      .eq('order_id', orderId)
      .is('client_approved', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading modifications:', error);
    } else {
      setModifications(data || []);
    }
  };

  const calculateOrderTotal = async () => {
    const { data, error } = await supabase
      .from('order_items')
      .select('total_amount')
      .eq('order_id', orderId);

    if (!error && data) {
      const total = data.reduce((sum, item) => sum + (item.total_amount || 0), 0);
      setOrderTotal(total);
    }
  };

  const handleApproval = async (approved: boolean) => {
    setLoading(true);

    try {
      // Update all pending modifications
      const { error: updateError } = await supabase
        .from('order_modifications')
        .update({
          client_approved: approved,
          approved_at: new Date().toISOString()
        })
        .eq('order_id', orderId)
        .is('client_approved', null);

      if (updateError) throw updateError;

      if (approved) {
        // Update order status to approved
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: 'pendiente',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (orderError) throw orderError;

        toast({
          title: "Modificaciones aprobadas",
          description: "Los cambios han sido aprobados. La orden continuará su proceso.",
        });
      } else {
        // If rejected, remove the added items and restore order status
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId)
          .gte('created_at', modifications[0]?.created_at);

        if (deleteError) throw deleteError;

        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: 'pendiente',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (orderError) throw orderError;

        toast({
          title: "Modificaciones rechazadas",
          description: "Los cambios han sido rechazados y los artículos removidos.",
          variant: "destructive"
        });
      }

      onApprovalComplete();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la respuesta",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (modifications.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <AlertTriangle className="h-6 w-6 text-warning" />
            Aprobación de Modificaciones
          </CardTitle>
          <p className="text-muted-foreground">
            Sr(a). {clientName}, se han agregado nuevos artículos a su orden
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-info/10 border border-info/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-info mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-info mb-1">¿Qué necesita hacer?</p>
                <ul className="text-info/80 space-y-1 list-disc list-inside">
                  <li>Revisar los nuevos artículos agregados</li>
                  <li>Verificar el costo adicional</li>
                  <li>Aprobar o rechazar las modificaciones</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Lista de modificaciones */}
          <div className="space-y-4">
            <h3 className="font-semibold">Artículos agregados recientemente:</h3>
            
            {modifications.map((mod) => (
              <div key={mod.id} className="border border-border rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{mod.items_added?.service_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Cantidad: {mod.items_added?.quantity} | 
                      Total: ${mod.items_added?.total_amount?.toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {format(new Date(mod.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Total de la orden */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total de la orden:</span>
              <span>${orderTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            <Button
              variant="outline"
              onClick={() => handleApproval(false)}
              disabled={loading}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {loading ? "Procesando..." : "Rechazar cambios"}
            </Button>
            
            <Button
              onClick={() => handleApproval(true)}
              disabled={loading}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {loading ? "Procesando..." : "Aprobar cambios"}
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">Al aprobar autoriza:</p>
            <ul className="text-xs space-y-1">
              <li>• Los nuevos artículos agregados a su orden</li>
              <li>• El costo adicional mostrado</li>
              <li>• La continuación del servicio</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}