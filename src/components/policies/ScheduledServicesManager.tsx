import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Clock, Trash2, Calendar, Settings } from "lucide-react";
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
  frequency_type: 'minutes' | 'days' | 'monthly_on_day' | 'weekly_on_day';
  frequency_value: number;
  next_run: string;
  priority: number;
  is_active: boolean;
  policy_client_id: string;
  service_type_id: string;
  service_description: string | null;
  quantity: number;
  policy_clients: PolicyClient;
  service_types: ServiceType;
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
    frequency_type: 'minutes' as 'minutes' | 'days' | 'monthly_on_day' | 'weekly_on_day',
    frequency_value: 10,
    priority: 2,
    service_description: '',
    quantity: 1
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
        ),
        service_types!inner(
          id,
          name,
          service_category,
          base_price
        )
      `)
      .eq('is_active', true)
      .order('next_service_date', { ascending: true });

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
      // Calculate next run time based on frequency
      const nextRun = new Date();
      if (formData.frequency_type === 'minutes') {
        nextRun.setMinutes(nextRun.getMinutes() + formData.frequency_value);
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

      const { error } = await supabase
        .from('scheduled_services')
        .insert({
          policy_client_id: formData.policy_client_id,
          service_type_id: formData.service_type_id,
          frequency_type: formData.frequency_type,
          frequency_value: formData.frequency_value,
          next_run: nextRun.toISOString(),
          next_service_date: nextRun.toISOString().split('T')[0], // Backward compatibility
          priority: formData.priority,
          service_description: formData.service_description || null,
          quantity: formData.quantity,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Servicio programado creado correctamente"
      });

      setIsDialogOpen(false);
      resetForm();
      loadScheduledServices();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error creating scheduled service:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el servicio programado",
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
      service_type_id: '',
      frequency_type: 'minutes',
      frequency_value: 10,
      priority: 2,
      service_description: '',
      quantity: 1
    });
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
          
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Programar Nuevo Servicio</DialogTitle>
              <DialogDescription>
                Configura un servicio periódico automático para un cliente con póliza
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
                <Label htmlFor="service_type_id">Tipo de Servicio *</Label>
                <Select value={formData.service_type_id} onValueChange={(value) => 
                  setFormData({ ...formData, service_type_id: value })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar servicio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - {formatCurrency(service.base_price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Cantidad</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({
                      ...formData,
                      quantity: parseInt(e.target.value) || 1
                    })}
                    required
                  />
                </div>
                
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
                      <SelectItem value="days">Cada X días</SelectItem>
                      <SelectItem value="weekly_on_day">Día específico de la semana</SelectItem>
                      <SelectItem value="monthly_on_day">Día X de cada mes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    {formData.frequency_type === 'weekly_on_day' ? 'Día de la Semana *' : 'Valor de Frecuencia *'}
                  </Label>
                  {formData.frequency_type === 'weekly_on_day' ? (
                    <Select value={formData.frequency_value.toString()} onValueChange={(value) => 
                      setFormData({ ...formData, frequency_value: parseInt(value) })
                    }>
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
                  disabled={!formData.policy_client_id || !formData.service_type_id}
                >
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
                      <Badge variant="outline">
                        {service.quantity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       <Badge variant="outline">
                         <Calendar className="h-3 w-3 mr-1" />
                         {service.frequency_type === 'minutes' ? `${service.frequency_value} min` :
                          service.frequency_type === 'days' ? `${service.frequency_value} días` :
                          service.frequency_type === 'weekly_on_day' ? 
                            ['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'][service.frequency_value] :
                          `Día ${service.frequency_value} del mes`}
                       </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {service.next_run ? new Date(service.next_run).toLocaleString('es-MX') : 'No programado'}
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