import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar, Clock, Settings, Plus, Edit, Trash2, MessageSquare } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';

interface SurveyConfig {
  id: string;
  name: string;
  description: string | null;
  delay_days: number;
  delay_hours: number;
  is_active: boolean;
  survey_questions: any[];
  created_at: string;
}

interface ScheduledSurvey {
  id: string;
  order_id: string;
  survey_config_id: string;
  scheduled_date: string;
  survey_token: string;
  client_email: string;
  client_name: string;
  status: 'pending' | 'sent' | 'completed';
  created_at: string;
  order_number: string;
}

export default function ProgrammableSurveys() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [surveyConfigs, setSurveyConfigs] = useState<SurveyConfig[]>([]);
  const [scheduledSurveys, setScheduledSurveys] = useState<ScheduledSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SurveyConfig | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    delay_days: 1,
    delay_hours: 0,
    is_active: true,
    survey_questions: [
      { id: 1, question: '¿Cómo calificarías la calidad del servicio?', type: 'rating', required: true },
      { id: 2, question: '¿Qué tan satisfecho estás con el tiempo de respuesta?', type: 'rating', required: true },
      { id: 3, question: '¿Recomendarías nuestros servicios?', type: 'rating', required: true },
      { id: 4, question: 'Comentarios adicionales', type: 'text', required: false }
    ]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load survey configurations
      const { data: configsData, error: configsError } = await supabase
        .from('survey_configurations')
        .select('*')
        .order('created_at', { ascending: false });

      if (configsError) throw configsError;
      
      const processedConfigs = (configsData || []).map((config: any) => ({
        ...config,
        survey_questions: Array.isArray(config.survey_questions) ? config.survey_questions : []
      }));
      
      setSurveyConfigs(processedConfigs);

      // Load scheduled surveys
      const { data: scheduledData, error: scheduledError } = await supabase
        .from('scheduled_surveys')
        .select(`
          *,
          orders (order_number)
        `)
        .order('scheduled_date', { ascending: false })
        .limit(50);

      if (scheduledError) throw scheduledError;
      
      const processedScheduled = scheduledData?.map((survey: any) => ({
        ...survey,
        order_number: survey.orders?.order_number || 'N/A'
      })) || [];
      
      setScheduledSurveys(processedScheduled);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de encuestas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const configData = {
        name: formData.name,
        description: formData.description || null,
        delay_days: formData.delay_days,
        delay_hours: formData.delay_hours,
        is_active: formData.is_active,
        survey_questions: formData.survey_questions,
        created_by: user?.id
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('survey_configurations')
          .update(configData)
          .eq('id', editingConfig.id);

        if (error) throw error;

        toast({
          title: "Configuración actualizada",
          description: "La configuración de encuesta se actualizó correctamente",
        });
      } else {
        const { error } = await supabase
          .from('survey_configurations')
          .insert(configData);

        if (error) throw error;

        toast({
          title: "Configuración creada",
          description: "La nueva configuración de encuesta se creó correctamente",
        });
      }

      setShowConfigDialog(false);
      setEditingConfig(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive"
      });
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    try {
      const { error } = await supabase
        .from('survey_configurations')
        .delete()
        .eq('id', configId);

      if (error) throw error;

      toast({
        title: "Configuración eliminada",
        description: "La configuración se eliminó correctamente",
      });

      loadData();
    } catch (error) {
      console.error('Error deleting config:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la configuración",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      delay_days: 1,
      delay_hours: 0,
      is_active: true,
      survey_questions: [
        { id: 1, question: '¿Cómo calificarías la calidad del servicio?', type: 'rating', required: true },
        { id: 2, question: '¿Qué tan satisfecho estás con el tiempo de respuesta?', type: 'rating', required: true },
        { id: 3, question: '¿Recomendarías nuestros servicios?', type: 'rating', required: true },
        { id: 4, question: 'Comentarios adicionales', type: 'text', required: false }
      ]
    });
  };

  const handleEditConfig = (config: SurveyConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      description: config.description || '',
      delay_days: config.delay_days,
      delay_hours: config.delay_hours,
      is_active: config.is_active,
      survey_questions: config.survey_questions || []
    });
    setShowConfigDialog(true);
  };

  const addQuestion = () => {
    const newId = Math.max(...formData.survey_questions.map(q => q.id), 0) + 1;
    setFormData({
      ...formData,
      survey_questions: [
        ...formData.survey_questions,
        { id: newId, question: '', type: 'rating', required: true }
      ]
    });
  };

  const updateQuestion = (id: number, field: string, value: any) => {
    setFormData({
      ...formData,
      survey_questions: formData.survey_questions.map(q =>
        q.id === id ? { ...q, [field]: value } : q
      )
    });
  };

  const removeQuestion = (id: number) => {
    setFormData({
      ...formData,
      survey_questions: formData.survey_questions.filter(q => q.id !== id)
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Pendiente</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-info/10 text-info border-info/20">Enviada</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Completada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Cargando encuestas programables...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Encuestas Programables</h1>
              <p className="text-muted-foreground">
                Configura encuestas automáticas que se envían después de finalizar órdenes
              </p>
            </div>
          </div>
          
          <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setEditingConfig(null); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Configuración
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingConfig ? 'Editar Configuración' : 'Nueva Configuración de Encuesta'}
                </DialogTitle>
                <DialogDescription>
                  Configure cuándo y qué preguntar en las encuestas automáticas
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre de la configuración</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: Encuesta post-servicio"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="active">Activa</Label>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción opcional de la configuración"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="delay-days">Días de retraso</Label>
                    <Input
                      id="delay-days"
                      type="number"
                      min="0"
                      value={formData.delay_days}
                      onChange={(e) => setFormData({ ...formData, delay_days: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="delay-hours">Horas de retraso</Label>
                    <Input
                      id="delay-hours"
                      type="number"
                      min="0"
                      max="23"
                      value={formData.delay_hours}
                      onChange={(e) => setFormData({ ...formData, delay_hours: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Preguntas de la encuesta</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar pregunta
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.survey_questions.map((question, index) => (
                      <div key={question.id} className="border rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Pregunta"
                              value={question.question}
                              onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                            />
                            <div className="flex items-center gap-4">
                              <select
                                className="px-3 py-1 border rounded text-sm"
                                value={question.type}
                                onChange={(e) => updateQuestion(question.id, 'type', e.target.value)}
                              >
                                <option value="rating">Calificación (1-5)</option>
                                <option value="text">Texto libre</option>
                                <option value="boolean">Sí/No</option>
                              </select>
                              <label className="flex items-center gap-1 text-sm">
                                <input
                                  type="checkbox"
                                  checked={question.required}
                                  onChange={(e) => updateQuestion(question.id, 'required', e.target.checked)}
                                />
                                Obligatoria
                              </label>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeQuestion(question.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveConfig}>
                  {editingConfig ? 'Actualizar' : 'Crear'} Configuración
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Survey Configurations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuraciones de Encuestas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Retraso</TableHead>
                  <TableHead>Preguntas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surveyConfigs.map((config) => (
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
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {config.delay_days}d
                        <Clock className="h-3 w-3 ml-2" />
                        {config.delay_hours}h
                      </div>
                    </TableCell>
                    <TableCell>{config.survey_questions?.length || 0} preguntas</TableCell>
                    <TableCell>
                      {config.is_active ? (
                        <Badge className="bg-success/10 text-success border-success/20">Activa</Badge>
                      ) : (
                        <Badge variant="outline">Inactiva</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(config.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditConfig(config)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteConfig(config.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {surveyConfigs.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay configuraciones de encuestas</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crea una configuración para empezar a programar encuestas automáticas
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduled Surveys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Encuestas Programadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha Programada</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledSurveys.map((survey) => (
                  <TableRow key={survey.id}>
                    <TableCell className="font-medium">{survey.order_number}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{survey.client_name}</div>
                        <div className="text-sm text-muted-foreground">{survey.client_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(survey.scheduled_date).toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(survey.status)}</TableCell>
                    <TableCell>{new Date(survey.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {scheduledSurveys.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay encuestas programadas</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Las encuestas se programarán automáticamente cuando se finalicen órdenes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}