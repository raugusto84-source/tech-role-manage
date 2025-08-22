import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Camera, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderAssistanceRecordsProps {
  orderId: string;
  clientName?: string;
}

interface AssistanceRecord {
  id?: string;
  order_id: string;
  technician_id: string;
  record_type: 'arrival' | 'departure';
  timestamp: string;
  location_latitude: number;
  location_longitude: number;
  location_address?: string;
  evidence_photos: string[];
  notes?: string;
  created_at?: string;
  profiles?: {
    full_name: string;
  };
}

export function OrderAssistanceRecords({ orderId, clientName }: OrderAssistanceRecordsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<AssistanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<'arrival' | 'departure' | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRecords();
    getCurrentLocation();
  }, [orderId]);

  const loadRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('order_assistance_records' as any)
        .select('*')
        .eq('order_id', orderId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setRecords((data as unknown) as AssistanceRecord[]);
    } catch (error) {
      console.error('Error loading assistance records:', error);
    }
  };

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            title: "Error de ubicación",
            description: "No se pudo obtener la ubicación actual. Asegúrate de haber dado permisos de ubicación.",
            variant: "destructive",
          });
        }
      );
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setCapturedPhotos(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removePhoto = (index: number) => {
    setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const openEvidenceModal = (type: 'arrival' | 'departure') => {
    if (!currentLocation) {
      toast({
        title: "Ubicación requerida",
        description: "Necesitamos acceso a tu ubicación para registrar la asistencia.",
        variant: "destructive",
      });
      return;
    }

    setPendingRecord(type);
    setShowEvidenceModal(true);
    setCapturedPhotos([]);
  };

  const saveRecord = async () => {
    if (!user || !currentLocation || !pendingRecord) return;

    // Validar que hay al menos una foto
    if (capturedPhotos.length === 0) {
      toast({
        title: "Evidencia fotográfica requerida",
        description: "Debes tomar al menos una foto como evidencia.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Obtener dirección simplificada usando reverse geocoding
      let address = `${currentLocation.lat}, ${currentLocation.lng}`;
      
      try {
        const response = await fetch(
          `https://api.openstreetmap.org/reverse?format=json&lat=${currentLocation.lat}&lon=${currentLocation.lng}`
        );
        const data = await response.json();
        if (data.address) {
          // Extraer solo nombre y número de calle
          const streetNumber = data.address.house_number || '';
          const streetName = data.address.road || data.address.street || '';
          
          if (streetName) {
            address = `${streetNumber} ${streetName}`.trim();
          } else if (data.display_name) {
            // Fallback: tomar los primeros elementos de la dirección completa
            const parts = data.display_name.split(',');
            address = parts.slice(0, 2).join(',').trim();
          }
        }
      } catch (e) {
        console.log('Could not get address, using coordinates');
      }

      // Preparar datos del registro
      const recordData = {
        order_id: orderId,
        technician_id: user.id,
        record_type: pendingRecord,
        timestamp: new Date().toISOString(),
        location_latitude: currentLocation.lat,
        location_longitude: currentLocation.lng,
        location_address: address,
        evidence_photos: capturedPhotos,
      };

      const { error } = await supabase
        .from('order_assistance_records' as any)
        .insert([recordData]);

      if (error) throw error;

      toast({
        title: "Registro guardado",
        description: `Se registró correctamente la ${pendingRecord === 'arrival' ? 'llegada' : 'salida'}.`,
      });

      // Limpiar estado
      setShowEvidenceModal(false);
      setPendingRecord(null);
      setCapturedPhotos([]);
      
      // Recargar registros
      loadRecords();

    } catch (error) {
      console.error('Error saving record:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el registro. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Verificar si ya existe un registro de llegada sin salida
  const hasArrivalWithoutDeparture = records.some(r => r.record_type === 'arrival') && 
    !records.some(r => r.record_type === 'departure');

  // Verificar si ya hay registros completos
  const hasCompleteRecords = records.some(r => r.record_type === 'arrival') && 
    records.some(r => r.record_type === 'departure');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-primary" />
          Registros de Asistencia
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Botones de acción */}
        <div className="flex gap-2 mb-4">
          {!hasCompleteRecords && !hasArrivalWithoutDeparture && (
            <Button
              onClick={() => openEvidenceModal('arrival')}
              className="flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Registrar Llegada
            </Button>
          )}
          
          {hasArrivalWithoutDeparture && (
            <Button
              onClick={() => openEvidenceModal('departure')}
              className="flex items-center gap-2"
              variant="outline"
            >
              <CheckCircle2 className="h-4 w-4" />
              Registrar Salida
            </Button>
          )}
        </div>

        {/* Lista de registros */}
        <div className="space-y-4">
          {records.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No hay registros de asistencia aún
            </p>
          ) : (
            records.map((record) => (
              <div key={record.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={record.record_type === 'arrival' ? 'default' : 'outline'}
                      className="capitalize"
                    >
                      {record.record_type === 'arrival' ? 'Llegada' : 'Salida'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(record.timestamp), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </span>
                  </div>
                </div>

                {record.location_address && (
                  <div className="text-sm">
                    <strong>Ubicación:</strong> {record.location_address}
                  </div>
                )}

                {/* Evidencia fotográfica */}
                {record.evidence_photos && record.evidence_photos.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Evidencia fotográfica:</p>
                    <div className="grid grid-cols-3 gap-2">
                       {record.evidence_photos.map((photo, index) => (
                        <img
                          key={index}
                          src={photo}
                          alt={`Evidencia ${index + 1}`}
                          className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedPhoto(photo)}
                        />
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ))
          )}
        </div>

        {/* Modal de evidencia */}
        {showEvidenceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-lg mx-4">
              <CardHeader>
                <CardTitle>
                  Registrar {pendingRecord === 'arrival' ? 'Llegada' : 'Salida'}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Cliente: {clientName || 'No especificado'}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Evidencia fotográfica */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Evidencia fotográfica (requerida):
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full mb-2"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Tomar/Seleccionar Fotos
                  </Button>
                  
                  {/* Preview de fotos */}
                  {capturedPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {capturedPhotos.map((photo, index) => (
                        <div key={index} className="relative">
                           <img
                            src={photo}
                            alt={`Evidencia ${index + 1}`}
                            className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setSelectedPhoto(photo)}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0"
                            onClick={() => removePhoto(index)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ubicación actual */}
                {currentLocation && (
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                    <strong>Ubicación detectada:</strong><br/>
                    Se registrará automáticamente la dirección donde te encuentras
                  </div>
                )}

                {/* Botones */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={saveRecord}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      `Confirmar ${pendingRecord === 'arrival' ? 'Llegada' : 'Salida'}`
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEvidenceModal(false);
                      setPendingRecord(null);
                      setCapturedPhotos([]);
                    }}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>

      {/* Modal para ver fotos */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 z-10"
              onClick={() => setSelectedPhoto(null)}
            >
              ×
            </Button>
            <img
              src={selectedPhoto}
              alt="Evidencia ampliada"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </Card>
  );
}