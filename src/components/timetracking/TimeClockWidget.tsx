import { useState, useEffect, useRef } from 'react';
import { Clock, MapPin, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatHoursAndMinutes } from '@/utils/timeUtils';
import { getCurrentDateMexico } from '@/utils/dateUtils';

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

/**
 * Widget para registro de entrada y salida con geolocalización + foto
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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Limpiar cámara/stream al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Cargar registro actual del día
  useEffect(() => {
    if (user) loadTodayRecord();
  }, [user]);

  const loadTodayRecord = async () => {
    if (!user) return;
    try {
      const today = getCurrentDateMexico();
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('employee_id', user.id)
        .eq('work_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentRecord(data);
    } catch (error) {
      console.error('Error loading today record:', error);
      toast({ title: 'Error', description: 'No se pudo cargar el registro del día', variant: 'destructive' });
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
          const loc: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}&zoom=18&addressdetails=1`,
              { headers: { 'User-Agent': 'TimeTrackingApp/1.0' } }
            );
            const data = await response.json();
            if (data?.display_name) loc.address = data.display_name;
            else loc.address = `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
          } catch (geocodeError) {
            console.warn('Error obteniendo dirección:', geocodeError);
            loc.address = `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
          }

          resolve(loc);
        },
        (error) => {
          reject(new Error(`Error de geolocalización: ${error.message}`));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('La cámara no está disponible en este dispositivo o navegador');
      }

      // 1) Mostrar contenedor y asegurar que el <video> existe en el DOM
      setShowCamera(true);
      await new Promise(requestAnimationFrame);

      const video = videoRef.current;
      if (!video) throw new Error('Elemento de video no disponible');

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
        },
        audio: false,
      };

      // 2) Solicitar cámara
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;

      // 3) Reproducir (muted + playsInline habilitan autoplay en móviles)
      await video.play();
      console.log('Cámara iniciada correctamente');
    } catch (error: any) {
      console.error('Error accediendo a la cámara:', error);
      let errorMessage = 'No se pudo acceder a la cámara';
      if (error.name === 'NotAllowedError') errorMessage = 'Permisos de cámara denegados. Habilítalos en tu navegador.';
      else if (error.name === 'NotFoundError') errorMessage = 'No se encontró cámara en el dispositivo.';
      else if (error.name === 'NotSupportedError') errorMessage = 'La cámara no es compatible con este navegador.';
      else if (error.name === 'NotReadableError') errorMessage = 'La cámara está siendo usada por otra aplicación.';
      else if (error.message) errorMessage = error.message;

      toast({ title: 'Error de cámara', description: errorMessage, variant: 'destructive' });
      setShowCamera(false);
      setLoading(false);
    }
  };

  const capturePhoto = async (): Promise<string | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    if (video.readyState < 2) {
      // Espera breve si el video aún no está listo
      await new Promise((r) => setTimeout(r, 100));
    }

    const context = canvas.getContext('2d');
    if (!context) return null;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    canvas.width = vw;
    canvas.height = vh;
    context.drawImage(video, 0, 0, vw, vh);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return dataUrl;
  };

  const stopCamera = () => {
    try {
      const video = videoRef.current;
      const stream = video?.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (video) {
        video.pause();
        video.srcObject = null;
      }
    } catch (e) {
      console.warn('Error al detener cámara:', e);
    }
    setShowCamera(false);
  };

  const uploadPhoto = async (photoDataUrl: string): Promise<string | null> => {
    try {
      // Convertir data URL a blob
      const response = await fetch(photoDataUrl);
      const blob = await response.blob();

      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const folder = `${user?.id}/${yyyy}-${mm}-${dd}`;
      const fileName = `${folder}/check-${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from('time-tracking-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('time-tracking-photos')
        .getPublicUrl(data.path);

      return urlData.publicUrl ?? null;
    } catch (error) {
      console.error('Error subiendo foto:', error);
      toast({ title: 'Error al subir foto', description: 'No se obtuvo URL pública. Revisa la configuración del bucket.' , variant: 'destructive' });
      return null;
    }
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await startCamera();
      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);
      setLoading(false);
      toast({ title: 'Tome una foto', description: 'Posiciónese frente a la cámara y haga clic en Capturar' });
    } catch (error: any) {
      console.error('Error preparando check-in:', error);
      toast({ title: 'Error al preparar entrada', description: error.message || 'No se pudo preparar el registro de entrada', variant: 'destructive' });
      setLoading(false);
    }
  };

  const confirmCheckIn = async () => {
    if (!user || !location) return;
    setLoading(true);
    try {
      let photoUrl: string | null = null;
      if (showCamera) {
        const photoDataUrl = await capturePhoto();
        if (photoDataUrl) {
          setCapturedPhoto(photoDataUrl);
          photoUrl = await uploadPhoto(photoDataUrl);
        }
        stopCamera();
      }

      const now = new Date();
      const checkInData = {
        employee_id: user.id,
        check_in_time: now.toISOString(),
        check_in_location: location as any,
        check_in_photo_url: photoUrl,
        work_date: getCurrentDateMexico(),
        status: 'checked_in',
      };

      const { data, error } = await supabase
        .from('time_records')
        .insert(checkInData)
        .select()
        .single();

      if (error) throw error;

      setCurrentRecord(data);
      setCapturedPhoto(null);
      setLocation(null);

      toast({ title: 'Entrada registrada', description: `Registrado a las ${currentTime.toLocaleTimeString()} con foto y ubicación` });
    } catch (error: any) {
      console.error('Error en check-in:', error);
      toast({ title: 'Error al registrar entrada', description: error.message || 'No se pudo registrar la entrada', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || !currentRecord) return;
    setLoading(true);
    try {
      await startCamera();
      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);
      setLoading(false);
      toast({ title: 'Tome una foto de salida', description: 'Posiciónese frente a la cámara y haga clic en Capturar' });
    } catch (error: any) {
      console.error('Error preparando check-out:', error);
      toast({ title: 'Error al preparar salida', description: error.message || 'No se pudo preparar el registro de salida', variant: 'destructive' });
      setLoading(false);
    }
  };

  const confirmCheckOut = async () => {
    if (!user || !currentRecord || !location) return;
    setLoading(true);
    try {
      let photoUrl: string | null = null;
      if (showCamera) {
        const photoDataUrl = await capturePhoto();
        if (photoDataUrl) {
          setCapturedPhoto(photoDataUrl);
          photoUrl = await uploadPhoto(photoDataUrl);
        }
        stopCamera();
      }

      const checkInTime = new Date(currentRecord.check_in_time);
      const checkOutTime = new Date();
      const totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      const updateData = {
        check_out_time: checkOutTime.toISOString(),
        check_out_location: location as any,
        check_out_photo_url: photoUrl,
        status: 'checked_out',
        total_hours: totalHours,
      };

      const { data, error } = await supabase
        .from('time_records')
        .update(updateData)
        .eq('id', currentRecord.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentRecord(data);
      setCapturedPhoto(null);
      setLocation(null);

      toast({ title: 'Salida registrada', description: `Registrado a las ${currentTime.toLocaleTimeString()} con foto y ubicación` });
    } catch (error: any) {
      console.error('Error en check-out:', error);
      toast({ title: 'Error al registrar salida', description: error.message || 'No se pudo registrar la salida', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '--:--';
    return new Date(timeString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = () => {
    if (!currentRecord) return <Badge variant="outline">Sin registrar</Badge>;
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
        <CardDescription>Registra tu entrada y salida diaria</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Reloj actual */}
        <div className="text-center">
          <div className="text-3xl font-mono font-bold">{currentTime.toLocaleTimeString('es-ES')}</div>
          <div className="text-sm text-muted-foreground">
            {currentTime.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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

        {/* Cámara para captura de foto (siempre montada; oculta si showCamera=false) */}
        <div className={`space-y-3 p-4 bg-muted rounded-lg transition-all ${showCamera ? 'block' : 'hidden'}`}>
          <div className="text-center">
            <p className="text-sm font-medium mb-2">Tome una foto para completar el registro</p>
            <div className="relative inline-block">
              <video ref={videoRef} autoPlay playsInline muted className="rounded-lg w-full max-w-sm" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={canCheckIn ? confirmCheckIn : confirmCheckOut} disabled={loading} className="flex-1">
              <Camera className="h-4 w-4 mr-2" />
              Capturar y {canCheckIn ? 'Entrar' : 'Salir'}
            </Button>
            <Button onClick={() => { stopCamera(); setLoading(false); }} variant="outline">
              Cancelar
            </Button>
          </div>
        </div>

        {/* Botones de acción (solo si cámara oculta) */}
        {!showCamera && (
          <div className="space-y-2">
            {canCheckIn && (
              <Button onClick={handleCheckIn} disabled={loading} className="w-full" size="lg">
                {loading ? <AlertCircle className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Registrar Entrada
              </Button>
            )}
            {canCheckOut && (
              <Button onClick={handleCheckOut} disabled={loading} variant="outline" className="w-full" size="lg">
                {loading ? <AlertCircle className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                Registrar Salida
              </Button>
            )}
          </div>
        )}

        {/* Foto capturada (preview) */}
        {capturedPhoto && (
          <div className="text-center">
            <p className="text-sm font-medium mb-2">Foto capturada:</p>
            <img src={capturedPhoto} alt="Foto de registro" className="rounded-lg w-32 h-24 object-cover mx-auto" />
          </div>
        )}

        {/* Ubicación */}
        {location && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-start gap-1">
              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="leading-tight">{location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}</span>
            </div>
            <div className="text-xs opacity-75">GPS: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
