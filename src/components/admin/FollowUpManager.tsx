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
import { Bell, Clock, Mail, MessageSquare, Phone, Plus, Search, RefreshCw } from "lucide-react";
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

export function FollowUpManager() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<FollowUpConfig[]>([]);
  const [reminders, setReminders] = useState<FollowUpReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<FollowUpConfig | null>(null);

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
    { value: "order_created", label: "Orden Creada" },
    { value: "order_assigned", label: "Orden Asignada" },
    { value: "order_in_progress", label: "Orden en Progreso" },
    { value: "order_completed", label: "Orden Completada" },
    { value: "payment_pending", label: "Pago Pendiente" },
    { value: "client_inactive", label: "Cliente Inactivo" }
  ];

  const notificationChannels = [
    { value: "system", label: "Sistema", icon: Bell },
    { value: "email", label: "Email", icon: Mail },
    { value: "whatsapp", label: "WhatsApp", icon: MessageSquare }
  ];

  useEffect(() => {
    loadData();
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configurations">Configuraciones</TabsTrigger>
          <TabsTrigger value="reminders">Recordatorios Activos</TabsTrigger>
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
      </Tabs>
    </div>
  );
}