import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, AlertTriangle, Package, PenTool } from 'lucide-react';
import { AuthorizationSignature } from './AuthorizationSignature';
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
  const [previousTotal, setPreviousTotal] = useState<number>(0);
  const [newItemsTotal, setNewItemsTotal] = useState<number>(0);
  const [orderTotal, setOrderTotal] = useState<number>(0);
  const [showSignature, setShowSignature] = useState(false);

  useEffect(() => {
    loadPendingModifications();
    calculateTotals();
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

  const calculateTotals = async () => {
    // Get all order items
    const { data: allItems, error } = await supabase
      .from('order_items')
      .select('total_amount, status, created_at')
      .eq('order_id', orderId);

    if (!error && allItems) {
      const totalAmount = allItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
      setOrderTotal(totalAmount);

      // Calculate items added before modifications (approved items)
      const approvedItems = allItems.filter(item => item.status !== 'pausa');
      const previousAmount = approvedItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
      setPreviousTotal(previousAmount);

      // Calculate new items in pause
      const newItems = allItems.filter(item => item.status === 'pausa');
      const newAmount = newItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
      setNewItemsTotal(newAmount);
    }
  };

  const handleApproval = (approved: boolean) => {
    if (approved) {
      setShowSignature(true);
    } else {
      handleRejection();
    }
  };

  const handleRejection = async () => {
    setLoading(true);

    try {
      // Update all pending modifications as rejected
      const { error: updateError } = await supabase
        .from('order_modifications')
        .update({
          client_approved: false,
          approved_at: new Date().toISOString()
        })
        .eq('order_id', orderId)
        .is('client_approved', null);

      if (updateError) throw updateError;

      // Remove items in pause status
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId)
        .eq('status', 'pausa');

      if (deleteError) throw deleteError;

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'en_proceso',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      toast({
        title: "Modificaciones rechazadas",
        description: "Los cambios han sido rechazados y los artículos removidos.",
        variant: "destructive"
      });

      onApprovalComplete();
    } catch (error) {
      console.error('Error processing rejection:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar el rechazo",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureComplete = async () => {
    setLoading(true);

    try {
      // Update all pending modifications as approved
      const { error: updateError } = await supabase
        .from('order_modifications')
        .update({
          client_approved: true,
          approved_at: new Date().toISOString()
        })
        .eq('order_id', orderId)
        .is('client_approved', null);

      if (updateError) throw updateError;

      // Update items status from pause to pending and order status back to in process
      const { error: itemsError } = await supabase
        .from('order_items')
        .update({ status: 'pendiente' })
        .eq('order_id', orderId)
        .eq('status', 'pausa');

      if (itemsError) throw itemsError;

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'en_proceso',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      toast({
        title: "Modificaciones aprobadas",
        description: "Los cambios han sido aprobados con su firma. La orden continuará su proceso.",
      });

      onApprovalComplete();
    } catch (error) {
      console.error('Error completing approval:', error);
      toast({
        title: "Error",
        description: "No se pudo completar la aprobación",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (modifications.length === 0) {
    return null;
  }

  // Show signature component if approval was confirmed
  if (showSignature) {
    return (
      <AuthorizationSignature
        orderId={orderId}
        orderNumber={`Modificación - ${orderId.slice(0, 8)}`}
        clientName={clientName}
        onSignatureComplete={handleSignatureComplete}
      />
    );
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

          {/* Resumen financiero */}
          <div className="space-y-4">
            <h3 className="font-semibold">Resumen de costos:</h3>
            
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total previamente autorizado:</span>
                <span className="font-medium">${previousTotal.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center text-primary">
                <span className="font-medium">Nuevos artículos:</span>
                <span className="font-semibold">+${newItemsTotal.toLocaleString()}</span>
              </div>
              
              <hr className="border-border" />
              
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Nuevo total de la orden:</span>
                <span className="text-primary">${orderTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Lista de modificaciones */}
          <div className="space-y-4">
            <h3 className="font-semibold">Nuevos artículos agregados:</h3>
            
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