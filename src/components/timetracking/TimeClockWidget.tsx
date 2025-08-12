import { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatHoursAndMinutes } from '@/utils/timeUtils';

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

/**
 * Widget para registro de entrada y salida con geolocalización
 * Muestra el estado actual y permite registrar check-in/check-out
 */
export function TimeClockWidget() {
  const { user } = useAuth();
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Actualizar reloj cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Cargar registro actual del día
  useEffect(() => {
    if (user) {
      loadTodayRecord();
    }
  }, [user]);

  const loadTodayRecord = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('employee_id', user.id)
        .eq('work_date', today)
        .maybeSingle();

      if (error) throw error;
      setCurrentRecord(data);
    } catch (error) {
      console.error('Error loading today record:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el registro del día",
        variant: "destructive"
      });
    }
  };

  const getCurrentLocation = (): Promise<Location> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          // Opcional: obtener dirección usando reverse geocoding
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${location.lng},${location.lat}.json?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw&limit=1`
            );
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              location.address = data.features[0].place_name;
            }
          } catch (geocodeError) {
            console.warn('Error obteniendo dirección:', geocodeError);
          }

          resolve(location);
        },
        (error) => {
          reject(new Error(`Error de geolocalización: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutos
        }
      );
    });
  };

  const handleCheckIn = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);

      const { data, error } = await supabase
        .from('time_records')
        .insert({
          employee_id: user.id,
          check_in_time: new Date().toISOString(),
          check_in_location: currentLocation as any,
          work_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentRecord(data);
      toast({
        title: "Entrada registrada",
        description: `Registrado a las ${currentTime.toLocaleTimeString()}`,
      });
    } catch (error: any) {
      console.error('Error en check-in:', error);
      toast({
        title: "Error al registrar entrada",
        description: error.message || "No se pudo registrar la entrada",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || !currentRecord) return;

    setLoading(true);
    try {
      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);

      const { data, error } = await supabase
        .from('time_records')
        .update({
          check_out_time: new Date().toISOString(),
          check_out_location: currentLocation as any
        })
        .eq('id', currentRecord.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentRecord(data);
      toast({
        title: "Salida registrada",
        description: `Registrado a las ${currentTime.toLocaleTimeString()}`,
      });
    } catch (error: any) {
      console.error('Error en check-out:', error);
      toast({
        title: "Error al registrar salida",
        description: error.message || "No se pudo registrar la salida",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '--:--';
    return new Date(timeString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = () => {
    if (!currentRecord) {
      return <Badge variant="outline">Sin registrar</Badge>;
    }
    
    switch (currentRecord.status) {
      case 'checked_in':
        return <Badge variant="default" className="bg-green-500">Presente</Badge>;
      case 'checked_out':
        return <Badge variant="secondary">Finalizado</Badge>;
      default:
        return <Badge variant="outline">Incompleto</Badge>;
    }
  };

  const canCheckIn = !currentRecord || currentRecord.status === 'checked_out';
  const canCheckOut = currentRecord && currentRecord.status === 'checked_in';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Control de Horarios
        </CardTitle>
        <CardDescription>
          Registra tu entrada y salida diaria
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Reloj actual */}
        <div className="text-center">
          <div className="text-3xl font-mono font-bold">
            {currentTime.toLocaleTimeString('es-ES')}
          </div>
          <div className="text-sm text-muted-foreground">
            {currentTime.toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>

        {/* Estado actual */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Estado:</span>
          {getStatusBadge()}
        </div>

        {/* Registro del día */}
        {currentRecord && (
          <div className="space-y-2 p-3 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm">Entrada:</span>
              <span className="font-mono">{formatTime(currentRecord.check_in_time)}</span>
            </div>
            
            {currentRecord.check_out_time && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Salida:</span>
                  <span className="font-mono">{formatTime(currentRecord.check_out_time)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total:</span>
                  <span className="font-mono font-semibold">
                    {currentRecord.total_hours ? formatHoursAndMinutes(currentRecord.total_hours) : '0h 0m'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Botones de acción */}
        <div className="space-y-2">
          {canCheckIn && (
            <Button 
              onClick={handleCheckIn}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <AlertCircle className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Registrar Entrada
            </Button>
          )}

          {canCheckOut && (
            <Button 
              onClick={handleCheckOut}
              disabled={loading}
              variant="outline"
              className="w-full"
              size="lg"
            >
              {loading ? (
                <AlertCircle className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              Registrar Salida
            </Button>
          )}
        </div>

        {/* Ubicación */}
        {location && (
          <div className="text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 inline mr-1" />
            {location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}