/**
 * COMPONENTE: OrderAcceptancePanel
 * 
 * PROPÓSITO:
 * - Mostrar sugerencias de técnicos para órdenes pendientes
 * - Permitir al administrador aceptar la orden y asignar el técnico seleccionado
 * - Reemplaza la asignación automática con un proceso manual controlado
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Star, 
  Clock, 
  Briefcase, 
  CheckCircle, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TechnicianSuggestion {
  technician_id: string;
  full_name: string;
  current_workload: number;
  skill_level: number;
  years_experience: number;
  score: number;
  suggestion_reason: string;
}

interface OrderAcceptancePanelProps {
  orderId: string;
  serviceTypeId: string;
  deliveryDate?: string;
  onOrderAccepted: () => void;
  className?: string;
}

export function OrderAcceptancePanel({
  orderId,
  serviceTypeId,
  deliveryDate,
  onOrderAccepted,
  className = ""
}: OrderAcceptancePanelProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<TechnicianSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<string>('');

  useEffect(() => {
    loadTechnicianSuggestions();
  }, [serviceTypeId, deliveryDate]);

  const loadTechnicianSuggestions = async () => {
    if (!serviceTypeId) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .rpc('suggest_optimal_technician', {
          p_service_type_id: serviceTypeId,
          p_delivery_date: deliveryDate || null
        });

      if (error) {
        console.error('Error getting technician suggestions:', error);
        throw error;
      }

      const sortedSuggestions = (data || []).sort((a, b) => b.score - a.score);
      setSuggestions(sortedSuggestions);

      // Pre-seleccionar el mejor técnico
      if (sortedSuggestions.length > 0) {
        const bestTechnician = sortedSuggestions[0];
        setSelectedTechnicianId(bestTechnician.technician_id);
        setSelectedReason(bestTechnician.suggestion_reason);
      }

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

  const handleAcceptOrder = async () => {
    if (!selectedTechnicianId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un técnico antes de aceptar la orden",
        variant: "destructive"
      });
      return;
    }

    try {
      setAccepting(true);

      // Actualizar la orden con el técnico asignado
      const { error } = await supabase
        .from('orders')
        .update({
          assigned_technician: selectedTechnicianId,
          assignment_reason: selectedReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Orden aceptada",
        description: "La orden ha sido aceptada y el técnico asignado exitosamente",
      });

      onOrderAccepted();

    } catch (error) {
      console.error('Error accepting order:', error);
      toast({
        title: "Error",
        description: "No se pudo aceptar la orden",
        variant: "destructive"
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleTechnicianSelect = (suggestion: TechnicianSuggestion) => {
    setSelectedTechnicianId(suggestion.technician_id);
    setSelectedReason(suggestion.suggestion_reason);
  };

  const getWorkloadColor = (workload: number) => {
    if (workload === 0) return 'bg-green-100 text-green-800';
    if (workload <= 2) return 'bg-yellow-100 text-yellow-800';
    if (workload <= 4) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getSkillStars = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-4 w-4 ${i < level ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
      />
    ));
  };

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
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No se encontraron técnicos disponibles para este tipo de servicio. 
              Puedes asignar manualmente un técnico o dejar la orden pendiente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

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
        {suggestions.slice(0, 3).map((suggestion, index) => (
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

            <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              <strong>Razón:</strong> {suggestion.suggestion_reason}
            </div>
          </div>
        ))}

        <div className="pt-4 border-t">
          <Button 
            onClick={handleAcceptOrder}
            disabled={!selectedTechnicianId || accepting}
            className="w-full"
            size="lg"
          >
            {accepting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Aceptando orden...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Aceptar Orden y Asignar Técnico
              </>
            )}
          </Button>
        </div>

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