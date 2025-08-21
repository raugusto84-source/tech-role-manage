import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, FileText, Calendar, User, PenTool, RotateCcw, Package } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import SignatureCanvas from "react-signature-canvas";

interface OrderItem {
  id: string;
  service_name: string;
  service_description?: string;
  quantity: number;
  unit_base_price: number;
  total_amount: number;
  status: string;
  item_type?: string;
  service_types?: {
    base_price: number;
    cost_price: number;
    item_type: string;
    profit_margin_tiers?: any; // JSON data from Supabase
  };
}

interface ClientOrderApprovalProps {
  order: {
    id: string;
    order_number: string;
    failure_description: string;
    delivery_date: string;
    created_at: string;
    status: string;
    client_approval?: boolean;
    client_approval_notes?: string;
    client_approved_at?: string;
    estimated_cost?: number;
    clients?: {
      name: string;
      client_number: string;
      address: string;
    };
    service_types?: {
      name: string;
      description?: string;
    };
    estimated_delivery_date?: string | null;
  };
  onApprovalChange?: () => void;
}

export function ClientOrderApproval({ order, onApprovalChange }: ClientOrderApprovalProps) {
  const [approving, setApproving] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string>("");
  const [hasStartedApproval, setHasStartedApproval] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const signatureRef = useRef<SignatureCanvas>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadOrderItems();
  }, [order.id]); // Solo recargar si realmente cambia el ID

  const loadOrderItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id, 
          service_name, 
          service_description, 
          quantity, 
          unit_base_price, 
          unit_cost_price,
          total_amount, 
          status,
          item_type,
          profit_margin_rate,
          subtotal,
          vat_amount,
          service_type_id,
          service_types!inner(
            base_price,
            cost_price,
            item_type,
            profit_margin_tiers
          )
        `)
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading order items:', error);
        throw error;
      }
      
      console.log('Order items raw data:', data);
      
      // Procesar los items para asegurar precios correctos según tipo
      const processedItems = data?.map(item => {
        let finalUnitPrice = 0;
        let finalTotal = 0;

        console.log(`🔍 Processing item ${item.service_name}:`, {
          stored_unit_base_price: item.unit_base_price,
          stored_total_amount: item.total_amount,
          item_type: item.item_type,
          service_type_item_type: item.service_types?.item_type,
          service_cost_price: item.service_types?.cost_price,
          service_base_price: item.service_types?.base_price,
          service_type_id: item.service_type_id
        });

        const isService = item.item_type === 'servicio' || item.service_types?.item_type === 'servicio';
        
        if (isService) {
          // SERVICIOS: Usar base_price (precio fijo)
          finalUnitPrice = item.unit_base_price || item.service_types?.base_price || 0;
          finalTotal = item.total_amount || (finalUnitPrice * item.quantity);
          console.log(`💼 Service pricing for ${item.service_name}:`, { finalUnitPrice, finalTotal });
        } else {
          // ARTÍCULOS: Prioridad de precios
          console.log(`📦 Processing article ${item.service_name}`);
          
          if (item.unit_base_price && item.unit_base_price > 0) {
            // Usar precio almacenado si existe y es válido
            finalUnitPrice = item.unit_base_price;
            finalTotal = item.total_amount || (finalUnitPrice * item.quantity);
            console.log(`✅ Using stored unit_base_price:`, { finalUnitPrice, finalTotal });
          } else {
            // Calcular precio basado en cost_price del service_type
            const serviceCostPrice = item.service_types?.cost_price || 0;
            const serviceBasePrice = item.service_types?.base_price || 0;
            const itemCostPrice = item.unit_cost_price || 0;
            
            console.log(`🔍 Price sources for ${item.service_name}:`, {
              service_cost_price: serviceCostPrice,
              service_base_price: serviceBasePrice, 
              item_cost_price: itemCostPrice,
              item_base_price: item.unit_base_price
            });
            
            // Usar cost_price del service_type (más confiable)
            if (serviceCostPrice > 0) {
              // Calcular usando profit_margin_tiers del service_type
              const marginTiers = item.service_types?.profit_margin_tiers;
              let margin = 80; // Default margin
              
              if (Array.isArray(marginTiers) && marginTiers.length > 0) {
                const tier = marginTiers.find((t: any) => 
                  item.quantity >= (t.min_qty || 1) && 
                  item.quantity <= (t.max_qty || 999)
                );
                if (tier && typeof tier === 'object' && 'margin' in tier) {
                  margin = (tier as any).margin || 80;
                }
              }
              
              finalUnitPrice = serviceCostPrice * (1 + margin / 100);
              finalTotal = finalUnitPrice * item.quantity;
              
              console.log(`💰 Calculated from service cost_price:`, {
                service_cost_price: serviceCostPrice,
                margin_used: margin,
                calculated_unit_price: finalUnitPrice,
                quantity: item.quantity,
                calculated_total: finalTotal
              });
            } else if (serviceBasePrice > 0) {
              // Usar base_price del service_type como fallback
              finalUnitPrice = serviceBasePrice;
              finalTotal = finalUnitPrice * item.quantity;
              console.log(`🔄 Using service base_price:`, { finalUnitPrice, finalTotal });
            } else {
              // Precio mínimo por defecto
              finalUnitPrice = 50000; // 50,000 COP mínimo
              finalTotal = finalUnitPrice * item.quantity;
              console.log(`⚠️ Using default price for ${item.service_name}:`, { finalUnitPrice, finalTotal });
            }
          }
        }

        const result = {
          ...item,
          unit_base_price: finalUnitPrice,
          total_amount: finalTotal
        };

        console.log(`✨ Final result for ${item.service_name}:`, {
          unit_price: result.unit_base_price,
          total: result.total_amount,
          quantity: result.quantity
        });

        return result;
      }) || [];
      
      setOrderItems(processedItems);
    } catch (error) {
      console.error('Error loading order items:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los artículos de la orden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalAmount = orderItems.reduce((sum, item) => sum + item.total_amount, 0);

  const handleSignatureConfirm = async () => {
    if (signatureRef.current?.isEmpty()) {
      toast({
        title: "Firma requerida",
        description: "Por favor, firma en el área designada para continuar.",
        variant: "destructive"
      });
      return;
    }

    if (hasStartedApproval || approving) {
      console.log("Approval already in progress, ignoring");
      return;
    }

    const signatureDataURL = signatureRef.current?.toDataURL();
    setSignatureData(signatureDataURL || "");
    setShowSignature(false);
    
    // Proceder automáticamente con la aprobación después de capturar la firma
    setHasStartedApproval(true);
    setApproving(true);
    
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          client_approval: true,
          client_approval_notes: approvalNotes || "Orden aprobada sin comentarios adicionales",
          initial_signature_url: signatureDataURL,
          status: "pendiente",
          client_approved_at: new Date().toISOString()
        })
        .eq("id", order.id);

      if (error) throw error;
      
      // Obtener fecha estimada de entrega calculada por el servidor
      const { data: updated, error: fetchError } = await supabase
        .from('orders')
        .select('estimated_delivery_date')
        .eq('id', order.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      toast({
        title: "Orden Aprobada",
        description: updated?.estimated_delivery_date
          ? `Entrega estimada: ${format(new Date(updated.estimated_delivery_date), 'dd/MM/yyyy HH:mm', { locale: es })}`
          : "La orden ha sido aprobada y enviada a los técnicos.",
        variant: "default"
      });

      onApprovalChange?.();
    } catch (error) {
      console.error("Error approving order:", error);
      toast({
        title: "Error",
        description: "No se pudo aprobar la orden. Intenta nuevamente.",
        variant: "destructive"
      });
      setHasStartedApproval(false);
      setSignatureData(""); // Limpiar firma en caso de error
    } finally {
      setApproving(false);
    }
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
  };

  const isPendingApproval = order.status === "pendiente_aprobacion";
  const isAlreadyApproved = order.client_approval;

  return (
    <div className="space-y-6">
      {/* Estado de la orden */}
      <Card className={`border-l-4 ${
        isPendingApproval 
          ? "border-l-warning bg-warning/5" 
          : isAlreadyApproved 
            ? "border-l-success bg-success/5"
            : "border-l-muted"
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {isPendingApproval ? (
                <AlertCircle className="h-5 w-5 text-warning" />
              ) : isAlreadyApproved ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground" />
              )}
              {order.order_number}
            </CardTitle>
            <Badge className={
              isPendingApproval 
                ? "bg-warning/10 text-warning border-warning/20"
                : isAlreadyApproved
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-muted text-foreground"
            }>
              {isPendingApproval ? "PENDIENTE APROBACIÓN" : 
               isAlreadyApproved ? "APROBADA" : 
               order.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Información del servicio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <User className="h-4 w-4 mr-2" />
                <span>Cliente: {order.clients?.name}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Fecha de entrega: {format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: es })}</span>
              </div>
            </div>
            
            {order.estimated_cost && (
              <div className="flex items-center justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Costo estimado</p>
                  <p className="text-2xl font-bold text-primary">${order.estimated_cost.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Descripción del servicio */}
          <div className="space-y-2">
            <h4 className="font-medium">Servicio solicitado:</h4>
            <p className="text-sm font-medium text-primary">{order.service_types?.name}</p>
            <p className="text-sm text-muted-foreground">{order.failure_description}</p>
          </div>

          {/* Artículos de la orden */}
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h4 className="font-medium">Cargando artículos...</h4>
              </div>
            </div>
          ) : orderItems.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h4 className="font-medium">Artículos incluidos en esta orden:</h4>
              </div>
              
              <div className="space-y-2">
                {orderItems.map((item) => (
                  <Card key={item.id} className="border border-border/50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h5 className="font-medium text-foreground">{item.service_name}</h5>
                          {item.service_description && (
                            <p className="text-sm text-muted-foreground mt-1">{item.service_description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Cantidad: {item.quantity}</span>
                            <span>Precio unitario: {formatCurrency(item.unit_base_price || 0)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-primary">{formatCurrency(item.total_amount || 0)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Total de la orden */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Total de la orden:</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium text-muted-foreground">No se encontraron artículos para esta orden</h4>
              </div>
            </div>
          )}

          {/* Estado de aprobación */}
          {isPendingApproval && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-6">
              <h4 className="font-bold text-warning mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                ⚠️ Esta orden requiere tu firma y aprobación
              </h4>
              <div className="bg-white rounded-lg p-4 mb-4 border">
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Importante:</strong> Al firmar y aprobar esta orden, confirmas que:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mb-3">
                  <li>Has revisado y aceptas los servicios descritos</li>
                  <li>Autorizas el costo estimado mostrado</li>
                  <li>Permites que nuestros técnicos inicien el trabajo</li>
                  <li>Entiendes que el trabajo comenzará una vez aprobado</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                {/* Área de firma */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <PenTool className="h-4 w-4" />
                      Firma digital requerida
                    </label>
                    {signatureData && (
                      <div className="flex items-center gap-2 text-success text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Firma capturada
                      </div>
                    )}
                  </div>
                  
                  {!signatureData ? (
                    <Button 
                      onClick={() => setShowSignature(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <PenTool className="h-4 w-4 mr-2" />
                      Hacer clic para firmar
                    </Button>
                  ) : (
                    <div className="border rounded-lg p-3 bg-success/5 border-success/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-success">✓ Firma registrada correctamente</span>
                        <Button 
                          onClick={() => setShowSignature(true)}
                          variant="ghost"
                          size="sm"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Cambiar firma
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Comentarios adicionales */}
                <div>
                  <label className="text-sm font-medium">Comentarios adicionales (opcional)</label>
                  <Textarea
                    placeholder="Agrega cualquier comentario o instrucción especial..."
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>
                
                {/* Estado después de firmar */}
                {signatureData && !approving && !hasStartedApproval && (
                  <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                    <p className="text-success font-medium">
                      ✓ Orden firmada y aprobada exitosamente
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      La orden ha sido enviada a los técnicos para su procesamiento.
                    </p>
                  </div>
                )}
                
                {/* Indicador de procesamiento */}
                {(approving || hasStartedApproval) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 font-medium flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-800 border-t-transparent rounded-full"></div>
                      Procesando aprobación...
                    </p>
                    <p className="text-sm text-blue-600 mt-1">
                      Por favor espera mientras se procesa la orden.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Orden ya aprobada */}
          {isAlreadyApproved && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-4">
              <h4 className="font-medium text-success mb-2">
                ✓ Orden aprobada
              </h4>
              <p className="text-sm text-muted-foreground">
                Aprobada el {order.client_approved_at && format(new Date(order.client_approved_at), 'dd/MM/yyyy HH:mm', { locale: es })}
              </p>
              {order.estimated_delivery_date && (
                <p className="text-sm font-medium mt-1">
                  Entrega estimada: {format(new Date(order.estimated_delivery_date), 'dd/MM/yyyy HH:mm', { locale: es })}
                </p>
              )}
              {order.client_approval_notes && (
                <div className="mt-2">
                  <p className="text-sm font-medium">Comentarios:</p>
                  <p className="text-sm text-muted-foreground italic">"{order.client_approval_notes}"</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de firma digital */}
      {showSignature && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                Firma Digital
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Firma en el área blanca de abajo para aprobar la orden
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-2 bg-white">
                <SignatureCanvas
                  ref={signatureRef}
                  canvasProps={{
                    width: 400,
                    height: 200,
                    className: 'signature-canvas w-full'
                  }}
                  backgroundColor="white"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={clearSignature}
                  variant="outline"
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
                <Button 
                  onClick={handleSignatureConfirm}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Firma
                </Button>
              </div>
              
              <Button 
                onClick={() => setShowSignature(false)}
                variant="ghost"
                className="w-full"
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}