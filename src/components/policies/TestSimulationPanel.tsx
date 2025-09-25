import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Play, Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface SimulationResult {
  success: boolean;
  days_advanced?: number;
  events_created: number;
  scheduled_services_created: number;
  policy_payments_created: number;
  follow_ups_created: number;
  simulation_date: string;
  details: any[];
  error?: string;
}

export function TestSimulationPanel() {
  const { toast } = useToast();
  const [simulationType, setSimulationType] = useState<'minutes' | 'days'>('minutes');
  const [timeValue, setTimeValue] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<SimulationResult | null>(null);

  const handleSimulation = async () => {
    if (timeValue < 1) {
      toast({
        title: "Error",
        description: "El valor debe ser mayor a 0",
        variant: "destructive"
      });
      return;
    }

    setIsRunning(true);
    setLastResult(null);

    try {
      const payload = simulationType === 'minutes' ? 
        { minutes_to_advance: timeValue, simulate_events: true } :
        { days_to_advance: timeValue, simulate_events: true };

      const { data, error } = await supabase.functions.invoke('simulate-time-advance', {
        body: payload
      });

      if (error) throw error;

      setLastResult(data);
      
      if (data.success && data.events_created > 0) {
        toast({
          title: "Simulación Completada",
          description: `Se crearon ${data.scheduled_services_created} servicios y ${data.policy_payments_created} pagos`
        });
      } else if (data.success) {
        toast({
          title: "Simulación Completada",
          description: "No se encontraron eventos para procesar",
          variant: "default"
        });
      }
    } catch (error: any) {
      console.error('Simulation error:', error);
      toast({
        title: "Error",
        description: "Error durante la simulación: " + (error.message || 'Error desconocido'),
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Simulación de Tiempo
          </CardTitle>
          <CardDescription>
            Prueba los servicios programados y pagos de pólizas avanzando el tiempo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Simulación</Label>
              <Select value={simulationType} onValueChange={(value) => setSimulationType(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutos (para pruebas rápidas)</SelectItem>
                  <SelectItem value="days">Días (simulación normal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="1"
                max={simulationType === 'minutes' ? 1440 : 365}
                value={timeValue}
                onChange={(e) => setTimeValue(parseInt(e.target.value) || 1)}
                placeholder={simulationType === 'minutes' ? '10' : '30'}
              />
            </div>
          </div>

          <Button 
            onClick={handleSimulation} 
            disabled={isRunning}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? 'Ejecutando...' : `Simular ${timeValue} ${simulationType === 'minutes' ? 'minutos' : 'días'}`}
          </Button>

          {lastResult && (
            <div className="space-y-4">
              <Alert className={lastResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                <div className="flex items-center gap-2">
                  {lastResult.success ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  }
                  <AlertDescription>
                    {lastResult.success ? 
                      `Simulación exitosa hasta: ${new Date(lastResult.simulation_date).toLocaleString('es-MX')}` :
                      `Error: ${lastResult.error}`
                    }
                  </AlertDescription>
                </div>
              </Alert>

              {lastResult.success && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{lastResult.scheduled_services_created}</div>
                    <div className="text-sm text-muted-foreground">Servicios Creados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{lastResult.policy_payments_created}</div>
                    <div className="text-sm text-muted-foreground">Pagos Creados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{lastResult.events_created}</div>
                    <div className="text-sm text-muted-foreground">Eventos Totales</div>
                  </div>
                </div>
              )}

              {lastResult.details && lastResult.details.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Detalles de Eventos:</h4>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {lastResult.details.map((event, index) => (
                      <div key={index} className="text-xs bg-muted p-2 rounded">
                        <Badge variant="outline" className="mr-2">{event.type}</Badge>
                        {event.client && <span className="font-medium">{event.client}</span>}
                        {event.service && <span> - {event.service}</span>}
                        {event.amount && <span> - ${event.amount}</span>}
                        {event.next_run && (
                          <div className="text-muted-foreground mt-1">
                            Próxima ejecución: {new Date(event.next_run).toLocaleString('es-MX')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}