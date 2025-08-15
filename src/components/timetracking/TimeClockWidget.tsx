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
  const total = Math.max(0, hours);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${h}h ${m}m`;
};

// ===== Componente principal =====
export function TimeClockWidget() {
  const { user } = useAuth();

  // Estado de hoy e historial
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  // Cámara y foto
  const [showCamera, setShowCamera] = useState(false);
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

  // ===== Cleanup cámara =====
  useEffect(() => () => stopCamera(), []);

  // ===== Conectar stream al <video> cuando se muestre =====
  useEffect(() => {
    if (!showCamera || !videoRef.current || !streamRef.current) return;
    const v = videoRef.current;
    v.muted = true; // autoplay en iOS
    v.playsInline = true;
    // @ts-expect-error: srcObject existe en runtime
    v.srcObject = streamRef.current;
    const p = v.play();
    if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
  }, [showCamera]);

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

  // ===== Cámara =====
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara no está disponible en este dispositivo');
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } } });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }
      streamRef.current = stream;
      setShowCamera(true);
    } catch (error: any) {
      toast({ title: '❌ Error de cámara', description: error?.message || 'No se pudo acceder a la cámara', variant: 'destructive' });
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

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await waitForVideoReady(video);
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      // @ts-expect-error
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const BUCKET = 'time-tracking-photos';

  // Devuelve URL renderizable: si guardaste una pública y el bucket es privado, intenta firmarla.
  const toRenderableUrl = async (raw?: string | null): Promise<string | null> => {
    if (!raw) return null;
    try {
      // Si ya parece http(s), intentamos parsear bucket y key para firmar
      if (/^https?:\/\//i.test(raw)) {
        const m = raw.match(/\/storage\/v1\/object\/[^/]+\/([^/]+)\/(.+)$/); // .../object/public|sign/{bucket}/{key}
        if (m) {
          const bucket = m[1];
          const key = decodeURIComponent(m[2]);
          const { data, error } = await supabase.storage.from(bucket).createSignedUrl(key, 60 * 60);
          return error ? raw : data.signedUrl;
        }
        return raw; // URL externa o no parseable
      }
      // Si es una ruta tipo "carpeta/archivo.jpg"
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(raw, 60 * 60);
      return error ? null : data.signedUrl;
    } catch {
      return raw ?? null;
    }
  };

  const uploadPhoto = async (dataUrl: string): Promise<string | null> => {
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const fileName = `time-record-${user?.id}-${Date.now()}.jpg`;
    const { data, error } = await supabase.storage.from(BUCKET).upload(fileName, blob, { contentType: 'image/jpeg' });
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    // Guardamos la URL pública (si el bucket es público) o la pública "teórica"; al mostrar firmamos si hace falta
    return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
  };

  // ===== Flujos de check-in / check-out =====
  const handleCheck = async (type: 'in' | 'out') => {
    if (!user) return;
    setLoading(true);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      await startCamera();
      setLoading(false);
      toast({ title: type === 'in' ? '📸 Tome una foto' : '📸 Foto de salida', description: 'Posiciónese frente a la cámara' });
    } catch (e: any) {
      toast({ title: '❌ Error', description: e.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const saveRecord = async (payload: any) => {
    const { data, error } = await supabase.from('time_records').upsert(payload).select().single();
    if (error) {
      console.error('DB error:', error);
      toast({ title: 'Error de base de datos', description: error.message, variant: 'destructive' });
      return null;
    }
    setCurrentRecord(data);
    void loadHistory();
    return data;
  };

  const confirmCheck = async (type: 'in' | 'out') => {
    if (!user || !location) return;

    let photoPublicUrl: string | null = null;
    if (showCamera) {
      const photo = await capturePhoto();
      if (photo) {
        setCapturedPhoto(photo);
        photoPublicUrl = await uploadPhoto(photo);
      }
    }
    stopCamera();

    const now = new Date();
    const base = {
      employee_id: user.id,
      work_date: (currentRecord?.work_date as string) || now.toISOString().split('T')[0],
    };

    const payload =
      type === 'in'
        ? {
            ...base,
            check_in_time: now.toISOString(),
            check_in_location: JSON.stringify(location),
            check_in_photo_url: photoPublicUrl,
            status: 'checked_in',
          }
        : {
            ...base,
            id: currentRecord?.id,
            check_out_time: now.toISOString(),
            check_out_location: JSON.stringify(location),
            check_out_photo_url: photoPublicUrl,
            status: 'checked_out',
            total_hours: currentRecord?.check_in_time
              ? (now.getTime() - new Date(currentRecord.check_in_time).getTime()) / 3600000
              : null,
          };

    const saved = await saveRecord(payload);
    if (saved) toast({ title: '✅ Registro guardado', description: `${type === 'in' ? 'Entrada' : 'Salida'} a las ${fmtTime(now.toISOString())}` });
    setLocation(null);
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
          <Button variant="outline" size="sm" onClick={() => { setHistoryOpen(true); void loadHistory(); }}>
            Ver historial
          </Button>
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

        {/* Cámara */}
        {showCamera && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="relative inline-block">
              <video ref={videoRef} autoPlay playsInline muted className="rounded-lg w-full max-w-sm border" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => confirmCheck(canCheckIn ? 'in' : 'out')} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />Capturar y {canCheckIn ? 'Entrar' : 'Salir'}
              </Button>
              <Button variant="outline" onClick={() => { stopCamera(); setLoading(false); setLocation(null); }}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* Acciones */}
        {!showCamera && (
          <div className="space-y-2">
            {canCheckIn && (
              <Button onClick={() => handleCheck('in')} disabled={loading} className="w-full" size="lg">
                {loading ? <AlertCircle className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />} Registrar Entrada
              </Button>
            )}
            {canCheckOut && (
              <Button onClick={() => handleCheck('out')} disabled={loading} variant="outline" className="w-full" size="lg">
                {loading ? <AlertCircle className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />} Registrar Salida
              </Button>
            )}
          </div>
        )}

        {/* Preview instantánea local */}
        {capturedPhoto && (
          <div className="text-center">
            <p className="text-sm font-medium mb-2">Foto capturada:</p>
            <img src={capturedPhoto} alt="Foto de registro" className="rounded-lg w-32 h-24 object-cover mx-auto border" />
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyLoading ? (
                    <TableRow><TableCell colSpan={5}>Cargando…</TableCell></TableRow>
                  ) : history.length === 0 ? (
                    <TableRow><TableCell colSpan={5}>Sin registros</TableCell></TableRow>
                  ) : (
                    history.map((r) => (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRecord(r)}>
                        <TableCell>{new Date(r.work_date || r.check_in_time).toLocaleDateString('es-ES')}</TableCell>
                        <TableCell>{fmtTime(r.check_in_time)}</TableCell>
                        <TableCell>{fmtTime(r.check_out_time)}</TableCell>
                        <TableCell>{fmtHoursAndMinutes(r.total_hours)}</TableCell>
                        <TableCell className="max-w-[240px] truncate" title={fmtAddress(r.check_in_location)}>{fmtAddress(r.check_in_location)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Detalle de un registro */}
            {selectedRecord && (
              <div className="mt-4 space-y-2 rounded-lg border p-3">
                <div className="text-sm font-medium">Detalle del registro</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Entrada:</span> {fmtTime(selectedRecord.check_in_time)}</div>
                  <div><span className="text-muted-foreground">Salida:</span> {fmtTime(selectedRecord.check_out_time)}</div>
                  <div><span className="text-muted-foreground">Total:</span> {fmtHoursAndMinutes(selectedRecord.total_hours)}</div>

                  <div className="flex items-start gap-2">
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
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedRecord.check_in_photo_url && (
                      <PhotoCard label="Foto de entrada" rawUrl={selectedRecord.check_in_photo_url} onPreview={setPhotoPreviewUrl} toRenderableUrl={toRenderableUrl} />
                    )}
                    {selectedRecord.check_out_photo_url && (
                      <PhotoCard label="Foto de salida" rawUrl={selectedRecord.check_out_photo_url} onPreview={setPhotoPreviewUrl} toRenderableUrl={toRenderableUrl} />
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedRecord(null); void loadHistory(); }}>Actualizar</Button>
              <Button onClick={() => setHistoryOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de vista previa de foto */}
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

// ===== Componente auxiliar para foto con URL firmada si es necesario =====
function PhotoCard({ label, rawUrl, onPreview, toRenderableUrl }: { label: string; rawUrl: string; onPreview: (u: string) => void; toRenderableUrl: (u?: string | null) => Promise<string | null>; }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    toRenderableUrl(rawUrl).then((u) => { if (alive) { setUrl(u); setLoading(false); } });
    return () => { alive = false; };
  }, [rawUrl]);

  return (
    <div className="rounded border p-2">
      <div className="text-xs mb-1">{label}</div>
      {loading ? (
        <div className="w-full h-32 bg-muted animate-pulse rounded" />
      ) : url ? (
        <img src={url} alt={label} className="w-full h-32 object-cover rounded" />
      ) : (
        <div className="text-xs text-muted-foreground h-32 flex items-center justify-center">No disponible</div>
      )}
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => url && onPreview(url)} disabled={!url}>
          <Eye className="h-4 w-4 mr-1" /> Ver grande
        </Button>
        {url && (
          <a className="text-xs underline self-center" href={url} target="_blank" rel="noreferrer">Abrir en nueva pestaña</a>
        )}
      </div>
    </div>
  );
}
