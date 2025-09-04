/**
 * COMPONENTE: FleetSuggestion
 * 
 * PROPÓSITO:
 * - Sugiere flotillas óptimas basadas en servicios, habilidades y disponibilidad
 * - Reemplaza la asignación individual de técnicos por asignación por flotillas
 * - Considera las especialidades de cada flotilla y la carga de trabajo
 * 
 * LÓGICA DE SUGERENCIA:
 * 1. Consulta la función suggest_optimal_fleet() en la base de datos
 * 2. Evalúa flotillas considerando:
 *    - Habilidades promedio de técnicos (60% del peso)
 *    - Carga de trabajo total (20% del peso)
 *    - Disponibilidad de técnicos (20% del peso)
 * 3. Filtra por flotillas que manejan el tipo de servicio
 * 4. Muestra razón clara de por qué cada flotilla es sugerida
 * 
 * VENTAJAS:
 * - Distribución equitativa de trabajo entre flotillas
 * - Asignación basada en especialización
 * - Mejor planificación de recursos
 * - Transparencia en la toma de decisiones
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Star, 
  Briefcase, 
  CheckCircle, 
  AlertCircle,
  Info,
  RefreshCw,
  Truck
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface FleetSuggestion {
  fleet_group_id: string;
  fleet_name: string;
  available_technicians: number;
  average_skill_level: number;
  total_workload: number;
  score: number;
  suggestion_reason: string;
}

interface FleetSuggestionProps {
  serviceTypeId: string;
  onFleetSelect: (fleetId: string, fleetName: string, reason: string) => void;
  selectedFleetId?: string;
  deliveryDate?: string;
  className?: string;
}

export function FleetSuggestion({
  serviceTypeId,
  onFleetSelect,
  selectedFleetId,
  deliveryDate,
  className = ""
}: FleetSuggestionProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<FleetSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAllFleets, setShowAllFleets] = useState(false);

  /**
   * FUNCIÓN: loadFleetSuggestions
   * 
   * PROPÓSITO:
   * - Consulta la función suggest_optimal_fleet() de la base de datos
   * - Obtiene la lista ordenada de flotillas con sus puntuaciones y razones
   * - Maneja errores y estados de carga
   */
  const loadFleetSuggestions = async () => {
    if (!serviceTypeId) return;
    
    try {
      setLoading(true);
      
      console.log('Loading fleet suggestions for service:', serviceTypeId);
      
      // Llamar a la función de sugerencia de flotillas
      const { data, error } = await supabase
        .rpc('suggest_optimal_fleet', {
          p_service_type_id: serviceTypeId,
          p_delivery_date: deliveryDate || null
        });

      if (error) {
        console.error('Error getting fleet suggestions:', error);
        throw error;
      }

      console.log('Fleet suggestions received:', data);

      // Ordenar por puntuación descendente (mejor flotilla primero)
      const sortedSuggestions = (data || []).sort((a, b) => b.score - a.score);
      setSuggestions(sortedSuggestions);

      // **SELECCIÓN AUTOMÁTICA**: Asignar automáticamente la mejor flotilla
      if (sortedSuggestions.length > 0 && !selectedFleetId) {
        const bestFleet = sortedSuggestions[0];
        onFleetSelect(bestFleet.fleet_group_id, bestFleet.fleet_name, bestFleet.suggestion_reason);
        
        toast({
          title: "Flotilla asignada automáticamente",
          description: `${bestFleet.fleet_name} - ${bestFleet.suggestion_reason}`,
        });
      }

    } catch (error) {
      console.error('Error loading fleet suggestions:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las sugerencias de flotillas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar sugerencias cuando cambie el tipo de servicio
  useEffect(() => {
    loadFleetSuggestions();
  }, [serviceTypeId, deliveryDate]);

  /**
   * FUNCIÓN: getWorkloadColor
   * 
   * PROPÓSITO:
   * - Determina el color del badge según la carga de trabajo total
   * - Proporciona feedback visual rápido sobre disponibilidad
   */
  const getWorkloadColor = (workload: number) => {
    if (workload === 0) return 'bg-green-100 text-green-800';
    if (workload <= 5) return 'bg-yellow-100 text-yellow-800';
    if (workload <= 10) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  /**
   * FUNCIÓN: getSkillStars
   * 
   * PROPÓSITO:
   * - Convierte el nivel de habilidad promedio en estrellas visuales
   * - Facilita la interpretación rápida del nivel de competencia de la flotilla
   */
  const getSkillStars = (level: number) => {
    const roundedLevel = Math.round(level);
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-4 w-4 ${i < roundedLevel ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
      />
    ));
  };

  /**
   * FUNCIÓN: getAvailabilityColor
   * 
   * PROPÓSITO:
   * - Determina el color según la cantidad de técnicos disponibles
   */
  const getAvailabilityColor = (count: number) => {
    if (count >= 5) return 'bg-green-100 text-green-800';
    if (count >= 3) return 'bg-blue-100 text-blue-800';
    if (count >= 2) return 'bg-yellow-100 text-yellow-800';
    if (count >= 1) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  /**
   * FUNCIÓN: handleFleetSelect
   * 
   * PROPÓSITO:
   * - Maneja la selección de una flotilla
   * - Proporciona feedback al usuario sobre la selección
   * - Envía la razón de la sugerencia al componente padre
   */
  const handleFleetSelect = (suggestion: FleetSuggestion) => {
    onFleetSelect(suggestion.fleet_group_id, suggestion.fleet_name, suggestion.suggestion_reason);
    toast({
      title: "Flotilla seleccionada",
      description: `${suggestion.fleet_name} ha sido asignada a la orden`,
    });
  };

  // Mostrar estado de carga
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Analizando flotillas disponibles...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground">
              Evaluando disponibilidad y especialización...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mostrar mensaje si no hay flotillas disponibles
  if (suggestions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Sin flotillas especializadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No se encontraron flotillas especializadas para este tipo de servicio. 
              Configura las especialidades de las flotillas en el módulo de administración 
              o asigna manualmente un técnico.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Determinar cuántas flotillas mostrar
  const fleetsToShow = showAllFleets ? suggestions : suggestions.slice(0, 3);
  const bestSuggestion = suggestions[0];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Sugerencias de Flotillas
        </CardTitle>
        {bestSuggestion && (
          <Alert className="mt-2">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Recomendada:</strong> {bestSuggestion.fleet_name} - {bestSuggestion.suggestion_reason}
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {fleetsToShow.map((suggestion, index) => (
          <div 
            key={suggestion.fleet_group_id}
            className={`
              p-4 border rounded-lg transition-all cursor-pointer
              ${selectedFleetId === suggestion.fleet_group_id 
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }
              ${index === 0 ? 'border-green-200 bg-green-50' : ''}
            `}
            onClick={() => handleFleetSelect(suggestion)}
          >
            {/* Header de la flotilla */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Truck className="h-6 w-6 text-primary" />
                </div>
                
                <div>
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    {suggestion.fleet_name}
                    {index === 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Recomendada
                      </Badge>
                    )}
                  </h4>
                  
                  {/* Puntuación y estrellas de habilidad promedio */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      {getSkillStars(suggestion.average_skill_level)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Puntuación: {suggestion.score.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedFleetId === suggestion.fleet_group_id && (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
            </div>

            {/* Métricas de la flotilla */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <Badge 
                  variant="outline" 
                  className={`${getAvailabilityColor(suggestion.available_technicians)} border-0`}
                >
                  <Users className="h-3 w-3 mr-1" />
                  {suggestion.available_technicians} técnicos
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Disponibles</p>
              </div>

              <div className="text-center">
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-0">
                  <Star className="h-3 w-3 mr-1" />
                  {suggestion.average_skill_level.toFixed(1)}/5
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Habilidad Prom.</p>
              </div>

              <div className="text-center">
                <Badge 
                  variant="outline" 
                  className={`${getWorkloadColor(suggestion.total_workload)} border-0`}
                >
                  <Briefcase className="h-3 w-3 mr-1" />
                  {suggestion.total_workload} órdenes
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Carga Total</p>
              </div>
            </div>

            {/* Razón de la sugerencia */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              <strong>Razón:</strong> {suggestion.suggestion_reason}
            </div>
          </div>
        ))}

        {/* Botón para mostrar más flotillas */}
        {suggestions.length > 3 && (
          <Button 
            variant="outline" 
            onClick={() => setShowAllFleets(!showAllFleets)}
            className="w-full"
          >
            {showAllFleets 
              ? `Mostrar menos (${suggestions.length - 3} flotillas ocultas)`
              : `Ver todas las flotillas (${suggestions.length - 3} más)`
            }
          </Button>
        )}

        {/* Botón para actualizar sugerencias */}
        <Button 
          variant="ghost" 
          onClick={loadFleetSuggestions}
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