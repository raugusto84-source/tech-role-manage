import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, Save, X, Settings, ArrowRight, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface DiagnosticStep {
  id: string;
  question: string;
  type: 'yes_no' | 'multiple_choice' | 'text';
  options?: string[];
  next_step_yes?: string;
  next_step_no?: string;
  next_steps?: { [key: string]: string };
  solution_mapping?: { [key: string]: string }; // mapea respuesta a solution_id
  next_step_mapping?: { [key: string]: string }; // mapea respuesta a step_id
  image_url?: string;
}

interface Solution {
  id: string;
  title: string;
  description: string;
  recommended_services: string[];
  confidence_score: number;
}

interface DiagnosticFlow {
  id: string;
  category_id: string;
  problem_title: string;
  description?: string;
  flow_data: {
    steps: DiagnosticStep[];
    solutions: Solution[];
  };
  is_active: boolean;
  category?: Category;
}

export function UnifiedDiagnosticManager() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [flows, setFlows] = useState<DiagnosticFlow[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [editingFlow, setEditingFlow] = useState<DiagnosticFlow | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [newFlow, setNewFlow] = useState({
    problem_title: '',
    description: '',
    category_id: ''
  });
  const [loading, setLoading] = useState(false);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from('main_service_categories')
        .select('id, name, icon')
        .eq('is_active', true)
        .order('name');
      setCategories(data || []);
    };
    loadCategories();
  }, []);

  // Load service types
  useEffect(() => {
    const loadServiceTypes = async () => {
      const { data } = await supabase
        .from('service_types')
        .select('id, name, category')
        .eq('is_active', true)
        .order('name');
      setServiceTypes(data || []);
    };
    loadServiceTypes();
  }, []);

  // Load flows for selected category
  useEffect(() => {
    if (!selectedCategoryId) {
      setFlows([]);
      return;
    }

    const loadFlows = async () => {
      const { data } = await supabase
        .from('diagnostic_flow')
        .select(`
          id,
          category_id,
          problem_title,
          description,
          flow_data,
          is_active,
          main_service_categories (id, name, icon)
        `)
        .eq('category_id', selectedCategoryId)
        .eq('is_active', true)
        .order('problem_title');
      
      setFlows(data?.map(f => ({
        ...f,
        flow_data: (f.flow_data as any) || { steps: [], solutions: [] },
        category: f.main_service_categories as Category
      })) || []);
    };
    loadFlows();
  }, [selectedCategoryId]);

  const handleCreateFlow = async () => {
    if (!newFlow.problem_title.trim() || !selectedCategoryId) {
      toast({
        title: 'Error',
        description: 'Selecciona una categoría y escribe el título del problema.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    const defaultFlowData = {
        steps: [
          {
            id: 'step-1',
            question: '¿Cuál es el síntoma principal que presenta?',
            type: 'multiple_choice' as const,
            options: ['No enciende', 'Va lento', 'Se congela', 'Virus', 'Otro'],
            next_steps: {},
            solution_mapping: {},
            next_step_mapping: {}
          }
        ],
      solutions: [
        {
          id: 'solution-1',
          title: 'Diagnóstico inicial requerido',
          description: 'Se necesita evaluación técnica presencial',
          recommended_services: [],
          confidence_score: 80
        }
      ]
    };

    const { error } = await supabase
      .from('diagnostic_flow')
      .insert({
        category_id: selectedCategoryId,
        problem_title: newFlow.problem_title.trim(),
        description: newFlow.description.trim() || null,
        flow_data: defaultFlowData
      });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Problema creado',
        description: 'El problema y su flujo de diagnóstico han sido creados exitosamente.',
      });
      setNewFlow({ problem_title: '', description: '', category_id: '' });
      
      // Reload flows
      const { data } = await supabase
        .from('diagnostic_flow')
        .select(`
          id,
          category_id,
          problem_title,
          description,
          flow_data,
          is_active,
          main_service_categories (id, name, icon)
        `)
        .eq('category_id', selectedCategoryId)
        .eq('is_active', true)
        .order('problem_title');
      
      setFlows(data?.map(f => ({
        ...f,
        flow_data: (f.flow_data as any) || { steps: [], solutions: [] },
        category: f.main_service_categories as Category
      })) || []);
    }
    setLoading(false);
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('¿Estás seguro de eliminar este problema y su flujo de diagnóstico?')) return;

    setLoading(true);
    const { error } = await supabase
      .from('diagnostic_flow')
      .update({ is_active: false })
      .eq('id', flowId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Problema eliminado',
        description: 'El problema ha sido desactivado.',
      });
      setFlows(prev => prev.filter(f => f.id !== flowId));
    }
    setLoading(false);
  };

  const handleConfigureFlow = (flow: DiagnosticFlow) => {
    setEditingFlow(flow);
    setIsEditorOpen(true);
  };

  const handleEditorSave = () => {
    // Reload flows after saving
    if (selectedCategoryId) {
      const loadFlows = async () => {
        const { data } = await supabase
          .from('diagnostic_flow')
          .select(`
            id,
            category_id,
            problem_title,
            description,
            flow_data,
            is_active,
            main_service_categories (id, name, icon)
          `)
          .eq('category_id', selectedCategoryId)
          .eq('is_active', true)
          .order('problem_title');
        
        setFlows(data?.map(f => ({
          ...f,
          flow_data: (f.flow_data as any) || { steps: [], solutions: [] },
          category: f.main_service_categories as Category
        })) || []);
      };
      loadFlows();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Problemas y Diagnósticos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Crea problemas por categoría y configura diagramas de diagnóstico con soluciones automáticas
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Selection */}
          <div>
            <Label>Seleccionar Categoría</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategoryId === category.id ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  <div className="text-2xl">
                    {category.icon || '🔧'}
                  </div>
                  <span className="text-sm text-center">{category.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Create New Problem */}
          {selectedCategoryId && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Crear Nuevo Problema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Título del Problema</Label>
                  <Input
                    placeholder="Ej: Computadora lenta"
                    value={newFlow.problem_title}
                    onChange={(e) => setNewFlow(prev => ({ ...prev, problem_title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Descripción (Opcional)</Label>
                  <Input
                    placeholder="Descripción breve del problema"
                    value={newFlow.description}
                    onChange={(e) => setNewFlow(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
              
              <Button onClick={handleCreateFlow} disabled={loading} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Crear Problema con Diagrama
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Problems List */}
      {selectedCategoryId && flows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Problemas de {categories.find(c => c.id === selectedCategoryId)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {flows.map((flow) => (
                <Card key={flow.id} className="relative border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{flow.problem_title}</CardTitle>
                        {flow.description && (
                          <p className="text-sm text-muted-foreground mt-1">{flow.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="text-xs">
                          {flow.flow_data.steps.length} pasos
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {flow.flow_data.solutions.length} soluciones
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Preview of first solution */}
                      {flow.flow_data.solutions.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Solución principal:</span><br />
                          {flow.flow_data.solutions[0].title}
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handleConfigureFlow(flow)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Configurar Diagrama
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteFlow(flow.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCategoryId && flows.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No hay problemas para esta categoría. Crea uno nuevo arriba.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Visual Flow Editor Dialog */}
      <VisualFlowEditor
        flow={editingFlow}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingFlow(null);
        }}
        onSave={handleEditorSave}
        serviceTypes={serviceTypes}
      />
    </div>
  );
}

// Visual Flow Editor Component
interface VisualFlowEditorProps {
  flow: DiagnosticFlow | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  serviceTypes: any[];
}

function VisualFlowEditor({ flow, isOpen, onClose, onSave, serviceTypes }: VisualFlowEditorProps) {
  const { toast } = useToast();
  const [editingFlow, setEditingFlow] = useState<DiagnosticFlow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (flow) {
      setEditingFlow({ ...flow });
    }
  }, [flow]);

  const addStep = () => {
    if (!editingFlow) return;
    
    const newStep: DiagnosticStep = {
      id: `step-${Date.now()}`,
      question: '',
      type: 'multiple_choice',
      options: ['Opción 1', 'Opción 2'],
      next_steps: {},
      solution_mapping: {},
      next_step_mapping: {}
    };

    setEditingFlow({
      ...editingFlow,
      flow_data: {
        ...editingFlow.flow_data,
        steps: [...editingFlow.flow_data.steps, newStep]
      }
    });
  };

  const updateStep = (stepId: string, updates: Partial<DiagnosticStep>) => {
    if (!editingFlow) return;

    setEditingFlow({
      ...editingFlow,
      flow_data: {
        ...editingFlow.flow_data,
        steps: editingFlow.flow_data.steps.map(step =>
          step.id === stepId ? { ...step, ...updates } : step
        )
      }
    });
  };

  const removeStep = (stepId: string) => {
    if (!editingFlow) return;

    setEditingFlow({
      ...editingFlow,
      flow_data: {
        ...editingFlow.flow_data,
        steps: editingFlow.flow_data.steps.filter(step => step.id !== stepId)
      }
    });
  };

  const addSolution = () => {
    if (!editingFlow) return;
    
    const newSolution: Solution = {
      id: `solution-${Date.now()}`,
      title: '',
      description: '',
      recommended_services: [],
      confidence_score: 80
    };

    setEditingFlow({
      ...editingFlow,
      flow_data: {
        ...editingFlow.flow_data,
        solutions: [...editingFlow.flow_data.solutions, newSolution]
      }
    });
  };

  const updateSolution = (solutionId: string, updates: Partial<Solution>) => {
    if (!editingFlow) return;

    setEditingFlow({
      ...editingFlow,
      flow_data: {
        ...editingFlow.flow_data,
        solutions: editingFlow.flow_data.solutions.map(solution =>
          solution.id === solutionId ? { ...solution, ...updates } : solution
        )
      }
    });
  };

  const removeSolution = (solutionId: string) => {
    if (!editingFlow) return;

    setEditingFlow({
      ...editingFlow,
      flow_data: {
        ...editingFlow.flow_data,
        solutions: editingFlow.flow_data.solutions.filter(solution => solution.id !== solutionId)
      }
    });
  };

  const handleSave = async () => {
    if (!editingFlow) return;

    setLoading(true);
    const { error } = await supabase
      .from('diagnostic_flow')
      .update({
        flow_data: editingFlow.flow_data as any
      })
      .eq('id', editingFlow.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Guardado exitoso',
        description: 'El diagrama de flujo ha sido actualizado.',
      });
      onSave();
      onClose();
    }
    setLoading(false);
  };

  if (!editingFlow) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Diagrama: {editingFlow.problem_title}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Steps Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Preguntas del Diagnóstico</CardTitle>
                <Button onClick={addStep} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[400px] overflow-y-auto">
              {editingFlow.flow_data.steps.map((step, index) => (
                <Card key={step.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Pregunta {index + 1}</Badge>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => removeStep(step.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Pregunta</Label>
                      <Input
                        value={step.question}
                        onChange={(e) => updateStep(step.id, { question: e.target.value })}
                        placeholder="¿Cuál es el problema?"
                        className="text-sm"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select 
                        value={step.type} 
                        onValueChange={(value: 'yes_no' | 'multiple_choice' | 'text') => 
                          updateStep(step.id, { type: value })
                        }
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes_no">Sí/No</SelectItem>
                          <SelectItem value="multiple_choice">Opción Múltiple</SelectItem>
                          <SelectItem value="text">Texto Libre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {step.type === 'multiple_choice' && (
                      <div>
                        <Label className="text-xs">Opciones</Label>
                        <Textarea
                          value={step.options?.join('\n') || ''}
                          onChange={(e) => updateStep(step.id, { 
                            options: e.target.value.split('\n').filter(opt => opt.trim()) 
                          })}
                          placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                          className="text-sm"
                          rows={3}
                        />
                      </div>
                      )}

                      {/* Solution Mapping */}
                      <div>
                        <Label className="text-xs">Mapeo de Respuestas</Label>
                        <div className="space-y-3">
                          {step.type === 'yes_no' ? (
                            <div className="space-y-2">
                              <div className="text-xs font-medium">Respuesta: Sí</div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Ir a pregunta:</Label>
                                  <Select 
                                    value={step.next_step_mapping?.['Sí'] || ''} 
                                    onValueChange={(stepId) => updateStep(step.id, {
                                      next_step_mapping: { ...step.next_step_mapping, 'Sí': stepId }
                                    })}
                                  >
                                    <SelectTrigger className="text-xs">
                                      <SelectValue placeholder="Siguiente pregunta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {editingFlow?.flow_data.steps
                                        .filter(s => s.id !== step.id)
                                        .map((otherStep) => (
                                        <SelectItem key={otherStep.id} value={otherStep.id}>
                                          {otherStep.question || `Pregunta ${otherStep.id}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">O ir a solución:</Label>
                                  <Select 
                                    value={step.solution_mapping?.['Sí'] || ''} 
                                    onValueChange={(solutionId) => updateStep(step.id, {
                                      solution_mapping: { ...step.solution_mapping, 'Sí': solutionId }
                                    })}
                                  >
                                    <SelectTrigger className="text-xs">
                                      <SelectValue placeholder="Solución final" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {editingFlow?.flow_data.solutions.map((solution) => (
                                        <SelectItem key={solution.id} value={solution.id}>
                                          {solution.title || `Solución ${solution.id}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              
                              <div className="text-xs font-medium">Respuesta: No</div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Ir a pregunta:</Label>
                                  <Select 
                                    value={step.next_step_mapping?.['No'] || ''} 
                                    onValueChange={(stepId) => updateStep(step.id, {
                                      next_step_mapping: { ...step.next_step_mapping, 'No': stepId }
                                    })}
                                  >
                                    <SelectTrigger className="text-xs">
                                      <SelectValue placeholder="Siguiente pregunta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {editingFlow?.flow_data.steps
                                        .filter(s => s.id !== step.id)
                                        .map((otherStep) => (
                                        <SelectItem key={otherStep.id} value={otherStep.id}>
                                          {otherStep.question || `Pregunta ${otherStep.id}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">O ir a solución:</Label>
                                  <Select 
                                    value={step.solution_mapping?.['No'] || ''} 
                                    onValueChange={(solutionId) => updateStep(step.id, {
                                      solution_mapping: { ...step.solution_mapping, 'No': solutionId }
                                    })}
                                  >
                                    <SelectTrigger className="text-xs">
                                      <SelectValue placeholder="Solución final" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {editingFlow?.flow_data.solutions.map((solution) => (
                                        <SelectItem key={solution.id} value={solution.id}>
                                          {solution.title || `Solución ${solution.id}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          ) : step.type === 'multiple_choice' && step.options ? (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {step.options.map((option) => (
                                <div key={option} className="border-b pb-2">
                                  <div className="text-xs font-medium mb-1">{option}:</div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Select 
                                        value={step.next_step_mapping?.[option] || ''} 
                                        onValueChange={(stepId) => updateStep(step.id, {
                                          next_step_mapping: { ...step.next_step_mapping, [option]: stepId }
                                        })}
                                      >
                                        <SelectTrigger className="text-xs">
                                          <SelectValue placeholder="→ Pregunta" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {editingFlow?.flow_data.steps
                                            .filter(s => s.id !== step.id)
                                            .map((otherStep) => (
                                            <SelectItem key={otherStep.id} value={otherStep.id}>
                                              {otherStep.question || `Pregunta ${otherStep.id}`}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Select 
                                        value={step.solution_mapping?.[option] || ''} 
                                        onValueChange={(solutionId) => updateStep(step.id, {
                                          solution_mapping: { ...step.solution_mapping, [option]: solutionId }
                                        })}
                                      >
                                        <SelectTrigger className="text-xs">
                                          <SelectValue placeholder="✓ Solución" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {editingFlow?.flow_data.solutions.map((solution) => (
                                            <SelectItem key={solution.id} value={solution.id}>
                                              {solution.title || `Solución ${solution.id}`}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Para preguntas de texto libre, se utilizará la primera solución por defecto
                            </div>
                          )}
                        </div>
                      </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Solutions Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Soluciones Automáticas</CardTitle>
                <Button onClick={addSolution} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[400px] overflow-y-auto">
              {editingFlow.flow_data.solutions.map((solution, index) => (
                <Card key={solution.id} className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Solución {index + 1}</Badge>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => removeSolution(solution.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Título</Label>
                      <Input
                        value={solution.title}
                        onChange={(e) => updateSolution(solution.id, { title: e.target.value })}
                        placeholder="Nombre de la solución"
                        className="text-sm"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs">Descripción</Label>
                      <Textarea
                        value={solution.description}
                        onChange={(e) => updateSolution(solution.id, { description: e.target.value })}
                        placeholder="Descripción de la solución..."
                        className="text-sm"
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Servicios Recomendados</Label>
                      <Select 
                        onValueChange={(serviceId) => {
                          const currentServices = solution.recommended_services || [];
                          if (!currentServices.includes(serviceId)) {
                            updateSolution(solution.id, { 
                              recommended_services: [...currentServices, serviceId] 
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Agregar servicio" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceTypes.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {solution.recommended_services.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {solution.recommended_services.map((serviceId) => {
                            const service = serviceTypes.find(s => s.id === serviceId);
                            return service ? (
                              <Badge key={serviceId} variant="outline" className="text-[10px] px-1 py-0">
                                {service.name}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-auto p-0 ml-1"
                                  onClick={() => updateSolution(solution.id, {
                                    recommended_services: solution.recommended_services.filter(id => id !== serviceId)
                                  })}
                                >
                                  <X className="h-2 w-2" />
                                </Button>
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="text-xs">Confianza (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={solution.confidence_score}
                        onChange={(e) => updateSolution(solution.id, { 
                          confidence_score: parseInt(e.target.value) || 0 
                        })}
                        className="text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-1" />
            {loading ? 'Guardando...' : 'Guardar Diagrama'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}