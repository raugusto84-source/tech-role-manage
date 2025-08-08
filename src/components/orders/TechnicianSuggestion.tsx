/**
 * COMPONENTE: TechnicianSuggestion
 * 
 * PROPÓSITO:
 * - Muestra sugerencias automáticas de técnicos basadas en disponibilidad y habilidades
 * - Permite seleccionar el técnico sugerido o elegir manualmente
 * - Explica la razón de cada sugerencia para transparencia en la decisión
 * 
 * LÓGICA DE SUGERENCIA:
 * 1. Consulta la función suggest_optimal_technician() en la base de datos
 * 2. La función evalúa cada técnico considerando:
 *    - Carga de trabajo actual (40% del peso): menos órdenes activas = mejor
 *    - Nivel de habilidad en el servicio (60% del peso): mayor habilidad = mejor
 *    - Años de experiencia (información adicional)
 * 3. Ordena técnicos por puntuación descendente
 * 4. Muestra razón clara de por qué cada técnico es sugerido
 * 
 * REUTILIZACIÓN:
 * - Este componente puede reutilizarse en:
 *   - Formulario de creación de órdenes
 *   - Reasignación de órdenes existentes
 *   - Módulo de planificación de recursos
 *   - Dashboard de administración
 * 
 * PARÁMETROS:
 * - serviceTypeId: ID del tipo de servicio para evaluar habilidades específicas
 * - onTechnicianSelect: Callback cuando se selecciona un técnico
 * - selectedTechnicianId: ID del técnico actualmente seleccionado
 * - deliveryDate: Fecha de entrega (opcional, para futuras mejoras de disponibilidad)
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  User, 
  Star, 
  Clock, 
  Briefcase, 
  CheckCircle, 
  AlertCircle,
  Info,
  RefreshCw
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface TechnicianSuggestion {
  technician_id: string;
  full_name: string;
  current_workload: number;
  skill_level: number;
  years_experience: number;
  score: number;
  suggestion_reason: string;
}

interface TechnicianSuggestionProps {
  serviceTypeId: string;
  onTechnicianSelect: (technicianId: string, reason: string) => void;
  selectedTechnicianId?: string;
  deliveryDate?: string;
  className?: string;
}

export function TechnicianSuggestion({
  serviceTypeId,
  onTechnicianSelect,
  selectedTechnicianId,
  deliveryDate,
  className = ""
}: TechnicianSuggestionProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<TechnicianSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAllTechnicians, setShowAllTechnicians] = useState(false);

  /**
   * FUNCIÓN: loadTechnicianSuggestions
   * 
   * PROPÓSITO:
   * - Consulta la función suggest_optimal_technician() de la base de datos
   * - Obtiene la lista ordenada de técnicos con sus puntuaciones y razones
   * - Maneja errores y estados de carga
   * 
   * PROCESO:
   * 1. Llama a la función RPC con el tipo de servicio y fecha de entrega
   * 2. Ordena resultados por puntuación descendente (mejor técnico primero)
   * 3. Actualiza el estado con las sugerencias obtenidas
   */
  const loadTechnicianSuggestions = async () => {
    if (!serviceTypeId) return;
    
    try {
      setLoading(true);
      
      // Llamar a la función de sugerencia en la base de datos
      const { data, error } = await supabase
        .rpc('suggest_optimal_technician', {
          p_service_type_id: serviceTypeId,
          p_delivery_date: deliveryDate || null
        });

      if (error) {
        console.error('Error getting technician suggestions:', error);
        throw error;
      }

      // Ordenar por puntuación descendente (mejor técnico primero)
      const sortedSuggestions = (data || []).sort((a, b) => b.score - a.score);
      setSuggestions(sortedSuggestions);

    } catch (error) {
      console.error('Error loading technician suggestions:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las sugerencias de técnicos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar sugerencias cuando cambie el tipo de servicio
  useEffect(() => {
    loadTechnicianSuggestions();
  }, [serviceTypeId, deliveryDate]);

  /**
   * FUNCIÓN: getWorkloadColor
   * 
   * PROPÓSITO:
   * - Determina el color del badge según la carga de trabajo
   * - Proporciona feedback visual rápido sobre disponibilidad
   */
  const getWorkloadColor = (workload: number) => {
    if (workload === 0) return 'bg-green-100 text-green-800';
    if (workload <= 2) return 'bg-yellow-100 text-yellow-800';
    if (workload <= 4) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  /**
   * FUNCIÓN: getSkillStars
   * 
   * PROPÓSITO:
   * - Convierte el nivel de habilidad numérico en estrellas visuales
   * - Facilita la interpretación rápida del nivel de competencia
   */
  const getSkillStars = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-4 w-4 ${i < level ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
      />
    ));
  };

  /**
   * FUNCIÓN: handleTechnicianSelect
   * 
   * PROPÓSITO:
   * - Maneja la selección de un técnico
   * - Proporciona feedback al usuario sobre la selección
   * - Envía la razón de la sugerencia al componente padre
   */
  const handleTechnicianSelect = (suggestion: TechnicianSuggestion) => {
    onTechnicianSelect(suggestion.technician_id, suggestion.suggestion_reason);
    toast({
      title: "Técnico seleccionado",
      description: `${suggestion.full_name} ha sido asignado a la orden`,
    });
  };

  // Mostrar estado de carga
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Analizando técnicos disponibles...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground">
              Evaluando disponibilidad y habilidades...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mostrar mensaje si no hay técnicos disponibles
  if (suggestions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Sin técnicos disponibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No se encontraron técnicos disponibles para este tipo de servicio. 
              Puedes asignar manualmente un técnico o crear la orden sin asignación.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Determinar cuántos técnicos mostrar
  const techniciansToShow = showAllTechnicians ? suggestions : suggestions.slice(0, 3);
  const bestSuggestion = suggestions[0];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Sugerencias de Técnicos
        </CardTitle>
        {bestSuggestion && (
          <Alert className="mt-2">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Recomendado:</strong> {bestSuggestion.full_name} - {bestSuggestion.suggestion_reason}
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {techniciansToShow.map((suggestion, index) => (
          <div 
            key={suggestion.technician_id}
            className={`
              p-4 border rounded-lg transition-all cursor-pointer
              ${selectedTechnicianId === suggestion.technician_id 
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }
              ${index === 0 ? 'border-green-200 bg-green-50' : ''}
            `}
            onClick={() => handleTechnicianSelect(suggestion)}
          >
            {/* Header del técnico */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {suggestion.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    {suggestion.full_name}
                    {index === 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Recomendado
                      </Badge>
                    )}
                  </h4>
                  
                  {/* Puntuación y estrellas de habilidad */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      {getSkillStars(suggestion.skill_level)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Puntuación: {suggestion.score.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedTechnicianId === suggestion.technician_id && (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
            </div>

            {/* Métricas del técnico */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <Badge 
                  variant="outline" 
                  className={`${getWorkloadColor(suggestion.current_workload)} border-0`}
                >
                  <Briefcase className="h-3 w-3 mr-1" />
                  {suggestion.current_workload} órdenes
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Carga actual</p>
              </div>

              <div className="text-center">
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-0">
                  <Star className="h-3 w-3 mr-1" />
                  {suggestion.skill_level}/5
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Habilidad</p>
              </div>

              <div className="text-center">
                <Badge variant="outline" className="bg-purple-100 text-purple-800 border-0">
                  <Clock className="h-3 w-3 mr-1" />
                  {suggestion.years_experience} años
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Experiencia</p>
              </div>
            </div>

            {/* Razón de la sugerencia */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              <strong>Razón:</strong> {suggestion.suggestion_reason}
            </div>
          </div>
        ))}

        {/* Botón para mostrar más técnicos */}
        {suggestions.length > 3 && (
          <Button 
            variant="outline" 
            onClick={() => setShowAllTechnicians(!showAllTechnicians)}
            className="w-full"
          >
            {showAllTechnicians 
              ? `Mostrar menos (${suggestions.length - 3} técnicos ocultos)`
              : `Ver todos los técnicos (${suggestions.length - 3} más)`
            }
          </Button>
        )}

        {/* Botón para actualizar sugerencias */}
        <Button 
          variant="ghost" 
          onClick={loadTechnicianSuggestions}
          className="w-full text-muted-foreground"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar sugerencias
        </Button>
      </CardContent>
    </Card>
  );
}