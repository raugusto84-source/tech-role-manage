import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useRewardSettings } from '@/hooks/useRewardSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, User, Calendar, DollarSign, FileText, ShoppingCart, Send, CheckCircle, XCircle, Package } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
  withholding_rate: number;
  withholding_amount: number;
  withholding_type: string;
  total: number;
  is_custom: boolean;
  image_url?: string | null;
  taxes?: any[];
  item_type?: string;
  unit_cost_price?: number;
  profit_margin_rate?: number;
  base_price?: number;
  service_vat_rate?: number;
  service_types?: {
    image_url?: string | null;
    item_type?: string;
    cost_price?: number;
    base_price?: number;
    vat_rate?: number;
  };
}

interface ConvertQuoteResult {
  success?: boolean;
  error?: string;
  existing?: boolean;
  order_id?: string;
  order_number?: string;
  quote_number?: string;
  total_amount?: number;
  estimated_delivery_date?: string;
  items_converted?: number;
  client_name?: string;
  message?: string;
}

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  service_description: string;
  estimated_amount: number;
  status: 'solicitud' | 'enviada' | 'aceptada' | 'rechazada' | 'seguimiento' | 'pendiente_aprobacion';
  request_date: string;
  notes?: string;
  marketing_channel?: string;
  account_type?: string;
  sale_type?: string;
  created_by?: string;
  assigned_to?: string;
}

interface QuoteDetailsProps {
  quote: Quote;
  onBack: () => void;
  onQuoteUpdated: () => void;
}

/**
 * Vista detallada de una cotización
 * Permite ver toda la información y realizar acciones como actualizar estado
 * o convertir a orden de trabajo
 */
