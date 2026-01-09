import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle, XCircle, Package, Clock, Truck, AlertTriangle, ShoppingCart } from 'lucide-react';
import { formatCOPCeilToTen } from '@/utils/currency';
import { AddQuoteItemsDialog } from './AddQuoteItemsDialog';

interface QuoteItem {
  id: string;
  service_type_id?: string;
  name: string;
  item_type?: string;
  service_types?: {
    item_type?: string;
    service_category?: string;
  };
}

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  has_equipment?: boolean;
  equipment_ready?: boolean;
  department?: string;
}

interface QuoteWorkflowActionsProps {
  quote: Quote;
  quoteItems: QuoteItem[];
  onQuoteUpdated: () => void;
}

export function QuoteWorkflowActions({ quote, quoteItems, onQuoteUpdated }: QuoteWorkflowActionsProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [hasEquipment, setHasEquipment] = useState(quote.has_equipment || false);
  const [equipmentReady, setEquipmentReady] = useState(quote.equipment_ready || false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | 'assign' | null>(null);
  const [department, setDepartment] = useState<string | null>(quote.department || null);
  const [showAddItemsDialog, setShowAddItemsDialog] = useState(false);
  const [hasNoItems, setHasNoItems] = useState(false);

  // Check if quote has items
  useEffect(() => {
    setHasNoItems(quoteItems.length === 0);
  }, [quoteItems]);

  // Detectar si hay productos (equipo) en los items
  useEffect(() => {
    const checkEquipment = async () => {
      if (quoteItems.length === 0) return;

      // Verificar si algún item es artículo/producto
      let hasProducts = false;
      let detectedDepartment: string | null = null;

      for (const item of quoteItems) {
        // Verificar tipo de item
        const itemType = item.item_type || item.service_types?.item_type;
        if (itemType === 'articulo') {
          hasProducts = true;
        }

        // Detectar departamento por service_category
        if (item.service_type_id && !detectedDepartment) {
          const { data } = await supabase
            .from('service_types')
            .select('service_category')
            .eq('id', item.service_type_id)
            .single();
          
          if (data?.service_category) {
            detectedDepartment = data.service_category;
          }
        }
      }

      setHasEquipment(hasProducts);
      if (detectedDepartment) {
        setDepartment(detectedDepartment);
      }
    };

    checkEquipment();
  }, [quoteItems]);

  const canManageQuotes = profile?.role === 'administrador' || profile?.role === 'vendedor' || profile?.role === 'supervisor';
  const isAdmin = profile?.role === 'administrador';
  const canConfirmEquipment = profile?.role === 'administrador' || profile?.role === 'supervisor';

  // Aprobar cotización
  const handleApprove = async () => {
    // Si no tiene items, abrir diálogo para agregar
    if (hasNoItems) {
      setShowAddItemsDialog(true);
      setShowConfirmDialog(false);
      return;
    }

    if (hasEquipment && !equipmentReady) {
      // Si tiene equipo y no está listo, pasar a estado "asignando"
      await updateQuoteStatus('asignando');
    } else {
      // Si no tiene equipo o ya está listo, crear orden directamente
      await convertToOrder();
    }
  };

  // Callback cuando se agregan items desde el diálogo
  const handleItemsAdded = () => {
    onQuoteUpdated();
    // Después de agregar items, proceder con la aprobación
    setTimeout(() => {
      convertToOrder();
    }, 500);
  };

  // Rechazar cotización
  const handleReject = async () => {
    await updateQuoteStatus('rechazada');
  };

  // Confirmar material listo y asignar
  const handleAssign = async () => {
    if (!equipmentReady) {
      toast({
        title: "Error",
        description: "Debes confirmar que el material está listo antes de asignar",
        variant: "destructive"
      });
      return;
    }
    await convertToOrder();
  };

  const updateQuoteStatus = async (newStatus: string) => {
    try {
      setLoading(true);

      const updateData: any = {
        status: newStatus,
        has_equipment: hasEquipment,
        department: department
      };

      if (newStatus === 'asignando') {
        updateData.equipment_ready = false;
      }

      const { error } = await supabase
        .from('quotes')
        .update(updateData)
        .eq('id', quote.id);

      if (error) throw error;

      const statusMessages: Record<string, string> = {
        'asignando': 'Cotización en espera de material. Contabilidad debe confirmar cuando esté listo.',
        'rechazada': 'Cotización rechazada',
        'aceptada': 'Cotización aceptada'
      };

      toast({
        title: "Estado actualizado",
        description: statusMessages[newStatus] || `Estado cambiado a ${newStatus}`
      });

      onQuoteUpdated();
    } catch (error: any) {
      console.error('Error updating quote status:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
      setPendingAction(null);
    }
  };

  const convertToOrder = async () => {
    try {
      setLoading(true);

      // Obtener técnico del departamento correspondiente
      let assignedTechnician: string | null = null;

      if (department) {
        // Buscar flotilla del departamento
        const { data: fleetGroup } = await supabase
          .from('fleet_groups')
          .select('id')
          .eq('category', department)
          .eq('is_active', true)
          .single();

        if (fleetGroup) {
          // Buscar técnico asignado a esa flotilla
          const { data: technicians } = await supabase
            .from('fleet_group_technicians')
            .select('technician_id')
            .eq('fleet_group_id', fleetGroup.id)
            .eq('is_active', true)
            .limit(1);

          if (technicians && technicians.length > 0) {
            assignedTechnician = technicians[0].technician_id;
          }
        }
      }

      // Si está en estado asignando, primero actualizar equipment_ready
      if (quote.status === 'asignando') {
        await supabase
          .from('quotes')
          .update({
            equipment_ready: true,
            equipment_confirmed_at: new Date().toISOString(),
            equipment_confirmed_by: (profile as any)?.user_id
          })
          .eq('id', quote.id);
      }

      // Llamar a la función de conversión
      const { data, error } = await supabase.rpc('convert_quote_to_order', {
        quote_id: quote.id
      });

      if (error) throw error;

      const result = data as any;
      
      if (result?.error) {
        throw new Error(result.error);
      }

      // Actualizar la orden con el técnico asignado y source_type
      if (result?.order_id && assignedTechnician) {
        await supabase
          .from('orders')
          .update({
            assigned_technician: assignedTechnician,
            source_type: 'quote'
          })
          .eq('id', result.order_id);
      }

      if (result?.success) {
        if (result.existing) {
          toast({
            title: "Orden existente",
            description: result.message || `Orden ${result.order_number} ya existe`
          });
        } else {
          toast({
            title: "¡Orden creada!",
            description: `Orden ${result.order_number} creada${assignedTechnician ? ' y asignada al técnico del departamento de ' + department : ''}`
          });
        }
      }

      onQuoteUpdated();
    } catch (error: any) {
      console.error('Error converting to order:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la orden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
      setPendingAction(null);
    }
  };

  const handleEquipmentReadyChange = async (checked: boolean) => {
    setEquipmentReady(checked);
    
    // Guardar inmediatamente en la BD
    try {
      await supabase
        .from('quotes')
        .update({ equipment_ready: checked })
        .eq('id', quote.id);
    } catch (error) {
      console.error('Error updating equipment_ready:', error);
    }
  };

  const openConfirmDialog = (action: 'approve' | 'reject' | 'assign') => {
    setPendingAction(action);
    setShowConfirmDialog(true);
  };

  const executeAction = () => {
    switch (pendingAction) {
      case 'approve':
        handleApprove();
        break;
      case 'reject':
        handleReject();
        break;
      case 'assign':
        handleAssign();
        break;
    }
  };

  const getActionDialogContent = () => {
    switch (pendingAction) {
      case 'approve':
        if (hasEquipment && !equipmentReady) {
          return {
            title: "¿Aprobar cotización?",
            description: "Esta cotización tiene productos. Pasará a estado 'Asignando' mientras contabilidad compra el material."
          };
        }
        return {
          title: "¿Aprobar y crear orden?",
          description: "Se creará una orden de trabajo y se asignará automáticamente al técnico del departamento correspondiente."
        };
      case 'reject':
        return {
          title: "¿Rechazar cotización?",
          description: "La cotización será marcada como rechazada. Esta acción no se puede deshacer."
        };
      case 'assign':
        return {
          title: "¿Confirmar material y crear orden?",
          description: "Se creará una orden de trabajo con el material confirmado y se asignará al técnico del departamento."
        };
      default:
        return { title: "", description: "" };
    }
  };

  if (!canManageQuotes) return null;

  // Vista para estado "asignando" (esperando material)
  if (quote.status === 'asignando') {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <Package className="h-5 w-5" />
            Esperando Material
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-orange-700">
            <AlertTriangle className="h-4 w-4" />
            <span>Esta cotización tiene productos pendientes de compra</span>
          </div>

          {department && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white">
                <Truck className="h-3 w-3 mr-1" />
                Departamento: {department === 'sistemas' ? 'Sistemas' : 'Seguridad'}
              </Badge>
            </div>
          )}

          <Separator />

          {canConfirmEquipment && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="equipmentReady"
                  checked={equipmentReady}
                  onCheckedChange={handleEquipmentReadyChange}
                />
                <label
                  htmlFor="equipmentReady"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Material listo para asignar
                </label>
              </div>

              <Button
                onClick={() => openConfirmDialog('assign')}
                disabled={loading || !equipmentReady}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar y Crear Orden
              </Button>
            </div>
          )}

          {!canConfirmEquipment && (
            <p className="text-sm text-muted-foreground">
              Solo administradores y supervisores pueden confirmar el material.
            </p>
          )}
        </CardContent>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{getActionDialogContent().title}</AlertDialogTitle>
              <AlertDialogDescription>{getActionDialogContent().description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={executeAction} disabled={loading}>
                {loading ? "Procesando..." : "Confirmar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    );
  }

  // Vista normal para cotizaciones pendientes
  if (quote.status !== 'aceptada' && quote.status !== 'rechazada') {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Alerta cuando no tiene items */}
            {hasNoItems && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-800">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="text-sm font-medium">Cotización sin items</span>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  Al aprobar se abrirá el catálogo para seleccionar servicios o productos
                </p>
              </div>
            )}

            {/* Indicador de equipo */}
            {hasEquipment && !hasNoItems && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-amber-800">
                  <Package className="h-4 w-4" />
                  <span className="text-sm font-medium">Cotización con productos</span>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  Al aprobar, pasará a estado "Asignando" para esperar el material
                </p>
              </div>
            )}

            {/* Departamento detectado */}
            {department && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Truck className="h-3 w-3 mr-1" />
                  {department === 'sistemas' ? 'Sistemas' : 'Seguridad'}
                </Badge>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => hasNoItems ? handleApprove() : openConfirmDialog('approve')}
                disabled={loading}
                variant="default"
                className="w-full"
                size="sm"
              >
                {hasNoItems ? (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Agregar Items
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {hasEquipment ? 'Aprobar' : 'Aprobar y Crear Orden'}
                  </>
                )}
              </Button>
              <Button
                onClick={() => openConfirmDialog('reject')}
                disabled={loading}
                variant="destructive"
                className="w-full"
                size="sm"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rechazar
              </Button>
            </div>

            {quote.status === 'pendiente_aprobacion' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <h4 className="font-medium text-orange-800 text-sm mb-1">Cotización Pendiente de Aprobación</h4>
                <p className="text-xs text-orange-700">
                  Al aprobarla se iniciará el flujo de trabajo automáticamente.
                </p>
              </div>
            )}
          </CardContent>

          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{getActionDialogContent().title}</AlertDialogTitle>
                <AlertDialogDescription>{getActionDialogContent().description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={executeAction} 
                  disabled={loading}
                  className={pendingAction === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}
                >
                  {loading ? "Procesando..." : "Confirmar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>

        <AddQuoteItemsDialog
          open={showAddItemsDialog}
          onOpenChange={setShowAddItemsDialog}
          quoteId={quote.id}
          quoteNumber={quote.quote_number}
          onItemsAdded={handleItemsAdded}
        />
      </>
    );
  }

  // Mostrar estado actual si ya está procesada
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge className={quote.status === 'aceptada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
          {quote.status === 'aceptada' ? (
            <><CheckCircle className="h-4 w-4 mr-2" /> Aceptada</>
          ) : (
            <><XCircle className="h-4 w-4 mr-2" /> Rechazada</>
          )}
        </Badge>
      </CardContent>
    </Card>
  );
}
