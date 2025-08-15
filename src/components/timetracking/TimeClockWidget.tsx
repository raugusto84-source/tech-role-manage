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
import { formatHoursAndMinutes } from '@/utils/timeUtils';

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export function TimeClockWidget() {
  const { user } = useAuth();
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      loadTodayRecord();
      loadHistory();
    }
  }, [user]);

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (!showCamera || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
  }, [showCamera]);

  const resolveAddress = async (lat: number, lng: number): Promise<string | undefined> => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'User-Agent': 'TimeTrackingApp/1.0' } });
      const j = await r.json();
      return j?.display_name;
    } catch {
      return undefined;
    }
  };

  const getCurrentLocation = (): Promise<Location> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocalización no soportada'));
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const loc: Location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const addr = await resolveAddress(loc.lat, loc.lng);
        loc.address = addr || `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
        resolve(loc);
      }, (err) => reject(new Error(`Error de geolocalización: ${err.message}`)), { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 });
    });
  };

  const parseLocation = (raw?: string | null) => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };
  const formatAddress = (raw?: string | null) => {
    const loc = parseLocation(raw);
    if (!loc) return '—';
    return loc.address || `${Number(loc.lat).toFixed(6)}, ${Number(loc.lng).toFixed(6)}`;
  };

  const loadTodayRecord = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('time_records').select('*').eq('employee_id', user.id).eq('work_date', today).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setCurrentRecord(data);
  };

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase.from('time_records').select('*').eq('employee_id', user.id).order('created_at', { ascending: false }).limit(20);
    setHistory(data || []);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' }, width: { ideal: 320 }, height: { ideal: 240 } } });
      streamRef.current = stream;
      setShowCamera(true);
    } catch (error) {
      toast({ title: '❌ Error de cámara', description: (error as any).message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setShowCamera(false);
  };

  const uploadPhoto = async (dataUrl: string) => {
    const blob = await fetch(dataUrl).then(r => r.blob());
    const fileName = `time-record-${user?.id}-${Date.now()}.jpg`;
    const { data } = await supabase.storage.from('time-tracking-photos').upload(fileName, blob, { contentType: 'image/jpeg' });
    return supabase.storage.from('time-tracking-photos').getPublicUrl(data?.path || '').data.publicUrl;
  };

  const saveRecord = async (payload: any) => {
    const { data, error } = await supabase.from('time_records').upsert(payload).select().single();
    if (!error) {
      setCurrentRecord(data);
      loadHistory();
    }
  };

  const handleCheck = async (type: 'in' | 'out') => {
    if (!user) return;
    setLoading(true);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      await startCamera();
      setLoading(false);
    } catch (e: any) {
      toast({ title: '❌ Error', description: e.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const confirmCheck = async (type: 'in' | 'out') => {
    if (!location || !user) return;
    let photoUrl = null;
    if (showCamera) {
      const photo = await capturePhoto();
      if (photo) photoUrl = await uploadPhoto(photo);
    }
    stopCamera();
    const now = new Date();
    const payload: any = type === 'in'
      ? { employee_id: user.id, check_in_time: now.toISOString(), check_in_location: JSON.stringify(location), check_in_photo_url: photoUrl, work_date: now.toISOString().split('T')[0], status: 'checked_in' }
      : { id: currentRecord?.id, check_out_time: now.toISOString(), check_out_location: JSON.stringify(location), check_out_photo_url: photoUrl, status: 'checked_out', total_hours: (now.getTime() - new Date(currentRecord.check_in_time).getTime()) / 3600000 };
    await saveRecord(payload);
    toast({ title: '✅ Registro guardado', description: `${type === 'in' ? 'Entrada' : 'Salida'} a las ${now.toLocaleTimeString('es-ES')}` });
  };

  const formatTime = (time?: string) => time ? new Date(time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Control de Horarios</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>Ver historial</Button>
        </div>
        <CardDescription>Registra tu entrada y salida diaria</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-3xl font-mono font-bold">{currentTime.toLocaleTimeString('es-ES')}</div>
          <div className="text-sm text-muted-foreground">{currentTime.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        {currentRecord && (
          <div className="space-y-2 p-3 bg-muted rounded-lg">
            <div className="flex justify-between"><span>Entrada:</span><span>{formatTime(currentRecord.check_in_time)}</span></div>
            {currentRecord.check_out_time && (
              <>
                <div className="flex justify-between"><span>Salida:</span><span>{formatTime(currentRecord.check_out_time)}</span></div>
                <div className="flex justify-between"><span>Total:</span><span>{formatHoursAndMinutes(currentRecord.total_hours)}</span></div>
              </>
            )}
          </div>
        )}
        {showCamera && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <video ref={videoRef} autoPlay playsInline muted className="rounded-lg w-full max-w-sm border" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-2">
              <Button onClick={() => confirmCheck(!currentRecord || currentRecord.status === 'checked_out' ? 'in' : 'out')} className="flex-1"><Camera className="h-4 w-4 mr-2" />Capturar y {!currentRecord || currentRecord.status === 'checked_out' ? 'Entrar' : 'Salir'}</Button>
              <Button variant="outline" onClick={() => { stopCamera(); setLoading(false); setLocation(null); }}>Cancelar</Button>
            </div>
          </div>
        )}
        {!showCamera && (
          <div className="space-y-2">
            {(!currentRecord || currentRecord.status === 'checked_out') && <Button onClick={() => handleCheck('in')} disabled={loading} className="w-full" size="lg"><CheckCircle className="h-4 w-4 mr-2" />Registrar Entrada</Button>}
            {currentRecord && currentRecord.status === 'checked_in' && <Button onClick={() => handleCheck('out')} disabled={loading} variant="outline" className="w-full" size="lg"><MapPin className="h-4 w-4 mr-2" />Registrar Salida</Button>}
          </div>
        )}
        {capturedPhoto && <img src={capturedPhoto} alt="Foto de registro" className="rounded-lg w-32 h-24 object-cover mx-auto border" />}
        {location && <div className="text-xs text-muted-foreground"><MapPin className="h-3 w-3 mr-1 inline" />{location.address}</div>}
      </CardContent>

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
                {history.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>Sin registros</TableCell></TableRow>
                ) : (
                  history.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRecord(r)}>
                      <TableCell>{new Date(r.work_date || r.check_in_time).toLocaleDateString('es-ES')}</TableCell>
                      <TableCell>{formatTime(r.check_in_time)}</TableCell>
                      <TableCell>{formatTime(r.check_out_time)}</TableCell>
                      <TableCell>{r.total_hours ? formatHoursAndMinutes(r.total_hours) : '—'}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={formatAddress(r.check_in_location)}>{formatAddress(r.check_in_location)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {selectedRecord && (
            <div className="mt-4 space-y-2 rounded-lg border p-3">
              <div className="text-sm font-medium">Detalle del registro</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Entrada:</span> {formatTime(selectedRecord.check_in_time)}</div>
                <div><span className="text-muted-foreground">Salida:</span> {formatTime(selectedRecord.check_out_time)}</div>
                <div><span className="text-muted-foreground">Total:</span> {selectedRecord.total_hours ? formatHoursAndMinutes(selectedRecord.total_hours) : '—'}</div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <div>
                    <div className="truncate" title={formatAddress(selectedRecord.check_in_location)}>{formatAddress(selectedRecord.check_in_location)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedRecord(null); loadHistory(); }}>Actualizar</Button>
            <Button onClick={() => setHistoryOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
