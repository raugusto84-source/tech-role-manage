import { useState, useEffect, useRef } from 'react';
import { Clock, MapPin, CheckCircle, AlertCircle, Camera } from 'lucide-react';
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
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);

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
      
      // Obtener el registro más reciente del día
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('employee_id', user.id)
        .eq('work_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading today record:', error);
        throw error;
      }
      
      console.log('Loaded today record:', data);
      setCurrentRecord(data);
    } catch (error: any) {
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

          // Obtener dirección real usando API de geocodificación más precisa
          try {
            // Usar API de OpenStreetMap Nominatim (gratuita y sin límites)
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&zoom=18&addressdetails=1`,
              {
                headers: {
                  'User-Agent': 'TimeTrackingApp/1.0'
                }
              }
            );
            const data = await response.json();
            if (data && data.display_name) {
              location.address = data.display_name;
            }
          } catch (geocodeError) {
            console.warn('Error obteniendo dirección:', geocodeError);
            // Fallback a coordenadas si falla la geocodificación
            location.address = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
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

  const startCamera = async () => {
    try {
      // Verificar disponibilidad de la API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no está disponible en este dispositivo o navegador');
      }

      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 }
        }
      };

      console.log('Solicitando acceso a la cámara...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setShowCamera(true);
          console.log('Cámara iniciada correctamente');
        };
      }
    } catch (error: any) {
      console.error('Error accediendo a la cámara:', error);
      
      let errorMessage = "No se pudo acceder a la cámara";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permisos de cámara denegados. Por favor, habilite los permisos en su navegador.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No se encontró cámara en el dispositivo.";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "La cámara no es compatible con este navegador.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "La cámara está siendo usada por otra aplicación.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error de cámara",
        description: errorMessage,
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const capturePhoto = async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    
    if (!context || video.readyState !== 4) {
      console.log('Video no está listo para captura');
      return null;
    }
    
    // Esperar un momento para asegurar que el video esté cargado
    await new Promise(resolve => setTimeout(resolve, 100));
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    console.log('Foto capturada exitosamente');
    return dataUrl;
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const uploadPhoto = async (photoDataUrl: string): Promise<string | null> => {
    try {
      // Convertir data URL a blob
      const response = await fetch(photoDataUrl);
      const blob = await response.blob();
      
      // Crear nombre único para la foto
      const fileName = `check-in-${user?.id}-${Date.now()}.jpg`;
      
      // Subir a Supabase Storage
      const { data, error } = await supabase.storage
        .from('time-tracking-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });
      
      if (error) throw error;
      
      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('time-tracking-photos')
        .getPublicUrl(data.path);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error subiendo foto:', error);
      return null;
    }
  };

  const handleCheckIn = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Iniciar cámara y obtener ubicación
      await startCamera();
      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);

      // Esperar a que el usuario tome la foto
      toast({
        title: "Tome una foto",
        description: "Posiciónese frente a la cámara y haga clic en capturar",
      });
      
    } catch (error: any) {
      console.error('Error preparando check-in:', error);
      toast({
        title: "Error al preparar entrada",
        description: error.message || "No se pudo preparar el registro de entrada",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const confirmCheckIn = async () => {
    if (!user || !location) return;

    try {
      console.log('Iniciando confirmación de entrada...');
      let photoUrl = null;
      
      // Capturar y subir foto
      if (showCamera) {
        console.log('Capturando foto...');
        const photoDataUrl = await capturePhoto();
        if (photoDataUrl) {
          setCapturedPhoto(photoDataUrl);
          console.log('Foto capturada, subiendo...');
          photoUrl = await uploadPhoto(photoDataUrl);
          console.log('Foto subida:', photoUrl);
        }
        stopCamera();
      }

      const checkInData = {
        employee_id: user.id,
        check_in_time: new Date().toISOString(),
        check_in_location: location as any,
        check_in_photo_url: photoUrl,
        work_date: new Date().toISOString().split('T')[0],
        status: 'checked_in'
      };

      console.log('Insertando registro de entrada:', checkInData);

      const { data, error } = await supabase
        .from('time_records')
        .insert(checkInData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Check-in successful, data received:', data);
      setCurrentRecord(data);
      setCapturedPhoto(null);
      setLocation(null);
      
      toast({
        title: "Entrada registrada",
        description: `Registrado a las ${currentTime.toLocaleTimeString()} con foto y ubicación`,
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
      // Iniciar cámara y obtener ubicación para salida
      await startCamera();
      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);

      toast({
        title: "Tome una foto de salida",
        description: "Posiciónese frente a la cámara y haga clic en capturar",
      });
      
    } catch (error: any) {
      console.error('Error preparando check-out:', error);
      toast({
        title: "Error al preparar salida",
        description: error.message || "No se pudo preparar el registro de salida",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const confirmCheckOut = async () => {
    if (!user || !currentRecord || !location) return;

    try {
      console.log('Iniciando confirmación de salida...');
      let photoUrl = null;
      
      // Capturar y subir foto de salida
      if (showCamera) {
        console.log('Capturando foto de salida...');
        const photoDataUrl = await capturePhoto();
        if (photoDataUrl) {
          setCapturedPhoto(photoDataUrl);
          console.log('Foto capturada, subiendo...');
          photoUrl = await uploadPhoto(photoDataUrl);
          console.log('Foto de salida subida:', photoUrl);
        }
        stopCamera();
      }

      // Calcular horas trabajadas
      const checkInTime = new Date(currentRecord.check_in_time);
      const checkOutTime = new Date();
      const totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      const updateData = {
        check_out_time: checkOutTime.toISOString(),
        check_out_location: location as any,
        check_out_photo_url: photoUrl,
        status: 'checked_out',
        total_hours: totalHours
      };

      console.log('Actualizando registro de salida:', updateData);

      const { data, error } = await supabase
        .from('time_records')
        .update(updateData)
        .eq('id', currentRecord.id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Check-out successful, data received:', data);
      setCurrentRecord(data);
      setCapturedPhoto(null);
      setLocation(null);
      
      toast({
        title: "Salida registrada",
        description: `Registrado a las ${currentTime.toLocaleTimeString()} con foto y ubicación`,
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

        {/* Cámara para captura de foto */}
        {showCamera && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-sm font-medium mb-2">Tome una foto para completar el registro</p>
              <div className="relative inline-block">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline
                  className="rounded-lg w-full max-w-sm"
                />
                <canvas 
                  ref={canvasRef} 
                  className="hidden"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              <Button 
                onClick={canCheckIn ? confirmCheckIn : confirmCheckOut}
                disabled={loading}
                className="flex-1"
              >
                <Camera className="h-4 w-4 mr-2" />
                Capturar y {canCheckIn ? 'Entrar' : 'Salir'}
              </Button>
              <Button 
                onClick={() => {
                  stopCamera();
                  setLoading(false);
                }}
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        {!showCamera && (
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
        )}

        {/* Foto capturada (preview) */}
        {capturedPhoto && (
          <div className="text-center">
            <p className="text-sm font-medium mb-2">Foto capturada:</p>
            <img 
              src={capturedPhoto} 
              alt="Foto de registro" 
              className="rounded-lg w-32 h-24 object-cover mx-auto"
            />
          </div>
        )}

        {/* Ubicación */}
        {location && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-start gap-1">
              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="leading-tight">
                {location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}
              </span>
            </div>
            <div className="text-xs opacity-75">
              GPS: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}