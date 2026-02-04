import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Clock, Trash2, Calendar, Settings, Pencil } from "lucide-react";
import { formatDateMexico } from "@/utils/dateUtils";

interface PolicyClient {
  id: string;
  clients: {
    id: string;
    name: string;
    email: string;
  };
  insurance_policies: {
    policy_name: string;
  };
}

interface ServiceType {
  id: string;
  name: string;
  service_category: string;
  base_price: number;
}

interface ScheduledService {
  id: string;
  frequency_days: number;
  next_service_date: string;
  frequency_type: 'minutes' | 'days' | 'monthly_on_day' | 'weekly_on_day' | 'cada_1_semana' | 'cada_2_semanas' | 'cada_3_semanas' | 'cada_4_semanas';
  frequency_value: number;
  week_interval: number;
  day_of_week: number | null;
  next_run: string;
  priority: number;
  is_active: boolean;
  policy_client_id: string;
  services: any[];
  service_description: string | null;
  quantity: number;
  start_date: string | null;
  policy_clients: PolicyClient;
}

interface ScheduledServicesManagerProps {
  onStatsUpdate: () => void;
}

export function ScheduledServicesManager({ onStatsUpdate }: ScheduledServicesManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scheduledServices, setScheduledServices] = useState<ScheduledService[]>([]);
  const [policyClients, setPolicyClients] = useState<PolicyClient[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ScheduledService | null>(null);
  
  const [formData, setFormData] = useState({
    policy_client_id: '',
    selected_services: [] as Array<{ service_type_id: string; quantity: number }>,
    frequency_type: 'minutes' as 'minutes' | 'days' | 'weekly_on_day' | 'monthly_on_day' | 'cada_1_semana' | 'cada_2_semanas' | 'cada_3_semanas' | 'cada_4_semanas',
    frequency_value: 10,
    day_of_week: 1, // Default to Monday
    priority: 2,
    service_description: '',
    start_date: new Date().toISOString().split('T')[0], // Today's date as default
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadScheduledServices(),
        loadPolicyClients(),
        loadServiceTypes()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadScheduledServices = async () => {
    const { data, error } = await supabase
      .from('scheduled_services')
      .select(`
        *,
        policy_clients!inner(
          id,
          clients!inner(
            id,
            name,
            email
          ),
          insurance_policies!inner(
            policy_name
          )
        )
      `)
      .eq('is_active', true)
      .order('next_service_date', { ascending: false });

    if (error) throw error;
    setScheduledServices(data as ScheduledService[] || []);
  };

  const loadPolicyClients = async () => {
    const { data, error } = await supabase
      .from('policy_clients')
      .select(`
        id,
        clients!inner(
          id,
          name,
          email
        ),
        insurance_policies!inner(
          policy_name
        )
      `)
      .eq('is_active', true);

    if (error) throw error;
    setPolicyClients(data || []);
  };

  const loadServiceTypes = async () => {
    const { data, error } = await supabase
      .from('service_types')
      .select('id, name, service_category, base_price')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setServiceTypes(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Calculate next run time based on frequency and start date
      const startDate = new Date(formData.start_date);
      const nextRun = new Date(startDate);
      
      if (formData.frequency_type === 'minutes') {
        nextRun.setMinutes(nextRun.getMinutes() + formData.frequency_value);
      } else if (['cada_1_semana', 'cada_2_semanas', 'cada_3_semanas', 'cada_4_semanas'].includes(formData.frequency_type)) {
        // Calculate next occurrence of the selected day of week
        const targetDay = formData.day_of_week;
        const currentDay = nextRun.getDay();
        let daysUntilTarget = (targetDay - currentDay + 7) % 7;
        if (daysUntilTarget === 0) {
          // If today is the target day, move to the configured week interval
          const weeksToAdd = formData.frequency_type === 'cada_1_semana' ? 1 :
                            formData.frequency_type === 'cada_2_semanas' ? 2 :
                            formData.frequency_type === 'cada_3_semanas' ? 3 : 4;
          nextRun.setDate(nextRun.getDate() + (7 * weeksToAdd));
        } else {
          nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        }
      } else if (formData.frequency_type === 'days') {
        nextRun.setDate(nextRun.getDate() + formData.frequency_value);
      } else if (formData.frequency_type === 'weekly_on_day') {
        // Calculate next occurrence of specific day of week
        const targetDay = formData.frequency_value; // 0=Sunday, 1=Monday, etc.
        const currentDay = nextRun.getDay();
        let daysUntilTarget = (targetDay - currentDay + 7) % 7;
        if (daysUntilTarget === 0) daysUntilTarget = 7; // If today is the target day, schedule for next week
        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      } else { // monthly_on_day
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(formData.frequency_value);
      }

      // Set execution time to 00:01 (12:01 AM) Mexico time
      nextRun.setHours(0, 1, 0, 0);

      // Keep original frequency_type values - don't convert cada_X_semanas
      let dbFrequencyValue = formData.frequency_value;
      let weekInterval = 1;

      if (['cada_1_semana', 'cada_2_semanas', 'cada_3_semanas', 'cada_4_semanas'].includes(formData.frequency_type)) {
        dbFrequencyValue = formData.day_of_week; // The day of the week (0-6)
        
        // Extract week interval from frequency type
        weekInterval = formData.frequency_type === 'cada_1_semana' ? 1 :
                      formData.frequency_type === 'cada_2_semanas' ? 2 :
                      formData.frequency_type === 'cada_3_semanas' ? 3 : 4;
      }

      const serviceData = {
        policy_client_id: formData.policy_client_id,
        services: formData.selected_services,
        frequency_type: formData.frequency_type, // Keep original value
        frequency_value: dbFrequencyValue,
        week_interval: weekInterval,
        day_of_week: ['cada_1_semana', 'cada_2_semanas', 'cada_3_semanas', 'cada_4_semanas'].includes(formData.frequency_type) 
          ? formData.day_of_week 
          : null,
        next_run: nextRun.toISOString(),
        next_service_date: nextRun.toISOString().split('T')[0],
        priority: formData.priority,
        service_description: formData.service_description || null,
        quantity: formData.selected_services.reduce((total, service) => total + service.quantity, 0),
        start_date: formData.start_date,
        is_active: true
      };

      if (editingService) {
        // Update existing service
        const { error: updateError } = await supabase
          .from('scheduled_services')
          .update(serviceData)
          .eq('id', editingService.id);

        if (updateError) throw updateError;

        toast({
          title: "Éxito",
          description: "Servicio programado actualizado correctamente"
        });
      } else {
        // Create new service
        const { error: insertError } = await supabase
          .from('scheduled_services')
          .insert(serviceData);

        if (insertError) {
          throw insertError;
        }

        // Call edge function to create initial orders and set up automation
        const { error: functionError } = await supabase.functions.invoke('process-scheduled-services', {
          body: { 
            action: 'create_initial_orders',
            start_date: formData.start_date,
            policy_client_id: formData.policy_client_id
          }
        });

        if (functionError) {
          console.warn('Warning: Could not create initial orders:', functionError);
        }

        toast({
          title: "Éxito",
          description: `${formData.selected_services.reduce((total, service) => total + service.quantity, 0)} servicio(s) programado(s) creado(s) correctamente`
        });
      }

      setIsDialogOpen(false);
      setEditingService(null);
      resetForm();
      loadScheduledServices();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error creating scheduled services:', error);
      toast({
        title: "Error",
        description: "No se pudieron crear los servicios programados",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este servicio programado?')) return;

    try {
      const { error } = await supabase
        .from('scheduled_services')
        .update({ is_active: false })
        .eq('id', serviceId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Servicio programado eliminado correctamente"
      });

      loadScheduledServices();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error deleting scheduled service:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el servicio programado",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      policy_client_id: '',
      selected_services: [],
      frequency_type: 'minutes',
      frequency_value: 10,
      day_of_week: 1,
      priority: 2,
      service_description: '',
      start_date: new Date().toISOString().split('T')[0],
    });
    setEditingService(null);
  };

  const handleEdit = (service: ScheduledService) => {
    setEditingService(service);
    
    // Convert weekly_on_day with week_interval back to cada_X_semanas for editing
    let editFrequencyType = service.frequency_type;
    if (service.frequency_type === 'weekly_on_day' && service.week_interval) {
      if (service.week_interval === 1) editFrequencyType = 'cada_1_semana';
      else if (service.week_interval === 2) editFrequencyType = 'cada_2_semanas';
      else if (service.week_interval === 3) editFrequencyType = 'cada_3_semanas';
      else if (service.week_interval >= 4) editFrequencyType = 'cada_4_semanas';
    }
    
    setFormData({
      policy_client_id: service.policy_client_id,
      selected_services: service.services || [],
      frequency_type: editFrequencyType,
      frequency_value: service.frequency_value,
      day_of_week: service.day_of_week || service.frequency_value || 1,
      priority: service.priority,
      service_description: service.service_description || '',
      start_date: service.start_date || new Date().toISOString().split('T')[0],
    });
    setIsDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  if (loading) {
    return <div>Cargando servicios programados...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Servicios Periódicos</h2>
          <p className="text-muted-foreground">
            Programa servicios automáticos para clientes con pólizas activas
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Programar Servicio
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingService ? 'Editar Servicio Programado' : 'Programar Nuevo Servicio'}</DialogTitle>
              <DialogDescription>
                {editingService ? 'Modifica la configuración del servicio periódico' : 'Configura un servicio periódico automático para un cliente con póliza'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="policy_client_id">Cliente con Póliza *</Label>
                <Select value={formData.policy_client_id} onValueChange={(value) => 
                  setFormData({ ...formData, policy_client_id: value })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {policyClients.map((pc) => (
                      <SelectItem key={pc.id} value={pc.id}>
                        {pc.clients.name} - {pc.insurance_policies.policy_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Servicios a Programar * (seleccionar servicios y cantidades)</Label>
                <div className="border rounded-md p-3 max-h-60 overflow-y-auto space-y-3">
                  {serviceTypes.map((service) => {
                    const selectedService = formData.selected_services.find(s => s.service_type_id === service.id);
                    const isSelected = !!selectedService;
                    const currentQuantity = selectedService?.quantity || 0;
                    
                    return (
                      <div key={service.id} className="flex items-center space-x-3 p-2 border rounded">
                      <Checkbox
                        id={service.id}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              selected_services: [...formData.selected_services, { service_type_id: service.id, quantity: 1 }]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              selected_services: formData.selected_services.filter(s => s.service_type_id !== service.id)
                            });
                          }
                        }}
                      />
                      <div className="flex-1">
                        <Label htmlFor={service.id} className="cursor-pointer font-medium">
                          {service.name}
                        </Label>
                        <div className="text-sm text-muted-foreground">
                          Precio unitario: {formatCurrency(service.base_price)}
                        </div>
                        {isSelected && currentQuantity > 1 && (
                          <div className="text-sm font-medium text-primary">
                            Subtotal: {formatCurrency(service.base_price * currentQuantity)}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="flex items-center space-x-2">
                          <Label className="text-sm">Cantidad:</Label>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            value={currentQuantity}
                            onChange={(e) => {
                              const newQuantity = parseInt(e.target.value) || 1;
                              setFormData({
                                ...formData,
                                selected_services: formData.selected_services.map(s => 
                                  s.service_type_id === service.id 
                                    ? { ...s, quantity: newQuantity }
                                    : s
                                )
                              });
                            }}
                            className="w-16"
                          />
                        </div>
                      )}
                    </div>
                    );
                  })}
                  {serviceTypes.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      No hay servicios disponibles
                    </p>
                  )}
                </div>
                {formData.selected_services.length > 0 && (
                  <div className="mt-3 p-3 bg-muted rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Resumen de servicios seleccionados:</span>
                      <span className="text-sm text-muted-foreground">
                        {formData.selected_services.reduce((total, service) => total + service.quantity, 0)} servicio(s)
                      </span>
                    </div>
                    <div className="space-y-1">
                      {formData.selected_services.map((selectedService) => {
                        const serviceType = serviceTypes.find(st => st.id === selectedService.service_type_id);
                        if (!serviceType) return null;
                        const itemTotal = serviceType.base_price * selectedService.quantity;
                        return (
                          <div key={selectedService.service_type_id} className="flex justify-between text-sm">
                            <span>{serviceType.name} x{selectedService.quantity}</span>
                            <span className="font-medium">{formatCurrency(itemTotal)}</span>
                          </div>
                        );
                      })}
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between font-semibold">
                          <span>Total estimado por ejecución:</span>
                          <span className="text-primary">
                            {formatCurrency(
                              formData.selected_services.reduce((total, service) => {
                                const serviceType = serviceTypes.find(st => st.id === service.service_type_id);
                                return total + (serviceType?.base_price || 0) * service.quantity;
                              }, 0)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_description">Descripción del Servicio</Label>
                <Input
                  id="service_description"
                  value={formData.service_description}
                  onChange={(e) => setFormData({
                    ...formData,
                    service_description: e.target.value
                  })}
                  placeholder="Descripción específica del servicio..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Fecha de Inicio *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({
                    ...formData,
                    start_date: e.target.value
                  })}
                  required
                />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>📅 Creación automática de órdenes:</strong></p>
                  <p>• El sistema creará órdenes para TODAS las fechas desde esta fecha hasta hoy</p>
                  <p>• Ejemplo: Si es lunes y programas "cada lunes" desde hace 1 mes, se crearán 4-5 órdenes</p>
                  <p>• Luego programará automáticamente las siguientes según la frecuencia</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad</Label>
                  <Select value={formData.priority.toString()} onValueChange={(value) => 
                    setFormData({ ...formData, priority: parseInt(value) })
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Baja</SelectItem>
                      <SelectItem value="2">Normal</SelectItem>
                      <SelectItem value="3">Alta</SelectItem>
                      <SelectItem value="4">Crítica</SelectItem>
                      <SelectItem value="5">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium">Configuración de Frecuencia</h4>
                
                <div className="space-y-2">
                  <Label>Tipo de Frecuencia *</Label>
                  <Select value={formData.frequency_type} onValueChange={(value) => {
                    const newFrequencyValue = value === 'weekly_on_day' ? 1 : // Default to Monday
                                            value === 'monthly_on_day' ? 10 : // Default to day 10
                                            value === 'minutes' ? 10 : // Default to 10 minutes
                                            ['cada_1_semana', 'cada_2_semanas', 'cada_3_semanas', 'cada_4_semanas'].includes(value) ? 0 : // Not needed for fixed weeks
                                            30; // Default to 30 days
                    setFormData({ 
                      ...formData, 
                      frequency_type: value as any,
                      frequency_value: newFrequencyValue
                    });
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Cada X minutos (para pruebas)</SelectItem>
                      <SelectItem value="cada_1_semana">Cada 1 semana</SelectItem>
                      <SelectItem value="cada_2_semanas">Cada 2 semanas</SelectItem>
                      <SelectItem value="cada_3_semanas">Cada 3 semanas</SelectItem>
                      <SelectItem value="cada_4_semanas">Cada 4 semanas</SelectItem>
                      <SelectItem value="days">Cada X días</SelectItem>
                      <SelectItem value="weekly_on_day">Día específico de la semana</SelectItem>
                      <SelectItem value="monthly_on_day">Día X de cada mes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    {formData.frequency_type === 'weekly_on_day' || ['cada_1_semana', 'cada_2_semanas', 'cada_3_semanas', 'cada_4_semanas'].includes(formData.frequency_type)
                      ? 'Día de la Semana *' 
                      : 'Valor de Frecuencia *'}
                  </Label>
                  {formData.frequency_type === 'weekly_on_day' || ['cada_1_semana', 'cada_2_semanas', 'cada_3_semanas', 'cada_4_semanas'].includes(formData.frequency_type) ? (
                    <div className="space-y-2">
                      <Select 
                        value={['cada_1_semana', 'cada_2_semanas', 'cada_3_semanas', 'cada_4_semanas'].includes(formData.frequency_type) 
                          ? formData.day_of_week.toString() 
                          : formData.frequency_value.toString()} 
                        onValueChange={(value) => {
                          if (['cada_1_semana', 'cada_2_semanas', 'cada_3_semanas', 'cada_4_semanas'].includes(formData.frequency_type)) {
                            setFormData({ ...formData, day_of_week: parseInt(value) });
                          } else {
                            setFormData({ ...formData, frequency_value: parseInt(value) });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar día..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Domingo</SelectItem>
                          <SelectItem value="1">Lunes</SelectItem>
                          <SelectItem value="2">Martes</SelectItem>
                          <SelectItem value="3">Miércoles</SelectItem>
                          <SelectItem value="4">Jueves</SelectItem>
                          <SelectItem value="5">Viernes</SelectItem>
                          <SelectItem value="6">Sábado</SelectItem>
                        </SelectContent>
                      </Select>
                      {['cada_1_semana', 'cada_2_semanas', 'cada_3_semanas', 'cada_4_semanas'].includes(formData.frequency_type) && (
                        <div className="text-sm text-muted-foreground">
                          Se ejecutará cada {
                            formData.frequency_type === 'cada_1_semana' ? '1 semana' :
                            formData.frequency_type === 'cada_2_semanas' ? '2 semanas' :
                            formData.frequency_type === 'cada_3_semanas' ? '3 semanas' :
                            '4 semanas'
                          } los días {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][formData.day_of_week]}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min="1"
                      max={formData.frequency_type === 'monthly_on_day' ? 31 : 9999}
                      value={formData.frequency_value}
                      onChange={(e) => setFormData({
                        ...formData,
                        frequency_value: parseInt(e.target.value) || 1
                      })}
                      placeholder={
                        formData.frequency_type === 'minutes' ? '10 (minutos)' :
                        formData.frequency_type === 'days' ? '30 (días)' : '10 (día del mes)'
                      }
                      required
                    />
                  )}
                </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mt-3">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    📋 Comportamiento de creación automática:
                  </p>
                  <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <div className="mb-2 p-2 bg-green-100 dark:bg-green-900/30 rounded text-green-800 dark:text-green-200">
                      <strong>✅ Las órdenes se crean automáticamente en estado "EN PROCESO"</strong>
                      <br />No requieren aprobación del cliente - están listas para asignar técnico
                    </div>
                    
                    {formData.frequency_type === 'weekly_on_day' && (
                      <div>
                        <strong>Ejemplo:</strong> Si seleccionas "Lunes" y la fecha de inicio fue hace 1 mes, 
                        se crearán órdenes EN PROCESO para TODOS los lunes desde entonces hasta hoy, 
                        luego se programará automáticamente para cada lunes futuro.
                      </div>
                    )}
                    
                    {formData.frequency_type === 'monthly_on_day' && (
                      <div>
                        <strong>Ejemplo:</strong> Si seleccionas día "15" y la fecha de inicio fue hace 3 meses, 
                        se crearán órdenes EN PROCESO para el día 15 de cada mes desde entonces hasta hoy, 
                        luego continuará automáticamente cada mes.
                      </div>
                    )}
                    
                    {formData.frequency_type === 'days' && (
                      <div>
                        <strong>Ejemplo:</strong> Si seleccionas "cada 7 días" desde hace 1 mes, 
                        se crearán aproximadamente 4-5 órdenes EN PROCESO para ponerse al día,
                        luego continuará cada 7 días automáticamente.
                      </div>
                    )}

                    {formData.frequency_type === 'minutes' && (
                      <div>
                        <strong>Nota:</strong> Para frecuencias en minutos (solo pruebas),
                        se crearán órdenes EN PROCESO para los intervalos pasados hasta alcanzar el presente.
                      </div>
                    )}

                    {['cada_1_semana', 'cada_2_semanas', 'cada_3_semanas', 'cada_4_semanas'].includes(formData.frequency_type) && (
                      <div>
                        <strong>Ejemplo:</strong> Si seleccionas "{
                          formData.frequency_type === 'cada_1_semana' ? 'cada 1 semana' :
                          formData.frequency_type === 'cada_2_semanas' ? 'cada 2 semanas' :
                          formData.frequency_type === 'cada_3_semanas' ? 'cada 3 semanas' :
                          'cada 4 semanas'
                        }" los {['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'][formData.day_of_week]} desde hace 2 meses, 
                        se crearán órdenes EN PROCESO para todos los {['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'][formData.day_of_week]} que cumplan el intervalo de {
                          formData.frequency_type === 'cada_1_semana' ? '1 semana' :
                          formData.frequency_type === 'cada_2_semanas' ? '2 semanas' :
                          formData.frequency_type === 'cada_3_semanas' ? '3 semanas' :
                          '4 semanas'
                        } desde entonces hasta hoy, 
                        luego continuará automáticamente según la frecuencia.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={!formData.policy_client_id || formData.selected_services.length === 0}
                >
                  {editingService ? 'Actualizar Servicio(s)' : 'Programar Servicio(s)'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Servicios Programados</CardTitle>
          <CardDescription>
            Servicios automáticos configurados para clientes con pólizas activas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scheduledServices.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay servicios programados. Configura el primer servicio automático.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Fecha Inicio</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Próxima Ejecución</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{service.policy_clients.clients.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {service.policy_clients.clients.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{service.policy_clients.insurance_policies.policy_name}</TableCell>
                     <TableCell>
                       <div className="space-y-1">
                         {service.services?.map((svc: any, index: number) => (
                           <div key={index} className="flex items-center space-x-2">
                             <div className="font-medium text-sm">Servicio {index + 1}</div>
                             <Badge variant="outline">
                               Cantidad: {svc.quantity}
                             </Badge>
                           </div>
                         )) || (
                           <div className="text-sm text-muted-foreground">
                             Sin servicios configurados
                           </div>
                         )}
                         {service.service_description && (
                           <div className="text-sm text-muted-foreground mt-1">
                             {service.service_description}
                           </div>
                         )}
                       </div>
                     </TableCell>
                     <TableCell>
                       <Badge variant="outline">
                         {service.services?.reduce((total: number, svc: any) => total + svc.quantity, 0) || 0}
                       </Badge>
                     </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {service.start_date ? formatDateMexico(service.start_date) : 'No definida'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline" className="whitespace-nowrap">
                          <Calendar className="h-3 w-3 mr-1" />
                          {service.frequency_type === 'minutes' ? `Cada ${service.frequency_value} minutos` :
                           service.frequency_type === 'cada_1_semana' ? 'Cada 1 semana' :
                           service.frequency_type === 'cada_2_semanas' ? 'Cada 2 semanas' :
                           service.frequency_type === 'cada_3_semanas' ? 'Cada 3 semanas' :
                           service.frequency_type === 'cada_4_semanas' ? 'Cada 4 semanas' :
                           service.frequency_type === 'days' ? `Cada ${service.frequency_value} días` :
                           service.frequency_type === 'weekly_on_day' ? 
                             ((service as any).week_interval > 1 ? `Cada ${(service as any).week_interval} semanas` : 'Cada semana') :
                           'Cada mes'}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          {service.frequency_type === 'minutes' ? '' :
                           ['cada_1_semana', 'cada_2_semanas', 'cada_3_semanas', 'cada_4_semanas', 'weekly_on_day'].includes(service.frequency_type) ? 
                             `Los ${['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'][service.frequency_type === 'weekly_on_day' ? service.frequency_value : (service.day_of_week || 1)]}` :
                           service.frequency_type === 'monthly_on_day' ? `Día ${service.frequency_value} del mes` :
                           ''}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {service.next_run ? `${formatDateMexico(service.next_run.split('T')[0])}, 12:01 a.m.` : 'No programado'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={service.priority >= 4 ? "destructive" : service.priority >= 3 ? "default" : "secondary"}>
                        P{service.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(service)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(service.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}