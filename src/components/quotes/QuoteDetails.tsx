import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, User, Calendar, DollarSign, FileText, ShoppingCart, Send, CheckCircle, XCircle, Package } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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
}

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  service_description: string;
  estimated_amount: number;
  status: 'solicitud' | 'enviada' | 'aceptada' | 'rechazada' | 'seguimiento';
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
  const [loading, setLoading] = useState(false);
  const [newStatus, setNewStatus] = useState<'solicitud' | 'enviada' | 'aceptada' | 'rechazada' | 'seguimiento'>(quote.status);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [salesperson, setSalesperson] = useState<string>('');

  // Load quote items and salesperson information
  useEffect(() => {
    const loadQuoteDetails = async () => {
      try {
        // Load quote items
        const { data: items, error: itemsError } = await supabase
          .from('quote_items')
          .select('*')
          .eq('quote_id', quote.id)
          .order('created_at', { ascending: true });

        if (itemsError) {
          console.error('Error loading quote items:', itemsError);
        } else {
          setQuoteItems(items || []);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

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
      case 'solicitud': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'enviada': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'aceptada': return 'bg-green-100 text-green-800 border-green-200';
      case 'rechazada': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
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

  // Actualizar estado de la cotización
  const updateQuoteStatus = async () => {
    if (newStatus === quote.status) return;

    try {
      setLoading(true);

      const updateData: any = { status: newStatus };
      
      // Agregar timestamps según el estado
      if (newStatus === 'enviada') {
        updateData.quote_sent_at = new Date().toISOString();
      } else if (newStatus === 'aceptada' || newStatus === 'rechazada') {
        updateData.final_decision_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('quotes')
        .update(updateData)
        .eq('id', quote.id);

      if (error) {
        toast({
          title: "Error",
          description: `Error al actualizar estado: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Estado actualizado",
        description: `La cotización ha sido marcada como ${getStatusText(newStatus)}`,
      });

      onQuoteUpdated();
    } catch (error) {
      console.error('Error updating quote status:', error);
      toast({
        title: "Error inesperado",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Convertir cotización a orden
  const convertToOrder = async () => {
    try {
      setLoading(true);

      // Buscar el cliente en la tabla clients
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('email', quote.client_email)
        .maybeSingle();

      if (clientError) {
        toast({
          title: "Error",
          description: `Error al buscar cliente: ${clientError.message}`,
          variant: "destructive",
        });
        return;
      }

      if (!clientData) {
        toast({
          title: "Cliente no encontrado",
          description: "El cliente de esta cotización no existe en el sistema. Debe ser creado primero.",
          variant: "destructive",
        });
        return;
      }

      // Buscar un tipo de servicio genérico o crear uno por defecto
      const { data: serviceTypes, error: serviceError } = await supabase
        .from('service_types')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      if (serviceError) {
        toast({
          title: "Error",
          description: `Error al buscar tipos de servicio: ${serviceError.message}`,
          variant: "destructive",
        });
        return;
      }

      if (!serviceTypes || serviceTypes.length === 0) {
        toast({
          title: "Sin tipos de servicio",
          description: "No hay tipos de servicio disponibles. Contacta al administrador.",
          variant: "destructive",
        });
        return;
      }

      // Crear la orden
      const orderData = {
        client_id: clientData.id,
        service_type: serviceTypes[0].id,
        failure_description: quote.service_description,
        estimated_cost: quote.estimated_amount,
        delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 días después
        created_by: profile?.user_id,
        status: 'pendiente',
      };

      const { error: orderError } = await supabase
        .from('orders')
        .insert(orderData as any);

      if (orderError) {
        toast({
          title: "Error",
          description: `Error al crear orden: ${orderError.message}`,
          variant: "destructive",
        });
        return;
      }

      // Actualizar estado de la cotización a aceptada
      await supabase
        .from('quotes')
        .update({ 
          status: 'aceptada',
          final_decision_date: new Date().toISOString()
        })
        .eq('id', quote.id);

      toast({
        title: "Orden creada",
        description: "La cotización ha sido convertida a orden de trabajo exitosamente",
      });

      onQuoteUpdated();
    } catch (error) {
      console.error('Error converting quote to order:', error);
      toast({
        title: "Error inesperado",
        description: "No se pudo convertir la cotización a orden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canManageQuotes = profile?.role === 'administrador' || profile?.role === 'vendedor';
  const StatusIcon = getStatusIcon(quote.status);

  // Calculate totals from quote items
  const calculateTotals = () => {
    const subtotal = quoteItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalVat = quoteItems.reduce((sum, item) => sum + item.vat_amount, 0);
    const totalWithholdings = quoteItems.reduce((sum, item) => sum + item.withholding_amount, 0);
    const total = quoteItems.reduce((sum, item) => sum + item.total, 0);
    
    return { subtotal, totalVat, totalWithholdings, total };
  };

  const { subtotal, totalVat, totalWithholdings, total } = calculateTotals();

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
                        <TableHead>Artículo/Servicio</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead className="text-right">Precio Unitario</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">IVA ({quoteItems[0]?.vat_rate || 16}%)</TableHead>
                        <TableHead className="text-right">Retención</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quoteItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              {item.description && (
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.vat_amount)}</TableCell>
                          <TableCell className="text-right">
                            {item.withholding_amount > 0 ? (
                              <div>
                                <div className="text-sm">{formatCurrency(-item.withholding_amount)}</div>
                                {item.withholding_type && (
                                  <div className="text-xs text-muted-foreground">{item.withholding_type} ({item.withholding_rate}%)</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                        </TableRow>
                      ))}
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
                          <span>{formatCurrency(total)}</span>
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

              {quote.account_type && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">Tipo de Cuenta</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {quote.account_type === 'no_fiscal' ? 'No Fiscal' : 'Fiscal'}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Acciones */}
          {canManageQuotes && (
            <Card>
              <CardHeader>
                <CardTitle>Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Actualizar estado */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Cambiar Estado</label>
                  <div className="flex gap-2">
                    <Select value={newStatus} onValueChange={(value: any) => setNewStatus(value)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solicitud">Nueva</SelectItem>
                        <SelectItem value="enviada">Enviada</SelectItem>
                        <SelectItem value="aceptada">Aceptada</SelectItem>
                        <SelectItem value="rechazada">Rechazada</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={updateQuoteStatus}
                      disabled={loading || newStatus === quote.status}
                      size="sm"
                    >
                      Actualizar
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Convertir a orden */}
                {quote.status === 'aceptada' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full" disabled={loading}>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Convertir a Orden
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Convertir a orden de trabajo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esto creará una nueva orden de trabajo basada en esta cotización. 
                          El cliente debe existir en el sistema para poder proceder.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={convertToOrder}>
                          Convertir a Orden
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}