import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package, ShoppingCart, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCOPCeilToTen } from '@/utils/currency';
import { getItemTypeInfo } from '@/utils/itemTypeUtils';
interface QuoteItem {
  id: string;
  quote_id: string;
  service_type_id?: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  is_custom: boolean;
  image_url?: string | null;
  item_type?: string;
  service_types?: {
    image_url?: string | null;
    item_type?: string;
  };
}
interface ClientQuoteItemsSummaryProps {
  quoteId: string;
  estimatedAmount: number;
}
export function ClientQuoteItemsSummary({
  quoteId,
  estimatedAmount
}: ClientQuoteItemsSummaryProps) {
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadQuoteItems();
  }, [quoteId]);
  const loadQuoteItems = async () => {
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from('quote_items').select(`
          *,
          service_types (
            image_url,
            item_type
          )
        `).eq('quote_id', quoteId).order('created_at', {
        ascending: true
      });
      if (error) {
        console.error('Error loading quote items:', error);
        return;
      }
      setQuoteItems(data || []);
    } catch (error) {
      console.error('Error loading quote items:', error);
    } finally {
      setLoading(false);
    }
  };
  const formatCurrency = (amount: number) => formatCOPCeilToTen(amount);
  const calculateTotals = () => {
    // Sumar directamente usando los totales guardados en cada quote item
    const total = quoteItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const subtotal = quoteItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const vatTotal = quoteItems.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
    
    return {
      subtotal,
      vatTotal,
      total
    };
  };
  const {
    subtotal,
    vatTotal,
    total
  } = calculateTotals();
  if (loading) {
    return <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-24 bg-muted rounded-lg"></div>
        </div>
      </div>;
  }
  return <div className="space-y-4">
      {/* Quote Ready Status Card with Expanded Details */}
      <Card className="border-2 border-green-200 bg-green-50/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-800 font-semibold">¡Tu cotización está lista!</span>
            </div>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-green-200 mb-3">
            <div className="text-center mb-4">
              <div className="text-3xl font-bold text-green-700 mb-1">
                {formatCurrency(estimatedAmount || total)}
              </div>
              <div className="text-sm text-green-600">
                {quoteItems.length} servicio{quoteItems.length !== 1 ? 's' : ''} incluido{quoteItems.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Quick breakdown in summary */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA:</span>
                <span>{formatCurrency(vatTotal)}</span>
              </div>
              <div className="flex justify-between font-semibold text-green-700 border-t pt-1">
                <span>Total:</span>
                <span>{formatCurrency(estimatedAmount || total)}</span>
              </div>
            </div>
          </div>

          <div className="text-sm text-green-700 text-center">
            Puedes enviar esta cotización ahora o agregar más servicios opcionales
          </div>
        </CardContent>
      </Card>

      {/* Detailed Items Breakdown - Always Visible */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-primary">
            <Package className="h-5 w-5" />
            Desglose detallado de servicios
          </h3>
          
          {quoteItems.length > 0 ? <div className="space-y-3">
              {quoteItems.map((item, index) => {
            const itemTypeInfo = getItemTypeInfo(item.item_type || item.service_types?.item_type || 'servicio');
            return <div key={item.id} className="border rounded-lg p-4 bg-card/50">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-base mb-1">{item.name}</h4>
                            {item.description && <p className="text-sm text-muted-foreground mb-2">
                                {item.description}
                              </p>}
                            <Badge variant="outline" className="text-xs mb-2">
                              {itemTypeInfo.label}
                            </Badge>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold text-primary">
                              {formatCurrency(item.total || 0)}
                            </div>
                          </div>
                        </div>

                        {/* Detailed pricing breakdown for each item */}
                        
                      </div>
                    </div>
                  </div>;
          })}
            </div> : <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay servicios agregados a esta cotización</p>
            </div>}
        </CardContent>
      </Card>

      {/* Final Totals Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-primary">
            <DollarSign className="h-5 w-5" />
            Resumen final
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground">Subtotal ({quoteItems.length} servicios):</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground">IVA Total:</span>
              <span className="font-semibold">{formatCurrency(vatTotal)}</span>
            </div>
            
            <div className="border-t-2 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-primary">Total a pagar:</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(estimatedAmount || total)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>;
}