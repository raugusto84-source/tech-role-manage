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
import { TechnicianSuggestion } from '@/components/orders/TechnicianSuggestion';
import { OrderServiceSelection } from '@/components/orders/OrderServiceSelection';
import { OrderItemsList, OrderItem } from '@/components/orders/OrderItemsList';
import { ProductServiceSeparator } from '@/components/orders/ProductServiceSeparator';
import { calculateDeliveryDate, calculateAdvancedDeliveryDate, calculateSharedTimeHours, suggestSupportTechnician, calculateTechnicianWorkload, getTechnicianCurrentWorkload } from '@/utils/workScheduleCalculator';
import { useWorkloadCalculation } from '@/hooks/useWorkloadCalculation';
import { DeliveryCalculationDisplay } from '@/components/orders/DeliveryCalculationComponent';
import { MultipleSupportTechnicianSelector } from '@/components/orders/MultipleSupportTechnicianSelector';
import { CashbackApplicationDialog } from './CashbackApplicationDialog';
import { useRewardSettings } from '@/hooks/useRewardSettings';
import { usePricingCalculation } from '@/hooks/usePricingCalculation';

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
  assigned_technician: string;
  estimated_cost: string;
  is_home_service: boolean;
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
  const { settings: rewardSettings } = useRewardSettings();
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
    assigned_technician: '',
    estimated_cost: '',
    is_home_service: false,
    service_location: null
  });
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [supportTechnicians, setSupportTechnicians] = useState<SupportTechnicianEntry[]>([]);

  // Estados para el sistema de sugerencias de técnicos
  const [showTechnicianSuggestions, setShowTechnicianSuggestions] = useState(false);
  const [showSupportSuggestion, setShowSupportSuggestion] = useState(false);
  const [suggestionReason, setSuggestionReason] = useState('');
  const [supportSuggestion, setSupportSuggestion] = useState<any>(null);
  
  // Estados para cashback
  const [availableCashback, setAvailableCashback] = useState(0);
  const [appliedCashback, setAppliedCashback] = useState(0);
  const [showCashbackDialog, setShowCashbackDialog] = useState(false);

  // Hook for pricing calculation with cashback adjustment
  const pricing = usePricingCalculation(orderItems, formData.client_id);

  useEffect(() => {
    loadServiceTypes();
    loadCurrentOrders();
    loadTechnicianSchedules();
    
    if (profile?.role === 'administrador' || profile?.role === 'vendedor') {
      loadClients();
      loadTechnicians();
    } else if (profile?.role === 'cliente') {
      loadCurrentClient();
      loadTechnicians();
      loadClientCashback();
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

  const loadClientCashback = async () => {
    try {
      // Only load for clients
      if (profile?.role !== 'cliente') return;

      // Get client data using email from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user?.id)
        .single();

      if (!profileData?.email) return;

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('email', profileData.email)
        .single();

      if (!client) return;

      // Get available cashback
      const { data: rewardsData } = await supabase
        .from('client_rewards')
        .select('total_cashback')
        .eq('client_id', client.id)
        .single();

      setAvailableCashback(rewardsData?.total_cashback || 0);
    } catch (error) {
      console.error('Error loading client cashback:', error);
    }
  };

  // Calcular precios usando exactamente la misma lógica que ProductServiceSeparator
  const calculateExactDisplayPrice = (service: ServiceType, quantity: number = 1) => {
    const salesVatRate = service.vat_rate || 16;
    const cashbackPercent = rewardSettings?.apply_cashback_to_items
      ? (rewardSettings.general_cashback_percent || 0)
      : 0;

    if (service.item_type === 'servicio') {
      // Para servicios: precio base + IVA + cashback
      const basePrice = (service.base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      
      return {
        subtotal: basePrice,
        vatAmount: basePrice * salesVatRate / 100,
        totalAmount: finalWithCashback
      };
    } else {
      // Para artículos: utilizar SIEMPRE cost_price como costo base
      const purchaseVatRate = 16;
      const baseCost = (service.cost_price || 0) * quantity;
      
      const marginPercent = service.profit_margin_tiers && service.profit_margin_tiers.length > 0 
        ? service.profit_margin_tiers[0].margin 
        : 20;
      
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + marginPercent / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      
      return {
        subtotal: afterSalesVat - (afterSalesVat * salesVatRate / 100), // Subtotal sin IVA final
        vatAmount: afterSalesVat * salesVatRate / 100,
        totalAmount: finalWithCashback
      };
    }
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
          unit_price: service.base_price || service.cost_price || 0,
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
        unit_price: service.base_price || service.cost_price || 0,
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
    
    // Asignación automática de técnico basada en habilidades y disponibilidad
    await autoAssignOptimalTechnician(service.id, updatedItems);
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

  const calculateTotalsWithCashbackAdjustment = async () => {
    let totalCostPrice = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    let totalVATAmount = orderItems.reduce((sum, item) => sum + item.vat_amount, 0);
    
    // Only apply cashback percentage to items for GENERAL cashback (not new client)
    // and only if the setting is enabled
    if (rewardSettings?.apply_cashback_to_items && formData.client_id) {
      try {
        // Check if client is new (hasn't made any completed orders)
        const { data: clientOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('client_id', formData.client_id)
          .eq('status', 'finalizada');
        
        const isNewClient = !clientOrders || clientOrders.length === 0;
        
        // Only apply to price if NOT a new client (use general cashback)
        if (!isNewClient) {
          const cashbackPercent = rewardSettings.general_cashback_percent;
          const cashbackAmount = totalCostPrice * (cashbackPercent / 100);
          totalCostPrice += cashbackAmount;
          // Recalculate VAT on the new total
          totalVATAmount = orderItems.reduce((sum, item) => {
            const itemCashback = item.subtotal * (cashbackPercent / 100);
            const newItemSubtotal = item.subtotal + itemCashback;
            return sum + (newItemSubtotal * item.vat_rate / 100);
          }, 0);
        }
        // If it's a new client, don't modify the price - cashback will be given as reward later
      } catch (error) {
        console.error('Error checking client status:', error);
      }
    }
    
    const totalAmount = totalCostPrice + totalVATAmount;
    return {
      totalCostPrice,
      totalVATAmount,
      totalAmount
    };
  };

  const handleApplyCashback = (amount: number) => {
    setAppliedCashback(amount);
    toast({
      title: "Cashback aplicado",
      description: `Se aplicaron ${new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP'
      }).format(amount)} como descuento`,
    });
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
   * FUNCIÓN: autoAssignOptimalTechnician
   * 
   * PROPÓSITO:
   * - Asignar automáticamente el mejor técnico basado en habilidades y disponibilidad
   * - Se ejecuta cuando se agrega un servicio a la orden
   * - Considera todos los servicios de la orden para la asignación óptima
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
          setSuggestionReason(bestTechnician.suggestion_reason);
          
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

    // Apply cashback discount if any
    if (appliedCashback > 0) {
      if (appliedCashback > pricing.totalAmount) {
        toast({
          title: "Error",
          description: "El descuento no puede ser mayor al total de la orden",
          variant: "destructive"
        });
        return;
      }
    }
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

      if (!formData.delivery_date) {
        toast({
          title: "Error",
          description: "Debe seleccionar una fecha de entrega",
          variant: "destructive"
        });
        return;
      }

      // Calcular totales de todos los items
      const totalAmount = orderItems.reduce((sum, item) => sum + item.total, 0) - appliedCashback;
      const totalHours = calculateTotalHours();
      
      // All orders start as pending authorization
      const initialStatus = 'pendiente_aprobacion';

      // Crear la orden principal - explicitly set correct status
      const orderData = {
        client_id: formData.client_id,
        service_type: orderItems[0].service_type_id,
        failure_description: formData.failure_description,
        delivery_date: formData.delivery_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estimated_cost: pricing.totalAmount,
        average_service_time: totalHours,
        assigned_technician: formData.assigned_technician && formData.assigned_technician !== 'unassigned' ? formData.assigned_technician : null,
        assignment_reason: suggestionReason || null,
        created_by: user?.id,
        status: initialStatus,
        is_home_service: formData.is_home_service,
        service_location: formData.service_location,
        travel_time_hours: formData.is_home_service ? 1 : 0
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
        description: `${statusMessage} ${orderItems.length} artículo(s) por un total de ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalAmount)}`,
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

               {/* Selección de Servicios y Productos Separados */}
               <div className="space-y-4">
                 <Label>Servicios y Productos *</Label>
                 <ProductServiceSeparator
                   onServiceAdd={handleServiceAdd}
                   selectedServiceIds={orderItems.map(item => item.service_type_id)}
                    selectedServices={orderItems.map(item => ({
                      service: {
                        id: item.service_type_id,
                        name: item.name,
                        description: item.description,
                        cost_price: item.cost_price, // Usar el cost_price del item
                        base_price: item.unit_price || 0,
                        vat_rate: item.vat_rate,
                        item_type: item.item_type,
                        category: '',
                        estimated_hours: item.estimated_hours,
                        profit_margin_tiers: item.profit_margin_tiers // Usar los profit_margin_tiers del item
                      },
                      quantity: item.quantity
                    }))}
                   onRemoveService={(serviceId: string) => {
                     setOrderItems(prev => prev.filter(item => item.service_type_id !== serviceId));
                   }}
                 />
               </div>

              {/* Lista de artículos seleccionados */}
              <OrderItemsList 
                items={orderItems}
                onItemsChange={setOrderItems}
              />

              {/* Asignación de Técnico Principal */}
              {(profile?.role === 'administrador' || profile?.role === 'vendedor') && (
                <div className="space-y-4">
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
                </div>
              )}

              {/* Fecha de Entrega */}
              <div className="space-y-2">
                <Label htmlFor="delivery_date">Fecha de Entrega Estimada *</Label>
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
                      disabled={(date) => date < new Date()}
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

              {/* Sugerencias de Técnicos para Staff */}
              {showTechnicianSuggestions && orderItems.length > 0 && (profile?.role === 'administrador' || profile?.role === 'vendedor') && (
                <div className="mt-4">
                  <TechnicianSuggestion
                    serviceTypeId={orderItems[0].service_type_id}
                    deliveryDate={formData.delivery_date}
                    onTechnicianSelect={handleTechnicianSuggestionSelect}
                    selectedTechnicianId={formData.assigned_technician}
                  />
                </div>
              )}

              {/* Información del Técnico Asignado Automáticamente */}
              {formData.assigned_technician && suggestionReason && (
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
                        {suggestionReason}
                      </p>
                    </div>
                    {(profile?.role === 'administrador' || profile?.role === 'vendedor') && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTechnicianSuggestions(true)}
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

        {/* Cashback Application Dialog */}
        <CashbackApplicationDialog
          open={showCashbackDialog}
          onOpenChange={setShowCashbackDialog}
          availableCashback={availableCashback}
          orderTotal={pricing.totalAmount}
          onApply={handleApplyCashback}
        />
      </div>
    </div>
  );
}