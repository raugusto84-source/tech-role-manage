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
 * (Versión parcheada para móviles: asegura que el <video> esté montado antes de asignar el stream,
 * usa playsInline/muted y conecta srcObject desde un useEffect)
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
  const streamRef = useRef<MediaStream | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Cleanup de la cámara al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // 🔧 En móviles: cuando showCamera sea true y ya tengamos stream, conecta al <video>
  useEffect(() => {
    const attachStream = async () => {
      if (!showCamera || !videoRef.current || !streamRef.current) return;
      const video = videoRef.current;

      // Asegura atributos para autoplay en iOS
      video.muted = true;
      video.playsInline = true;

      // Asigna el stream sólo cuando el elemento existe
      video.srcObject = streamRef.current;

      try {
        const playPromise = video.play();
        if (playPromise && typeof (playPromise as any).then === 'function') {
          await playPromise;
        }
      } catch (e) {
        // iOS puede rechazar el primer intento; ignoramos o reintentamos al capturar
        // console.warn('Video play() fue rechazado inicialmente:', e);
      }
    };

    attachStream();
  }, [showCamera]);

  const loadTodayRecord = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
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
        return;
      }

      setCurrentRecord(data);
    } catch (error: any) {
      console.error('Error en loadTodayRecord:', error);
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
            lng: position.coords.longitude,
          };

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&zoom=18&addressdetails=1`,
              {
                headers: { 'User-Agent': 'TimeTrackingApp/1.0' },
              }
            );
            const data = await response.json();
            if (data?.display_name) {
              location.address = data.display_name;
            }
          } catch (geocodeError) {
            console.warn('Error obteniendo dirección:', geocodeError);
            location.address = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
          }

          resolve(location);
        },
        (error) => {
          console.error('Error de geolocalización:', error);
          reject(new Error(`Error de geolocalización: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    });
  };

  // 🔧 startCamera ahora sólo pide permisos y guarda el stream; mostrar UI después
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('La cámara no está disponible en este dispositivo');
      }

      // Intento con frontal; si falla, hacemos fallback
      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 320, max: 640 },
            height: { ideal: 240, max: 480 },
          },
        });
      } catch (e: any) {
        if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
          // Fallback a cámara trasera o sin facingMode
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 320, max: 640 },
                height: { ideal: 240, max: 480 },
              },
            });
          } catch (e2) {
            // Último intento sin facingMode
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        } else {
          throw e;
        }
      }

      streamRef.current = stream!;
      // Mostrar el bloque de cámara; el useEffect conectará el stream al <video>
      setShowCamera(true);
    } catch (error: any) {
      console.error('❌ Error de cámara:', error);
      toast({
        title: '❌ Error de cámara',
        description:
          error?.name === 'NotAllowedError'
            ? 'Permisos denegados. Permita el acceso a la cámara.'
            : error?.name === 'NotFoundError'
            ? 'No se encontró cámara.'
            : error?.name === 'NotSupportedError'
            ? 'Cámara no compatible.'
            : error?.name === 'NotReadableError'
            ? 'Cámara en uso por otra aplicación.'
            : error?.message || 'No se pudo acceder a la cámara',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const waitForVideoReady = async (video: HTMLVideoElement) => {
    let tries = 0;
    while ((video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) && tries < 20) {
      await new Promise((r) => setTimeout(r, 100));
      tries++;
    }
  };

  const capturePhoto = async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('Referencias de video o canvas no disponibles');
      return null;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('No se pudo obtener contexto 2D del canvas');
      return null;
    }

    try {
      await waitForVideoReady(video);
      const w = video.videoWidth || 320;
      const h = video.videoHeight || 240;
      canvas.width = w;
      canvas.height = h;
      context.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      return dataUrl;
    } catch (error) {
      console.error('Error capturando foto:', error);
      return null;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        // @ts-expect-error - limpiar srcObject
        videoRef.current.srcObject = null;
      } catch {}
    }
    setShowCamera(false);
  };

  const uploadPhoto = async (photoDataUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(photoDataUrl);
      const blob = await response.blob();
      const fileName = `time-record-${user?.id}-${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from('time-tracking-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        console.error('Error subiendo a storage:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('time-tracking-photos')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error en uploadPhoto:', error);
      return null;
    }
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);

      await startCamera(); // el useEffect conectará el stream al <video>

      toast({ title: '📸 Tome una foto', description: 'Posiciónese frente a la cámara' });
    } catch (error: any) {
      console.error('Error preparando check-in:', error);
      toast({ title: '❌ Error', description: error.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const confirmCheckIn = async () => {
    if (!user || !location) {
      toast({ title: '❌ Error', description: 'Faltan datos para registrar entrada', variant: 'destructive' });
      return;
    }

    try {
      let photoUrl = null;

      if (showCamera) {
        const photoDataUrl = await capturePhoto();
        if (photoDataUrl) {
          setCapturedPhoto(photoDataUrl);
          photoUrl = await uploadPhoto(photoDataUrl);
        }
      }

      stopCamera();

      const now = new Date();
      const checkInData = {
        employee_id: user.id,
        check_in_time: now.toISOString(),
        check_in_location: JSON.stringify(location),
        check_in_photo_url: photoUrl,
        work_date: now.toISOString().split('T')[0],
        status: 'checked_in',
      };

      const { data, error } = await supabase.from('time_records').insert(checkInData).select().single();

      if (error) {
        throw new Error(`Error de base de datos: ${error.message}`);
      }

      setCurrentRecord(data);
      setCapturedPhoto(null);
      setLocation(null);

      toast({ title: '✅ Entrada registrada', description: `${now.toLocaleTimeString('es-ES')}` });
      setTimeout(loadTodayRecord, 1000);
    } catch (error: any) {
      console.error('Error en confirmCheckIn:', error);
      toast({ title: '❌ Error', description: error.message, variant: 'destructive' });
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

      await startCamera();

      toast({ title: '📸 Foto de salida', description: 'Posiciónese frente a la cámara' });
    } catch (error: any) {
      console.error('Error preparando check-out:', error);
      toast({ title: '❌ Error', description: error.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const confirmCheckOut = async () => {
    if (!user || !currentRecord || !location) {
      console.error('Datos incompletos para check-out');
      return;
    }

    try {
      let photoUrl = null;

      if (showCamera) {
        const photoDataUrl = await capturePhoto();
        if (photoDataUrl) {
          setCapturedPhoto(photoDataUrl);
          photoUrl = await uploadPhoto(photoDataUrl);
        }
      }

      stopCamera();

      const checkInTime = new Date(currentRecord.check_in_time);
      const checkOutTime = new Date();
      const totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      const updateData = {
        check_out_time: checkOutTime.toISOString(),
        check_out_location: JSON.stringify(location),
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

      if (error) {
        throw new Error(`Error de base de datos: ${error.message}`);
      }

      setCurrentRecord(data);
      setCapturedPhoto(null);
      setLocation(null);

      toast({ title: '✅ Salida registrada', description: `${checkOutTime.toLocaleTimeString('es-ES')}` });
      setTimeout(loadTodayRecord, 1000);
    } catch (error: any) {
      console.error('Error en confirmCheckOut:', error);
      toast({ title: '❌ Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '--:--';
    return new Date(timeString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = () => {
    if (!currentRecord) {
      return <Badge variant="outline">Sin registrar</Badge>;
    }
    switch (currentRecord.status) {
      case 'checked_in':
        return <Badge className="bg-green-500 text-white">Presente</Badge>;
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
            {currentTime.toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
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

        {/* Cámara (video siempre montado cuando showCamera es true) */}
        {showCamera && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-sm font-medium mb-2">Tome una foto para completar el registro</p>
              <div className="relative inline-block">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="rounded-lg w-full max-w-sm border"
                  style={{ maxWidth: '320px', height: 'auto' }}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={canCheckIn ? confirmCheckIn : confirmCheckOut} disabled={loading} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                Capturar y {canCheckIn ? 'Entrar' : 'Salir'}
              </Button>
              <Button
                onClick={() => {
                  stopCamera();
                  setLoading(false);
                  setLocation(null);
                }}
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Botones principales */}
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

        {/* Preview de foto */}
        {capturedPhoto && (
          <div className="text-center">
            <p className="text-sm font-medium mb-2">Foto capturada:</p>
            <img src={capturedPhoto} alt="Foto de registro" className="rounded-lg w-32 h-24 object-cover mx-auto border" />
          </div>
        )}

        {/* Ubicación */}
        {location && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-start gap-1">
              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="leading-tight">{location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
