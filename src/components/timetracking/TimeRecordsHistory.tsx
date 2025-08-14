import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, Camera } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface TimeRecord {
  id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_location: any;
  check_out_location: any;
  check_in_photo_url: string | null;
  check_out_photo_url: string | null;
  total_hours: number | null;
  status: string;
}

export function TimeRecordsHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadTimeRecords();
    }
  }, [user]);

  const loadTimeRecords = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('employee_id', user.id)
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30); // Últimos 30 registros

      if (error) throw error;

      setRecords(data || []);
    } catch (error: any) {
      console.error('Error loading time records:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los registros",
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (record: TimeRecord) => {
    switch (record.status) {
      case 'checked_in':
        return <Badge variant="default" className="bg-green-500">Presente</Badge>;
      case 'checked_out':
        return <Badge variant="secondary">Finalizado</Badge>;
      default:
        return <Badge variant="outline">Incompleto</Badge>;
    }
  };

  const getLocationText = (location: any) => {
    if (!location) return 'Sin ubicación';
    
    if (location.address) {
      return location.address;
    }
    
    if (location.lat && location.lng) {
      return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
    }
    
    return 'Ubicación no disponible';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historial de Registros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historial de Registros
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay registros disponibles
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <Card key={record.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{formatDate(record.work_date)}</span>
                    </div>
                    {getStatusBadge(record)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Entrada */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-600 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Entrada
                      </h4>
                      <div className="text-sm space-y-1">
                        <div>Hora: {formatTime(record.check_in_time)}</div>
                        {record.check_in_location && (
                          <div className="flex items-start gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-xs text-muted-foreground">
                              {getLocationText(record.check_in_location)}
                            </span>
                          </div>
                        )}
                        {record.check_in_photo_url && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 px-2"
                                onClick={() => setSelectedPhoto(record.check_in_photo_url)}
                              >
                                <Camera className="h-3 w-3 mr-1" />
                                Ver foto
                              </Button>
                            </DialogTrigger>
                          </Dialog>
                        )}
                      </div>
                    </div>

                    {/* Salida */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Salida
                      </h4>
                      <div className="text-sm space-y-1">
                        <div>Hora: {formatTime(record.check_out_time)}</div>
                        {record.check_out_location && (
                          <div className="flex items-start gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-xs text-muted-foreground">
                              {getLocationText(record.check_out_location)}
                            </span>
                          </div>
                        )}
                        {record.check_out_photo_url && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 px-2"
                                onClick={() => setSelectedPhoto(record.check_out_photo_url)}
                              >
                                <Camera className="h-3 w-3 mr-1" />
                                Ver foto
                              </Button>
                            </DialogTrigger>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  </div>

                  {record.total_hours && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-center gap-2 text-sm font-medium">
                        <Clock className="h-4 w-4" />
                        Total: {record.total_hours.toFixed(2)} horas
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para mostrar fotos */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto de Registro</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="flex justify-center">
              <img
                src={selectedPhoto}
                alt="Foto de registro"
                className="max-w-full max-h-96 object-contain rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y0ZjRmNCIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2VuIG5vIGRpc3BvbmlibGU8L3RleHQ+Cjwvc3ZnPg==';
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}