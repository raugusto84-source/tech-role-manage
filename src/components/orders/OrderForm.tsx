import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus, CalendarIcon, MapPin, Crosshair, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClientForm } from '@/components/ClientForm';
import { FleetSuggestion } from '@/components/orders/FleetSuggestion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { OrderServiceSelection } from '@/components/orders/OrderServiceSelection';
import { OrderItemsList, OrderItem } from '@/components/orders/OrderItemsList';
import { ProductServiceSeparator } from '@/components/orders/ProductServiceSeparator';
import { calculateDeliveryDate, calculateAdvancedDeliveryDate, calculateSharedTimeHours, suggestSupportTechnician, calculateTechnicianWorkload, getTechnicianCurrentWorkload } from '@/utils/workScheduleCalculator';
import { useWorkloadCalculation } from '@/hooks/useWorkloadCalculation';
import { DeliveryCalculationDisplay } from '@/components/orders/DeliveryCalculationComponent';
import { MultipleSupportTechnicianSelector } from '@/components/orders/MultipleSupportTechnicianSelector';
// Removed CashbackApplicationDialog import - cashback system eliminated
import { useSalesPricingCalculation } from '@/hooks/useSalesPricingCalculation';
import { usePricingCalculation } from '@/hooks/usePricingCalculation';
import { formatCOPCeilToTen, ceilToTen } from '@/utils/currency';
import { EquipmentList } from './EquipmentList';

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
  profit_margin_tiers?: Array<{
    min_qty: number;
    max_qty: number;
    margin: number;
  }>;
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

interface OrderFormData {
  client_id: string;
  failure_description: string;
  delivery_date: string;
  assigned_fleet: string;
  assigned_technician: string;
  estimated_cost: string;
  is_home_service: boolean;
  service_category: 'sistemas' | 'seguridad';
  service_location: {
    latitude?: number;
    longitude?: number;
    address?: string;
  } | null;
}

interface SupportTechnicianEntry {
  id: string;
  technicianId: string;
  reductionPercentage: number;
}

