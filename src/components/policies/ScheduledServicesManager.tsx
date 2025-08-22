import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Play, Pause, Clock, RotateCcw } from "lucide-react";

interface ScheduledService {
  id: string;
  policy_client_id: string;
  service_type_id: string;
  frequency_days: number;
  next_service_date: string;
  last_service_date: string | null;
  is_active: boolean;
  service_description: string;
  priority: number;
  created_at: string;
  policy_clients: {
    clients: {
      name: string;
      email: string;
    };
    insurance_policies: {
      policy_name: string;
      policy_number: string;
    };
  };
  service_types: {
    name: string;
    description: string;
  };
}

interface PolicyClient {
  id: string;
  clients: {
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
  description: string;
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
  const [formData, setFormData] = useState({
    policy_client_id: '',
    service_type_id: '',
    frequency_days: 30,
    next_service_date: '',
    service_description: '',
    priority: 1,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load scheduled services
      const { data: servicesData, error: servicesError } = await supabase
        .from('scheduled_services')
        .select(`
          *,
          policy_clients(
            clients(name, email),
            insurance_policies(policy_name, policy_number)
          ),
          service_types(name, description)
        `)
        .order('next_service_date', { ascending: true });

      if (servicesError) throw servicesError;
      setScheduledServices(servicesData || []);

      // Load policy clients
      const { data: policyClientsData, error: policyClientsError } = await supabase
        .from('policy_clients')
        .select(`
          id,
          clients(name, email),
          insurance_policies(policy_name)
        `)
        .eq('is_active', true);

      if (policyClientsError) throw policyClientsError;
      setPolicyClients(policyClientsData || []);

      // Load service types
      const { data: serviceTypesData, error: serviceTypesError } = await supabase
        .from('service_types')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');

      if (serviceTypesError) throw serviceTypesError;
      setServiceTypes(serviceTypesData || []);

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

  const handleCreateScheduledService = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('scheduled_services')
        .insert([{
          ...formData,
          created_by: user?.id,
          is_active: true,
        }]);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Servicio programado creado correctamente",
      });

      setIsDialogOpen(false);
      resetForm();
      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error creating scheduled service:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el servicio programado",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (serviceId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('scheduled_services')
        .update({ is_active: !currentStatus })
        .eq('id', serviceId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Servicio ${!currentStatus ? 'activado' : 'pausado'} correctamente`,
      });

      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error toggling service status:', error);
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del servicio",
        variant: "destructive",
      });
    }
  };

  const handleCreateOrder = async (service: ScheduledService) => {
    try {
      // Get client_id from policy_clients
      const { data: policyClient, error: policyError } = await supabase
        .from('policy_clients')
        .select('clients(id)')
        .eq('id', service.policy_client_id)
        .single();

      if (policyError || !policyClient) {
        throw new Error('No se pudo obtener información del cliente');
      }

      // Create order with policy information
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: `ORD-POL-${Date.now()}`,
          client_id: policyClient.clients.id,
          service_type: 'domicilio', // Use valid service_type enum value
          service_location: 'domicilio', // Use valid service_location enum value
          delivery_date: service.next_service_date,
          estimated_cost: 0,
          failure_description: service.service_description || `Servicio programado: ${service.service_types.name}`,
          status: 'pendiente',
          is_policy_order: true,
          order_priority: service.priority,
          created_by: user?.id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order item for the scheduled service
      const { error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: orderData.id,
          service_type_id: service.service_type_id,
          quantity: 1,
          unit_cost_price: 0,
          unit_base_price: 0,
          profit_margin_rate: 0,
          subtotal: 0,
          vat_rate: 0,
          vat_amount: 0,
          total_amount: 0,
          service_name: service.service_types.name,
          service_description: service.service_types.description,
          item_type: 'servicio',
          status: 'pendiente',
        });

      if (itemError) throw itemError;

      // Update last service date and calculate next date
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + service.frequency_days);

      const { error: updateError } = await supabase
        .from('scheduled_services')
        .update({
          last_service_date: new Date().toISOString().split('T')[0],
          next_service_date: nextDate.toISOString().split('T')[0],
        })
        .eq('id', service.id);

      if (updateError) throw updateError;

      toast({
        title: "Éxito",
        description: `Orden ${orderData.order_number} creada y próxima fecha programada para ${nextDate.toLocaleDateString('es-MX')}`,
      });

      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: "Error",
        description: `No se pudo crear la orden de servicio: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      policy_client_id: '',
      service_type_id: '',
      frequency_days: 30,
      next_service_date: '',
      service_description: '',
      priority: 1,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX');
  };

  const getDaysUntilService = (dateString: string) => {
    const serviceDate = new Date(dateString);
    const today = new Date();
    const diffTime = serviceDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getPriorityBadge = (priority: number) => {
    if (priority === 1) return <Badge variant="destructive">Alta</Badge>;
    if (priority === 2) return <Badge variant="default">Media</Badge>;
    return <Badge variant="secondary">Baja</Badge>;
  };

  if (loading) {
    return <div>Cargando servicios programados...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Servicios Programados</h2>
          <p className="text-muted-foreground">
            Gestiona los servicios recurrentes para clientes con pólizas
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Programar Servicio
            </Button>
          </DialogTrigger>
          
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Programar Nuevo Servicio</DialogTitle>
              <DialogDescription>
                Configura un servicio recurrente para un cliente con póliza
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateScheduledService} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="policy_client_id">Cliente con Póliza *</Label>
                <Select 
                  value={formData.policy_client_id} 
                  onValueChange={(value) => setFormData({...formData, policy_client_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
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
                <Label htmlFor="service_type_id">Tipo de Servicio *</Label>
                <Select 
                  value={formData.service_type_id} 
                  onValueChange={(value) => setFormData({...formData, service_type_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency_days">Frecuencia (días) *</Label>
                  <Input
                    type="number"
                    value={formData.frequency_days}
                    onChange={(e) => setFormData({...formData, frequency_days: parseInt(e.target.value)})}
                    min="1"
                    max="365"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad *</Label>
                  <Select 
                    value={formData.priority.toString()} 
                    onValueChange={(value) => setFormData({...formData, priority: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Alta (1)</SelectItem>
                      <SelectItem value="2">Media (2)</SelectItem>
                      <SelectItem value="3">Baja (3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="next_service_date">Próximo Servicio *</Label>
                <Input
                  type="date"
                  value={formData.next_service_date}
                  onChange={(e) => setFormData({...formData, next_service_date: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_description">Descripción del Servicio</Label>
                <Textarea
                  value={formData.service_description}
                  onChange={(e) => setFormData({...formData, service_description: e.target.value})}
                  placeholder="Detalles específicos del servicio programado"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Programar Servicio
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
            Lista de servicios recurrentes configurados para clientes con pólizas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scheduledServices.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay servicios programados. Programa el primer servicio para comenzar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Próximo Servicio</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledServices.map((service) => {
                  const daysUntil = getDaysUntilService(service.next_service_date);
                  const isOverdue = daysUntil < 0;
                  const isDue = daysUntil <= 3;

                  return (
                    <TableRow key={service.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {service.policy_clients.clients.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {service.policy_clients.insurance_policies.policy_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{service.service_types.name}</div>
                          {service.service_description && (
                            <div className="text-sm text-muted-foreground">
                              {service.service_description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <RotateCcw className="h-4 w-4 text-muted-foreground" />
                          <span>Cada {service.frequency_days} días</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className={isOverdue ? 'text-destructive font-medium' : isDue ? 'text-orange-600 font-medium' : ''}>
                            {formatDate(service.next_service_date)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {isOverdue ? (
                            <span className="text-destructive">Vencido hace {Math.abs(daysUntil)} días</span>
                          ) : isDue ? (
                            <span className="text-orange-600">En {daysUntil} días</span>
                          ) : (
                            <span>En {daysUntil} días</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(service.priority)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={service.is_active ? "default" : "secondary"}>
                          {service.is_active ? "Activo" : "Pausado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {(isOverdue || isDue) && service.is_active && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleCreateOrder(service)}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Crear Orden
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(service.id, service.is_active)}
                          >
                            {service.is_active ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}