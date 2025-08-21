import { useState, useRef, useEffect } from 'react';
import { Camera, MapPin, Check, X, Plus, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface TechnicianPhoto {
  id: string;
  photo_type: 'arrival' | 'departure' | 'evidence';
  photo_url: string;
  location: Location;
  timestamp: string;
  notes?: string;
}

interface TechnicianPhotoCaptureProps {
  orderId: string;
  orderNumber: string;
  onPhotosUpdate: () => void;
  onStatusUpdate?: (newStatus: string) => void;
}

export function TechnicianPhotoCapture({ orderId, orderNumber, onPhotosUpdate, onStatusUpdate }: TechnicianPhotoCaptureProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [photoType, setPhotoType] = useState<'arrival' | 'departure' | 'evidence'>('arrival');
  const [location, setLocation] = useState<Location | null>(null);
  const [notes, setNotes] = useState('');
  const [existingPhotos, setExistingPhotos] = useState<TechnicianPhoto[]>([]);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadExistingPhotos();
    return () => stopCamera();
  }, [orderId]);

  const loadExistingPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('technician_photos' as any)
        .select('*')
        .eq('order_id', orderId)
        .eq('technician_id', user?.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setExistingPhotos(data ? data as unknown as TechnicianPhoto[] : []);
    } catch (error) {
      console.error('Error loading technician photos:', error);
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
              { headers: { 'User-Agent': 'TechnicianPhotoApp/1.0' } }
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

      setShowCamera(true);
      await new Promise(requestAnimationFrame);

      const video = videoRef.current;
      if (!video) throw new Error('Elemento de video no disponible');

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment', // Cámara trasera preferida para documentar trabajos
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play();
      
      // Obtener ubicación mientras se inicia la cámara
      const currentLocation = await getCurrentLocation();
      setLocation(currentLocation);
      
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
      await new Promise((r) => setTimeout(r, 100));
    }

    const context = canvas.getContext('2d');
    if (!context) return null;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
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
      const response = await fetch(photoDataUrl);
      const blob = await response.blob();

      const timestamp = new Date().toISOString();
      const fileName = `${orderId}/${user?.id}/${photoType}_${timestamp.replace(/[:.]/g, '-')}.jpg`;

      const { data, error } = await supabase.storage
        .from('technician-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('technician-photos')
        .getPublicUrl(data.path);

      return urlData.publicUrl ?? null;
    } catch (error) {
      console.error('Error subiendo foto:', error);
      toast({ title: 'Error al subir foto', description: 'No se pudo subir la foto al servidor', variant: 'destructive' });
      return null;
    }
  };

  const handleCaptureAndSave = async () => {
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

      if (!photoUrl) {
        toast({ title: 'Error', description: 'No se pudo capturar la foto', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('technician_photos' as any)
        .insert({
          order_id: orderId,
          technician_id: user.id,
          photo_type: photoType,
          photo_url: photoUrl,
          location: location as any,
          notes: notes || null,
          timestamp: new Date().toISOString()
        });

      if (error) throw error;

      // Actualizar estado de la orden según el tipo de foto
      let newStatus = null;
      if (photoType === 'arrival') {
        newStatus = 'en_proceso';
        toast({ title: 'Foto de llegada guardada', description: 'Orden marcada como en proceso' });
      } else if (photoType === 'departure') {
        newStatus = 'finalizada';
        toast({ title: 'Foto de salida guardada', description: 'Orden finalizada exitosamente' });
      } else {
        toast({ title: 'Evidencia guardada', description: 'Foto de evidencia agregada correctamente' });
      }

      if (newStatus && onStatusUpdate) {
        onStatusUpdate(newStatus);
      }

      // Limpiar formulario
      setCapturedPhoto(null);
      setLocation(null);
      setNotes('');
      
      // Recargar fotos y notificar cambios
      await loadExistingPhotos();
      onPhotosUpdate();

    } catch (error: any) {
      console.error('Error guardando foto:', error);
      toast({ title: 'Error al guardar', description: error.message || 'No se pudo guardar la foto', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartCapture = (type: 'arrival' | 'departure' | 'evidence') => {
    setPhotoType(type);
    setNotes('');
    startCamera();
  };

  const hasArrivalPhoto = existingPhotos.some(photo => photo.photo_type === 'arrival');
  const hasDeparturePhoto = existingPhotos.some(photo => photo.photo_type === 'departure');
  const evidencePhotos = existingPhotos.filter(photo => photo.photo_type === 'evidence');

  const getPhotoTypeLabel = (type: string) => {
    switch (type) {
      case 'arrival': return 'Llegada';
      case 'departure': return 'Salida';
      case 'evidence': return 'Evidencia';
      default: return type;
    }
  };

  const getPhotoTypeBadge = (type: string) => {
    switch (type) {
      case 'arrival': return <Badge className="bg-blue-500">Llegada</Badge>;
      case 'departure': return <Badge className="bg-green-500">Salida</Badge>;
      case 'evidence': return <Badge variant="outline">Evidencia</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Documentación del Trabajo - {orderNumber}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Cámara para captura */}
        {showCamera && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-sm font-medium mb-2">
                Foto de {getPhotoTypeLabel(photoType)} - {orderNumber}
              </p>
              <div className="relative inline-block">
                <video ref={videoRef} autoPlay playsInline muted className="rounded-lg w-full max-w-md" />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            {/* Notas para la foto */}
            <div>
              <Label htmlFor="photo-notes">Notas (opcional)</Label>
              <Textarea
                id="photo-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agrega una descripción de la foto..."
                rows={2}
              />
            </div>

            {/* Ubicación */}
            {location && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="leading-tight">{location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-center">
              <Button onClick={handleCaptureAndSave} disabled={loading} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                Guardar Foto
              </Button>
              <Button onClick={() => { stopCamera(); setLoading(false); }} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Botones de acción (solo si cámara oculta) */}
        {!showCamera && (
          <div className="space-y-3">
            {/* Foto de llegada */}
            {!hasArrivalPhoto && (
              <Button 
                onClick={() => handleStartCapture('arrival')} 
                disabled={loading} 
                className="w-full" 
                size="lg"
              >
                <Camera className="h-4 w-4 mr-2" />
                Tomar Foto de Llegada
              </Button>
            )}

            {/* Fotos de evidencia - solo disponible después de la llegada */}
            {hasArrivalPhoto && !hasDeparturePhoto && (
              <Button 
                onClick={() => handleStartCapture('evidence')} 
                disabled={loading} 
                variant="outline" 
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Evidencia del Trabajo
              </Button>
            )}

            {/* Foto de salida - solo disponible después de la llegada */}
            {hasArrivalPhoto && !hasDeparturePhoto && (
              <Button 
                onClick={() => handleStartCapture('departure')} 
                disabled={loading} 
                className="w-full" 
                size="lg"
              >
                <Camera className="h-4 w-4 mr-2" />
                Tomar Foto de Salida
              </Button>
            )}
          </div>
        )}

        {/* Fotos existentes */}
        {existingPhotos.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Fotos Documentadas</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {existingPhotos.map((photo) => (
                <div key={photo.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    {getPhotoTypeBadge(photo.photo_type)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(photo.timestamp).toLocaleString('es-ES')}
                    </span>
                  </div>
                  
                  <img 
                    src={photo.photo_url} 
                    alt={`Foto de ${getPhotoTypeLabel(photo.photo_type)}`}
                    className="w-full h-32 object-cover rounded"
                  />
                  
                  {photo.notes && (
                    <p className="text-xs text-muted-foreground">{photo.notes}</p>
                  )}
                  
                  {photo.location && (
                    <div className="text-xs text-muted-foreground flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span className="leading-tight">
                        {photo.location.address || `${photo.location.lat.toFixed(6)}, ${photo.location.lng.toFixed(6)}`}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Foto capturada preview */}
        {capturedPhoto && (
          <div className="text-center space-y-2">
            <p className="text-sm font-medium">Foto capturada:</p>
            <img src={capturedPhoto} alt="Foto capturada" className="rounded-lg w-full max-w-xs mx-auto" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}