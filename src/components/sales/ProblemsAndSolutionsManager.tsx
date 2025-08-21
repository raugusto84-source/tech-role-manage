import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Save, X, Package, Camera, Monitor, Computer, Zap, ShieldCheck, Key, Home, Wrench, Settings, Phone, Wifi, Lock, Users, Building, Car } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface MainCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface Problem {
  id: string;
  name: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  is_active: boolean;
}

interface Question {
  id: string;
  question_text: string;
  question_order: number;
  is_active: boolean;
}

interface ServiceType {
  id: string;
  name: string;
}

// Icon mapping
const ICON_COMPONENTS: Record<string, React.ComponentType<any>> = {
  camera: Camera,
  monitor: Monitor,
  computer: Computer,
  zap: Zap,
  'shield-check': ShieldCheck,
  key: Key,
  home: Home,
  wrench: Wrench,
  settings: Settings,
  package: Package,
  'shield-alert': Package, // fallback
  phone: Phone,
  wifi: Wifi,
  lock: Lock,
  users: Users,
  building: Building,
  car: Car,
};

const getIconComponent = (iconName: string | null) => {
  if (!iconName) return Package;
  return ICON_COMPONENTS[iconName] || Package;
};

interface DiagnosticRule {
  id: string;
  conditions: any[];
  recommended_services: string[];
  confidence_score: number;
  priority: number;
  is_active: boolean;
}

