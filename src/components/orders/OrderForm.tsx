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
import { ArrowLeft, Save } from 'lucide-react';

interface ServiceType {
  id: string;
  name: string;
  description?: string;
  base_price?: number;
  estimated_hours?: number;
}

interface Technician {
  user_id: string;
  full_name: string;
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
  
  const [formData, setFormData] = useState({
    client_name: profile?.role === 'cliente' ? profile.full_name : '',
    client_email: profile?.role === 'cliente' ? profile.email : '',
    client_phone: '',
    service_type: '',
    failure_description: '',
    requested_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    estimated_cost: '',
    average_service_time: '',
    assigned_technician: ''
  });

  useEffect(() => {
    loadServiceTypes();
    if (profile?.role === 'administrador' || profile?.role === 'vendedor') {
      loadTechnicians();
    }
  }, [profile?.role]);

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

  const handleServiceTypeChange = (serviceTypeId: string) => {
    const selectedService = serviceTypes.find(st => st.id === serviceTypeId);
    if (selectedService) {
      setFormData(prev => ({
        ...prev,
        service_type: serviceTypeId,
        estimated_cost: selectedService.base_price?.toString() || '',
        average_service_time: selectedService.estimated_hours ? 
          (selectedService.estimated_hours * 60).toString() : ''
      }));
      
      // Calcular fecha de entrega estimada (agregando las horas estimadas)
      if (selectedService.estimated_hours && formData.requested_date) {
        const requestDate = new Date(formData.requested_date);
        requestDate.setDate(requestDate.getDate() + Math.ceil(selectedService.estimated_hours / 8)); // Asumiendo 8 horas por día
        setFormData(prev => ({
          ...prev,
          delivery_date: requestDate.toISOString().split('T')[0]
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const orderData = {
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_phone: formData.client_phone || null,
        service_type: formData.service_type,
        failure_description: formData.failure_description,
        requested_date: formData.requested_date,
        delivery_date: formData.delivery_date,
        estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
        average_service_time: formData.average_service_time ? parseInt(formData.average_service_time) : null,
        assigned_technician: formData.assigned_technician || null,
        created_by: user?.id,
        status: 'pendiente' as const
      };

      const { error } = await supabase
        .from('orders')
        .insert(orderData as any);

      if (error) throw error;

      toast({
        title: "Orden creada",
        description: "La orden de servicio se ha creado exitosamente",
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
              {/* Información del Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_name">Nombre del Cliente *</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                    required
                    disabled={profile?.role === 'cliente'}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="client_email">Email del Cliente *</Label>
                  <Input
                    id="client_email"
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_email: e.target.value }))}
                    required
                    disabled={profile?.role === 'cliente'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_phone">Teléfono del Cliente</Label>
                <Input
                  id="client_phone"
                  value={formData.client_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, client_phone: e.target.value }))}
                />
              </div>

              {/* Información del Servicio */}
              <div className="space-y-2">
                <Label htmlFor="service_type">Tipo de Servicio *</Label>
                <Select value={formData.service_type} onValueChange={handleServiceTypeChange} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo de servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} {service.base_price && `- $${service.base_price}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              {/* Fechas y Costos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requested_date">Fecha Solicitada *</Label>
                  <Input
                    id="requested_date"
                    type="date"
                    value={formData.requested_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, requested_date: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="delivery_date">Fecha de Entrega Estimada *</Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimated_cost">Costo Estimado</Label>
                  <Input
                    id="estimated_cost"
                    type="number"
                    step="0.01"
                    value={formData.estimated_cost}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_cost: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="average_service_time">Tiempo Estimado (minutos)</Label>
                  <Input
                    id="average_service_time"
                    type="number"
                    value={formData.average_service_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, average_service_time: e.target.value }))}
                    placeholder="120"
                  />
                </div>
              </div>

              {/* Asignación de Técnico (solo para admins y vendedores) */}
              {(profile?.role === 'administrador' || profile?.role === 'vendedor') && (
                <div className="space-y-2">
                  <Label htmlFor="assigned_technician">Técnico Asignado</Label>
                  <Select value={formData.assigned_technician} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_technician: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un técnico (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin asignar</SelectItem>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.user_id} value={tech.user_id}>
                          {tech.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Crear Orden
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}