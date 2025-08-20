import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Category {
  id: string;
  name: string;
  icon?: string;
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
  category?: Category;
}

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

interface ClientDiagnosticFlowProps {
  onDiagnosisComplete?: (result: {
    flow_id: string;
    problem_title: string;
    answers: { [key: string]: string };
    recommended_solution: Solution;
  }) => void;
}

export function ClientDiagnosticFlow({ onDiagnosisComplete }: ClientDiagnosticFlowProps) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [flows, setFlows] = useState<DiagnosticFlow[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedFlow, setSelectedFlow] = useState<DiagnosticFlow | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [isCompleted, setIsCompleted] = useState(false);

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

  // Load flows for selected category
  useEffect(() => {
    if (!selectedCategory) {
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
          main_service_categories (id, name, icon)
        `)
        .eq('category_id', selectedCategory)
        .eq('is_active', true)
        .order('problem_title');
      
      setFlows(data?.map(f => ({
        ...f,
        flow_data: (f.flow_data as any) || { steps: [], solutions: [] },
        category: f.main_service_categories as Category
      })) || []);
    };
    loadFlows();
  }, [selectedCategory]);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedFlow(null);
    setCurrentStep(0);
    setAnswers({});
    setIsCompleted(false);
  };

  const handleFlowSelect = (flow: DiagnosticFlow) => {
    setSelectedFlow(flow);
    setCurrentStep(0);
    setAnswers({});
    setIsCompleted(false);
  };

  const handleAnswer = (answer: string) => {
    if (!selectedFlow) return;

    const step = selectedFlow.flow_data.steps[currentStep];
    const newAnswers = { ...answers, [step.id]: answer };
    setAnswers(newAnswers);

    // Check if we have more steps
    if (currentStep < selectedFlow.flow_data.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete diagnosis
      completeDiagnosis(newAnswers);
    }
  };

  const completeDiagnosis = (finalAnswers: { [key: string]: string }) => {
    if (!selectedFlow) return;

    // For now, return the first solution (could be enhanced with logic)
    const solution = selectedFlow.flow_data.solutions[0] || {
      id: 'default',
      title: 'Diagnóstico requerido',
      description: 'Se necesita evaluación técnica para determinar la solución',
      recommended_services: [],
      confidence_score: 70
    };

    setIsCompleted(true);

    if (onDiagnosisComplete) {
      onDiagnosisComplete({
        flow_id: selectedFlow.id,
        problem_title: selectedFlow.problem_title,
        answers: finalAnswers,
        recommended_solution: solution
      });
    }

    toast({
      title: 'Diagnóstico completado',
      description: 'Hemos identificado una posible solución para tu problema.',
    });
  };

  const handleRestart = () => {
    setSelectedFlow(null);
    setCurrentStep(0);
    setAnswers({});
    setIsCompleted(false);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Category selection view
  if (!selectedCategory) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>¿Qué tipo de problema tienes?</CardTitle>
          <p className="text-muted-foreground">
            Selecciona la categoría que mejor describe tu problema
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant="outline"
                className="h-auto p-6 flex flex-col items-center gap-3"
                onClick={() => handleCategorySelect(category.id)}
              >
                <div className="text-3xl">
                  {category.icon || '🔧'}
                </div>
                <span className="font-medium">{category.name}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Flow selection view
  if (!selectedFlow) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Selecciona tu problema específico</CardTitle>
              <p className="text-muted-foreground">
                {categories.find(c => c.id === selectedCategory)?.name}
              </p>
            </div>
            <Button variant="outline" onClick={() => setSelectedCategory('')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {flows.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No hay diagnósticos disponibles para esta categoría.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {flows.map((flow) => (
                <Button
                  key={flow.id}
                  variant="outline"
                  className="w-full h-auto p-4 justify-start"
                  onClick={() => handleFlowSelect(flow)}
                >
                  <div className="text-left">
                    <div className="font-medium">{flow.problem_title}</div>
                    {flow.description && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {flow.description}
                      </div>
                    )}
                    <Badge variant="secondary" className="mt-2">
                      {flow.flow_data.steps.length} preguntas
                    </Badge>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Completed diagnosis view
  if (isCompleted) {
    const solution = selectedFlow.flow_data.solutions[0];
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <CardTitle>Diagnóstico Completado</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium text-lg">{solution?.title}</h3>
            <p className="text-muted-foreground mt-1">{solution?.description}</p>
          </div>
          
          {solution?.confidence_score && (
            <div>
              <Badge variant="outline">
                Confianza: {solution.confidence_score}%
              </Badge>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleRestart} variant="outline">
              Nuevo Diagnóstico
            </Button>
            <Button onClick={() => window.location.href = '/quotes'}>
              Solicitar Cotización
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Diagnostic step view
  const step = selectedFlow.flow_data.steps[currentStep];
  if (!step) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{selectedFlow.problem_title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pregunta {currentStep + 1} de {selectedFlow.flow_data.steps.length}
            </p>
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRestart}>
              Reiniciar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-4">{step.question}</h3>
          
          {step.image_url && (
            <div className="mb-4">
              <img 
                src={step.image_url} 
                alt="Imagen de ayuda" 
                className="max-w-md max-h-60 rounded-lg object-cover border mx-auto"
              />
            </div>
          )}

          <div className="space-y-2">
            {step.type === 'yes_no' ? (
              <div className="flex gap-3">
                <Button 
                  className="flex-1" 
                  onClick={() => handleAnswer('Sí')}
                >
                  Sí
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => handleAnswer('No')}
                >
                  No
                </Button>
              </div>
            ) : step.type === 'multiple_choice' && step.options ? (
              <div className="space-y-2">
                {step.options.map((option, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleAnswer(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  className="w-full p-3 border rounded-md resize-none"
                  rows={3}
                  placeholder="Describe tu respuesta..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const value = (e.target as HTMLTextAreaElement).value.trim();
                      if (value) handleAnswer(value);
                    }
                  }}
                />
                <Button 
                  onClick={() => {
                    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                    const value = textarea?.value.trim();
                    if (value) handleAnswer(value);
                  }}
                >
                  Continuar
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}