export function OrderForm({ onSuccess, onCancel }: OrderFormProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { getDisplayPrice, formatCurrency } = useSalesPricingCalculation();
  const [loading, setLoading] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [technicianWorkloads, setTechnicianWorkloads] = useState<any>({});
  const [technicianSchedules, setTechnicianSchedules] = useState<Record<string, any>>({});
  
  const [formData, setFormData] = useState<OrderFormData>({
    client_id: '',
    failure_description: '',
    delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    assigned_fleet: '',
    assigned_technician: '',
    estimated_cost: '',
    is_home_service: false,
    service_category: 'sistemas',
    service_location: null
  });
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [supportTechnicians, setSupportTechnicians] = useState<SupportTechnicianEntry[]>([]);
  const [orderEquipment, setOrderEquipment] = useState<any[]>([]);

  // Estados para el sistema de sugerencias de flotillas
  const [showFleetSuggestions, setShowFleetSuggestions] = useState(false);
  const [showTechnicianSuggestions, setShowTechnicianSuggestions] = useState(false);
  const [selectedFleetName, setSelectedFleetName] = useState('');
  const [fleetSuggestionReason, setFleetSuggestionReason] = useState('');

  // Estados para agregar item manual
  const [showManualItemDialog, setShowManualItemDialog] = useState(false);
  const [manualItemForm, setManualItemForm] = useState({
    name: '',
    description: '',
    price: '',
    quantity: '1',
    item_type: 'servicio' as 'servicio' | 'articulo'
  });
  
  // Hook for pricing calculation
  const pricing = usePricingCalculation(orderItems, formData.client_id);

  // Función para cargar equipos de la orden (para edición)
  const loadOrderEquipment = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('order_equipment')
        .select(`
          *,
          equipment_categories (
            name,
            icon
          )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrderEquipment(data || []);
    } catch (error) {
      console.error('Error loading order equipment:', error);
    }
  };

  // Función para actualizar automáticamente la fecha de entrega
  const updateDeliveryDate = async () => {
    if (orderItems.length === 0) return;

    try {
      const defaultSchedule = {
        work_days: [1, 2, 3, 4, 5],
        start_time: '08:00',
        end_time: '16:00',
        break_duration_minutes: 60,
      };

      const hasTechnician = !!formData.assigned_technician && formData.assigned_technician !== 'unassigned';
      const primarySchedule = hasTechnician
        ? (technicianSchedules[formData.assigned_technician] || defaultSchedule)
        : defaultSchedule;

      const processedSupport = hasTechnician
        ? supportTechnicians.map(st => ({
            id: st.technicianId,
            schedule: technicianSchedules[st.technicianId] || defaultSchedule,
            reductionPercentage: st.reductionPercentage,
          }))
        : [];

      let currentWorkload = 0;
      if (hasTechnician) {
        try {
          currentWorkload = await getTechnicianCurrentWorkload(formData.assigned_technician);
        } catch (e) {
          console.warn('Could not fetch technician workload, using 0');
          currentWorkload = 0;
        }
      }

      const result = calculateAdvancedDeliveryDate({
        orderItems: orderItems.map((item) => ({
          id: item.id,
          estimated_hours: (item as any).estimated_hours || 1,
          shared_time: (item as any).shared_time || false,
          service_type_id: (item as any).service_type_id,
          quantity: (item as any).quantity || 1,
        })),
        primaryTechnicianSchedule: primarySchedule,
        supportTechnicians: processedSupport,
        creationDate: new Date(),
        currentWorkload,
      });

      const calculatedDate = result.deliveryDate.toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, delivery_date: calculatedDate }));

      console.log('Auto-calculated delivery date:', calculatedDate);
    } catch (error) {
      console.error('Error auto-calculating delivery date:', error);
    }
  };

  // Effect para recalcular fecha cuando cambien técnicos de apoyo
  useEffect(() => {
    if (orderItems.length > 0) {
      updateDeliveryDate();
    }
  }, [supportTechnicians.length]); // Recalcular cuando cambie la cantidad de técnicos de apoyo

  // Effect para recalcular fecha cuando cambien los items de la orden o el técnico
  useEffect(() => {
    if (orderItems.length > 0) {
      const timeoutId = setTimeout(() => updateDeliveryDate(), 400);
      return () => clearTimeout(timeoutId);
    }
  }, [orderItems, formData.assigned_technician, supportTechnicians.length]);

  useEffect(() => {
    loadServiceTypes();
    loadCurrentOrders();
    loadTechnicianSchedules();
    
    const init = async () => {
      if (profile?.role === 'administrador' || profile?.role === 'vendedor') {
        await syncClientsFromProfiles();
        await loadClients();
        await loadTechnicians();
      } else if (profile?.role === 'cliente') {
        await loadCurrentClient();
        await loadTechnicians();
      }
    };
    init();
  }, [profile?.role, profile?.email, formData.service_category]); // Recargar cuando cambie la categoría

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .eq('service_category', formData.service_category) // Filtrar por categoría seleccionada
        .order('name');

      if (error) throw error;
      
      // Transform data to match ServiceType interface
      const transformedData = (data || []).map((service: any) => ({
        ...service,
        profit_margin_tiers: Array.isArray(service.profit_margin_tiers) ? service.profit_margin_tiers : []
      }));
      
      setServiceTypes(transformedData);
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

  const loadTechnicianSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('work_schedules')
        .select('employee_id, work_days, start_time, end_time, break_duration_minutes, is_active')
        .eq('is_active', true);

      if (error) throw error;

      // Convertir array a objeto indexado por employee_id
      const schedulesMap: Record<string, any> = {};
      
      // Primero, crear horarios por defecto para todos los técnicos
      technicians.forEach(technician => {
        schedulesMap[technician.user_id] = {
          work_days: [1, 2, 3, 4, 5],
          start_time: '08:00',
          end_time: '16:00',
          break_duration_minutes: 60
        };
      });

      // Luego, sobrescribir con los horarios específicos que existan
      (data || []).forEach(schedule => {
        schedulesMap[schedule.employee_id] = {
          work_days: schedule.work_days,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          break_duration_minutes: schedule.break_duration_minutes || 60
        };
      });
      
      setTechnicianSchedules(schedulesMap);
    } catch (error) {
      console.error('Error loading technician schedules:', error);
      // Crear horarios por defecto si hay error
      const defaultSchedules: Record<string, any> = {};
      technicians.forEach(technician => {
        defaultSchedules[technician.user_id] = {
          work_days: [1, 2, 3, 4, 5],
          start_time: '08:00',
          end_time: '16:00',
          break_duration_minutes: 60
        };
      });
      setTechnicianSchedules(defaultSchedules);
    }
  };

  // Sincroniza perfiles con rol "cliente" hacia la tabla clients para que todos aparezcan
  const syncClientsFromProfiles = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .eq('role', 'cliente');
      if (profilesError) throw profilesError;

      const emails = (profilesData || []).map((p: any) => p.email).filter(Boolean);
      if (emails.length === 0) return;

      const { data: existing, error: existingError } = await supabase
        .from('clients')
        .select('email')
        .in('email', emails);
      if (existingError) throw existingError;

      const existingSet = new Set((existing || []).map((c: any) => c.email).filter(Boolean));
      const toInsert = (profilesData || [])
        .filter((p: any) => p.email && !existingSet.has(p.email))
        .map((p: any) => ({
          user_id: p.user_id,
          name: p.full_name || (p.email as string).split('@')[0],
          email: p.email,
          phone: p.phone || '',
          address: 'Dirección no especificada',
          client_number: '', // trigger handle_new_client will generate the real number
          created_by: user?.id || null
        }));

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('clients').insert(toInsert);
        if (insertError) throw insertError;
        console.log('Synced new clients from profiles:', toInsert.length);
      }
    } catch (e) {
      console.error('Error syncing clients from profiles:', e);
    }
  };

  const loadClients = async () => {
    try {
      // Obtener los emails de perfiles activos con rol cliente
      const { data: activeProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('email, user_id')
        .eq('role', 'cliente');

      if (profilesError) throw profilesError;

      if (!activeProfiles || activeProfiles.length === 0) {
        console.log('No active client profiles found');
        setClients([]);
        return;
      }

      const activeEmails = activeProfiles.map(p => p.email).filter(Boolean);
      const activeUserIds = activeProfiles.map(p => p.user_id).filter(Boolean);

      // Cargar clientes que corresponden a esos perfiles activos
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .or(`email.in.(${activeEmails.join(',')}),user_id.in.(${activeUserIds.join(',')})`)
        .order('client_number')
        .limit(1000);

      if (error) throw error;
      
      console.log('Loaded active clients:', data?.length);
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      setClients([]);
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
        console.log('No client found for email:', profile.email, 'Creating client record automatically');
        
        // Crear automáticamente el registro de cliente si no existe
        const { data: newClient, error: createError } = await supabase
          .from('clients')
          .insert({
            name: profile.full_name || 'Usuario Cliente',
            email: profile.email,
            phone: '', 
            address: 'Dirección no especificada',
            created_by: user?.id
          } as any)
          .select()
          .single();
          
        if (createError) {
          console.error('Error creating client record:', createError);
          toast({
            title: "Error",
            description: `No se pudo crear el registro de cliente: ${createError.message}`,
            variant: "destructive"
          });
          return;
        }
        
        console.log('Client record created automatically:', newClient);
        setFormData(prev => ({ ...prev, client_id: newClient.id }));
        toast({
          title: "Cliente creado",
          description: `Se ha creado tu registro de cliente automáticamente: ${newClient.name}`,
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


  // Use sales pricing calculation for consistent pricing
  const calculateExactDisplayPrice = (service: ServiceType, quantity: number = 1) => {
    console.log('OrderForm calculateExactDisplayPrice called for:', service.name, 'quantity:', quantity);
    const rawTotal = getDisplayPrice(service, quantity);

    // Alinear con visual: aplicar redondeo por ítem a múltiplos de 10 para catálogo
    const roundedTotal = ceilToTen(rawTotal);
    
    const salesVatRate = service.vat_rate ?? 16;
    const subtotalWithoutVat = roundedTotal / (1 + salesVatRate / 100);
    const vatAmount = roundedTotal - subtotalWithoutVat;
    
    const result = {
      subtotal: subtotalWithoutVat,
      vatAmount: vatAmount,
      totalAmount: roundedTotal
    };
    
    console.log('OrderForm pricing result:', result);
    return result;
  };

  const handleServiceAdd = async (service: ServiceType, quantity: number = 1) => {
    // Verificar si el servicio ya existe
    const existingItemIndex = orderItems.findIndex(item => item.service_type_id === service.id);
    
    let updatedItems: OrderItem[];
    if (existingItemIndex >= 0) {
      // Si ya existe, aumentar cantidad
      updatedItems = [...orderItems];
      const existingItem = updatedItems[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;
      
      // Recalcular precios usando la misma lógica que ProductServiceSeparator
      const exactPricing = calculateExactDisplayPrice(service, newQuantity);
      
      // Calcular horas por unidad basándose en el servicio original
      const hoursPerUnit = (service.estimated_hours || 0);
      const totalEstimatedHours = newQuantity * hoursPerUnit;
      
        updatedItems[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          unit_price: exactPricing.totalAmount / newQuantity,
          subtotal: exactPricing.subtotal,
          original_subtotal: undefined,
          policy_discount_percentage: 0,
          policy_discount_amount: 0,
          policy_name: undefined,
          vat_rate: service.vat_rate,
          vat_amount: exactPricing.vatAmount,
          total: exactPricing.totalAmount, // Este es el precio final correcto con cashback
          estimated_hours: totalEstimatedHours
        };
      
      toast({
        title: "Cantidad actualizada",
        description: `Se aumentó la cantidad de ${service.name} a ${newQuantity}`,
      });
    } else {
      // Agregar nuevo item - usar cálculo exacto como ProductServiceSeparator
      const exactPricing = calculateExactDisplayPrice(service, quantity);
      const estimatedHours = quantity * (service.estimated_hours || 0);
      
      const newItem: OrderItem = {
        id: `item-${Date.now()}-${Math.random()}`,
        service_type_id: service.id,
        name: service.name,
        description: service.description || '',
        quantity,
        unit_price: exactPricing.totalAmount / quantity,
        cost_price: service.cost_price,
        estimated_hours: estimatedHours,
        subtotal: exactPricing.subtotal,
        original_subtotal: undefined,
        policy_discount_percentage: 0,
        policy_discount_amount: 0,
        policy_name: undefined,
        vat_rate: service.vat_rate,
        vat_amount: exactPricing.vatAmount,
        total: exactPricing.totalAmount, // Este es el precio final correcto con cashback
        item_type: service.item_type,
        shared_time: (service as any).shared_time || false,
        status: 'pendiente',
        profit_margin_tiers: service.profit_margin_tiers
      };
      
      updatedItems = [...orderItems, newItem];
      toast({
        title: "Servicio agregado",
        description: `${service.name} ha sido agregado a la orden`,
      });
    }
    
    setOrderItems(updatedItems);
    
    // Asignación automática de flotilla para el servicio
    await autoAssignOptimalFleet(service.id, updatedItems);
  };

  const handleManualItemAdd = () => {
    const price = parseFloat(manualItemForm.price);
    const quantity = parseInt(manualItemForm.quantity);

    if (!manualItemForm.name.trim() || isNaN(price) || price <= 0 || quantity <= 0) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos correctamente",
        variant: "destructive"
      });
      return;
    }

    // Calcular IVA (16%)
    const vatRate = 16;
    const totalAmount = price * quantity;
    const subtotal = totalAmount / (1 + vatRate / 100);
    const vatAmount = totalAmount - subtotal;

    const newItem: OrderItem = {
      id: `manual-${Date.now()}-${Math.random()}`,
      service_type_id: null, // Items manuales no tienen service_type_id
      name: manualItemForm.name,
      description: manualItemForm.description || '',
      quantity,
      unit_price: price,
      cost_price: 0,
      estimated_hours: 0,
      subtotal: subtotal,
      original_subtotal: undefined,
      policy_discount_percentage: 0,
      policy_discount_amount: 0,
      policy_name: undefined,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total: totalAmount,
      item_type: manualItemForm.item_type,
      shared_time: false,
      status: 'pendiente',
      profit_margin_tiers: []
    };

    setOrderItems([...orderItems, newItem]);
    
    // Resetear formulario y cerrar diálogo
    setManualItemForm({
      name: '',
      description: '',
      price: '',
      quantity: '1',
      item_type: 'servicio'
    });
    setShowManualItemDialog(false);

    toast({
      title: "Item agregado",
      description: `${manualItemForm.name} ha sido agregado a la orden`,
    });
  };

  const calculateTotalHours = () => {
    // Usar la función mejorada de cálculo de tiempo compartido
    const baseHours = calculateSharedTimeHours(orderItems);
    // Agregar 1 hora si es servicio a domicilio para tiempo de traslado
    return formData.is_home_service ? baseHours + 1 : baseHours;
  };

  const calculateTotals = () => {
    const totalCostPrice = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalVATAmount = orderItems.reduce((sum, item) => sum + item.vat_amount, 0);
    const totalAmount = totalCostPrice + totalVATAmount;
    return {
      totalCostPrice,
      totalVATAmount,
      totalAmount
    };
  };

  // Removed calculateTotalsWithCashbackAdjustment - cashback system eliminated

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
      
      // Calcular reducción por técnicos de apoyo múltiples
      const totalReduction = supportTechnicians.reduce((sum, tech) => sum + tech.reductionPercentage, 0);
      const reductionFactor = 1 - (Math.min(totalReduction, 90) / 100); // Cap at 90%
      const adjustedHours = totalHours * reductionFactor;
      
      const { deliveryDate } = calculateDeliveryDate(adjustedHours, standardSchedule);
      const deliveryDateString = deliveryDate.toISOString().split('T')[0];
      
      setFormData(prev => ({
        ...prev,
        delivery_date: deliveryDateString
      }));
      
      // Ya no se sugieren técnicos de apoyo en el sistema de flotillas
      // La flotilla se encargará de gestionar la distribución de trabajo
    }
  };

  /**
   * FUNCIÓN: handleFleetSuggestionSelect
   * 
   * PROPÓSITO:
   * - Maneja la selección de una flotilla desde las sugerencias automáticas
   * - Actualiza el formulario con la flotilla seleccionada
   * - Guarda la razón de la sugerencia para mostrar al usuario
   * - Asigna automáticamente el mejor técnico disponible de la flotilla
   * 
   * PARÁMETROS:
   * - fleetId: ID de la flotilla seleccionada
   * - fleetName: Nombre de la flotilla
   * - reason: Razón por la cual fue sugerida esta flotilla
   */
  /**
   * FUNCIÓN: autoAssignOptimalFleet
   * 
   * PROPÓSITO:
   * - Asigna automáticamente la mejor flotilla para un tipo de servicio
   * - Luego selecciona el mejor técnico disponible de esa flotilla
   * - Basado en habilidades y disponibilidad
   */
  const autoAssignOptimalFleet = async (serviceTypeId: string, orderItems: OrderItem[]) => {
    try {
      console.log('Auto-assigning optimal fleet for service:', serviceTypeId);
      
      // Ejecutar para todos los usuarios - la selección automática debe funcionar siempre
      // Solo los administradores/vendedores pueden cambiar manualmente después

      // Obtener sugerencias de flotilla
      const { data: suggestions, error } = await supabase
        .rpc('suggest_optimal_fleet', {
          p_service_type_id: serviceTypeId,
          p_delivery_date: formData.delivery_date || null
        });

      if (error) {
        console.error('Error getting fleet suggestions:', error);
        return;
      }

      if (!suggestions || suggestions.length === 0) {
        console.log('No fleet suggestions available for service');
        
        // Mostrar mensaje informativo solo para staff
        if (profile?.role === 'administrador' || profile?.role === 'vendedor') {
          toast({
            title: "Sin flotillas disponibles",
            description: "No hay flotillas configuradas para este tipo de servicio",
            variant: "destructive"
          });
        }
        return;
      }

      // Seleccionar la mejor flotilla (la primera en el ranking)
      const bestFleet = suggestions[0];
      console.log('Best fleet selected:', bestFleet);
      
      setFormData(prev => ({ 
        ...prev, 
        assigned_fleet: bestFleet.fleet_group_id
      }));
      setSelectedFleetName(bestFleet.fleet_name);
      setFleetSuggestionReason(bestFleet.suggestion_reason);
      
      // Asignar el mejor técnico de esa flotilla
      await assignBestTechnicianFromFleet(bestFleet.fleet_group_id, serviceTypeId);
      
      // Calcular y actualizar fecha de entrega automáticamente
      setTimeout(() => updateDeliveryDate(), 500); // Pequeño delay para asegurar que el técnico se haya asignado
      
      // No mostrar notificación - asignación silenciosa

    } catch (error) {
      console.error('Error in fleet auto-assignment:', error);
    }
  };

  const assignBestTechnicianFromFleet = async (fleetId: string, serviceTypeId: string) => {
    try {
      // Obtener técnicos asignados a la flotilla específica
      const { data: fleetTechnicians, error: fleetError } = await supabase
        .from('fleet_assignments')
        .select(`
          technician_id,
          profiles!inner(user_id, full_name)
        `)
        .eq('fleet_group_id', fleetId)
        .eq('is_active', true);

      if (fleetError) {
        console.log('Error getting fleet technicians, using fallback:', fleetError);
        // Fallback: usar el mejor técnico general
        await assignBestTechnicianFallback(serviceTypeId);
        return;
      }

      if (!fleetTechnicians?.length) {
        console.log('No technicians assigned to this fleet, using fallback');
        await assignBestTechnicianFallback(serviceTypeId);
        return;
      }

      // Obtener sugerencias de técnicos para este servicio específico
      const { data: techSuggestions, error: techError } = await supabase
        .rpc('suggest_optimal_technician', {
          p_service_type_id: serviceTypeId,
          p_delivery_date: formData.delivery_date || null
        });

      if (techError || !techSuggestions?.length) {
        console.log('No technician suggestions available');
        return;
      }

      // Filtrar solo técnicos de la flotilla seleccionada
      const technicianIds = fleetTechnicians.map(ft => ft.technician_id);
      const fleetTechSuggestions = techSuggestions.filter(ts => 
        technicianIds.includes(ts.technician_id)
      );

      if (fleetTechSuggestions.length > 0) {
        // Seleccionar el mejor técnico de la flotilla (ya viene ordenado por score)
        const bestTechnician = fleetTechSuggestions[0];
        setFormData(prev => ({ 
          ...prev, 
          assigned_technician: bestTechnician.technician_id
        }));
        setFleetSuggestionReason(bestTechnician.suggestion_reason);
        
        // Actualizar fecha de entrega automáticamente
        setTimeout(() => updateDeliveryDate(), 300);
        
        console.log('Best technician from specific fleet assigned:', bestTechnician);
      } else {
        // No hay técnicos capacitados para este servicio en esta flotilla
        console.log('No qualified technicians in this fleet for this service, using fallback');
        await assignBestTechnicianFallback(serviceTypeId);
      }

    } catch (error) {
      console.error('Error assigning technician from fleet:', error);
      await assignBestTechnicianFallback(serviceTypeId);
    }
  };

  const assignBestTechnicianFallback = async (serviceTypeId: string) => {
    try {
      // Obtener el mejor técnico general disponible como fallback
      const { data: techSuggestions, error: techError } = await supabase
        .rpc('suggest_optimal_technician', {
          p_service_type_id: serviceTypeId,
          p_delivery_date: formData.delivery_date || null
        });

      if (techError || !techSuggestions?.length) {
        console.log('No technician suggestions available in fallback');
        return;
      }

      const bestTechnician = techSuggestions[0];
      setFormData(prev => ({ 
        ...prev, 
        assigned_technician: bestTechnician.technician_id
      }));
      setFleetSuggestionReason(bestTechnician.suggestion_reason);
      
      // Actualizar fecha de entrega automáticamente
      setTimeout(() => updateDeliveryDate(), 300);
      
      console.log('Fallback technician assigned:', bestTechnician);
    } catch (error) {
      console.error('Error in technician fallback assignment:', error);
    }
  };

  /**
   * FUNCIÓN: autoAssignOptimalTechnician (Legacy - mantenida para compatibilidad)
   * 
   * PROPÓSITO:
   * - Asignar automáticamente el mejor técnico basado en habilidades y disponibilidad
   * - Se ejecuta cuando se agrega un servicio a la orden
   * - Ahora integrado con el sistema de flotillas
   */
  const autoAssignOptimalTechnician = async (serviceTypeId: string, currentItems: OrderItem[]) => {
    try {
      // Si ya hay un técnico asignado y solo es el primer servicio, mantenerlo
      if (formData.assigned_technician && currentItems.length === 1) {
        return;
      }

      const { data: suggestions, error } = await supabase
        .rpc('suggest_optimal_technician', {
          p_service_type_id: serviceTypeId,
          p_delivery_date: formData.delivery_date || null
        });

      if (error) {
        console.error('Error getting technician suggestions:', error);
        return;
      }

      // Ordenar por puntuación y seleccionar el mejor
      const sortedSuggestions = (suggestions || []).sort((a, b) => b.score - a.score);
      
      if (sortedSuggestions.length > 0) {
        const bestTechnician = sortedSuggestions[0];
        
        // Solo reasignar si es un técnico diferente al actual o si no hay técnico asignado
        if (!formData.assigned_technician || formData.assigned_technician !== bestTechnician.technician_id) {
          setFormData(prev => ({ 
            ...prev, 
            assigned_technician: bestTechnician.technician_id 
          }));
          setFleetSuggestionReason(bestTechnician.suggestion_reason);
          
          // Actualizar fecha de entrega automáticamente
          setTimeout(() => updateDeliveryDate(), 300);
          
          // Notificar sobre la asignación automática
          toast({
            title: "Técnico asignado automáticamente",
            description: `${bestTechnician.full_name}: ${bestTechnician.suggestion_reason}`,
          });
        }
      } else {
        // No hay técnicos disponibles para este servicio específico
        console.log('No technicians available for service:', serviceTypeId);
      }
    } catch (error) {
      console.error('Error in auto-assignment:', error);
    }
  };

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
        setFleetSuggestionReason(bestTechnician.suggestion_reason);
        
        // Actualizar fecha de entrega automáticamente
        setTimeout(() => updateDeliveryDate(), 300);
        
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
    setFleetSuggestionReason(reason);
    
    // Actualizar fecha de entrega automáticamente
    setTimeout(() => updateDeliveryDate(), 300);
    
    // Encontrar el nombre del técnico para el toast
    const selectedTechnician = technicians.find(t => t.user_id === technicianId);
    if (selectedTechnician) {
      toast({
        title: "Técnico sugerido seleccionado",
        description: `${selectedTechnician.full_name}: ${reason}`,
      });
    }
  };

  const handleLocationCapture = () => {
    setLoadingLocation(true);
    
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Tu navegador no soporta geolocalización",
        variant: "destructive"
      });
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({
          ...prev,
          service_location: {
            latitude,
            longitude,
            address: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
          }
        }));
        setLoadingLocation(false);
        toast({
          title: "Ubicación capturada",
          description: "Se ha guardado tu ubicación actual",
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        setLoadingLocation(false);
        toast({
          title: "Error",
          description: "No se pudo obtener tu ubicación. Verifica los permisos del navegador.",
          variant: "destructive"
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleHomeServiceChange = async (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      is_home_service: checked,
      service_location: checked ? prev.service_location : null
    }));

    // Automatically add/remove home service when checkbox is toggled
    if (checked) {
      // Find the "Servicio a Domicilio" service type
      const homeService = serviceTypes.find(service => 
        service.name.toLowerCase().includes('servicio a domicilio') || 
        service.category === 'traslado'
      );
      
      if (homeService && !orderItems.find(item => item.service_type_id === homeService.id)) {
        await handleServiceAdd(homeService);
        toast({
          title: "Servicio agregado",
          description: "Se agregó automáticamente el servicio a domicilio",
        });
      }
    } else {
      // Remove home service if it exists
      const homeServiceItem = orderItems.find(item => 
        item.name.toLowerCase().includes('servicio a domicilio') ||
        item.name.toLowerCase().includes('traslado')
      );
      
      if (homeServiceItem) {
        const updatedItems = orderItems.filter(item => item.service_type_id !== homeServiceItem.service_type_id);
        setOrderItems(updatedItems);
        toast({
          title: "Servicio removido",
          description: "Se removió el servicio a domicilio",
        });
      }
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

      if (!formData.client_id) {
        toast({
          title: "Error",
          description: "No se ha seleccionado un cliente",
          variant: "destructive"
        });
        return;
      }

      // Calcular totales de todos los items
      const totalAmount = orderItems.reduce((sum, item) => sum + item.total, 0);
      const totalHours = calculateTotalHours();
      
      // All orders start as pending authorization
      const initialStatus = 'pendiente_aprobacion';

      // Calcular automáticamente fecha estimada de entrega según carga actual
      const defaultSchedule = {
        work_days: [1, 2, 3, 4, 5],
        start_time: '08:00',
        end_time: '16:00',
        break_duration_minutes: 60,
      };

      let computedDeliveryDate = formData.delivery_date;
      let finalAssignedTechnician = formData.assigned_technician;
      
      try {
        // Si no hay técnico asignado, intentar asignar uno automáticamente
        if (!finalAssignedTechnician || finalAssignedTechnician === 'unassigned') {
          console.log('No technician assigned, attempting auto-assignment...');
          
          // Intentar asignación automática basada en el primer servicio
          if (orderItems.length > 0 && technicians.length > 0) {
            const firstServiceId = orderItems[0].service_type_id;
            
            // Usar la lógica existente para encontrar el mejor técnico
            try {
              await autoAssignOptimalFleet(firstServiceId, orderItems);
              finalAssignedTechnician = formData.assigned_technician;
              console.log('Auto-assigned technician via fleet logic:', finalAssignedTechnician);
            } catch (fleetError) {
              console.log('Fleet assignment failed, trying manual assignment...');
              
              // Fallback: usar el primer técnico disponible con menor carga
              const workloadEntries = Object.entries(technicianWorkloads).sort(([,a], [,b]) => 
                (a as any).total_hours - (b as any).total_hours
              );
              if (workloadEntries.length > 0) {
                finalAssignedTechnician = workloadEntries[0][0];
                console.log('Assigned technician with lowest workload:', finalAssignedTechnician);
              } else if (technicians.length > 0) {
                finalAssignedTechnician = technicians[0].user_id;
                console.log('Assigned first available technician:', finalAssignedTechnician);
              }
            }
          }
        }

        // Calcular fecha de entrega si tenemos técnico y items
        if (finalAssignedTechnician && orderItems.length > 0) {
          const primarySchedule = technicianSchedules[finalAssignedTechnician] || defaultSchedule;
          const processedSupport = supportTechnicians.map(st => ({
            id: st.technicianId,
            schedule: technicianSchedules[st.technicianId] || defaultSchedule,
            reductionPercentage: st.reductionPercentage,
          }));

          const currentWorkload = await getTechnicianCurrentWorkload(finalAssignedTechnician);
          console.log(`Calculating delivery date for technician ${finalAssignedTechnician} with ${totalHours}h total and ${currentWorkload}h current workload`);

          const result = calculateAdvancedDeliveryDate({
            orderItems: orderItems.map((item) => ({
              id: item.id,
              estimated_hours: (item as any).estimated_hours || 0,
              shared_time: (item as any).shared_time || false,
              service_type_id: (item as any).service_type_id,
              quantity: (item as any).quantity || 1,
            })),
            primaryTechnicianSchedule: primarySchedule,
            supportTechnicians: processedSupport,
            creationDate: new Date(),
            currentWorkload,
          });

          computedDeliveryDate = result.deliveryDate.toISOString().split('T')[0];
          console.log('Computed delivery date:', computedDeliveryDate);
        } else {
          // Fallback: calcular fecha basada solo en las horas estimadas (sin considerar carga actual)
          console.log('No technician available, using fallback calculation...');
          const result = calculateAdvancedDeliveryDate({
            orderItems: orderItems.map((item) => ({
              id: item.id,
              estimated_hours: (item as any).estimated_hours || 0,
              shared_time: (item as any).shared_time || false,
              service_type_id: (item as any).service_type_id,
              quantity: (item as any).quantity || 1,
            })),
            primaryTechnicianSchedule: defaultSchedule,
            supportTechnicians: [],
            creationDate: new Date(),
            currentWorkload: 0,
          });
          
          computedDeliveryDate = result.deliveryDate.toISOString().split('T')[0];
          console.log('Fallback delivery date calculated:', computedDeliveryDate);
        }
      } catch (e) {
        console.warn('Auto delivery date calc failed, using basic fallback:', e);
        // Fallback básico: agregar días basados en las horas estimadas
        const daysToAdd = Math.ceil(totalHours / 8); // Asumir 8 horas por día
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + daysToAdd);
        computedDeliveryDate = fallbackDate.toISOString().split('T')[0];
        console.log('Basic fallback delivery date:', computedDeliveryDate);
      }

      // Crear la orden principal - explicitly set correct status
      const orderData = {
        client_id: formData.client_id,
        service_type: orderItems[0].service_type_id,
        failure_description: formData.failure_description,
        delivery_date: computedDeliveryDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estimated_cost: pricing.totalAmount,
        average_service_time: totalHours,
        assigned_technician:
          finalAssignedTechnician && finalAssignedTechnician !== 'unassigned'
            ? finalAssignedTechnician
            : null,
        assigned_fleet: formData.assigned_fleet || null,  // Add fleet assignment to order
        assignment_reason: fleetSuggestionReason || null,
        created_by: user?.id,
        status: initialStatus,
        service_category: formData.service_category,
        is_home_service: formData.is_home_service,
        service_location: formData.service_location,
        travel_time_hours: formData.is_home_service ? 1 : 0,
      };

      console.log('Creating order with data:', orderData);

      const { data: orderResult, error: orderError } = await supabase
        .from('orders')
        .insert(orderData as any)
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Crear los items de la orden
      const orderItemsData = orderItems.map(item => ({
        order_id: orderResult.id,
        service_type_id: item.service_type_id, // Puede ser null para items manuales
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
        item_type: item.item_type,
        pricing_locked: true // Bloquear precios para evitar recálculos
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        await supabase.from('orders').delete().eq('id', orderResult.id);
        throw itemsError;
      }

      // Crear registros de técnicos de apoyo
      if (supportTechnicians.length > 0) {
        const supportTechnicianData = supportTechnicians.map(tech => ({
          order_id: orderResult.id,
          technician_id: tech.technicianId,
          reduction_percentage: tech.reductionPercentage
        }));

        const { error: supportError } = await supabase
          .from('order_support_technicians')
          .insert(supportTechnicianData);

        if (supportError) {
          console.error('Error creating support technician records:', supportError);
          // Don't fail the entire order creation for this
        }
      }

      // Registrar la carga de trabajo del técnico si está asignado
      if (formData.assigned_technician && formData.assigned_technician !== 'unassigned') {
        try {
          await getTechnicianCurrentWorkload(formData.assigned_technician);
          console.log('Workload updated for technician:', formData.assigned_technician);
        } catch (workloadError) {
          console.warn('Could not update technician workload:', workloadError);
        }
      }


      const statusMessage = profile?.role === 'cliente' 
        ? "Orden creada. Debe firmar para autorizar el servicio."
        : "Orden creada exitosamente";

      toast({
        title: "Orden creada",
        description: `${statusMessage} ${orderItems.length} artículo(s) por un total de ${formatCOPCeilToTen(totalAmount)} - Cobro pendiente generado`,
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

              {/* Servicio a Domicilio */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_home_service"
                    checked={formData.is_home_service}
                    onCheckedChange={handleHomeServiceChange}
                  />
                  <Label htmlFor="is_home_service" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Servicio a domicilio (+1 hora por traslado)
                  </Label>
                </div>
                
                {formData.is_home_service && (
                  <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/50">
                    <Label className="text-sm font-medium">Ubicación del servicio</Label>
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleLocationCapture}
                          disabled={loadingLocation}
                          className="flex-1"
                        >
                          {loadingLocation ? (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                              Capturando...
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Crosshair className="h-4 w-4" />
                              Usar GPS
                            </div>
                          )}
                        </Button>
                      </div>
                      
                      <Input
                        placeholder="O ingresa la dirección manualmente"
                        value={formData.service_location?.address || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          service_location: {
                            ...prev.service_location,
                            address: e.target.value
                          }
                        }))}
                      />
                      
                      {formData.service_location && formData.service_location.latitude && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-green-50 border border-green-200 rounded p-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <span>Ubicación GPS capturada: {formData.service_location.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selección de Categoría de Servicio - Obligatorio */}
              <div className="space-y-3">
                <Label>Categoría de Servicio *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={formData.service_category === 'sistemas' ? 'default' : 'outline'}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, service_category: 'sistemas' }));
                      setOrderItems([]);
                    }}
                    className="h-12 text-sm"
                  >
                    Sistemas
                  </Button>
                  <Button
                    type="button"
                    variant={formData.service_category === 'seguridad' ? 'default' : 'outline'}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, service_category: 'seguridad' }));
                      setOrderItems([]);
                    }}
                    className="h-12 text-sm"
                  >
                    Seguridad
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Selecciona la categoría para filtrar los servicios disponibles
                </p>
              </div>

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

               {/* Selección de servicios - Solo mostrar si se seleccionó categoría */}
               {formData.service_category && (
                 <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <Label>Servicios de {formData.service_category.charAt(0).toUpperCase() + formData.service_category.slice(1)} *</Label>
                     <Button
                       type="button"
                       variant="outline"
                       size="sm"
                       onClick={() => setShowManualItemDialog(true)}
                       className="gap-2"
                     >
                       <Plus className="h-4 w-4" />
                       Item Manual
                     </Button>
                   </div>
                      <OrderServiceSelection
                        onServiceAdd={(service, quantity = 1) => handleServiceAdd(service, quantity)}
                        selectedServiceIds={orderItems.map(item => item.service_type_id)}
                        serviceCategory={formData.service_category}
                    />
                 </div>
               )}

              {/* Lista de artículos seleccionados */}
              <OrderItemsList 
                items={orderItems}
                onItemsChange={setOrderItems}
              />

              {/* Equipos - Opcional para contextualizar el trabajo */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Equipos a Trabajar (Opcional)</Label>
                  <span className="text-sm text-muted-foreground">
                    Registra los equipos para mejor documentación
                  </span>
                </div>
                <EquipmentList
                  orderId={''} // Se pasará el orderId real después de crear la orden
                  equipment={orderEquipment}
                  onUpdate={() => {}} // Placeholder - se actualizará después de crear la orden
                  canEdit={true}
                />
              </div>

              {/* Técnico asignado automáticamente */}
              {formData.assigned_technician && (
                <div className="space-y-2">
                  <Label>Técnico Asignado Automáticamente</Label>
                  <div className="p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="font-medium">
                        {technicians.find(t => t.user_id === formData.assigned_technician)?.full_name || 'Técnico seleccionado'}
                      </span>
                    </div>
                    {fleetSuggestionReason && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {fleetSuggestionReason}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Fecha de Entrega */}
              <div className="space-y-2">
                <Label htmlFor="delivery_date">Fecha de Entrega Estimada (Auto-calculada)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.delivery_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.delivery_date ? format(new Date(formData.delivery_date), "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.delivery_date ? new Date(formData.delivery_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setFormData(prev => ({ 
                            ...prev, 
                            delivery_date: date.toISOString().split('T')[0] 
                          }));
                        }
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {orderItems.length > 0 && formData.assigned_technician && formData.assigned_technician !== 'unassigned' && (
                  <DeliveryCalculationDisplay 
                    technicianId={formData.assigned_technician}
                    orderItems={orderItems}
                    technicianSchedules={technicianSchedules}
                    supportTechnicians={supportTechnicians}
                    onDateUpdate={(date) => setFormData(prev => ({ ...prev, delivery_date: date }))}
                    currentDeliveryDate={formData.delivery_date}
                  />
                )}
              </div>

              {/* Multiple Support Technician Selector */}
              {(profile?.role === 'administrador' || profile?.role === 'vendedor') && formData.assigned_technician && (
                <MultipleSupportTechnicianSelector
                  technicians={technicians}
                  primaryTechnicianId={formData.assigned_technician}
                  selectedSupportTechnicians={supportTechnicians}
                  onSupportTechniciansChange={setSupportTechnicians}
                />
              )}

              {/* Fleet Suggestions for Staff */}
              {showFleetSuggestions && orderItems.length > 0 && (profile?.role === 'administrador' || profile?.role === 'vendedor') && (
                <div className="mt-4">
                  <FleetSuggestion
                    serviceTypeId={orderItems[0].service_type_id}
                    deliveryDate={formData.delivery_date}
                    onFleetSelect={(fleetId, fleetName, reason) => {
                      setFormData(prev => ({ ...prev, assigned_fleet: fleetId }));
                      setSelectedFleetName(fleetName);
                      setFleetSuggestionReason(reason);
                      setShowFleetSuggestions(false);
                    }}
                    selectedFleetId={formData.assigned_fleet}
                  />
                </div>
              )}

              {/* Información del Técnico Asignado Automáticamente */}
              {formData.assigned_technician && fleetSuggestionReason && (
                <div className="mt-4 p-4 bg-success/10 border border-success/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-success flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-success-foreground">Técnico Asignado Automáticamente</h4>
                      <p className="text-sm text-success-foreground/80 mt-1">
                        {technicians.find(t => t.user_id === formData.assigned_technician)?.full_name}
                      </p>
                      <p className="text-xs text-success-foreground/70 mt-1">
                        {fleetSuggestionReason}
                      </p>
                    </div>
                    {(profile?.role === 'administrador' || profile?.role === 'vendedor') && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFleetSuggestions(true)}
                        className="text-success-foreground hover:bg-success/20"
                      >
                        Cambiar
                      </Button>
                    )}
                  </div>
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
                    {fleetSuggestionReason && (
                      <div className="mt-3 text-sm text-blue-700 bg-blue-100 rounded p-2">
                        <strong>¿Por qué este técnico?</strong> {fleetSuggestionReason}
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

        {/* Diálogo para agregar item manual */}
        <Dialog open={showManualItemDialog} onOpenChange={setShowManualItemDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Artículo o Servicio Manual</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manual-item-type">Tipo *</Label>
                <Select 
                  value={manualItemForm.item_type} 
                  onValueChange={(value: 'servicio' | 'articulo') => 
                    setManualItemForm(prev => ({ ...prev, item_type: value }))
                  }
                >
                  <SelectTrigger id="manual-item-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="servicio">Servicio</SelectItem>
                    <SelectItem value="articulo">Artículo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-item-name">Nombre *</Label>
                <Input
                  id="manual-item-name"
                  placeholder="Ej: Instalación personalizada"
                  value={manualItemForm.name}
                  onChange={(e) => setManualItemForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-item-description">Descripción</Label>
                <Textarea
                  id="manual-item-description"
                  placeholder="Describe el artículo o servicio..."
                  rows={3}
                  value={manualItemForm.description}
                  onChange={(e) => setManualItemForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-item-price">Precio Total (con IVA) *</Label>
                  <Input
                    id="manual-item-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={manualItemForm.price}
                    onChange={(e) => setManualItemForm(prev => ({ ...prev, price: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-item-quantity">Cantidad *</Label>
                  <Input
                    id="manual-item-quantity"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={manualItemForm.quantity}
                    onChange={(e) => setManualItemForm(prev => ({ ...prev, quantity: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowManualItemDialog(false);
                  setManualItemForm({
                    name: '',
                    description: '',
                    price: '',
                    quantity: '1',
                    item_type: 'servicio'
                  });
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleManualItemAdd}
              >
                Agregar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}