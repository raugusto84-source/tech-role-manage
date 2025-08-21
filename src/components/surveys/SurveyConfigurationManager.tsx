import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Settings, Clock, Calendar, Edit, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface SurveyConfiguration {
  id: string;
  name: string;
  description: string;
  delay_days: number;
  delay_hours: number;
  is_active: boolean;
  survey_questions: any;
  created_at: string;
}

interface ScheduledSurvey {
  id: string;
  order_id: string;
  scheduled_date: string;
  sent_at: string | null;
  completed_at: string | null;
  client_email: string;
  client_name: string;
  status: string;
  orders: {
    order_number: string;
  };
}

export function SurveyConfigurationManager() {
  const { toast } = useToast();
  const [configurations, setConfigurations] = useState<SurveyConfiguration[]>([]);
  const [scheduledSurveys, setScheduledSurveys] = useState<ScheduledSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SurveyConfiguration | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    delay_days: 1,
    delay_hours: 0,
    is_active: true,
  });

  useEffect(() => {
    loadConfigurations();
    loadScheduledSurveys();
  }, []);

  const loadConfigurations = async () => {
    try {
      const { data, error } = await supabase
        .from('survey_configurations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigurations(data || []);
    } catch (error) {
      console.error('Error loading configurations:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las configuraciones",
        variant: "destructive"
      });
    }
  };

  const loadScheduledSurveys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('scheduled_surveys')
        .select(`
          *,
          orders!inner(order_number)
        `)
        .order('scheduled_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setScheduledSurveys(data || []);
    } catch (error) {
      console.error('Error loading scheduled surveys:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las encuestas programadas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingConfig) {
        const { error } = await supabase
          .from('survey_configurations')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingConfig.id);

        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Configuración actualizada correctamente"
        });
      } else {
        const { error } = await supabase
          .from('survey_configurations')
          .insert([{
            ...formData,
            survey_questions: [
              {"id": "service_quality", "text": "¿Cómo califica la calidad del servicio recibido?", "type": "rating"},
              {"id": "service_time", "text": "¿Cómo califica la puntualidad del servicio?", "type": "rating"},
              {"id": "would_recommend", "text": "¿Recomendaría nuestros servicios a otros?", "type": "rating"},
              {"id": "general_comments", "text": "Comentarios adicionales (opcional)", "type": "text"}
            ]
          }]);

        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Configuración creada correctamente"
        });
      }

      setDialogOpen(false);
      setEditingConfig(null);
      setFormData({
        name: '',
        description: '',
        delay_days: 1,
        delay_hours: 0,
        is_active: true,
      });
      loadConfigurations();
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (config: SurveyConfiguration) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      description: config.description,
      delay_days: config.delay_days,
      delay_hours: config.delay_hours,
      is_active: config.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta configuración?')) return;
    
    try {
      const { error } = await supabase
        .from('survey_configurations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Éxito",
        description: "Configuración eliminada correctamente"
      });
      
      loadConfigurations();
    } catch (error) {
      console.error('Error deleting configuration:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la configuración",
        variant: "destructive"
      });
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('survey_configurations')
        .update({ is_active: !isActive, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      loadConfigurations();
    } catch (error) {
      console.error('Error toggling configuration:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'sent': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Programada';
      case 'sent': return 'Enviada';
      case 'completed': return 'Completada';
      case 'expired': return 'Expirada';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuraciones de Encuestas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configuraciones de Encuestas
          </h2>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingConfig(null)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nueva Configuración
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingConfig ? 'Editar Configuración' : 'Nueva Configuración de Encuesta'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre de la configuración"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción de la configuración"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="delay_days">Días de espera</Label>
                    <Input
                      id="delay_days"
                      type="number"
                      min="0"
                      value={formData.delay_days}
                      onChange={(e) => setFormData({ ...formData, delay_days: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="delay_hours">Horas adicionales</Label>
                    <Input
                      id="delay_hours"
                      type="number"
                      min="0"
                      max="23"
                      value={formData.delay_hours}
                      onChange={(e) => setFormData({ ...formData, delay_hours: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Activa</Label>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingConfig ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {configurations.map((config) => (
            <Card key={config.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{config.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.is_active ? 'default' : 'secondary'}>
                      {config.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                    <Switch
                      checked={config.is_active}
                      onCheckedChange={() => toggleActive(config.id, config.is_active)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{config.description}</p>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{config.delay_days} días</span>
                  </div>
                  {config.delay_hours > 0 && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{config.delay_hours}h</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(config)}
                    className="flex items-center gap-1"
                  >
                    <Edit className="h-3 w-3" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(config.id)}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Encuestas Programadas */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Encuestas Programadas
        </h2>
        
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : scheduledSurveys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay encuestas programadas
              </div>
            ) : (
              <div className="divide-y">
                {scheduledSurveys.map((survey) => (
                  <div key={survey.id} className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Orden {survey.orders.order_number}</span>
                        <Badge className={getStatusColor(survey.status)}>
                          {getStatusText(survey.status)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Cliente: {survey.client_name} ({survey.client_email})
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Programada: {new Date(survey.scheduled_date).toLocaleString()}
                        {survey.sent_at && (
                          <span className="ml-2">
                            • Enviada: {new Date(survey.sent_at).toLocaleString()}
                          </span>
                        )}
                        {survey.completed_at && (
                          <span className="ml-2">
                            • Completada: {new Date(survey.completed_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}