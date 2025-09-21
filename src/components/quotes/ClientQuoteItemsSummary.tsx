import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package, ShoppingCart } from 'lucide-react';
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

export function ClientQuoteItemsSummary({ quoteId, estimatedAmount }: ClientQuoteItemsSummaryProps) {
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuoteItems();
  }, [quoteId]);

  const loadQuoteItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quote_items')
        .select(`
          *,
          service_types (
            image_url,
            item_type
          )
        `)
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true });

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
    const subtotal = quoteItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const vatTotal = quoteItems.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
    const total = subtotal + vatTotal;
    
    return { subtotal, vatTotal, total };
  };

  const { subtotal, vatTotal, total } = calculateTotals();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-24 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quote Ready Status Card */}
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
            <div className="text-center">
              <div className="text-3xl font-bold text-green-700 mb-1">
                {formatCurrency(estimatedAmount || total)}
              </div>
              <div className="text-sm text-green-600">
                {quoteItems.length} servicio{quoteItems.length !== 1 ? 's' : ''} incluido{quoteItems.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="text-sm text-green-700 text-center">
            Puedes enviar esta cotización ahora o agregar más servicios opcionales
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      {quoteItems.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Servicios incluidos
            </h3>
            
            <div className="space-y-3">
              {quoteItems.map((item) => {
                const itemTypeInfo = getItemTypeInfo(item.item_type || item.service_types?.item_type || 'servicio');
                
                return (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      {item.service_types?.image_url ? (
                        <img 
                          src={item.service_types.image_url} 
                          alt={item.name}
                          className="w-8 h-8 object-cover rounded"
                        />
                      ) : (
                        <ShoppingCart className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-sm">{item.name}</h4>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {itemTypeInfo.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Cantidad: {item.quantity}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          <div className="font-semibold text-sm">
                            {formatCurrency(item.total || 0)}
                          </div>
                          {item.quantity > 1 && (
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(item.unit_price || 0)} c/u
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totals Breakdown */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Resumen de costos
          </h3>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">IVA Total:</span>
              <span className="font-medium">{formatCurrency(vatTotal)}</span>
            </div>
            
            <div className="border-t pt-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-primary">Total:</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(estimatedAmount || total)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}