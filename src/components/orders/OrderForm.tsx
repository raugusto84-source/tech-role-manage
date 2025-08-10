import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus } from 'lucide-react';
import { ClientForm } from '@/components/ClientForm';
import { TechnicianSuggestion } from '@/components/orders/TechnicianSuggestion';
import { OrderServiceSelection } from '@/components/orders/OrderServiceSelection';
import { OrderItemsList, OrderItem } from '@/components/orders/OrderItemsList';
import { calculateDeliveryDate, calculateAdvancedDeliveryDate, calculateSharedTimeHours, suggestSupportTechnician, calculateTechnicianWorkload } from '@/utils/workScheduleCalculator';

interface ServiceType {
  id: string;
  name: string;
  description?: string | null;
  cost_price: number | null;
  base_price?: number | null;
  estimated_hours?: number | null;
  vat_rate: number;
  item_type: string;
  category: string;
}

interface Technician {
  user_id: string;
  full_name: string;
}

interface Client {
  id: string;
  client_number: string;
  name: string;
  email: string;
  phone?: string;
  address: string;
}

interface OrderFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function OrderForm({ onSuccess, onCancel }: OrderFormProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [technicianWorkloads, setTechnicianWorkloads] = useState<any>({});
  
  const [formData, setFormData] = useState({
    client_id: '',
    failure_description: '',
    delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default to tomorrow
    assigned_technician: '',
    support_technician: 'none' // Initialize with 'none' instead of empty string
  });
  
  // Estados para el sistema de sugerencias de técnicos
  const [showTechnicianSuggestions, setShowTechnicianSuggestions] = useState(false);
  const [showSupportSuggestion, setShowSupportSuggestion] = useState(false);
  const [suggestionReason, setSuggestionReason] = useState('');
  const [supportSuggestion, setSupportSuggestion] = useState<any>(null);

  useEffect(() => {
    loadServiceTypes();
    loadCurrentOrders(); // Para calcular cargas de trabajo
    
    if (profile?.role === 'administrador' || profile?.role === 'vendedor') {
      // Para staff: cargar lista completa de clientes y técnicos
      loadClients();
      loadTechnicians();
    } else if (profile?.role === 'cliente') {
      // Para clientes: cargar su propio cliente automáticamente y técnicos para mostrar nombres
      loadCurrentClient();
      loadTechnicians(); // Cargar técnicos para mostrar nombres en la asignación
    }
  }, [profile?.role, profile?.email]);

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error('Error loading service types:', error);
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('role', 'tecnico')
        .order('full_name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const loadCurrentOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('assigned_technician, average_service_time, status')
        .neq('status', 'finalizada');

      if (error) throw error;

      const workloads = calculateTechnicianWorkload(data || []);
      setTechnicianWorkloads(workloads);
    } catch (error) {
      console.error('Error loading current orders:', error);
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('client_number');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadCurrentClient = async () => {
    try {
      if (!profile?.email) {
        console.log('No profile email available');
        return;
      }
      
      // Solo ejecutar para usuarios con rol cliente
      if (profile.role !== 'cliente') {
        console.log('User is not a client, skipping auto-assignment');
        return;
      }
      
      console.log('Loading client for email:', profile.email);
      
      // Buscar cliente por email del usuario autenticado
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('email', profile.email)
        .maybeSingle();

      if (error) {
        console.error('Error loading current client:', error);
        toast({
          title: "Error",
          description: `Error al cargar cliente: ${error.message}`,
          variant: "destructive"
        });
        return;
      }
      
      if (data) {
        console.log('Client found and auto-assigned:', data);
        setFormData(prev => ({ ...prev, client_id: data.id }));
        toast({
          title: "Cliente asignado",
          description: `Se ha asignado automáticamente el cliente: ${data.name}`,
          variant: "default"
        });
      } else {
        console.log('No client found for email:', profile.email);
        toast({
          title: "Información",
          description: "No se encontró un cliente asociado a tu email. El administrador debe crear tu registro de cliente primero.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Unexpected error loading current client:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información del cliente",
        variant: "destructive"
      });
    }
  };

  const handleServiceAdd = (service: ServiceType, quantity: number = 1) => {
    // Verificar si el servicio ya existe
    const existingItemIndex = orderItems.findIndex(item => item.service_type_id === service.id);
    
    if (existingItemIndex >= 0) {
      // Si ya existe, aumentar cantidad
      const updatedItems = [...orderItems];
      const existingItem = updatedItems[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;
      const subtotal = newQuantity * existingItem.unit_price;
      const vatAmount = subtotal * (existingItem.vat_rate / 100);
      const total = subtotal + vatAmount;
      const totalEstimatedHours = newQuantity * (service.estimated_hours || 0);
      
      updatedItems[existingItemIndex] = {
        ...existingItem,
        quantity: newQuantity,
        subtotal,
        vat_amount: vatAmount,
        total,
        estimated_hours: totalEstimatedHours
      };
      
      setOrderItems(updatedItems);
      toast({
        title: "Cantidad actualizada",
        description: `Se aumentó la cantidad de ${service.name} a ${newQuantity}`,
      });
    } else {
      // Agregar nuevo item
      const subtotal = quantity * (service.base_price || 0);
      const vatRate = service.vat_rate || 16;
      const vatAmount = subtotal * (vatRate / 100);
      const total = subtotal + vatAmount;
      const estimatedHours = quantity * (service.estimated_hours || 0);
      
      const newItem: OrderItem = {
        id: `item-${Date.now()}-${Math.random()}`,
        service_type_id: service.id,
        name: service.name,
        description: service.description || '',
        quantity,
        unit_price: service.base_price || 0,
        estimated_hours: estimatedHours,
        subtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total,
        item_type: service.item_type,
        shared_time: (service as any).shared_time || false, // Usar valor del servicio
        status: 'pendiente' // Estado inicial
      };
      
      setOrderItems([...orderItems, newItem]);
      toast({
        title: "Servicio agregado",
        description: `${service.name} ha sido agregado a la orden`,
      });
    }
    
    // Recalcular fecha de entrega y sugerir apoyo
    recalculateDeliveryAndSuggestSupport();
  };

  const calculateTotalHours = () => {
    // Usar la función mejorada de cálculo de tiempo compartido
    return calculateSharedTimeHours(orderItems);
  };

  const recalculateDeliveryAndSuggestSupport = () => {
    const totalHours = calculateTotalHours();
    
    if (totalHours > 0 && formData.assigned_technician) {
      // Simular horario estándar (se puede obtener de la base de datos)
      const standardSchedule = {
        work_days: [1, 2, 3, 4, 5], // Lunes a viernes
        start_time: '08:00',
        end_time: '17:00',
        break_duration_minutes: 60
      };
      
      // Calcular reducción por técnicos de apoyo (0.5% por técnico)
      const supportTechnicians = formData.support_technician && formData.support_technician !== "none" ? 1 : 0;
      const reductionFactor = 1 - (supportTechnicians * 0.005); // 0.5% de reducción
      const adjustedHours = totalHours * reductionFactor;
      
      const { deliveryDate } = calculateDeliveryDate(adjustedHours, standardSchedule);
      const deliveryDateString = deliveryDate.toISOString().split('T')[0];
      
      setFormData(prev => ({
        ...prev,
        delivery_date: deliveryDateString
      }));
      
      // Sugerir técnico de apoyo si es necesario
      const supportSugg = suggestSupportTechnician(
        formData.assigned_technician,
        totalHours,
        technicians,
        technicianWorkloads
      );
      
      if (supportSugg.suggested) {
        setSupportSuggestion(supportSugg);
        setShowSupportSuggestion(true);
      }
    }
  };

  /**
   * FUNCIÓN: handleTechnicianSuggestionSelect
   * 
   * PROPÓSITO:
   * - Maneja la selección de un técnico desde las sugerencias automáticas
   * - Actualiza el formulario con el técnico seleccionado
   * - Guarda la razón de la sugerencia para mostrar al usuario
   * 
   * PARÁMETROS:
   * - technicianId: ID del técnico seleccionado
   * - reason: Razón por la cual fue sugerido este técnico
   */
  /**
   * FUNCIÓN: autoAssignTechnicianForClient
   * 
   * PROPÓSITO:
   * - Asignar automáticamente el mejor técnico para clientes
   * - Los clientes no ven la interfaz de selección, pero obtienen asignación óptima
   * - Proporciona transparencia sobre la asignación realizada
   */
  const autoAssignTechnicianForClient = async () => {
    if (orderItems.length === 0) return;
    try {
      // Usar el primer servicio para la sugerencia (se puede mejorar)
      const firstService = orderItems[0];
      const { data: suggestions, error } = await supabase
        .rpc('suggest_optimal_technician', {
          p_service_type_id: firstService.service_type_id,
          p_delivery_date: formData.delivery_date || null
        });

      if (error) {
        console.error('Error getting technician suggestions for client:', error);
        return;
      }

      // Ordenar por puntuación y seleccionar el mejor
      const sortedSuggestions = (suggestions || []).sort((a, b) => b.score - a.score);
      
      if (sortedSuggestions.length > 0) {
        const bestTechnician = sortedSuggestions[0];
        
        // Asignar automáticamente
        setFormData(prev => ({ 
          ...prev, 
          assigned_technician: bestTechnician.technician_id 
        }));
        setSuggestionReason(bestTechnician.suggestion_reason);
        
        // Notificar al cliente sobre la asignación
        toast({
          title: "Técnico asignado automáticamente",
          description: `${bestTechnician.full_name} será el técnico asignado. ${bestTechnician.suggestion_reason}`,
        });
      } else {
        // No hay técnicos disponibles
        toast({
          title: "Asignación pendiente",
          description: "No hay técnicos disponibles en este momento. Un técnico será asignado por el equipo administrativo.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error in auto-assignment for client:', error);
    }
  };

  const handleTechnicianSuggestionSelect = (technicianId: string, reason: string) => {
    setFormData(prev => ({ ...prev, assigned_technician: technicianId }));
    setSuggestionReason(reason);
    
    // Encontrar el nombre del técnico para el toast
    const selectedTechnician = technicians.find(t => t.user_id === technicianId);
    if (selectedTechnician) {
      toast({
        title: "Técnico sugerido seleccionado",
        description: `${selectedTechnician.full_name}: ${reason}`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar que tenemos items en la orden
      if (orderItems.length === 0) {
        toast({
          title: "Error",
          description: "Debe agregar al menos un artículo a la orden",
          variant: "destructive"
        });
        return;
      }

      // Validar que tenemos client_id
      if (!formData.client_id) {
        toast({
          title: "Error",
          description: "No se ha seleccionado un cliente",
          variant: "destructive"
        });
        return;
      }

      // Validar que tenemos fecha de entrega
      if (!formData.delivery_date) {
        toast({
          title: "Error",
          description: "Debe seleccionar una fecha de entrega",
          variant: "destructive"
        });
        return;
      }

      // Calcular totales de todos los items
      const totalAmount = orderItems.reduce((sum, item) => sum + item.total, 0);
      const totalHours = calculateTotalHours();
      
      // Crear la orden principal
      const orderData = {
        client_id: formData.client_id,
        service_type: orderItems[0].service_type_id, // Usar el primer servicio como tipo principal
        failure_description: formData.failure_description,
        delivery_date: formData.delivery_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default to tomorrow if empty
        estimated_cost: totalAmount,
        average_service_time: totalHours,
        assigned_technician: formData.assigned_technician && formData.assigned_technician !== 'unassigned' ? formData.assigned_technician : null,
        assignment_reason: suggestionReason || null,
        created_by: user?.id,
        status: 'pendiente' as const
      };

      const { data: orderResult, error: orderError } = await supabase
        .from('orders')
        .insert(orderData as any)
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Crear los items de la orden
      const orderItemsData = orderItems.map(item => ({
        order_id: orderResult.id,
        service_type_id: item.service_type_id,
        service_name: item.name,
        service_description: item.description,
        quantity: item.quantity,
        unit_cost_price: item.unit_price,
        unit_base_price: item.unit_price,
        profit_margin_rate: 0,
        subtotal: item.subtotal,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount,
        total_amount: item.total,
        item_type: item.item_type
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Si falla crear los items, eliminar la orden
        await supabase.from('orders').delete().eq('id', orderResult.id);
        throw itemsError;
      }

      toast({
        title: "Orden creada",
        description: `Orden creada exitosamente con ${orderItems.length} artículo(s) por un total de ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalAmount)}`,
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la orden de servicio",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClientCreated = (newClient: Client) => {
    setClients(prev => [...prev, newClient]);
    setFormData(prev => ({ ...prev, client_id: newClient.id }));
    setShowClientForm(false);
  };

  if (showClientForm) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center mb-6">
            <Button variant="ghost" onClick={() => setShowClientForm(false)} className="mr-4">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Crear Cliente</h1>
          </div>
          <ClientForm 
            onSuccess={handleClientCreated}
            onCancel={() => setShowClientForm(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={onCancel} className="mr-4">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Nueva Orden de Servicio</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Información de la Orden</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selección del Cliente - Solo para staff */}
              {(profile?.role === 'administrador' || profile?.role === 'vendedor') && (
                <div className="space-y-2">
                  <Label htmlFor="client_id">Cliente *</Label>
                  <div className="flex gap-2">
                    <Select value={formData.client_id} onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))} required>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecciona un cliente" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50">
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.client_number} - {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowClientForm(true)}
                      className="px-3"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Descripción del Problema - Arriba */}
              <div className="space-y-2">
                <Label htmlFor="failure_description">Descripción del Problema *</Label>
                <Textarea
                  id="failure_description"
                  value={formData.failure_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, failure_description: e.target.value }))}
                  placeholder="Describe detalladamente el problema o servicio requerido..."
                  rows={4}
                  required
                />
              </div>

              {/* Selección de Servicios por Categoría */}
              <div className="space-y-4">
                <Label>Servicios y Productos *</Label>
                <OrderServiceSelection 
                  onServiceAdd={handleServiceAdd}
                  selectedServiceIds={orderItems.map(item => item.service_type_id)}
                />
              </div>

              {/* Lista de artículos seleccionados */}
              <OrderItemsList 
                items={orderItems}
                onItemsChange={setOrderItems}
              />

              {/* Asignación de Técnicos */}
              {(profile?.role === 'administrador' || profile?.role === 'vendedor') && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="assigned_technician">Técnico Principal</Label>
                      <Select value={formData.assigned_technician} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_technician: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar técnico" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border z-50">
                          {technicians.map((technician) => (
                            <SelectItem key={technician.user_id} value={technician.user_id}>
                              {technician.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="support_technician">Técnico de Apoyo (Opcional)</Label>
                      <Select value={formData.support_technician} onValueChange={(value) => setFormData(prev => ({ ...prev, support_technician: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar técnico de apoyo" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border z-50">
                          <SelectItem value="none">Sin técnico de apoyo</SelectItem>
                          {technicians.filter(t => t.user_id !== formData.assigned_technician).map((technician) => (
                            <SelectItem key={technician.user_id} value={technician.user_id}>
                              {technician.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.support_technician && formData.support_technician !== "none" && (
                        <p className="text-xs text-green-600">
                          Tiempo estimado reducido en 0.5% con técnico de apoyo
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Fecha de Entrega */}
              <div className="space-y-2">
                <Label htmlFor="delivery_date">Fecha de Entrega Estimada *</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  value={formData.delivery_date}
                  readOnly
                  className="bg-muted"
                />
                {orderItems.length > 0 && formData.assigned_technician && formData.assigned_technician !== 'unassigned' && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Calculado automáticamente basado en {calculateSharedTimeHours(orderItems)} horas efectivas</p>
                    {formData.support_technician && formData.support_technician !== 'none' && (
                      <p className="text-green-600">Con técnico de apoyo: tiempo reducido</p>
                    )}
                     {(() => {
                       try {
                         // Usar horarios estándar para el cálculo de hora estimada
                         const primarySchedule = {
                           work_days: [1, 2, 3, 4, 5],
                           start_time: '08:00',
                           end_time: '17:00',
                           break_duration_minutes: 60
                         };
                         
                         let supportSchedule = undefined;
                         if (formData.support_technician && formData.support_technician !== 'none') {
                           // Si hay técnico de apoyo, usar el mismo horario estándar
                           supportSchedule = primarySchedule;
                         }
                         
                         // Obtener carga de trabajo actual del técnico
                         const currentWorkload = technicianWorkloads[formData.assigned_technician]?.total_hours || 0;
                         
                         const { deliveryTime, effectiveHours, breakdown } = calculateAdvancedDeliveryDate({
                            orderItems: orderItems.map(item => ({
                              id: item.id,
                              estimated_hours: item.estimated_hours || 0,
                              shared_time: item.shared_time || false,
                              status: item.status || 'pendiente',
                              service_type_id: item.service_type_id,
                              quantity: item.quantity
                            })),
                           primaryTechnicianSchedule: primarySchedule,
                           supportTechnicianSchedule: supportSchedule,
                           creationDate: new Date(),
                           currentWorkload
                         });
                         
                         return (
                           <div className="space-y-1">
                             <p className="text-blue-600 font-medium">Hora estimada de entrega: {deliveryTime}</p>
                             <p className="text-xs text-muted-foreground">{breakdown}</p>
                             <p className="text-xs text-green-600">Horas efectivas considerando tiempo compartido: {effectiveHours}h</p>
                           </div>
                          );
                        } catch (error) {
                          return <p className="text-red-500 text-xs">Error calculando fecha de entrega</p>;
                        }
                        return null;
                      })()}
                  </div>
                )}
              </div>

              {/* Sugerencias de Técnicos para Staff */}
              {showTechnicianSuggestions && orderItems.length > 0 && (profile?.role === 'administrador' || profile?.role === 'vendedor') && (
                <div className="mt-4">
                  <TechnicianSuggestion
                    serviceTypeId={orderItems[0].service_type_id}
                    deliveryDate={formData.delivery_date}
                    onTechnicianSelect={handleTechnicianSuggestionSelect}
                  />
                </div>
              )}

              {/* Mostrar técnico asignado para CLIENTES */}
              {profile?.role === 'cliente' && formData.assigned_technician && (
                <div className="space-y-2">
                  <Label>Técnico Asignado</Label>
                  <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                        {(() => {
                          const techName = technicians.find(t => t.user_id === formData.assigned_technician)?.full_name || 'Técnico';
                          return techName.split(' ').map(n => n[0]).join('').toUpperCase();
                        })()}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">
                          {technicians.find(t => t.user_id === formData.assigned_technician)?.full_name || 'Técnico Asignado'}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Técnico especializado asignado a tu orden
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-blue-600 font-medium">✓ ASIGNADO</div>
                      </div>
                    </div>
                    
                    {/* Mostrar razón de la asignación si está disponible */}
                    {suggestionReason && (
                      <div className="mt-3 text-sm text-blue-700 bg-blue-100 rounded p-2">
                        <strong>¿Por qué este técnico?</strong> {suggestionReason}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading || orderItems.length === 0} className="flex-1">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creando Orden...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Crear Orden de Servicio
                    </div>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}