import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, Save, X, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DiagnosticFlowEditor } from './DiagnosticFlowEditor';

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
  is_active: boolean;
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

export function DiagnosticFlowManager() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [flows, setFlows] = useState<DiagnosticFlow[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [editingFlow, setEditingFlow] = useState<DiagnosticFlow | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
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
          next_steps: {}
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
        title: 'Flujo creado',
        description: 'El flujo de diagnóstico ha sido creado exitosamente.',
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
    if (!confirm('¿Estás seguro de eliminar este flujo de diagnóstico?')) return;

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
        title: 'Flujo eliminado',
        description: 'El flujo ha sido desactivado.',
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
          <CardTitle>Gestionar Flujos de Diagnóstico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Seleccionar Categoría</Label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.icon && <span className="mr-2">{category.icon}</span>}
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCategoryId && (
            <div className="space-y-4 border-t pt-4">
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
                Crear Nuevo Flujo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCategoryId && flows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => (
            <Card key={flow.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{flow.problem_title}</CardTitle>
                    {flow.description && (
                      <p className="text-sm text-muted-foreground mt-1">{flow.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {flow.flow_data.steps.length} pasos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Soluciones:</span> {flow.flow_data.solutions.length}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleConfigureFlow(flow)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configurar
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
      )}

      {selectedCategoryId && flows.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No hay flujos de diagnóstico para esta categoría. Crea uno nuevo arriba.
            </p>
          </CardContent>
        </Card>
      )}

      <DiagnosticFlowEditor
        flow={editingFlow}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingFlow(null);
        }}
        onSave={handleEditorSave}
      />
    </div>
  );
}