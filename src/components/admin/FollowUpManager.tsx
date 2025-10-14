import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Clock, Mail, MessageSquare, Phone, Plus, Search, RefreshCw, Settings, Zap, FastForward, Play, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FollowUpConfig {
  id: string;
  name: string;
  description: string;
  trigger_event: string;
  delay_hours: number;
  notification_channels: string[];
  message_template: string;
  is_active: boolean;
}

interface FollowUpReminder {
  id: string;
  configuration_name: string;
  related_type: string;
  target_email: string;
  scheduled_at: string;
  status: string;
  message_content: string;
}

interface WhatsAppConfig {
  id?: string;
  provider: string;
  business_phone_number: string;
  phone_number_id: string;
  is_active: boolean;
}

interface TimeSimulation {
  current_date: string;
  days_to_advance: number;
  simulate_events: boolean;
}

export function FollowUpManager() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<FollowUpConfig[]>([]);
  const [reminders, setReminders] = useState<FollowUpReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<FollowUpConfig | null>(null);
  
  // WhatsApp Configuration
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig>({
    provider: "twilio",
    business_phone_number: "",
    phone_number_id: "",
    is_active: false
  });
  const [testingConnection, setTestingConnection] = useState(false);

  // Time Simulation
  const [timeSimulation, setTimeSimulation] = useState<TimeSimulation>({
    current_date: new Date().toISOString().split('T')[0],
    days_to_advance: 1,
    simulate_events: true
  });
  
  const [simulationRunning, setSimulationRunning] = useState(false);

  const [newConfig, setNewConfig] = useState({
    name: "",
    description: "",
    trigger_event: "",
    delay_hours: 2,
    notification_channels: ["system"],
    message_template: "",
    is_active: true
  });

  const triggerEvents = [
    { value: "quote_received", label: "Cotización Recibida" },
    { value: "quote_sent", label: "Cotización Enviada" },
    { value: "quote_pending", label: "Cotización Pendiente" },
    { value: "order_created", label: "Orden Creada" },
    { value: "order_assigned", label: "Orden Asignada" },
    { value: "order_in_progress", label: "Orden en Progreso" },
    { value: "order_completed", label: "Orden Completada" },
    { value: "payment_pending", label: "Pago Pendiente" },
    { value: "payment_due_soon", label: "Pago Próximo a Vencer" },
    { value: "payment_overdue", label: "Pago Vencido" },
    { value: "client_inactive", label: "Cliente Inactivo" },
    { value: "policy_renewal", label: "Renovación de Póliza" },
    { value: "warranty_expiring", label: "Garantía por Vencer" }
  ];

  const notificationChannels = [
    { value: "system", label: "Sistema", icon: Bell },
    { value: "email", label: "Email", icon: Mail },
    { value: "whatsapp", label: "WhatsApp", icon: MessageSquare }
  ];

  useEffect(() => {
    loadData();
    loadWhatsAppConfig();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadConfigurations(), loadReminders()]);
    } catch (error) {
      console.error('Error loading follow-up data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConfigurations = async () => {
    const { data } = await supabase
      .from('follow_up_configurations')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setConfigs(data);
  };

  const loadReminders = async () => {
    const { data } = await supabase
      .from('follow_up_reminders')
      .select(`
        *,
        follow_up_configurations!inner(name)
      `)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (data) {
      setReminders(data.map((reminder: any) => ({
        ...reminder,
        configuration_name: reminder.follow_up_configurations.name
      })));
    }
  };

  const saveConfiguration = async () => {
    try {
      if (editingConfig) {
        await supabase
          .from('follow_up_configurations')
          .update(newConfig)
          .eq('id', editingConfig.id);
        toast({ title: "Configuración actualizada", description: "Los cambios se han guardado correctamente" });
      } else {
        await supabase
          .from('follow_up_configurations')
          .insert(newConfig);
        toast({ title: "Configuración creada", description: "Nueva regla de seguimiento agregada" });
      }
      
      setShowAddDialog(false);
      setEditingConfig(null);
      resetForm();
      loadConfigurations();
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({ title: "Error", description: "No se pudo guardar la configuración", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setNewConfig({
      name: "",
      description: "",
      trigger_event: "",
      delay_hours: 2,
      notification_channels: ["system"],
      message_template: "",
      is_active: true
    });
  };

  const editConfiguration = (config: FollowUpConfig) => {
    setEditingConfig(config);
    setNewConfig(config);
    setShowAddDialog(true);
  };

  const toggleConfigStatus = async (id: string, currentStatus: boolean) => {
    try {
      await supabase
        .from('follow_up_configurations')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      loadConfigurations();
      toast({ 
        title: "Estado actualizado", 
        description: `Configuración ${!currentStatus ? 'activada' : 'desactivada'}` 
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pendiente</Badge>;
      case 'sent':
        return <Badge variant="default" className="bg-green-50 text-green-700">Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive">Fallido</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTriggerLabel = (trigger: string) => {
    return triggerEvents.find(t => t.value === trigger)?.label || trigger;
  };

  const getChannelIcons = (channels: string[]) => {
    return channels.map(channel => {
      const channelData = notificationChannels.find(c => c.value === channel);
      if (channelData) {
        const Icon = channelData.icon;
        return <Icon key={channel} className="h-4 w-4" />;
      }
      return null;
    });
  };

  const filteredConfigs = configs.filter(config =>
    config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    config.trigger_event.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // WhatsApp Functions
  const saveWhatsAppConfig = async () => {
    try {
      if (!whatsappConfig.business_phone_number) {
        toast({ 
          title: "Error", 
          description: "Por favor ingresa el número de negocio", 
          variant: "destructive" 
        });
        return;
      }

      // Validate phone format
      if (!whatsappConfig.business_phone_number.startsWith('+')) {
        toast({ 
          title: "Error", 
          description: "El número debe incluir el código de país (+52 para México)", 
          variant: "destructive" 
        });
        return;
      }

      // Check if config exists
      const { data: existing } = await supabase
        .from('whatsapp_config')
        .select('id')
        .single();

      if (existing) {
        // Update existing config
        const { error } = await supabase
          .from('whatsapp_config')
          .update({
            provider: whatsappConfig.provider,
            business_phone_number: whatsappConfig.business_phone_number,
            phone_number_id: whatsappConfig.phone_number_id,
            is_active: whatsappConfig.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await supabase
          .from('whatsapp_config')
          .insert({
            provider: whatsappConfig.provider,
            business_phone_number: whatsappConfig.business_phone_number,
            phone_number_id: whatsappConfig.phone_number_id,
            is_active: whatsappConfig.is_active
          });

        if (error) throw error;
      }

      toast({ 
        title: "Configuración guardada", 
        description: "La configuración de WhatsApp se ha guardado correctamente" 
      });
    } catch (error) {
      console.error('Error saving WhatsApp config:', error);
      toast({ 
        title: "Error", 
        description: "No se pudo guardar la configuración", 
        variant: "destructive" 
      });
    }
  };

  const loadWhatsAppConfig = async () => {
    try {
      const { data } = await supabase
        .from('whatsapp_config')
        .select('*')
        .single();

      if (data) {
        setWhatsappConfig({
          id: data.id,
          provider: data.provider,
          business_phone_number: data.business_phone_number,
          phone_number_id: data.phone_number_id || "",
          is_active: data.is_active
        });
      }
    } catch (error) {
      console.error('Error loading WhatsApp config:', error);
    }
  };

  const testWhatsAppConnection = async () => {
    try {
      setTestingConnection(true);

      if (!whatsappConfig.business_phone_number) {
        toast({ 
          title: "Error", 
          description: "Por favor configura el número de negocio primero", 
          variant: "destructive" 
        });
        return;
      }

      // Send test message
      const { data, error } = await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          phone: whatsappConfig.business_phone_number,
          message: '¡Prueba exitosa! Tu conexión con WhatsApp está funcionando correctamente. 🎉',
          message_type: 'test',
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({ 
          title: "Conexión exitosa", 
          description: `Mensaje de prueba enviado a ${whatsappConfig.business_phone_number}`,
        });
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error: any) {
      console.error('Error testing WhatsApp connection:', error);
      toast({ 
        title: "Error en la prueba", 
        description: error.message || "No se pudo enviar el mensaje de prueba", 
        variant: "destructive" 
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Time Simulation Functions
  const simulateTimeAdvance = async () => {
    try {
      setSimulationRunning(true);
      
      // Call edge function to simulate time advance and trigger events
      const { data, error } = await supabase.functions.invoke('simulate-time-advance', {
        body: {
          days_to_advance: timeSimulation.days_to_advance,
          simulate_events: timeSimulation.simulate_events,
          current_date: timeSimulation.current_date
        }
      });

      if (error) throw error;

      toast({
        title: "Simulación completada",
        description: `Se avanzaron ${timeSimulation.days_to_advance} días. ${data?.events_created || 0} eventos creados.`
      });

      // Reload data to see the new events
      await loadData();
      
    } catch (error) {
      console.error('Error in time simulation:', error);
      toast({
        title: "Error en simulación",
        description: "No se pudo completar la simulación de tiempo",
        variant: "destructive"
      });
    } finally {
      setSimulationRunning(false);
    }
  };

  const testAllEvents = async () => {
    try {
      setSimulationRunning(true);
      
      // Test all possible events by advancing 30 days
      const { data, error } = await supabase.functions.invoke('simulate-time-advance', {
        body: {
          days_to_advance: 30,
          simulate_events: true,
          current_date: timeSimulation.current_date,
          test_all_events: true
        }
      });

      if (error) throw error;

      toast({
        title: "Prueba completa realizada",
        description: `Se probaron todos los eventos. ${data?.events_created || 0} eventos creados en 30 días simulados.`
      });

      // Reload data
      await loadData();
      
    } catch (error) {
      console.error('Error testing events:', error);
      toast({
        title: "Error en prueba",
        description: "No se pudo completar la prueba de eventos",
        variant: "destructive"
      });
    } finally {
      setSimulationRunning(false);
    }
  };

  useEffect(() => {
    loadWhatsAppConfig();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Módulo de Seguimientos</h2>
          <p className="text-muted-foreground">
            Configuración de recordatorios automáticos para asegurar el seguimiento adecuado
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingConfig(null); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Regla
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? 'Editar Configuración' : 'Nueva Regla de Seguimiento'}
              </DialogTitle>
              <DialogDescription>
                Configure cuándo y cómo se deben enviar los recordatorios automáticos
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre de la Regla</Label>
                  <Input
                    id="name"
                    value={newConfig.name}
                    onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                    placeholder="Ej: Seguimiento Cotización 2h"
                  />
                </div>
                <div>
                  <Label htmlFor="trigger">Evento Disparador</Label>
                  <Select value={newConfig.trigger_event} onValueChange={(value) => setNewConfig({ ...newConfig, trigger_event: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione evento" />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerEvents.map(event => (
                        <SelectItem key={event.value} value={event.value}>
                          {event.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={newConfig.description}
                  onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                  placeholder="Descripción opcional de la regla"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="delay">Tiempo de Espera (horas)</Label>
                  <Input
                    id="delay"
                    type="number"
                    min="0"
                    value={newConfig.delay_hours}
                    onChange={(e) => setNewConfig({ ...newConfig, delay_hours: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Canales de Notificación</Label>
                  <div className="flex gap-2 mt-2">
                    {notificationChannels.map(channel => {
                      const Icon = channel.icon;
                      const isSelected = newConfig.notification_channels.includes(channel.value);
                      return (
                        <Button
                          key={channel.value}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const channels = isSelected
                              ? newConfig.notification_channels.filter(c => c !== channel.value)
                              : [...newConfig.notification_channels, channel.value];
                            setNewConfig({ ...newConfig, notification_channels: channels });
                          }}
                        >
                          <Icon className="h-4 w-4 mr-1" />
                          {channel.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="template">Plantilla del Mensaje</Label>
                <Textarea
                  id="template"
                  value={newConfig.message_template}
                  onChange={(e) => setNewConfig({ ...newConfig, message_template: e.target.value })}
                  placeholder="Mensaje que se enviará. Use {variable} para datos dinámicos"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variables disponibles: {'{cliente_nombre}'}, {'{orden_numero}'}, {'{cotizacion_numero}'}, {'{vendedor_nombre}'}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={newConfig.is_active}
                  onCheckedChange={(checked) => setNewConfig({ ...newConfig, is_active: checked })}
                />
                <Label htmlFor="active">Activar regla inmediatamente</Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={saveConfiguration}>
                {editingConfig ? 'Actualizar' : 'Crear'} Regla
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="configurations" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configurations">Configuraciones</TabsTrigger>
          <TabsTrigger value="reminders">Recordatorios Activos</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="simulation">Simulación</TabsTrigger>
        </TabsList>

        <TabsContent value="configurations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Reglas de Seguimiento</CardTitle>
                  <CardDescription>
                    Gestiona las reglas automáticas de recordatorios
                  </CardDescription>
                </div>
                <Button onClick={loadData} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar configuraciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Retraso</TableHead>
                    <TableHead>Canales</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConfigs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{config.name}</div>
                          {config.description && (
                            <div className="text-sm text-muted-foreground">{config.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTriggerLabel(config.trigger_event)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                          {config.delay_hours}h
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {getChannelIcons(config.notification_channels)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={config.is_active}
                          onCheckedChange={() => toggleConfigStatus(config.id, config.is_active)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editConfiguration(config)}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recordatorios Programados</CardTitle>
              <CardDescription>
                Lista de recordatorios pendientes y enviados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Configuración</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Programado Para</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Mensaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reminders.map((reminder) => (
                    <TableRow key={reminder.id}>
                      <TableCell>
                        <div className="font-medium">{reminder.configuration_name}</div>
                        <Badge variant="secondary" className="text-xs">
                          {reminder.related_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{reminder.target_email}</TableCell>
                      <TableCell>
                        {new Date(reminder.scheduled_at).toLocaleString('es-ES')}
                      </TableCell>
                      <TableCell>{getStatusBadge(reminder.status)}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm text-muted-foreground">
                          {reminder.message_content}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Configuración de WhatsApp
                  </CardTitle>
                  <CardDescription>
                    Configure la integración de WhatsApp para envío de recordatorios
                  </CardDescription>
                </div>
                <Badge variant={whatsappConfig.is_active ? "default" : "secondary"}>
                  {whatsappConfig.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="provider">Proveedor</Label>
                  <Select
                    value={whatsappConfig.provider}
                    onValueChange={(value) => setWhatsappConfig({...whatsappConfig, provider: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="meta" disabled>Meta (próximamente)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="whatsapp-phone">Número de Negocio</Label>
                  <Input
                    id="whatsapp-phone"
                    placeholder="+52 XXX XXX XXXX"
                    value={whatsappConfig.business_phone_number}
                    onChange={(e) => setWhatsappConfig({...whatsappConfig, business_phone_number: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Debe incluir código de país (ej: +52 para México)
                  </p>
                </div>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  💡 <strong>Credenciales de Twilio:</strong> Las credenciales (Account SID, Auth Token, Número WhatsApp) ya están configuradas de forma segura en el sistema.
                </p>
                <p className="text-xs text-muted-foreground">
                  Solo necesitas ingresar el número de negocio y probar la conexión.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="whatsapp-active"
                    checked={whatsappConfig.is_active}
                    onCheckedChange={(checked) => setWhatsappConfig({...whatsappConfig, is_active: checked})}
                  />
                  <Label htmlFor="whatsapp-active">Activar integración de WhatsApp</Label>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={testWhatsAppConnection}
                    variant="outline"
                    disabled={testingConnection || !whatsappConfig.business_phone_number}
                  >
                    {testingConnection ? "Probando..." : "Probar Conexión"}
                  </Button>
                  <Button onClick={saveWhatsAppConfig}>
                    <Settings className="h-4 w-4 mr-2" />
                    Guardar Configuración
                  </Button>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Configuración de Twilio WhatsApp
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Account SID y Auth Token</strong>: Obtener de la consola de Twilio</li>
                  <li>• <strong>Número WhatsApp</strong>: Debe incluir código de país (ej: +14155238886)</li>
                  <li>• El número debe ser un <strong>WhatsApp Business API</strong> aprobado por Twilio</li>
                  <li>• Para pruebas, usa el <strong>Twilio Sandbox for WhatsApp</strong></li>
                  <li>• Los números deben estar en formato internacional con +</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FastForward className="h-5 w-5" />
                Simulación de Tiempo
              </CardTitle>
              <CardDescription>
                Simule el avance del tiempo para probar eventos programados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="current-date">Fecha Actual del Sistema</Label>
                  <Input
                    id="current-date"
                    type="date"
                    value={timeSimulation.current_date}
                    onChange={(e) => setTimeSimulation({...timeSimulation, current_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="days-advance">Días a Avanzar</Label>
                  <Input
                    id="days-advance"
                    type="number"
                    min="1"
                    max="365"
                    value={timeSimulation.days_to_advance}
                    onChange={(e) => setTimeSimulation({...timeSimulation, days_to_advance: parseInt(e.target.value) || 1})}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="simulate-events"
                  checked={timeSimulation.simulate_events}
                  onCheckedChange={(checked) => setTimeSimulation({...timeSimulation, simulate_events: checked})}
                />
                <Label htmlFor="simulate-events">Crear eventos programados automáticamente</Label>
              </div>

              <div className="flex gap-4">
                <Button 
                  onClick={simulateTimeAdvance} 
                  disabled={simulationRunning}
                  className="flex-1"
                >
                  {simulationRunning ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Simular Avance de Tiempo
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={testAllEvents}
                  disabled={simulationRunning}
                  className="flex-1"
                >
                  {simulationRunning ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Probar Todos los Eventos (30 días)
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2 text-blue-700">
                  <Calendar className="h-4 w-4" />
                  ¿Qué hace esta simulación?
                </h4>
                <ul className="text-sm text-blue-600 space-y-1">
                  <li>• <strong>Servicios Programados:</strong> Crea órdenes para servicios de pólizas que correspondan a los días simulados</li>
                  <li>• <strong>Pagos de Pólizas:</strong> Genera pagos mensuales automáticos cuando corresponda</li>
                  <li>• <strong>Recordatorios:</strong> Activa seguimientos y notificaciones programadas</li>
                  <li>• <strong>Eventos de Calendario:</strong> Muestra todos los eventos que se crearían en el rango de tiempo</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <h4 className="font-medium mb-2 text-yellow-700">⚠️ Advertencia</h4>
                <p className="text-sm text-yellow-600">
                  Esta función es solo para pruebas. Los eventos creados son reales y aparecerán en el sistema. 
                  Use con precaución en entornos de producción.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}