export function ProblemsAndSolutionsManager() {
  const [categories, setCategories] = useState<MainCategory[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [rules, setRules] = useState<DiagnosticRule[]>([]);
  
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showProblemDialog, setShowProblemDialog] = useState(false);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  
  const [problemForm, setProblemForm] = useState({
    id: '',
    name: '',
    description: '',
    category_id: '',
  });

  const [questionForm, setQuestionForm] = useState({
    id: '',
    question_text: '',
    question_order: 1,
  });

  const [ruleForm, setRuleForm] = useState({
    id: '',
    conditions: [] as any[],
    recommended_services: [] as string[],
    confidence_score: 80,
    priority: 1,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedProblemId) {
      loadQuestions();
      loadRules();
    }
  }, [selectedProblemId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [categoriesRes, problemsRes, servicesRes] = await Promise.all([
        (supabase as any).from('main_service_categories').select('*').eq('is_active', true).order('name'),
        (supabase as any).from('problems').select(`
          *,
          main_service_categories!problems_category_id_fkey(name, icon)
        `).order('name'),
        (supabase as any).from('service_types').select('id, name').eq('is_active', true).order('name'),
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (problemsRes.data) {
        setProblems(problemsRes.data.map((p: any) => ({
          ...p,
          category_name: p.main_service_categories?.name || 'Sin categoría',
          category_icon: p.main_service_categories?.icon || null
        })));
      }
      if (servicesRes.data) setServices(servicesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: 'Error', description: 'Error al cargar datos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    if (!selectedProblemId) return;
    
    const { data } = await (supabase as any)
      .from('diagnostic_questions')
      .select('*')
      .eq('problem_id', selectedProblemId)
      .order('question_order');
    setQuestions(data || []);
  };

  const loadRules = async () => {
    if (!selectedProblemId) return;
    
    const { data } = await (supabase as any)
      .from('diagnostic_rules')
      .select('*')
      .eq('problem_id', selectedProblemId)
      .order('priority');
    setRules(data || []);
  };

  const saveProblem = async () => {
    try {
      const data = {
        name: problemForm.name,
        description: problemForm.description,
        category_id: problemForm.category_id || null,
        is_active: true,
      };

      if (problemForm.id) {
        await (supabase as any).from('problems').update(data).eq('id', problemForm.id);
        toast({ title: 'Éxito', description: 'Problema actualizado' });
      } else {
        await (supabase as any).from('problems').insert(data);
        toast({ title: 'Éxito', description: 'Problema creado' });
      }

      setShowProblemDialog(false);
      setProblemForm({ id: '', name: '', description: '', category_id: '' });
      loadData();
    } catch (error) {
      console.error('Error saving problem:', error);
      toast({ title: 'Error', description: 'Error al guardar problema', variant: 'destructive' });
    }
  };

  const saveQuestion = async () => {
    try {
      const data = {
        problem_id: selectedProblemId,
        question_text: questionForm.question_text,
        question_order: questionForm.question_order,
        is_active: true,
      };

      if (questionForm.id) {
        await (supabase as any).from('diagnostic_questions').update(data).eq('id', questionForm.id);
        toast({ title: 'Éxito', description: 'Pregunta actualizada' });
      } else {
        await (supabase as any).from('diagnostic_questions').insert(data);
        toast({ title: 'Éxito', description: 'Pregunta creada' });
      }

      setShowQuestionDialog(false);
      setQuestionForm({ id: '', question_text: '', question_order: 1 });
      loadQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      toast({ title: 'Error', description: 'Error al guardar pregunta', variant: 'destructive' });
    }
  };

  const saveRule = async () => {
    try {
      const data = {
        problem_id: selectedProblemId,
        conditions: ruleForm.conditions,
        recommended_services: ruleForm.recommended_services,
        confidence_score: ruleForm.confidence_score,
        priority: ruleForm.priority,
        is_active: true,
      };

      if (ruleForm.id) {
        await (supabase as any).from('diagnostic_rules').update(data).eq('id', ruleForm.id);
        toast({ title: 'Éxito', description: 'Regla actualizada' });
      } else {
        await (supabase as any).from('diagnostic_rules').insert(data);
        toast({ title: 'Éxito', description: 'Regla creada' });
      }

      setShowRuleDialog(false);
      setRuleForm({ id: '', conditions: [], recommended_services: [], confidence_score: 80, priority: 1 });
      loadRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({ title: 'Error', description: 'Error al guardar regla', variant: 'destructive' });
    }
  };

  const deleteProblem = async (id: string) => {
    try {
      await (supabase as any).from('problems').update({ is_active: false }).eq('id', id);
      toast({ title: 'Éxito', description: 'Problema desactivado' });
      loadData();
    } catch (error) {
      console.error('Error deleting problem:', error);
      toast({ title: 'Error', description: 'Error al eliminar problema', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestión de Problemas y Soluciones</h2>
        <Dialog open={showProblemDialog} onOpenChange={setShowProblemDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => setProblemForm({ id: '', name: '', description: '', category_id: '' })}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Problema
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {problemForm.id ? 'Editar Problema' : 'Nuevo Problema'}
              </DialogTitle>
              {problemForm.id && (
                <p className="text-sm text-muted-foreground">
                  Modifica el nombre y descripción del problema. Los cambios se aplicarán a todas las configuraciones existentes.
                </p>
              )}
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre del problema</Label>
                <Input
                  value={problemForm.name}
                  onChange={(e) => setProblemForm({ ...problemForm, name: e.target.value })}
                  placeholder="Ej: Computadora no enciende"
                />
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={problemForm.description}
                  onChange={(e) => setProblemForm({ ...problemForm, description: e.target.value })}
                  placeholder="Descripción detallada del problema"
                />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={problemForm.category_id} onValueChange={(value) => setProblemForm({ ...problemForm, category_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveProblem} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </Button>
                <Button variant="outline" onClick={() => setShowProblemDialog(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de problemas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Problemas ({problems.length})</span>
              <span className="text-sm font-normal text-muted-foreground">
                Haz clic para editar
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-auto">
            {problems.map((problem) => {
              const category = categories.find(cat => cat.id === problem.category_id);
              const IconComponent = getIconComponent(category?.icon || null);
              return (
                <div
                  key={problem.id}
                  className={`group p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedProblemId === problem.id 
                      ? 'border-primary bg-primary/10 shadow-sm' 
                      : 'border-muted hover:border-primary/50 hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedProblemId(problem.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <IconComponent className="h-5 w-5 text-primary flex-shrink-0" />
                        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {problem.name}
                        </h4>
                      </div>
                      {problem.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {problem.description}
                        </p>
                      )}
                      <Badge variant="outline" className="text-xs w-fit">
                        {problem.category_name}
                      </Badge>
                    </div>
                    <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 hover:bg-primary hover:text-primary-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProblemForm({
                            id: problem.id,
                            name: problem.name,
                            description: problem.description || '',
                            category_id: problem.category_id || '',
                          });
                          setShowProblemDialog(true);
                        }}
                        title="Editar nombre y descripción del problema"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => e.stopPropagation()}
                            title="Eliminar problema"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar problema?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción desactivará el problema "{problem.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteProblem(problem.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Configuración del problema seleccionado */}
        <div className="lg:col-span-2">
          {selectedProblemId ? (
            <Tabs defaultValue="questions" className="space-y-4">
              <TabsList>
                <TabsTrigger value="questions">Preguntas de Diagnóstico</TabsTrigger>
                <TabsTrigger value="rules">Reglas de Solución</TabsTrigger>
              </TabsList>

              <TabsContent value="questions" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Preguntas de Diagnóstico</h3>
                  <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={() => setQuestionForm({ id: '', question_text: '', question_order: questions.length + 1 })}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Pregunta
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {questionForm.id ? 'Editar Pregunta' : 'Nueva Pregunta'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Texto de la pregunta</Label>
                          <Textarea
                            value={questionForm.question_text}
                            onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                            placeholder="Ej: ¿La computadora muestra alguna luz al conectarla?"
                          />
                        </div>
                        <div>
                          <Label>Orden</Label>
                          <Input
                            type="number"
                            value={questionForm.question_order}
                            onChange={(e) => setQuestionForm({ ...questionForm, question_order: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={saveQuestion} className="flex-1">
                            <Save className="h-4 w-4 mr-2" />
                            Guardar
                          </Button>
                          <Button variant="outline" onClick={() => setShowQuestionDialog(false)}>
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2">
                  {questions.map((question) => (
                    <div key={question.id} className="p-3 border rounded">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium">#{question.question_order}</p>
                          <p>{question.question_text}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setQuestionForm({
                              id: question.id,
                              question_text: question.question_text,
                              question_order: question.question_order,
                            });
                            setShowQuestionDialog(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {questions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay preguntas configuradas. Agrega la primera pregunta.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="rules" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Reglas de Solución</h3>
                  <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={() => setRuleForm({ id: '', conditions: [], recommended_services: [], confidence_score: 80, priority: rules.length + 1 })}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Regla
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>
                          {ruleForm.id ? 'Editar Regla' : 'Nueva Regla de Solución'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Servicios recomendados</Label>
                          <div className="space-y-2">
                            {services.map((service) => (
                              <label key={service.id} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={ruleForm.recommended_services.includes(service.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setRuleForm({
                                        ...ruleForm,
                                        recommended_services: [...ruleForm.recommended_services, service.id]
                                      });
                                    } else {
                                      setRuleForm({
                                        ...ruleForm,
                                        recommended_services: ruleForm.recommended_services.filter(id => id !== service.id)
                                      });
                                    }
                                  }}
                                />
                                <span className="text-sm">{service.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Confianza (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={ruleForm.confidence_score}
                              onChange={(e) => setRuleForm({ ...ruleForm, confidence_score: parseInt(e.target.value) || 80 })}
                            />
                          </div>
                          <div>
                            <Label>Prioridad</Label>
                            <Input
                              type="number"
                              min="1"
                              value={ruleForm.priority}
                              onChange={(e) => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={saveRule} className="flex-1">
                            <Save className="h-4 w-4 mr-2" />
                            Guardar
                          </Button>
                          <Button variant="outline" onClick={() => setShowRuleDialog(false)}>
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2">
                  {rules.map((rule) => (
                    <div key={rule.id} className="p-3 border rounded">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium">Prioridad: {rule.priority} | Confianza: {rule.confidence_score}%</p>
                          <p className="text-sm text-muted-foreground">
                            {rule.recommended_services.length} servicio(s) recomendado(s)
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRuleForm({
                              id: rule.id,
                              conditions: rule.conditions,
                              recommended_services: rule.recommended_services,
                              confidence_score: rule.confidence_score,
                              priority: rule.priority,
                            });
                            setShowRuleDialog(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {rules.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay reglas configuradas. Agrega la primera regla.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Selecciona un problema de la lista para configurar sus preguntas de diagnóstico y reglas de solución.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}