import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, AlertTriangle, CheckCircle, Settings, Target } from "lucide-react";

interface ServiceType {
  id: string;
  name: string;
  service_category: string;
}

interface SLAConfig {
  id: string;
  service_type_id: string;
  status_stage: string;
  max_hours: number;
  warning_hours: number;
  notification_channels: string[];
  is_active: boolean;
  service_types?: { name: string; service_category: string };
}

export function OrderProcessSLAManager() {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [maxHours, setMaxHours] = useState<number>(24);
  const [warningHours, setWarningHours] = useState<number>(18);
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(true);
  const [systemEnabled, setSystemEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const statusOptions = [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en_proceso', label: 'En Proceso' },
    { value: 'en_camino', label: 'En Camino' },
    { value: 'finalizada', label: 'Finalizada' }
  ];

  useEffect(() => {
    loadServiceTypes();
    loadSLAConfigs();
  }, []);

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('id, name, service_category')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error('Error loading service types:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los tipos de servicio",
        variant: "destructive",
      });
    }
  };

  const loadSLAConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('order_process_slas')
        .select(`
          *,
          service_types!inner(name, service_category)
        `)
        .order('max_hours');

      if (error) throw error;
      setSlaConfigs(data || []);
    } catch (error) {
      console.error('Error loading SLA configs:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las configuraciones SLA",
        variant: "destructive",
      });
    }
  };

  const handleSaveSLA = async () => {
    if (!selectedServiceType || !selectedStatus) {
      toast({
        title: "Error",
        description: "Seleccione tipo de servicio y estado",
        variant: "destructive",
      });
      return;
    }

    if (warningHours >= maxHours) {
      toast({
        title: "Error",
        description: "Las horas de advertencia deben ser menores que las horas máximas",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const channels = [];
      if (whatsappEnabled) channels.push('whatsapp');
      if (systemEnabled) channels.push('system');

      const { error } = await supabase
        .from('order_process_slas')
        .upsert({
          service_type_id: selectedServiceType,
          status_stage: selectedStatus as any,
          max_hours: maxHours,
          warning_hours: warningHours,
          notification_channels: channels,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Configuración SLA guardada correctamente",
      });

      // Reset form
      setSelectedServiceType("");
      setSelectedStatus("");
      setMaxHours(24);
      setWarningHours(18);
      setWhatsappEnabled(true);
      setSystemEnabled(true);

      loadSLAConfigs();
    } catch (error) {
      console.error('Error saving SLA config:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración SLA",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSLAStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('order_process_slas')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `SLA ${!currentStatus ? 'activado' : 'desactivado'} correctamente`,
      });

      loadSLAConfigs();
    } catch (error) {
      console.error('Error toggling SLA status:', error);
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del SLA",
        variant: "destructive",
      });
    }
  };

  const runSLACheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-sla-notifications');
      
      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Verificación SLA completada. ${data?.notifications_sent || 0} notificaciones enviadas`,
      });
    } catch (error) {
      console.error('Error running SLA check:', error);
      toast({
        title: "Error",
        description: "No se pudo ejecutar la verificación SLA",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pendiente: 'bg-yellow-500',
      en_proceso: 'bg-blue-500',
      en_camino: 'bg-purple-500',
      finalizada: 'bg-green-500'
    };
    
    return (
      <Badge className={`${colors[status as keyof typeof colors]} text-white`}>
        {statusOptions.find(s => s.value === status)?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestión de SLA - Seguimiento de Procesos</h2>
          <p className="text-muted-foreground">
            Configure tiempos límite y notificaciones automáticas para cada etapa del proceso
          </p>
        </div>
        <Button onClick={runSLACheck} disabled={loading} className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Ejecutar Verificación SLA
        </Button>
      </div>

      <Tabs defaultValue="configure" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configure">Configurar SLA</TabsTrigger>
          <TabsTrigger value="manage">Administrar SLA</TabsTrigger>
        </TabsList>

        <TabsContent value="configure">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Nueva Configuración SLA
              </CardTitle>
              <CardDescription>
                Defina los tiempos límite y canales de notificación para cada tipo de servicio y estado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service-type">Tipo de Servicio</Label>
                  <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo de servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} ({type.service_category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warning-hours">Horas de Advertencia</Label>
                  <Input
                    id="warning-hours"
                    type="number"
                    value={warningHours}
                    onChange={(e) => setWarningHours(Number(e.target.value))}
                    min="1"
                    max="168"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enviar advertencia cuando se alcance este tiempo
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-hours">Horas Máximas (SLA)</Label>
                  <Input
                    id="max-hours"
                    type="number"
                    value={maxHours}
                    onChange={(e) => setMaxHours(Number(e.target.value))}
                    min="1"
                    max="168"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tiempo límite para completar esta etapa
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Canales de Notificación</Label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="whatsapp"
                      checked={whatsappEnabled}
                      onCheckedChange={setWhatsappEnabled}
                    />
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="system"
                      checked={systemEnabled}
                      onCheckedChange={setSystemEnabled}
                    />
                    <Label htmlFor="system">Sistema</Label>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveSLA} disabled={loading} className="w-full">
                {loading ? "Guardando..." : "Guardar Configuración SLA"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Configuraciones SLA Existentes
              </CardTitle>
              <CardDescription>
                Administre las configuraciones de tiempo y notificaciones existentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Advertencia</TableHead>
                    <TableHead>Máximo</TableHead>
                    <TableHead>Canales</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slaConfigs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">
                        {config.service_types?.name}
                        <div className="text-xs text-muted-foreground">
                          {config.service_types?.service_category}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(config.status_stage)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          {config.warning_hours}h
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-red-500" />
                          {config.max_hours}h
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {config.notification_channels.map((channel) => (
                            <Badge key={channel} variant="outline" className="text-xs">
                              {channel}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {config.is_active ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-gray-400" />
                          )}
                          {config.is_active ? 'Activo' : 'Inactivo'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleSLAStatus(config.id, config.is_active)}
                        >
                          {config.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {slaConfigs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No hay configuraciones SLA definidas
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}