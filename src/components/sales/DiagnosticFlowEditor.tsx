import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, ArrowRight, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticStep {
  id: string;
  question: string;
  type: 'yes_no' | 'multiple_choice' | 'text';
  options?: string[];
  next_step_yes?: string;
  next_step_no?: string;
  next_steps?: { [key: string]: string };
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
}

interface DiagnosticFlowEditorProps {
  flow: DiagnosticFlow | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function DiagnosticFlowEditor({ flow, isOpen, onClose, onSave }: DiagnosticFlowEditorProps) {
  const { toast } = useToast();
  const [editingFlow, setEditingFlow] = useState<DiagnosticFlow | null>(null);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (flow) {
      setEditingFlow({ ...flow });
    }
  }, [flow]);

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

  const addStep = () => {
    if (!editingFlow) return;
    
    const newStep: DiagnosticStep = {
      id: `step-${Date.now()}`,
      question: '',
      type: 'multiple_choice',
      options: ['Opción 1', 'Opción 2'],
      next_steps: {}
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
        description: 'El flujo de diagnóstico ha sido actualizado.',
      });
      onSave();
      onClose();
    }
    setLoading(false);
  };

  if (!editingFlow) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Flujo: {editingFlow.problem_title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Steps Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pasos del Diagnóstico</CardTitle>
                <Button onClick={addStep} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar Paso
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingFlow.flow_data.steps.map((step, index) => (
                <Card key={step.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Paso {index + 1}</Badge>
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
                      <Label>Pregunta</Label>
                      <Input
                        value={step.question}
                        onChange={(e) => updateStep(step.id, { question: e.target.value })}
                        placeholder="¿Cuál es el problema que presenta?"
                      />
                    </div>
                    
                    <div>
                      <Label>Tipo de Respuesta</Label>
                      <Select 
                        value={step.type} 
                        onValueChange={(value: 'yes_no' | 'multiple_choice' | 'text') => 
                          updateStep(step.id, { type: value })
                        }
                      >
                        <SelectTrigger>
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
                        <Label>Opciones (una por línea)</Label>
                        <Textarea
                          value={step.options?.join('\n') || ''}
                          onChange={(e) => updateStep(step.id, { 
                            options: e.target.value.split('\n').filter(opt => opt.trim()) 
                          })}
                          placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Solutions Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Soluciones Recomendadas</CardTitle>
                <Button onClick={addSolution} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar Solución
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingFlow.flow_data.solutions.map((solution, index) => (
                <Card key={solution.id} className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
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
                      <Label>Título de la Solución</Label>
                      <Input
                        value={solution.title}
                        onChange={(e) => updateSolution(solution.id, { title: e.target.value })}
                        placeholder="Formateo completo del equipo"
                      />
                    </div>
                    
                    <div>
                      <Label>Descripción</Label>
                      <Textarea
                        value={solution.description}
                        onChange={(e) => updateSolution(solution.id, { description: e.target.value })}
                        placeholder="Descripción detallada de la solución..."
                      />
                    </div>

                    <div>
                      <Label>Servicios Recomendados</Label>
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
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar servicio" />
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
                        <div className="flex flex-wrap gap-2 mt-2">
                          {solution.recommended_services.map((serviceId) => {
                            const service = serviceTypes.find(s => s.id === serviceId);
                            return service ? (
                              <Badge key={serviceId} variant="outline" className="text-xs">
                                {service.name}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-auto p-0 ml-1"
                                  onClick={() => updateSolution(solution.id, {
                                    recommended_services: solution.recommended_services.filter(id => id !== serviceId)
                                  })}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>Nivel de Confianza (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={solution.confidence_score}
                        onChange={(e) => updateSolution(solution.id, { 
                          confidence_score: parseInt(e.target.value) || 0 
                        })}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-1" />
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}