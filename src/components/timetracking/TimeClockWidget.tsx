import { useState, useEffect, useRef } from 'react';
import { Clock, MapPin, CheckCircle, AlertCircle, Camera, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// ===== Utilidades locales de formato =====
const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';

const parseLocation = (raw?: string | null) => {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

const fmtAddress = (raw?: string | null) => {
  const loc = parseLocation(raw);
  if (!loc) return '—';
  const { lat, lng, address } = loc;
  return address || `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
};

const mapUrl = (raw?: string | null) => {
  const loc = parseLocation(raw);
  if (!loc) return undefined;
  return `https://maps.google.com/?q=${loc.lat},${loc.lng}`;
};

const fmtHoursAndMinutes = (hours?: number | null) => {
  if (!hours && hours !== 0) return '—';
  const total = Math.max(0, hours ?? 0);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${h}h ${m}m`;
};

const BUCKET = 'time-tracking-photos'; // Debe ser PÚBLICO (opción 3)

// ===== Componente principal =====
export function TimeClockWidget() {
  const { user } = useAuth();

  // Estado de hoy e historial
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);

  // Cámara sencilla (bucket público)
  const [cameraOpen, setCameraOpen] = useState(false);
  const [checkType, setCheckType] = useState<'in' | 'out' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  // UI general
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);

  // ===== Reloj =====
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ===== Carga inicial =====
  useEffect(() => {
    if (!user) return;
    void loadTodayRecord();
    void loadHistory();
  }, [user]);

  // Cleanup cámara al desmontar
  useEffect(() => () => stopCamera(), []);

  // Conectar stream al <video> al abrir el modal
  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const v = videoRef.current;
    v.muted = true;
    v.playsInline = true;
    // @ts-expect-error runtime
    v.srcObject = streamRef.current;
    const p = v.play();
    if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
  }, [cameraOpen]);

  // ===== Supabase: cargar registro de hoy =====
  const loadTodayRecord = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('time_records')
      .select('*')
      .eq('employee_id', user.id)
      .eq('work_date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) console.error(error);
    setCurrentRecord(data);
  };

  // ===== Supabase: cargar historial =====
  const loadHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      console.error('Historial error:', e);
      toast({ title: 'Error cargando historial', description: 'Intenta de nuevo', variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  };

  // ===== GPS =====
  const resolveAddress = async (lat: number, lng: number): Promise<string | undefined> => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'User-Agent': 'TimeTrackingApp/1.0' },
      });
      const j = await r.json();
      return j?.display_name as string | undefined;
    } catch (e) {
      console.warn('Reverse geocode error:', e);
      return undefined;
    }
  };

  const getPosition = (options?: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocalización no soportada'));
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  const getCurrentLocation = async (): Promise<{ lat: number; lng: number; address?: string }> => {
    try {
      let pos: GeolocationPosition | null = null;
      try {
        pos = await getPosition({ enableHighAccuracy: true, timeout: 7000, maximumAge: 0 });
      } catch {
        pos = await getPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
      }
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const addr = await resolveAddress(lat, lng);
      return { lat, lng, address: addr || `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    } catch (e: any) {
      throw new Error(e?.message || 'No se pudo obtener la ubicación');
    }
  };

  // ===== Cámara (simple) =====
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara no está disponible en este dispositivo');
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } } });
      } catch {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }); }
        catch { stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
      }
      streamRef.current = stream;
    } catch (e: any) {
      throw new Error(e?.message || 'No se pudo acceder a la cámara');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      // @ts-expect-error
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Espera breve a que video tenga dimensiones
    let tries = 0;
    while ((video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) && tries < 20) {
      await new Promise((r) => setTimeout(r, 100));
      tries++;
    }
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const uploadPhotoPublic = async (dataUrl: string): Promise<string | null> => {
    try {
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const fileName = `time-record-${user?.id}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage.from(BUCKET).upload(fileName, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
    } catch (e: any) {
      console.error('Upload error:', e);
      toast({ title: 'No se pudo subir la foto', description: e?.message || 'Intenta de nuevo', variant: 'destructive' });
      return null;
    }
  };

  // ===== Guardado (con foto simple a bucket público) =====
  const beginCheck = async (type: 'in' | 'out') => {
    if (!user) return;
    setLoading(true);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      await startCamera();
      setCheckType(type);
      setCameraOpen(true);
    } catch (e: any) {
      toast({ title: '❌ Error', description: e?.message || 'No se pudo iniciar cámara/ubicación', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const confirmCheck = async () => {
    if (!user || !checkType || !location) return;
    try {
      const photo = await capturePhoto();
      if (!photo) throw new Error('No se pudo capturar la foto');
      const photoUrl = await uploadPhotoPublic(photo);
      if (!photoUrl) throw new Error('No se obtuvo URL pública');

      const now = new Date();
      const base = { employee_id: user.id, work_date: now.toISOString().split('T')[0] };

      if (checkType === 'in') {
        const payload = {
          ...base,
          check_in_time: now.toISOString(),
          check_in_location: JSON.stringify(location),
          check_in_photo_url: photoUrl,
          status: 'checked_in',
        };
        const { data, error } = await supabase.from('time_records').insert(payload).select().single();
        if (error) throw error;
        setCurrentRecord(data);
        toast({ title: '✅ Entrada registrada', description: now.toLocaleTimeString('es-ES') });
      } else {
        if (!currentRecord?.id) throw new Error('No hay entrada activa');
        const totalHours = currentRecord?.check_in_time
          ? (now.getTime() - new Date(currentRecord.check_in_time).getTime()) / 3600000
          : null;
        const update = {
          check_out_time: now.toISOString(),
          check_out_location: JSON.stringify(location),
          check_out_photo_url: photoUrl,
          status: 'checked_out',
          total_hours: totalHours,
        };
        const { data, error } = await supabase
          .from('time_records')
          .update(update)
          .eq('id', currentRecord.id)
          .select()
          .single();
        if (error) throw error;
        setCurrentRecord(data);
        toast({ title: '✅ Salida registrada', description: now.toLocaleTimeString('es-ES') });
      }
      setCameraOpen(false);
      stopCamera();
      setCapturedPhoto(photo);
      setTimeout(loadTodayRecord, 400);
      void loadHistory();
    } catch (e: any) {
      toast({ title: '❌ Error', description: e?.message || 'No se pudo guardar', variant: 'destructive' });
    }
  };

  // ===== UI helpers =====
  const canCheckIn = !currentRecord || currentRecord.status === 'checked_out';
  const canCheckOut = currentRecord && currentRecord.status === 'checked_in';

  const StatusBadge = () => {
    if (!currentRecord) return <Badge variant="outline">Sin registrar</Badge>;
    switch (currentRecord.status) {
      case 'checked_in':
        return <Badge className="bg-green-500 text-white">Presente</Badge>;
      case 'checked_out':
        return <Badge variant="secondary">Finalizado</Badge>;
      default:
        return <Badge variant="outline">Incompleto</Badge>;
    }
  };

  // ===== Render =====
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Control de Horarios</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setHistoryOpen(true); void loadHistory(); }}>
              Ver historial
            </Button>
          </div>
        </div>
        <CardDescription>Registra tu entrada y salida diaria</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Reloj */}
        <div className="text-center">
          <div className="text-3xl font-mono font-bold">{currentTime.toLocaleTimeString('es-ES')}</div>
          <div className="text-sm text-muted-foreground">{currentTime.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        {/* Estado */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Estado:</span>
          <StatusBadge />
        </div>

        {/* Info del día */}
        {currentRecord && (
          <div className="space-y-2 p-3 bg-muted rounded-lg">
            <div className="flex justify-between"><span>Entrada:</span><span>{fmtTime(currentRecord.check_in_time)}</span></div>
            {currentRecord.check_out_time && (
              <>
                <div className="flex justify-between"><span>Salida:</span><span>{fmtTime(currentRecord.check_out_time)}</span></div>
                <div className="flex justify-between"><span>Total:</span><span>{fmtHoursAndMinutes(currentRecord.total_hours)}</span></div>
              </>
            )}
          </div>
        )}

        {/* Acciones */}
        {!cameraOpen && (
          <div className="space-y-2">
            {canCheckIn && (
              <Button onClick={() => beginCheck('in')} disabled={loading} className="w-full" size="lg">
                {loading ? <AlertCircle className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />} Registrar Entrada
              </Button>
            )}
            {canCheckOut && (
              <Button onClick={() => beginCheck('out')} disabled={loading} variant="outline" className="w-full" size="lg">
                {loading ? <AlertCircle className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />} Registrar Salida
              </Button>
            )}
          </div>
        )}

        {/* Cámara inline (sin modal) */}
        {cameraOpen && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium">{checkType === 'out' ? 'Foto de salida' : 'Foto de entrada'}</div>
            <video ref={videoRef} autoPlay playsInline muted className="rounded-lg w-full max-w-sm border" />
            <canvas ref={canvasRef} className="hidden" />
            {capturedPhoto && <img src={capturedPhoto} alt="preview" className="w-full h-40 object-cover rounded border" />}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={async () => { const p = await capturePhoto(); if (p) setCapturedPhoto(p); }}>
                <Camera className="h-4 w-4 mr-2" /> Capturar
              </Button>
              <Button variant="outline" onClick={() => { setCameraOpen(false); stopCamera(); setCapturedPhoto(null); }}>Cancelar</Button>
            </div>
            <Button disabled={!capturedPhoto} onClick={confirmCheck} className="w-full">
              Guardar {checkType === 'out' ? 'salida' : 'entrada'}
            </Button>
          </div>
        )}

        {/* Ubicación reciente */}
        {location && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-start gap-1">
              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="leading-tight">{location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}</span>
            </div>
          </div>
        )}

        {/* ===== Diálogo de historial ===== */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Historial de registros</DialogTitle>
              <DialogDescription>Consulta tus entradas y salidas recientes</DialogDescription>
            </DialogHeader>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Salida</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Fotos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyLoading ? (
                    <TableRow><TableCell colSpan={6}>Cargando…</TableCell></TableRow>
                  ) : history.length === 0 ? (
                    <TableRow><TableCell colSpan={6}>Sin registros</TableCell></TableRow>
                  ) : (
                    history.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => { setSelectedRecord(r); setRecordDialogOpen(true); }}
                      >
                        <TableCell>{new Date(r.work_date || r.check_in_time).toLocaleDateString('es-ES')}</TableCell>
                        <TableCell>{fmtTime(r.check_in_time)}</TableCell>
                        <TableCell>{fmtTime(r.check_out_time)}</TableCell>
                        <TableCell>{fmtHoursAndMinutes(r.total_hours)}</TableCell>
                        <TableCell className="max-w-[240px] truncate" title={fmtAddress(r.check_in_location)}>
                          {fmtAddress(r.check_in_location)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {r.check_in_photo_url ? (
                              <img src={r.check_in_photo_url} alt="Entrada" className="w-12 h-9 object-cover rounded border" onClick={(e) => { e.stopPropagation(); setPhotoPreviewUrl(r.check_in_photo_url); }} />
                            ) : <div className="w-12 h-9 bg-muted rounded" />}
                            {r.check_out_photo_url ? (
                              <img src={r.check_out_photo_url} alt="Salida" className="w-12 h-9 object-cover rounded border" onClick={(e) => { e.stopPropagation(); setPhotoPreviewUrl(r.check_out_photo_url); }} />
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedRecord(null); void loadHistory(); }}>Actualizar</Button>
              <Button onClick={() => setHistoryOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialogo de detalle de un registro */}
        <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {selectedRecord ? (
                  <>Detalle del {new Date(selectedRecord.work_date || selectedRecord.check_in_time).toLocaleDateString('es-ES')} ({selectedRecord.status || '—'})</>
                ) : 'Detalle del registro'}
              </DialogTitle>
              <DialogDescription>Datos y fotos del día seleccionado</DialogDescription>
            </DialogHeader>

            {selectedRecord ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Entrada:</span> {fmtTime(selectedRecord.check_in_time)}</div>
                  <div><span className="text-muted-foreground">Salida:</span> {fmtTime(selectedRecord.check_out_time)}</div>
                  <div className="sm:col-span-2"><span className="text-muted-foreground">Total:</span> {fmtHoursAndMinutes(selectedRecord.total_hours)}</div>
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <div>
                      <div className="truncate" title={fmtAddress(selectedRecord.check_in_location)}>
                        {fmtAddress(selectedRecord.check_in_location)}
                      </div>
                      {mapUrl(selectedRecord.check_in_location) && (
                        <a className="text-xs underline" href={mapUrl(selectedRecord.check_in_location)} target="_blank" rel="noreferrer">Ver entrada en mapas</a>
                      )}
                    </div>
                  </div>
                  {selectedRecord.check_out_location && (
                    <div className="flex items-start gap-2 sm:col-span-2">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <div>
                        <div className="truncate" title={fmtAddress(selectedRecord.check_out_location)}>
                          {fmtAddress(selectedRecord.check_out_location)}
                        </div>
                        {mapUrl(selectedRecord.check_out_location) && (
                          <a className="text-xs underline" href={mapUrl(selectedRecord.check_out_location)} target="_blank" rel="noreferrer">Ver salida en mapas</a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {(selectedRecord.check_in_photo_url || selectedRecord.check_out_photo_url) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedRecord.check_in_photo_url && (
                      <div className="rounded border p-2">
                        <div className="text-xs mb-1">Foto de entrada</div>
                        <img src={selectedRecord.check_in_photo_url} alt="Entrada" className="w-full h-40 object-cover rounded" />
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setPhotoPreviewUrl(selectedRecord.check_in_photo_url)}>
                            <Eye className="h-4 w-4 mr-1" /> Ver grande
                          </Button>
                          <a className="text-xs underline self-center" href={selectedRecord.check_in_photo_url} target="_blank" rel="noreferrer">Abrir en nueva pestaña</a>
                        </div>
                      </div>
                    )}
                    {selectedRecord.check_out_photo_url && (
                      <div className="rounded border p-2">
                        <div className="text-xs mb-1">Foto de salida</div>
                        <img src={selectedRecord.check_out_photo_url} alt="Salida" className="w-full h-40 object-cover rounded" />
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setPhotoPreviewUrl(selectedRecord.check_out_photo_url)}>
                            <Eye className="h-4 w-4 mr-1" /> Ver grande
                          </Button>
                          <a className="text-xs underline self-center" href={selectedRecord.check_out_photo_url} target="_blank" rel="noreferrer">Abrir en nueva pestaña</a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Selecciona un registro del historial.</div>
            )}

            <DialogFooter>
              <Button onClick={() => setRecordDialogOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        
        {/* Modal de foto grande */}
        {photoPreviewUrl && (
          <Dialog open={true} onOpenChange={(o) => { if (!o) setPhotoPreviewUrl(null); }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Vista de foto</DialogTitle>
              </DialogHeader>
              <img src={photoPreviewUrl} alt="Foto" className="w-full h-auto rounded" />
              <DialogFooter>
                <Button onClick={() => setPhotoPreviewUrl(null)}>Cerrar</Button>
                <a className="text-sm underline" href={photoPreviewUrl} target="_blank" rel="noreferrer">Abrir en nueva pestaña</a>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
