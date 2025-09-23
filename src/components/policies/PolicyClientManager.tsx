import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, UserPlus, Calendar, ArrowLeft, ArrowRight, Settings } from "lucide-react";

interface Client {
  id: string;
  user_id?: string | null;
  name: string;
  email: string | null;
  phone: string | null;
}

interface InsurancePolicy {
  id: string;
  policy_number: string;
  policy_name: string;
  monthly_fee: number;
}

interface PolicyClient {
  id: string;
  policy_id: string;
  client_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  clients: Client;
  insurance_policies: InsurancePolicy;
}

interface ServiceType {
  id: string;
  name: string;
  description?: string | null;
  cost_price: number | null;
  base_price: number | null;
  vat_rate: number;
  item_type: string;
  category: string;
  estimated_hours?: number | null;
}

interface SelectedService {
  service: ServiceType;
  quantity: number;
}

interface PolicyClientManagerProps {
  onStatsUpdate: () => void;
}

export function PolicyClientManager({ onStatsUpdate }: PolicyClientManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [policyClients, setPolicyClients] = useState<PolicyClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profileCandidates, setProfileCandidates] = useState<Array<{ user_id: string; full_name: string | null; email: string | null; phone: string | null }>>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Multi-step assignment states
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [globalFrequencyDays, setGlobalFrequencyDays] = useState<number>(30);
  const [frequencyWeeks, setFrequencyWeeks] = useState<number>(1);
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // 1 = Lunes
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load policy clients
      const { data: policyClientsData, error: policyClientsError } = await supabase
        .from('policy_clients')
        .select(`
          *,
          clients(id, name, email, phone),
          insurance_policies(id, policy_number, policy_name, monthly_fee)
        `)
        .order('created_at', { ascending: false });

      if (policyClientsError) throw policyClientsError;
      setPolicyClients(policyClientsData || []);

      await loadClientsAndPolicies();

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadClientsAndPolicies = async () => {
    try {
      // Load available clients including user_id for mapping
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, user_id, name, email, phone')
        .order('name');

      if (clientsError) {
        console.error('Clients loading error:', clientsError);
        throw clientsError;
      }
      console.log('Loaded clients:', clientsData?.length || 0);
      setClients(clientsData || []);

      // Load profile-only candidates (role cliente) that are NOT in clients table
      const { data: profileData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .eq('role', 'cliente');

      if (profilesError) {
        console.error('Profiles loading error:', profilesError);
        throw profilesError;
      }

      const clientsUserIds = new Set((clientsData || []).map((c) => c.user_id).filter(Boolean));
      const clientsEmails = new Set((clientsData || []).map((c) => c.email).filter(Boolean));

      const candidates = (profileData || []).filter((p) => {
        const byUserId = p.user_id && !clientsUserIds.has(p.user_id);
        const byEmail = p.email == null || !clientsEmails.has(p.email);
        return byUserId && byEmail;
      });

      setProfileCandidates(candidates as any);

      // Load active policies
      const { data: policiesData, error: policiesError } = await supabase
        .from('insurance_policies')
        .select('id, policy_number, policy_name, monthly_fee')
        .eq('is_active', true)
        .order('policy_name');

      if (policiesError) {
        console.error('Policies loading error:', policiesError);
        throw policiesError;
      }
      console.log('Loaded policies:', policiesData?.length || 0);
      setPolicies(policiesData || []);

      // Load active services
      const { data: servicesData, error: servicesError } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('category, name');

      if (servicesError) {
        console.error('Services loading error:', servicesError);
        throw servicesError;
      }
      console.log('Loaded services:', servicesData?.length || 0);
      setServices(servicesData || []);

    } catch (error: any) {
      console.error('Error loading clients and policies:', error);
      toast({
        title: "Error",
        description: `No se pudieron cargar los clientes y pólizas disponibles: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Multi-step navigation functions
  const nextStep = () => {
    if (currentStep === 1 && (!selectedPolicyId || !selectedClientId)) {
      toast({
        title: "Error",
        description: "Debe seleccionar una póliza y un cliente",
        variant: "destructive",
      });
      return;
    }
    
    if (currentStep === 2 && selectedServices.length === 0) {
      toast({
        title: "Error", 
        description: "Debe seleccionar al menos un servicio",
        variant: "destructive",
      });
      return;
    }
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const resetDialog = () => {
    setCurrentStep(1);
    setSelectedPolicyId('');
    setSelectedClientId('');
    setSelectedServices([]);
    setIsSubmitting(false);
  };

  // Service selection functions
  const addService = (service: ServiceType) => {
    const existing = selectedServices.find(s => s.service.id === service.id);
    if (existing) {
      toast({
        title: "Información",
        description: "Este servicio ya está seleccionado",
        variant: "default",
      });
      return;
    }
    
    setSelectedServices(prev => [...prev, {
      service,
      quantity: 1
    }]);
  };

  const removeService = (serviceId: string) => {
    setSelectedServices(prev => prev.filter(s => s.service.id !== serviceId));
  };

  const updateServiceConfig = (serviceId: string, field: 'quantity', value: number) => {
    setSelectedServices(prev => prev.map(s => 
      s.service.id === serviceId 
        ? { ...s, [field]: Math.max(1, value) }
        : s
    ));
  };

  const createInitialOrder = async (policyClientId: string, policyInfo: InsurancePolicy) => {
    try {
      // Generate order number
      const { data: ordersCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact' });
      
      const currentYear = new Date().getFullYear();
      const orderNumber = `ORD-${currentYear}-${String((ordersCount?.length || 0) + 1).padStart(4, '0')}`;
      
      // Get the client ID
      let clientIdToUse = '';
      if (selectedClientId.startsWith('client:')) {
        clientIdToUse = selectedClientId.split(':')[1];
      } else {
        // Handle profile case - this should have been converted already
        return;
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: orderNumber,
          client_id: clientIdToUse,
          service_type: selectedServices[0]?.service.id || null, // Use service ID, not category
          failure_description: `Póliza ${policyInfo.policy_name} - Servicios automáticos`,
          delivery_date: new Date().toISOString().split('T')[0],
          estimated_cost: 0,
          status: 'en_proceso' as const, // Policy orders start in process
          client_approval: true, // Pre-authorized by policy
          client_approved_at: new Date().toISOString(),
          created_by: user?.id
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items for each selected service
      const orderItems = selectedServices.map(selectedService => ({
        order_id: order.id,
        service_type_id: selectedService.service.id,
        service_name: selectedService.service.name,
        service_description: selectedService.service.description || '',
        quantity: selectedService.quantity,
        unit_cost_price: selectedService.service.cost_price || 0,
        unit_base_price: selectedService.service.base_price || 0,
        subtotal: (selectedService.service.base_price || 0) * selectedService.quantity,
        vat_rate: selectedService.service.vat_rate || 0,
        vat_amount: ((selectedService.service.base_price || 0) * selectedService.quantity * (selectedService.service.vat_rate || 0)) / 100,
        total_amount: (selectedService.service.base_price || 0) * selectedService.quantity * (1 + (selectedService.service.vat_rate || 0) / 100),
        item_type: selectedService.service.item_type || 'servicio'
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Save service configurations for automatic order generation
      const serviceConfigs = selectedServices.map(selectedService => ({
        policy_client_id: policyClientId,
        service_type_id: selectedService.service.id,
        quantity: selectedService.quantity,
        frequency_days: globalFrequencyDays,
        frequency_weeks: frequencyWeeks,
        day_of_week: dayOfWeek,
        created_by: user?.id
      }));

      const { error: configsError } = await supabase
        .from('policy_service_configurations')
        .upsert(serviceConfigs, { 
          onConflict: 'policy_client_id,service_type_id',
          ignoreDuplicates: false 
        });

      if (configsError) throw configsError;

      return order;
    } catch (error) {
      console.error('Error creating initial order:', error);
      throw error;
    }
  };

  const handleAssignClient = async () => {
    if (selectedServices.length === 0) {
      toast({
        title: "Error",
        description: "Debe seleccionar al menos un servicio",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      let clientIdToUse = '';

      if (selectedClientId.startsWith('client:')) {
        clientIdToUse = selectedClientId.split(':')[1];
      } else if (selectedClientId.startsWith('profile:')) {
        const profileUserId = selectedClientId.split(':')[1];

        // Try to find existing client linked to this profile
        const { data: existingClient, error: existingErr } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', profileUserId)
          .maybeSingle();
        if (existingErr) console.warn('Existing client check error:', existingErr);

        if (existingClient?.id) {
          clientIdToUse = existingClient.id;
        } else {
          const profile = profileCandidates.find((p) => p.user_id === profileUserId);
          if (!profile) {
            toast({
              title: 'Error',
              description: 'No se encontró el perfil seleccionado',
              variant: 'destructive',
            });
            return;
          }

          // Create client record from profile
          const { data: inserted, error: insertErr } = await supabase
            .from('clients')
            .insert([
              {
                user_id: profile.user_id,
                name: (profile.full_name || profile.email || 'Cliente') as string,
                email: profile.email,
                phone: profile.phone,
                address: '',
                client_number: ''
              }
            ])
            .select('id')
            .single();

          if (insertErr) throw insertErr;
          clientIdToUse = inserted.id;

          // Refresh lists so the newly created client appears next time
          await loadClientsAndPolicies();
        }
      } else {
        clientIdToUse = selectedClientId; // fallback
      }

      // Upsert assignment to avoid duplicates and reactivate if exists
      const { data: policyClientData, error: assignmentError } = await supabase
        .from('policy_clients')
        .upsert([
          {
            policy_id: selectedPolicyId,
            client_id: clientIdToUse,
            assigned_by: user?.id,
            is_active: true,
          }
        ], { onConflict: 'policy_id,client_id' })
        .select()
        .single();

      if (assignmentError) throw assignmentError;

      // Get policy info for order creation
      const policyInfo = policies.find(p => p.id === selectedPolicyId);
      if (!policyInfo) {
        throw new Error('Información de póliza no encontrada');
      }

      // Create initial order with selected services
      const order = await createInitialOrder(policyClientData.id, policyInfo);

      toast({
        title: 'Éxito',
        description: `Cliente asignado a la póliza correctamente. Orden inicial ${order.order_number} creada con ${selectedServices.length} servicio(s).`,
      });

      setIsDialogOpen(false);
      resetDialog();
      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error assigning client:', error);
      toast({
        title: 'Error',
        description: 'No se pudo completar la asignación: ' + (error.message || 'Error desconocido'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('¿Estás seguro de que quieres remover esta asignación?')) return;

    try {
      const { error } = await supabase
        .from('policy_clients')
        .update({ is_active: false })
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Asignación removida correctamente",
      });

      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error removing assignment:', error);
      toast({
        title: "Error",
        description: "No se pudo remover la asignación",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX');
  };

  if (loading) {
    return <div>Cargando asignaciones...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Asignación de Clientes</h2>
          <p className="text-muted-foreground">
            Asigna clientes a pólizas de seguros para activar beneficios
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (open) {
            resetDialog();
            console.log('Dialog opened, refreshing clients and policies...');
            loadClientsAndPolicies();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Asignar Cliente
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Asignar Cliente a Póliza - Paso {currentStep} de 3
              </DialogTitle>
              <DialogDescription>
                {currentStep === 1 && "Selecciona la póliza y el cliente"}
                {currentStep === 2 && "Configura los servicios automáticos"}
                {currentStep === 3 && "Confirma la asignación y configuración"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Paso 1: Selección de Póliza y Cliente */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Póliza</label>
                    <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar póliza" />
                      </SelectTrigger>
                      <SelectContent>
                        {policies.map((policy) => (
                          <SelectItem key={policy.id} value={policy.id}>
                            {policy.policy_name} - {formatCurrency(policy.monthly_fee)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cliente</label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={`client-${client.id}`} value={`client:${client.id}`}>
                            {client.name} - {client.email}
                          </SelectItem>
                        ))}
                        {profileCandidates.map((p) => (
                          <SelectItem key={`profile-${p.user_id}`} value={`profile:${p.user_id}`}>
                            {(p.full_name || p.email) ?? 'Cliente'} - {p.email} (perfil)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Paso 2: Selección y Configuración de Servicios */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Servicios Disponibles</h3>
                    <Badge variant="outline">{selectedServices.length} seleccionados</Badge>
                  </div>

                  {/* Lista de servicios disponibles */}
                  <div className="grid gap-3 max-h-60 overflow-y-auto">
                    {services.map((service) => (
                      <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{service.name}</h4>
                          <p className="text-sm text-muted-foreground">{service.description}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">{service.category}</Badge>
                            <Badge variant={service.item_type === 'servicio' ? 'default' : 'outline'} className="text-xs">
                              {service.item_type}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={selectedServices.some(s => s.service.id === service.id) ? "secondary" : "outline"}
                          onClick={() => addService(service)}
                        >
                          {selectedServices.some(s => s.service.id === service.id) ? "Seleccionado" : "Seleccionar"}
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Servicios seleccionados y configuración */}
                  {selectedServices.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium">Configuración de Servicios</h3>
                      {selectedServices.map((selectedService, index) => (
                        <div key={selectedService.service.id} className="p-4 border rounded-lg bg-muted/50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{selectedService.service.name}</h4>
                              <p className="text-sm text-muted-foreground">{selectedService.service.description}</p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeService(selectedService.service.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4 mt-3">
                            <div>
                              <Label htmlFor={`quantity-${index}`} className="text-sm">Cantidad</Label>
                              <Input
                                id={`quantity-${index}`}
                                type="number"
                                min="1"
                                value={selectedService.quantity}
                                onChange={(e) => updateServiceConfig(
                                  selectedService.service.id,
                                  'quantity',
                                  parseInt(e.target.value) || 1
                                )}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {selectedServices.length > 0 && (
                        <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                          <h4 className="text-sm font-medium mb-3">Configuración de Frecuencia</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="day-of-week" className="text-sm font-medium">
                                Día de la Semana
                              </Label>
                              <select
                                id="day-of-week"
                                value={dayOfWeek}
                                onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                <option value={1}>Lunes</option>
                                <option value={2}>Martes</option>
                                <option value={3}>Miércoles</option>
                                <option value={4}>Jueves</option>
                                <option value={5}>Viernes</option>
                                <option value={6}>Sábado</option>
                                <option value={0}>Domingo</option>
                              </select>
                            </div>
                            
                            <div>
                              <Label htmlFor="frequency-weeks" className="text-sm font-medium">
                                Cada cuántas semanas
                              </Label>
                              <select
                                id="frequency-weeks"
                                value={frequencyWeeks}
                                onChange={(e) => setFrequencyWeeks(parseInt(e.target.value))}
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                <option value={1}>1 semana</option>
                                <option value={2}>2 semanas</option>
                                <option value={3}>3 semanas</option>
                                <option value={4}>4 semanas</option>
                              </select>
                            </div>
                          </div>
                          
                          <p className="text-xs text-muted-foreground mt-2">
                            Se creará una orden cada {frequencyWeeks === 1 ? '' : frequencyWeeks + ' '}{frequencyWeeks === 1 ? 'semana' : 'semanas'} los {
                              dayOfWeek === 0 ? 'domingos' :
                              dayOfWeek === 1 ? 'lunes' :
                              dayOfWeek === 2 ? 'martes' :
                              dayOfWeek === 3 ? 'miércoles' :
                              dayOfWeek === 4 ? 'jueves' :
                              dayOfWeek === 5 ? 'viernes' : 'sábados'
                            } con todos los servicios seleccionados
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Paso 3: Confirmación */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Confirmar Asignación</h3>
                  
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Póliza Seleccionada</h4>
                      {(() => {
                        const policy = policies.find(p => p.id === selectedPolicyId);
                        return policy ? (
                          <div>
                            <p className="font-medium">{policy.policy_name}</p>
                            <p className="text-sm text-muted-foreground">
                              Cuota mensual: {formatCurrency(policy.monthly_fee)}
                            </p>
                          </div>
                        ) : null;
                      })()}
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Cliente Seleccionado</h4>
                      {(() => {
                        if (selectedClientId.startsWith('client:')) {
                          const client = clients.find(c => c.id === selectedClientId.split(':')[1]);
                          return client ? (
                            <div>
                              <p className="font-medium">{client.name}</p>
                              <p className="text-sm text-muted-foreground">{client.email}</p>
                            </div>
                          ) : null;
                        } else if (selectedClientId.startsWith('profile:')) {
                          const profile = profileCandidates.find(p => p.user_id === selectedClientId.split(':')[1]);
                          return profile ? (
                            <div>
                              <p className="font-medium">{profile.full_name || profile.email}</p>
                              <p className="text-sm text-muted-foreground">{profile.email} (desde perfil)</p>
                            </div>
                          ) : null;
                        }
                        return null;
                      })()}
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Servicios Configurados ({selectedServices.length})</h4>
                      <div className="space-y-2">
                        {selectedServices.map((selectedService) => (
                          <div key={selectedService.service.id} className="flex justify-between items-center text-sm">
                            <span>{selectedService.service.name}</span>
                            <span className="text-muted-foreground">
                              Cantidad: {selectedService.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium">
                          Frecuencia: Cada {frequencyWeeks === 1 ? '' : frequencyWeeks + ' '}{frequencyWeeks === 1 ? 'semana' : 'semanas'} los {
                            dayOfWeek === 0 ? 'domingos' :
                            dayOfWeek === 1 ? 'lunes' :
                            dayOfWeek === 2 ? 'martes' :
                            dayOfWeek === 3 ? 'miércoles' :
                            dayOfWeek === 4 ? 'jueves' :
                            dayOfWeek === 5 ? 'viernes' : 'sábados'
                          }
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Se creará una orden inicial con estos servicios y se generarán órdenes automáticas según la frecuencia configurada.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navegación */}
              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={currentStep === 1 ? () => setIsDialogOpen(false) : prevStep}
                  disabled={isSubmitting}
                >
                  {currentStep === 1 ? (
                    "Cancelar"
                  ) : (
                    <>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Anterior
                    </>
                  )}
                </Button>
                
                {currentStep < 3 ? (
                  <Button onClick={nextStep} disabled={isSubmitting}>
                    Siguiente
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleAssignClient} disabled={isSubmitting}>
                    {isSubmitting ? "Procesando..." : "Confirmar Asignación"}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes Asignados</CardTitle>
          <CardDescription>
            Lista de clientes asignados a pólizas con sus detalles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policyClients.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay clientes asignados a pólizas. Asigna el primer cliente para comenzar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Cuota Mensual</TableHead>
                  <TableHead>Fecha de Inicio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policyClients.filter(pc => pc.is_active).map((policyClient) => (
                  <TableRow key={policyClient.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{policyClient.clients.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {policyClient.clients.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{policyClient.insurance_policies.policy_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {policyClient.insurance_policies.policy_number}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(policyClient.insurance_policies.monthly_fee)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(policyClient.start_date)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={policyClient.is_active ? "default" : "secondary"}>
                        {policyClient.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAssignment(policyClient.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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