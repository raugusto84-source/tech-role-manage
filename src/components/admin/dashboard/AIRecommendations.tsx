import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Brain, TrendingUp, Users, Wrench, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Recommendation {
  type: 'productivity' | 'training' | 'sales' | 'efficiency';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  impact: string;
}

interface AIRecommendationsProps {
  compact?: boolean;
}

export function AIRecommendations({ compact = false }: AIRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    generateRecommendations();
  }, []);

  const generateRecommendations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-recommendations', {
        body: { type: 'dashboard_overview' }
      });

      if (error) throw error;

      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      
      // Fallback recommendations if AI service fails
      const fallbackRecommendations: Recommendation[] = [
        {
          type: 'productivity',
          priority: 'high',
          title: 'Optimizar Asignación de Tareas',
          description: 'Se detectaron técnicos con tiempo libre mientras hay tareas pendientes.',
          action: 'Implementar asignación automática de tareas',
          impact: 'Incremento del 15% en productividad'
        },
        {
          type: 'training',
          priority: 'medium',
          title: 'Capacitación en Servicios Específicos',
          description: 'Algunos técnicos no pueden atender ciertos servicios por falta de conocimiento.',
          action: 'Programar capacitación técnica especializada',
          impact: 'Mayor versatilidad del equipo'
        },
        {
          type: 'sales',
          priority: 'high',
          title: 'Mejorar Conversión de Cotizaciones',
          description: 'La tasa de conversión está por debajo del objetivo.',
          action: 'Implementar seguimiento proactivo de cotizaciones',
          impact: 'Incremento del 20% en ventas'
        }
      ];
      
      setRecommendations(fallbackRecommendations);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'productivity': return <TrendingUp className="h-4 w-4" />;
      case 'training': return <Users className="h-4 w-4" />;
      case 'sales': return <TrendingUp className="h-4 w-4" />;
      case 'efficiency': return <Wrench className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">IA Recomendaciones</CardTitle>
          <Brain className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{recommendations.length}</div>
          <p className="text-xs text-muted-foreground">
            Sugerencias activas
          </p>
          <div className="mt-2">
            <Badge variant="destructive" className="text-xs">
              {recommendations.filter(r => r.priority === 'high').length} alta prioridad
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Recomendaciones de IA
            </CardTitle>
            <CardDescription>
              Sugerencias automatizadas para mejorar productividad y alcanzar metas
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateRecommendations}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(rec.type)}
                    <h4 className="font-semibold">{rec.title}</h4>
                  </div>
                  <Badge variant={getPriorityColor(rec.priority) as any}>
                    {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Media' : 'Baja'}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground">{rec.description}</p>
                
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-blue-600">Acción:</span>
                    <span className="text-xs">{rec.action}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-green-600">Impacto:</span>
                    <span className="text-xs">{rec.impact}</span>
                  </div>
                </div>
              </div>
            ))}
            
            {recommendations.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay recomendaciones disponibles en este momento</p>
                <p className="text-sm">El sistema está funcionando de manera óptima</p>
              </div>
            )}
            
            {loading && (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-purple-600" />
                <p className="text-muted-foreground">Generando recomendaciones...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Áreas de Mejora Detectadas</CardTitle>
          <CardDescription>Resumen de oportunidades identificadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <h4 className="font-medium">Productividad</h4>
                <p className="text-sm text-muted-foreground">
                  {recommendations.filter(r => r.type === 'productivity').length} recomendaciones
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <h4 className="font-medium">Capacitación</h4>
                <p className="text-sm text-muted-foreground">
                  {recommendations.filter(r => r.type === 'training').length} sugerencias
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div>
                <h4 className="font-medium">Ventas</h4>
                <p className="text-sm text-muted-foreground">
                  {recommendations.filter(r => r.type === 'sales').length} optimizaciones
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Wrench className="h-8 w-8 text-orange-600" />
              <div>
                <h4 className="font-medium">Eficiencia</h4>
                <p className="text-sm text-muted-foreground">
                  {recommendations.filter(r => r.type === 'efficiency').length} mejoras
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}