export function QuoteDetails({ quote, onBack, onQuoteUpdated }: QuoteDetailsProps) {
  const { profile } = useAuth();
  const { settings: rewardSettings } = useRewardSettings();
  const [loading, setLoading] = useState(false);
  const [newStatus, setNewStatus] = useState<'solicitud' | 'enviada' | 'aceptada' | 'rechazada' | 'seguimiento' | 'pendiente_aprobacion'>(quote.status);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [salesperson, setSalesperson] = useState<string>('');
  
  // Cashback state
  const [availableCashback, setAvailableCashback] = useState(0);
  const [applyCashback, setApplyCashback] = useState(false);
  const [cashbackAmount, setCashbackAmount] = useState(0);
  const [cashbackLoading, setCashbackLoading] = useState(false);

  // Load quote items and salesperson information
  useEffect(() => {
    const loadQuoteDetails = async () => {
      try {
        // Load quote details with cashback information
        const { data: quoteData, error: quoteError } = await supabase
          .from('quotes')
          .select('cashback_applied, cashback_amount_used')
          .eq('id', quote.id)
          .single();

        if (quoteError) {
          console.error('Error loading quote cashback details:', quoteError);
        } else if (quoteData) {
          // Initialize cashback state from database
          setApplyCashback(quoteData.cashback_applied || false);
          setCashbackAmount(quoteData.cashback_amount_used || 0);
        }

        // Load quote items with service type images and pricing info
        const { data: items, error: itemsError } = await supabase
          .from('quote_items')
          .select(`
            *,
            service_types!left(image_url, item_type, cost_price, base_price, vat_rate)
          `)
          .eq('quote_id', quote.id)
          .order('created_at', { ascending: true });

        if (itemsError) {
          console.error('Error loading quote items:', itemsError);
        } else {
          console.log('Raw quote items from database:', items);
          
          // If no items found with JOIN, try a simpler query
          if (!items || items.length === 0) {
            console.log('No items found with LEFT JOIN, trying simple query...');
            const { data: simpleItems, error: simpleError } = await supabase
              .from('quote_items')
              .select('*')
              .eq('quote_id', quote.id)
              .order('created_at', { ascending: true });
            
            if (simpleError) {
              console.error('Error with simple query:', simpleError);
            } else {
              console.log('Simple query result:', simpleItems);
              // Use simple items if found
              if (simpleItems && simpleItems.length > 0) {
                const mappedSimpleItems = simpleItems.map(item => {
                  console.log('Mapping simple item:', item);
                  return {
                    ...item,
                    image_url: null,
                    item_type: 'servicio',
                    unit_cost_price: 0,
                    base_price: 0,
                    service_vat_rate: item.vat_rate,
                    profit_margin_rate: 0
                  };
                });
                console.log('Mapped simple items:', mappedSimpleItems);
                setQuoteItems(mappedSimpleItems);
              }
            }
          } else {
            // Map the items to include image_url and pricing info from service_types
            const mappedItems = (items || []).map(item => {
              console.log('Mapping item:', item);
              return {
                ...item,
                image_url: item.service_types?.image_url || null,
                item_type: item.service_types?.item_type || 'servicio',
                unit_cost_price: item.service_types?.cost_price || 0,
                base_price: item.service_types?.base_price || 0,
                service_vat_rate: item.service_types?.vat_rate || item.vat_rate,
                profit_margin_rate: 30 // Default margin for products
              };
            });
            console.log('Mapped quote items:', mappedItems);
            setQuoteItems(mappedItems);
          }
        }

        // Load salesperson information
        if (quote.assigned_to || quote.created_by) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', quote.assigned_to || quote.created_by)
            .single();

          if (profileError) {
            console.error('Error loading salesperson:', profileError);
          } else {
            setSalesperson(profileData?.full_name || '');
          }
        }
      } catch (error) {
        console.error('Error loading quote details:', error);
      }
    };

    loadQuoteDetails();
  }, [quote.id, quote.assigned_to, quote.created_by]);

  // Load available cashback for the client
  useEffect(() => {
    const loadCashback = async () => {
      setCashbackLoading(true);
      try {
        // Find client by email
        const { data: clientData } = await supabase
          .from('clients')
          .select('id, email')
          .eq('email', quote.client_email)
          .single();
        
        if (clientData) {
          // Get client rewards
          const { data: rewardsData } = await supabase
            .from('client_rewards')
            .select('total_cashback')
            .eq('client_id', clientData.id)
            .single();

          if (rewardsData) {
            setAvailableCashback(rewardsData.total_cashback || 0);
          }
        }
      } catch (error) {
        console.error('Error loading cashback:', error);
      } finally {
        setCashbackLoading(false);
      }
    };

    if (quote.client_email) {
      loadCashback();
    }
  }, [quote.client_email]);

  const formatCurrency = (amount: number) => formatCOPCeilToTen(amount);
  const formatCashbackExact = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'solicitud': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'enviada': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'aceptada': return 'bg-green-100 text-green-800 border-green-200';
      case 'rechazada': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'Pendiente de Aprobación';
      case 'solicitud': return 'Nueva';
      case 'enviada': return 'Enviada';
      case 'aceptada': return 'Aceptada';
      case 'rechazada': return 'Rechazada';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'solicitud': return FileText;
      case 'enviada': return Send;
      case 'aceptada': return CheckCircle;
      case 'rechazada': return XCircle;
      default: return FileText;
    }
  };

  // Aceptar cotización
  const acceptQuote = async () => {
    try {
      setLoading(true);

      const updateData = { 
        status: 'aceptada' as const,
        final_decision_date: new Date().toISOString()
      };

      const { error } = await supabase
        .from('quotes')
        .update(updateData)
        .eq('id', quote.id);

      if (error) {
        toast({
          title: "Error",
          description: `Error al aceptar cotización: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Cotización aceptada",
        description: "La cotización ha sido aceptada exitosamente",
      });

      onQuoteUpdated();
    } catch (error) {
      console.error('Error accepting quote:', error);
      toast({
        title: "Error inesperado",
        description: "No se pudo aceptar la cotización",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Rechazar cotización
  const rejectQuote = async () => {
    try {
      setLoading(true);

      const updateData = { 
        status: 'rechazada' as const,
        final_decision_date: new Date().toISOString()
      };

      const { error } = await supabase
        .from('quotes')
        .update(updateData)
        .eq('id', quote.id);

      if (error) {
        toast({
          title: "Error",
          description: `Error al rechazar cotización: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Cotización rechazada",
        description: "La cotización ha sido rechazada",
      });

      onQuoteUpdated();
    } catch (error) {
      console.error('Error rejecting quote:', error);
      toast({
        title: "Error inesperado",
        description: "No se pudo rechazar la cotización",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Convertir cotización a orden preservando totales exactos
  const convertToOrder = async () => {
    // Prevenir múltiples clics - salir inmediatamente si ya está procesando
    if (loading) {
      console.log('Conversion already in progress, ignoring click');
      return;
    }

    try {
      setLoading(true);
      console.log('Starting quote conversion for quote:', quote.id, quote.quote_number);

      // Llamar a la función de conversión
      const { data, error } = await supabase.rpc('convert_quote_to_order', {
        quote_id: quote.id
      });

      if (error) {
        console.error('RPC error:', error);
        toast({
          title: "Error",
          description: `Error al convertir cotización: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Conversion result:', data);

      // Verificar el resultado de la función
      const result = data as ConvertQuoteResult;
      if (result?.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      if (result?.success) {
        if (result.existing) {
          toast({
            title: "Orden existente",
            description: result.message || `Orden ${result.order_number} ya existe para esta cotización`,
            variant: "default",
          });
        } else {
          toast({
            title: "¡Cotización convertida exitosamente!",
            description: `Orden ${result.order_number} creada con total de ${formatCOPCeilToTen(result.total_amount || 0)}. Se convirtieron ${result.items_converted || 0} items.`,
          });
        }
      }

      // Actualizar la cotización en la UI
      onQuoteUpdated();
    } catch (error) {
      console.error('Error converting quote to order:', error);
      toast({
        title: "Error inesperado",
        description: "No se pudo procesar la conversión",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle cashback toggle
  const handleCashbackToggle = async (checked: boolean) => {
    if (loading) return;
    
    try {
      setLoading(true);
      
      const cashbackAmountToUse = checked ? Math.min(availableCashback, total) : 0;
      
      // Only update the quote with cashback information - NO CLIENT BALANCE CHANGES YET
      const { error } = await supabase
        .from('quotes')
        .update({
          cashback_applied: checked,
          cashback_amount_used: cashbackAmountToUse,
          estimated_amount: total - cashbackAmountToUse
        })
        .eq('id', quote.id);

      if (error) {
        toast({
          title: "Error",
          description: `Error al actualizar cashback: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Update local state only (no client balance changes yet)
      setApplyCashback(checked);
      setCashbackAmount(cashbackAmountToUse);
      
      if (checked && cashbackAmountToUse > 0) {
        toast({
          title: "Cashback marcado para aplicar",
          description: `Descuento de ${formatCurrency(cashbackAmountToUse)} se aplicará cuando la cotización sea aceptada`,
        });
      } else {
        toast({
          title: "Cashback removido",
          description: "El descuento ha sido removido de la cotización",
        });
      }

    } catch (error) {
      console.error('Error handling cashback toggle:', error);
      toast({
        title: "Error",
        description: "Error inesperado al procesar cashback",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to determine if an item is a product
  const isProduct = (item: QuoteItem): boolean => {
    return item.item_type === 'articulo' || (item.profit_margin_rate && item.profit_margin_rate > 0);
  };

  // Function to calculate the correct price for an item
  const calculateItemCorrectPrice = (item: QuoteItem) => {
    console.log('QuoteDetails - Calculating price for item:', item.name, {
      item_type: item.item_type,
      unit_price: item.unit_price,
      base_price: item.base_price,
      service_types: item.service_types
    });

    // For quote items, use the already calculated unit_price from the database
    // This was calculated when the quote was created and includes all pricing logic
    return item.unit_price || 0;
  };

  // Calculate totals using correct pricing and reward settings
  const calculateTotals = () => {
    let subtotal = 0;
    let totalVat = 0;
    let totalWithholdings = 0;
    let total = 0;

    quoteItems.forEach(item => {
      const unitPrice = item.unit_price || 0;
      const quantity = item.quantity || 1;
      const vatRate = item.vat_rate || 0;
      
      // If there's VAT rate, extract the base price from unit_price that includes VAT
      let basePricePerUnit = unitPrice;
      let vatPerUnit = 0;
      
      if (vatRate > 0) {
        // unit_price includes VAT, so extract base price
        basePricePerUnit = unitPrice / (1 + vatRate / 100);
        vatPerUnit = unitPrice - basePricePerUnit;
      }
      
      const itemSubtotal = basePricePerUnit * quantity;
      const itemVat = vatPerUnit * quantity;
      const itemWithholding = (item.withholding_amount || 0) * quantity;
      const itemTotal = unitPrice * quantity;
      
      subtotal += itemSubtotal;
      totalVat += itemVat;
      totalWithholdings += itemWithholding;
      total += itemTotal;
    });

    return { 
      subtotal: subtotal,
      totalVat: totalVat,
      totalWithholdings: totalWithholdings, 
      total: total
    };
  };

  const { subtotal, totalVat, totalWithholdings, total } = calculateTotals();
  
  // Calculate final total (no more cashback discount)
  const finalTotal = total;

  const canManageQuotes = profile?.role === 'administrador' || profile?.role === 'vendedor';
  const StatusIcon = getStatusIcon(quote.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{quote.quote_number}</h1>
            <p className="text-muted-foreground">Detalles de la cotización</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge className={`${getStatusColor(quote.status)} border text-base px-3 py-1`}>
            <StatusIcon className="h-4 w-4 mr-2" />
            {getStatusText(quote.status)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información del cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nombre</p>
                  <p className="text-base">{quote.client_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base">{quote.client_email}</p>
                </div>
                {quote.client_phone && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
                    <p className="text-base">{quote.client_phone}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Artículos cotizados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Artículos y Servicios Cotizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quoteItems.length > 0 ? (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Imagen</TableHead>
                        <TableHead>Artículo/Servicio</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       {quoteItems.map((item) => {
                         const itemTypeInfo = getItemTypeInfo(item.item_type || 'servicio');
                         return (
                         <TableRow 
                           key={item.id}
                           className={`border-l-4 ${itemTypeInfo.colors.border} ${itemTypeInfo.colors.background}`}
                         >
                           <TableCell className="w-20">
                             {item.image_url ? (
                               <div className="w-16 h-16">
                                 <img 
                                   src={item.image_url} 
                                   alt={item.name}
                                   className="w-full h-full object-cover rounded-md border"
                                   onError={(e) => {
                                     const target = e.target as HTMLImageElement;
                                     target.style.display = 'none';
                                   }}
                                 />
                               </div>
                             ) : (
                               <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center">
                                 <Package className="h-6 w-6 text-gray-400" />
                               </div>
                             )}
                           </TableCell>
                           <TableCell>
                             <div className="flex items-center gap-2">
                               <div>
                                 <div className="flex items-center gap-2">
                                   <p className="font-medium">{item.name}</p>
                                   <Badge className={itemTypeInfo.colors.badge}>
                                     {getItemTypeInfo(item.item_type || 'servicio').icon} {itemTypeInfo.label}
                                   </Badge>
                                 </div>
                                 {item.description && (
                                   <p className="text-sm text-muted-foreground">{item.description}</p>
                                 )}
                               </div>
                             </div>
                           </TableCell>
                           <TableCell className="text-center">{item.quantity}</TableCell>
                           <TableCell className="text-right font-medium">
                             {formatCurrency(item.unit_price * item.quantity)}
                           </TableCell>
                         </TableRow>
                         );
                       })}
                    </TableBody>
                  </Table>
                  
                  {/* Totales */}
                  <div className="border-t pt-4">
                    <div className="flex justify-end">
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IVA Total:</span>
                          <span>{formatCurrency(totalVat)}</span>
                        </div>
                        {totalWithholdings > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Retenciones:</span>
                            <span>-{formatCurrency(totalWithholdings)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total:</span>
                          <span>{formatCurrency(finalTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay artículos en esta cotización</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Descripción general: {quote.service_description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notas adicionales */}
          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notas Adicionales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed">{quote.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          {/* Información general */}
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Fecha de Solicitud</p>
                  <p className="text-sm text-muted-foreground">{formatDate(quote.request_date)}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Valor Total</p>
                  <p className="text-xl font-bold text-green-600">
                    {total > 0 ? formatCurrency(total) : 
                     quote.estimated_amount ? formatCurrency(quote.estimated_amount) : 'Por definir'}
                  </p>
                </div>
              </div>

              {salesperson && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">Vendedor Asignado</p>
                    <p className="text-sm text-muted-foreground">{salesperson}</p>
                  </div>
                </>
              )}

              {quote.marketing_channel && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">Canal de Marketing</p>
                    <p className="text-sm text-muted-foreground capitalize">{quote.marketing_channel}</p>
                  </div>
                </>
              )}

            </CardContent>
          </Card>

          {/* Cashback Section */}
          {availableCashback > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Cashback Disponible
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCashbackExact(availableCashback)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Disponible para usar
                  </p>
                </div>

                {availableCashback > 0 && canManageQuotes && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="apply-cashback"
                        checked={applyCashback}
                        onCheckedChange={handleCashbackToggle}
                        disabled={loading || cashbackLoading}
                      />
                      <label 
                        htmlFor="apply-cashback" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Usar cashback
                      </label>
                    </div>
                    
                    {applyCashback && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm text-green-800">
                          Cashback que ganarás: <span className="font-medium">
                            +{formatCurrency(finalTotal * ((rewardSettings?.general_cashback_percent || 0) / 100))}
                          </span>
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                          Se aplicará cuando la cotización sea aceptada
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Acciones */}
          {canManageQuotes && (
            <Card>
              <CardHeader>
                <CardTitle>Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Botones de acción */}
                <div className="space-y-3">
                  <label className="text-sm font-medium block">Acciones de Cotización</label>
                  
                  {/* Solo mostrar botones si no está ya aceptada o rechazada */}
                  {quote.status !== 'aceptada' && quote.status !== 'rechazada' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={convertToOrder}
                        disabled={loading}
                        variant="default"
                        className="w-full"
                        size="sm"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Aceptar y Crear Orden
                      </Button>
                      <Button 
                        onClick={rejectQuote}
                        disabled={loading}
                        variant="destructive"
                        className="w-full"
                        size="sm"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Rechazar
                      </Button>
                    </div>
                  )}
                  
                  {/* Mostrar estado actual si ya está aceptada o rechazada */}
                  {(quote.status === 'aceptada' || quote.status === 'rechazada') && (
                    <div className="text-center py-2">
                      <Badge className={getStatusColor(quote.status)}>
                        <StatusIcon className="h-4 w-4 mr-2" />
                        {getStatusText(quote.status)}
                      </Badge>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Mensaje especial para cotizaciones pendientes de aprobación */}
                {quote.status === 'pendiente_aprobacion' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <h4 className="font-medium text-orange-800 text-sm mb-1">Cotización Pendiente de Aprobación</h4>
                    <p className="text-xs text-orange-700">
                      Al aprobarla (estado "Aceptada"), se generará automáticamente una orden de trabajo.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}