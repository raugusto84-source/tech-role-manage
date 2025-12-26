import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Clock, MapPin, Image, GraduationCap, Edit, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { formatDateMexico } from '@/utils/dateUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface JCFUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  jcf_training_start_date?: string;
  jcf_training_end_date?: string;
}

interface TimeRecord {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_photo_url: string | null;
  check_out_photo_url: string | null;
  check_in_location: any;
  check_out_location: any;
  total_hours: number | null;
  status: string;
  notes: string | null;
}

/**
 * Panel de historial y gestión de usuarios JCF (Jóvenes Construyendo el Futuro)
 * Muestra período de capacitación y registro de asistencia
 */
export function JCFHistoryPanel() {
  const [jcfUsers, setJcfUsers] = useState<JCFUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPeriod, setEditingPeriod] = useState<string | null>(null);
  const [periodForm, setPeriodForm] = useState({ start: '', end: '' });
  const { toast } = useToast();

  useEffect(() => {
    loadJCFUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadTimeRecords(selectedUserId);
    }
  }, [selectedUserId]);

  const loadJCFUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, phone, jcf_training_start_date, jcf_training_end_date')
        .eq('role', 'jcf' as any)
        .order('full_name');

      if (error) throw error;
      setJcfUsers(data || []);
      if (data && data.length > 0 && !selectedUserId) {
        setSelectedUserId(data[0].user_id);
      }
    } catch (error) {
      console.error('Error loading JCF users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeRecords = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('employee_id', userId)
        .order('work_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTimeRecords(data || []);
    } catch (error) {
      console.error('Error loading time records:', error);
    }
  };

  const handleSavePeriod = async (userId: string) => {
    try {
      const user = jcfUsers.find(u => u.user_id === userId);
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          jcf_training_start_date: periodForm.start || null,
          jcf_training_end_date: periodForm.end || null
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Período actualizado',
        description: 'Las fechas de capacitación JCF han sido actualizadas'
      });

      setEditingPeriod(null);
      loadJCFUsers();
    } catch (error: any) {
      console.error('Error updating period:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el período',
        variant: 'destructive'
      });
    }
  };

  const startEditPeriod = (user: JCFUser) => {
    setPeriodForm({
      start: user.jcf_training_start_date || '',
      end: user.jcf_training_end_date || ''
    });
    setEditingPeriod(user.user_id);
  };

  const calculateLateArrivals = (records: TimeRecord[]) => {
    // Consider late if check-in is after 9:00 AM (adjust as needed)
    return records.filter(r => {
      if (!r.check_in_time) return false;
      const checkInHour = new Date(r.check_in_time).getHours();
      return checkInHour >= 9;
    }).length;
  };

  const selectedUser = jcfUsers.find(u => u.user_id === selectedUserId);

  if (loading) {
    return <div className="text-center py-6">Cargando usuarios JCF...</div>;
  }

  if (jcfUsers.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No hay usuarios JCF registrados. Crea un usuario con rol "JCF" desde la pestaña de Usuarios.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de usuario JCF */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Jóvenes Construyendo el Futuro
          </CardTitle>
          <CardDescription>
            Gestión de aprendices del programa JCF - Registro de asistencia sin generación de nómina
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="jcf-user">Seleccionar Aprendiz</Label>
              <Select value={selectedUserId || ''} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar aprendiz JCF" />
                </SelectTrigger>
                <SelectContent>
                  {jcfUsers.map(user => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información del período de capacitación */}
      {selectedUser && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {selectedUser.full_name}
                </CardTitle>
                <CardDescription>{selectedUser.email}</CardDescription>
              </div>
              <Badge variant="secondary">JCF</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {editingPeriod === selectedUser.user_id ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Fecha de Inicio</Label>
                    <Input
                      type="date"
                      value={periodForm.start}
                      onChange={e => setPeriodForm(prev => ({ ...prev, start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Fecha de Fin</Label>
                    <Input
                      type="date"
                      value={periodForm.end}
                      onChange={e => setPeriodForm(prev => ({ ...prev, end: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSavePeriod(selectedUser.user_id)}>
                    <Save className="h-4 w-4 mr-1" /> Guardar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingPeriod(null)}>
                    <X className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Inicio de Capacitación</p>
                    <p className="font-medium">
                      {selectedUser.jcf_training_start_date
                        ? formatDateMexico(selectedUser.jcf_training_start_date, 'dd/MM/yyyy')
                        : 'No definido'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fin de Capacitación</p>
                    <p className="font-medium">
                      {selectedUser.jcf_training_end_date
                        ? formatDateMexico(selectedUser.jcf_training_end_date, 'dd/MM/yyyy')
                        : 'No definido'}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => startEditPeriod(selectedUser)}>
                  <Edit className="h-4 w-4 mr-1" /> Editar Período
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estadísticas rápidas */}
      {selectedUser && timeRecords.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Días Registrados</p>
              <p className="text-2xl font-bold">{timeRecords.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Llegadas Tarde</p>
              <p className="text-2xl font-bold text-destructive">{calculateLateArrivals(timeRecords)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Horas Totales</p>
              <p className="text-2xl font-bold">
                {timeRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0).toFixed(1)}h
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Historial de asistencia */}
      {selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Historial de Asistencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeRecords.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No hay registros de asistencia para este aprendiz
              </p>
            ) : (
              <div className="space-y-3">
                {timeRecords.map(record => (
                  <Card key={record.id} className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateMexico(record.work_date, 'dd/MM/yyyy')}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-green-600" />
                          Entrada: {record.check_in_time ? format(new Date(record.check_in_time), 'HH:mm') : 'N/A'}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-red-600" />
                          Salida: {record.check_out_time ? format(new Date(record.check_out_time), 'HH:mm') : 'N/A'}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <span className="font-medium">
                            {record.total_hours ? `${record.total_hours.toFixed(1)}h` : 'En progreso'}
                          </span>
                        </div>
                      </div>

                      {/* Fotos de entrada/salida */}
                      <div className="flex gap-4 mt-3">
                        {record.check_in_photo_url && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="flex items-center gap-1">
                                <Image className="h-3 w-3" />
                                Foto Entrada
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle>Foto de Entrada</DialogTitle>
                              </DialogHeader>
                              <img
                                src={record.check_in_photo_url}
                                alt="Foto de entrada"
                                className="w-full rounded-lg"
                              />
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <strong>Fecha:</strong> {formatDateMexico(record.work_date, 'dd/MM/yyyy')}
                                </div>
                                <div>
                                  <strong>Hora:</strong> {record.check_in_time ? format(new Date(record.check_in_time), 'HH:mm') : 'N/A'}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        
                        {record.check_out_photo_url && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="flex items-center gap-1">
                                <Image className="h-3 w-3" />
                                Foto Salida
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle>Foto de Salida</DialogTitle>
                              </DialogHeader>
                              <img
                                src={record.check_out_photo_url}
                                alt="Foto de salida"
                                className="w-full rounded-lg"
                              />
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <strong>Fecha:</strong> {formatDateMexico(record.work_date, 'dd/MM/yyyy')}
                                </div>
                                <div>
                                  <strong>Hora:</strong> {record.check_out_time ? format(new Date(record.check_out_time), 'HH:mm') : 'N/A'}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
