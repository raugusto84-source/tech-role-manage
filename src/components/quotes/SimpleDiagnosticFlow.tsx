import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, ArrowLeft, CheckCircle, Package, Loader2 } from 'lucide-react';
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

interface ServiceType {
  id: string;
  name: string;
  description?: string;
  base_price?: number;
  cost_price?: number;
  profit_margin_tiers?: any;
  unit?: string;
  vat_rate?: number;
  category?: string;
  item_type?: string;
}

// Funciones auxiliares para calcular precios
const isProduct = (service: ServiceType) => {
  const hasTiers = Array.isArray(service.profit_margin_tiers) && service.profit_margin_tiers.length > 0;
  return hasTiers || service.item_type === 'articulo';
};

const marginFromTiers = (service: ServiceType): number =>
  (service.profit_margin_tiers?.[0]?.margin ?? 30);

const getDisplayPrice = (service: ServiceType): number => {
  if (!isProduct(service)) {
    return (service.base_price || 0) * (1 + (service.vat_rate || 0) / 100);
  } else {
    const profitMargin = marginFromTiers(service);
    const priceWithMargin = (service.cost_price || 0) * (1 + profitMargin / 100);
    return priceWithMargin * (1 + (service.vat_rate || 0) / 100);
  }
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

interface SimpleDiagnosticFlowProps {
  onDiagnosisComplete?: (result: {
    flow_id: string;
    problem_title: string;
    answers: { [key: string]: string };
    recommended_solution: Solution;
    recommended_services: ServiceType[];
  }) => void;
}

export function SimpleDiagnosticFlow({ onDiagnosisComplete }: SimpleDiagnosticFlowProps) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [flows, setFlows] = useState<DiagnosticFlow[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedFlow, setSelectedFlow] = useState<DiagnosticFlow | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [recommendedServices, setRecommendedServices] = useState<ServiceType[]>([]);
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

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
    setRecommendedServices([]);
    setSelectedSolution(null);
  };

  const handleFlowSelect = (flow: DiagnosticFlow) => {
    setSelectedFlow(flow);
    setCurrentStep(0);
    setAnswers({});
    setIsCompleted(false);
    setRecommendedServices([]);
    setSelectedSolution(null);
  };

  const handleAnswer = async (answer: string) => {
    if (!selectedFlow || isTransitioning) return;

    // Mostrar respuesta seleccionada
    setSelectedAnswer(answer);
    
    // Iniciar transición visual
    setIsTransitioning(true);
    
    // Breve delay para mostrar el feedback visual
    await new Promise(resolve => setTimeout(resolve, 800));

    const step = selectedFlow.flow_data.steps[currentStep];
    const newAnswers = { ...answers, [step.id]: answer };
    setAnswers(newAnswers);

    // Check if this answer maps to another step first
    if (step.next_step_mapping?.[answer]) {
      const nextStepId = step.next_step_mapping[answer];
      const nextStepIndex = selectedFlow.flow_data.steps.findIndex(s => s.id === nextStepId);
      
      if (nextStepIndex !== -1) {
        // Delay adicional para la transición
        await new Promise(resolve => setTimeout(resolve, 500));
        setCurrentStep(nextStepIndex);
        setIsTransitioning(false);
        setSelectedAnswer(null);
        return;
      }
    }

    // Check if this answer maps to a solution
    if (step.solution_mapping?.[answer]) {
      await completeDiagnosis(newAnswers);
      setIsTransitioning(false);
      setSelectedAnswer(null);
      return;
    }

    // If no specific mapping, continue to next step or complete
    if (currentStep < selectedFlow.flow_data.steps.length - 1) {
      // Delay adicional para la transición
      await new Promise(resolve => setTimeout(resolve, 500));
      setCurrentStep(currentStep + 1);
      setIsTransitioning(false);
      setSelectedAnswer(null);
    } else {
      // Complete diagnosis with default logic
      await completeDiagnosis(newAnswers);
      setIsTransitioning(false);
      setSelectedAnswer(null);
    }
  };

  const completeDiagnosis = async (finalAnswers: { [key: string]: string }) => {
    if (!selectedFlow) return;

    // Encuentra la solución basada en las respuestas y el mapeo
    let selectedSolution: Solution | null = null;
    
    // Recorre las respuestas para encontrar una solución mapeada
    for (const [stepId, answer] of Object.entries(finalAnswers)) {
      const step = selectedFlow.flow_data.steps.find(s => s.id === stepId);
      if (step?.solution_mapping?.[answer]) {
        const solutionId = step.solution_mapping[answer];
        selectedSolution = selectedFlow.flow_data.solutions.find(s => s.id === solutionId) || null;
        if (selectedSolution) break; // Usar la primera solución encontrada
      }
    }

    // Si no se encuentra una solución mapeada, usar la primera disponible
    if (!selectedSolution) {
      selectedSolution = selectedFlow.flow_data.solutions[0] || {
        id: 'default',
        title: 'Diagnóstico requerido',
        description: 'Se necesita evaluación técnica para determinar la solución',
        recommended_services: [],
        confidence_score: 70
      };
    }

    setSelectedSolution(selectedSolution);

    // Load recommended services
    if (selectedSolution.recommended_services.length > 0) {
      const { data: services } = await supabase
        .from('service_types')
        .select('id, name, description, base_price, cost_price, profit_margin_tiers, unit, vat_rate, category, item_type')
        .in('id', selectedSolution.recommended_services)
        .eq('is_active', true);
      
      setRecommendedServices(services || []);
    }

    setIsCompleted(true);

    toast({
      title: 'Diagnóstico completado',
      description: `Solución encontrada: ${selectedSolution.title}`,
    });
  };

  const handleConfirmSolution = () => {
    if (!selectedFlow || !selectedSolution) return;

    if (onDiagnosisComplete) {
      onDiagnosisComplete({
        flow_id: selectedFlow.id,
        problem_title: selectedFlow.problem_title,
        answers,
        recommended_solution: selectedSolution,
        recommended_services: recommendedServices
      });
    }
  };

  const handleRestart = () => {
    setSelectedFlow(null);
    setCurrentStep(0);
    setAnswers({});
    setIsCompleted(false);
    setRecommendedServices([]);
    setSelectedSolution(null);
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
          <CardTitle className="text-center">1. ¿Qué tipo de problema tienes?</CardTitle>
          <p className="text-muted-foreground text-center">
            Selecciona la categoría que mejor describe tu problema
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant="outline"
                className="h-auto p-6 flex flex-col items-center gap-3 hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => handleCategorySelect(category.id)}
              >
                <div className="text-4xl">
                  {category.icon || '🔧'}
                </div>
                <span className="font-medium text-center">{category.name}</span>
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
            <div className="text-center flex-1">
              <CardTitle>2. Selecciona tu problema específico</CardTitle>
              <p className="text-muted-foreground">
                {categories.find(c => c.id === selectedCategory)?.name}
              </p>
            </div>
            <Button variant="outline" onClick={() => setSelectedCategory('')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cambiar Categoría
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {flows.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No hay diagnósticos disponibles para esta categoría.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setSelectedCategory('')}
              >
                Seleccionar otra categoría
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {flows.map((flow) => (
                <Button
                  key={flow.id}
                  variant="outline"
                  className="h-auto p-6 justify-start hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => handleFlowSelect(flow)}
                >
                  <div className="text-left flex-1">
                    <div className="font-medium text-lg">{flow.problem_title}</div>
                    {flow.description && (
                      <div className="text-sm opacity-80 mt-1">
                        {flow.description}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <Badge variant="secondary" className="text-xs">
                        {flow.flow_data.steps.length} preguntas
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {flow.flow_data.solutions.length} soluciones
                      </Badge>
                    </div>
                  </div>
                  <ArrowRight className="h-6 w-6 ml-4" />
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Completed diagnosis view
  if (isCompleted && selectedSolution) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <CardTitle>2. Solución Recomendada</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium text-lg">{selectedSolution.title}</h3>
              <p className="text-muted-foreground mt-1">{selectedSolution.description}</p>
            </div>
            
            {selectedSolution.confidence_score && (
              <div>
                <Badge variant="outline">
                  Confianza: {selectedSolution.confidence_score}%
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommended Services */}
        {recommendedServices.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-blue-500" />
                <CardTitle>3. Servicios Recomendados</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendedServices.map((service) => (
                  <Card key={service.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{service.name}</h4>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {service.description}
                            </p>
                          )}
                          {service.category && (
                            <Badge variant="outline" className="mt-2 text-xs">
                              {service.category}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-bold text-lg">
                            {formatCurrency(getDisplayPrice(service))}
                            {service.unit && (
                              <span className="text-sm text-muted-foreground ml-1">
                                /{service.unit}
                              </span>
                            )}
                          </div>
                          {service.vat_rate && (
                            <div className="text-xs text-muted-foreground">
                              (incluye IVA {service.vat_rate}%)
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>4. Confirma tu Selección</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button onClick={handleRestart} variant="outline" className="flex-1">
                Hacer Nuevo Diagnóstico
              </Button>
              <Button onClick={handleConfirmSolution} className="flex-1">
                Confirmar y Solicitar Cotización
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Diagnostic step view
  const step = selectedFlow.flow_data.steps[currentStep];
  if (!step) return null;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <CardTitle>2. Diagnóstico: {selectedFlow.problem_title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pregunta {currentStep + 1} de {selectedFlow.flow_data.steps.length}
            </p>
            {/* Indicador de progreso visual */}
            <div className="mt-4">
              <Progress 
                value={((currentStep + 1) / selectedFlow.flow_data.steps.length) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Progreso: {Math.round(((currentStep + 1) / selectedFlow.flow_data.steps.length) * 100)}%
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBack} 
                disabled={isTransitioning}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRestart}
              disabled={isTransitioning}
            >
              Reiniciar
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {/* Overlay de transición */}
      {isTransitioning && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">Procesando respuesta...</p>
            {selectedAnswer && (
              <p className="text-sm text-muted-foreground mt-2">
                Respuesta: "{selectedAnswer}"
              </p>
            )}
          </div>
        </div>
      )}
      
      <CardContent 
        className={`space-y-6 transition-all duration-500 ${
          isTransitioning ? 'scale-95 opacity-50' : 'scale-100 opacity-100'
        }`}
      >
        <div>
          <h3 
            className={`text-xl font-medium mb-6 text-center transition-all duration-700 ${
              isTransitioning ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
            }`}
          >
            {step.question}
          </h3>
          
          {step.image_url && (
            <div className="mb-6">
              <img 
                src={step.image_url} 
                alt="Imagen de ayuda" 
                className={`max-w-md max-h-60 rounded-lg object-cover border mx-auto transition-all duration-500 ${
                  isTransitioning ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
                }`}
              />
            </div>
          )}

          <div 
            className={`space-y-3 transition-all duration-500 delay-200 ${
              isTransitioning ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
            }`}
          >
            {step.type === 'yes_no' ? (
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  size="lg"
                  className={`h-16 text-lg transition-all duration-300 transform hover:scale-105 ${
                    selectedAnswer === 'Sí' ? 'bg-green-500 text-white scale-105' : ''
                  }`}
                  onClick={() => handleAnswer('Sí')}
                  disabled={isTransitioning}
                >
                  ✓ Sí
                  {selectedAnswer === 'Sí' && (
                    <CheckCircle className="h-5 w-5 ml-2 animate-pulse" />
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  className={`h-16 text-lg transition-all duration-300 transform hover:scale-105 ${
                    selectedAnswer === 'No' ? 'bg-red-500 text-white scale-105' : ''
                  }`}
                  onClick={() => handleAnswer('No')}
                  disabled={isTransitioning}
                >
                  ✗ No
                  {selectedAnswer === 'No' && (
                    <CheckCircle className="h-5 w-5 ml-2 animate-pulse" />
                  )}
                </Button>
              </div>
            ) : step.type === 'multiple_choice' && step.options ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {step.options.map((option, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="lg"
                    className={`h-16 text-left justify-start transition-all duration-300 transform hover:scale-105 hover:bg-primary hover:text-primary-foreground ${
                      selectedAnswer === option ? 'bg-primary text-primary-foreground scale-105' : ''
                    }`}
                    onClick={() => handleAnswer(option)}
                    disabled={isTransitioning}
                  >
                    <span className="text-lg">{option}</span>
                    {selectedAnswer === option ? (
                      <CheckCircle className="h-5 w-5 ml-auto animate-pulse" />
                    ) : (
                      <ArrowRight className="h-5 w-5 ml-auto" />
                    )}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <textarea
                  className={`w-full p-4 border rounded-lg resize-none text-lg transition-all duration-300 ${
                    isTransitioning ? 'opacity-50' : 'opacity-100'
                  }`}
                  rows={4}
                  placeholder="Describe tu respuesta con detalle..."
                  disabled={isTransitioning}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isTransitioning) {
                      e.preventDefault();
                      const value = (e.target as HTMLTextAreaElement).value.trim();
                      if (value) handleAnswer(value);
                    }
                  }}
                />
                <Button 
                  size="lg"
                  className="w-full transition-all duration-300 transform hover:scale-105"
                  disabled={isTransitioning}
                  onClick={() => {
                    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                    const value = textarea?.value.trim();
                    if (value) handleAnswer(value);
                  }}
                >
                  {isTransitioning ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      Continuar <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}