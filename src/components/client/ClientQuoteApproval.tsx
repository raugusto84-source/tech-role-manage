import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, FileText, Loader2, DollarSign } from 'lucide-react';
import { formatCOPCeilToTen } from '@/utils/currency';

interface QuoteItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  total: number;
}

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  service_description?: string;
  estimated_amount?: number;
  client_name?: string;
  created_at: string;
}

interface ClientQuoteApprovalProps {
  quote: Quote;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteUpdated: () => void;
}

export function ClientQuoteApproval({ quote, open, onOpenChange, onQuoteUpdated }: ClientQuoteApprovalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'accept' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Load quote items when dialog opens
  useEffect(() => {
    const loadQuoteItems = async () => {
      if (!quote.id || !open) return;
      setLoadingItems(true);
      try {
        const { data, error } = await supabase
          .from('quote_items')
          .select('id, name, quantity, unit_price, subtotal, total')
          .eq('quote_id', quote.id);

        if (error) throw error;
        setQuoteItems(data || []);
      } catch (error) {
        console.error('Error loading quote items:', error);
      } finally {
        setLoadingItems(false);
      }
    };

    if (open) {
      loadQuoteItems();
    }
  }, [open, quote.id]);

  const handleAccept = async () => {
    setLoading(true);
    setAction('accept');
    try {
      // Call the convert_quote_to_order function to accept and create order
      const { data, error } = await supabase.rpc('convert_quote_to_order', {
        quote_id: quote.id
      });

      if (error) throw error;

      const result = data as any;
      
      if (result?.error) {
        throw new Error(result.error);
      }

      // Log the status change
      await supabase.from('quote_status_logs').insert({
        quote_id: quote.id,
        previous_status: quote.status,
        new_status: 'aceptada',
        notes: 'Cliente aceptó la cotización desde el portal'
      });

      // Send notification email to sales team
      try {
        await supabase.functions.invoke('send-internal-notification', {
          body: {
            notification_type: 'quote_accepted',
            data: {
              quote_number: quote.quote_number,
              client_name: quote.client_name,
              total: total,
              description: quote.service_description
            }
          }
        });
      } catch (emailError) {
        console.error('Error sending notification email:', emailError);
        // Don't fail the whole operation if email fails
      }

      toast({
        title: "¡Cotización Aceptada!",
        description: result?.order_number 
          ? `Se ha creado la orden ${result.order_number}. Pronto nos pondremos en contacto.`
          : "Tu solicitud ha sido procesada correctamente.",
      });

      onQuoteUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error accepting quote:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar la aceptación",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setAction('reject');
    try {
      // Update quote status to rejected
      const { error: updateError } = await supabase
        .from('quotes')
        .update({ 
          status: 'rechazada',
          response_token: null 
        })
        .eq('id', quote.id);

      if (updateError) throw updateError;

      // Log the status change
      await supabase.from('quote_status_logs').insert({
        quote_id: quote.id,
        previous_status: quote.status,
        new_status: 'rechazada',
        notes: `Cliente rechazó la cotización desde el portal. ${rejectReason ? `Razón: ${rejectReason}` : ''}`
      });

      toast({
        title: "Cotización No Aceptada",
        description: "Hemos registrado tu decisión. ¿Podemos ayudarte con algo más?",
      });

      onQuoteUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error rejecting quote:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar el rechazo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setAction(null);
      setRejectReason('');
    }
  };

  // Use total (includes VAT) to match list view - fallback to estimated_amount if no items
  const total = quoteItems.length > 0 
    ? quoteItems.reduce((sum, item) => sum + (item.total || 0), 0)
    : (quote.estimated_amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Cotización {quote.quote_number}
          </DialogTitle>
          <DialogDescription>
            Revisa los detalles y decide si deseas aceptar esta cotización.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quote Description */}
          {quote.service_description && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Descripción del Servicio</h4>
                <p className="text-sm">{quote.service_description}</p>
              </CardContent>
            </Card>
          )}

          {/* Quote Items */}
          {loadingItems ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : quoteItems.length > 0 ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Detalle de Items</h4>
                {quoteItems.map((item) => {
                  // Calculate display price per unit from total (VAT included)
                  const unitPriceDisplay = item.quantity > 0 
                    ? (item.total || 0) / item.quantity 
                    : item.unit_price || 0;
                  return (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                    </div>
                    <span className="text-right">{formatCOPCeilToTen(item.total || 0)}</span>
                  </div>
                  );
                })}
                <Separator />
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Total
                  </span>
                  <span className="text-lg text-primary">{formatCOPCeilToTen(total)}</span>
                </div>
              </CardContent>
            </Card>
          ) : quote.estimated_amount ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Monto Estimado
                  </span>
                  <span className="text-lg text-primary">{formatCOPCeilToTen(quote.estimated_amount)}</span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Estado actual:</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Esperando tu respuesta
            </Badge>
          </div>

          {/* Reject Reason (only shown when rejecting) */}
          {action === 'reject' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">¿Por qué no aceptas la cotización? (opcional)</label>
              <Textarea
                placeholder="Comparte tu razón para ayudarnos a mejorar..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {action === 'reject' ? (
            <>
              <Button
                variant="outline"
                onClick={() => setAction(null)}
                disabled={loading}
              >
                Volver
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Confirmar No Aceptar
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setAction('reject')}
                disabled={loading}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                No Acepto
              </Button>
              <Button
                onClick={handleAccept}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading && action === 'accept' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Acepto la Cotización
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
