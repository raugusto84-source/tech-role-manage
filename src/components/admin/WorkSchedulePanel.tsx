import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface WorkSchedule {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  work_days: number[];
  break_duration_minutes: number;
  is_active: boolean;
  created_at: string;
}

interface WorkSchedulePanelProps {
  selectedUserId: string | null;
  selectedUserRole: string | null;
}

interface User {
  user_id: string;
  full_name: string;
  role: string;
}

const weekDays = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

export function WorkSchedulePanel({ selectedUserId, selectedUserRole }: WorkSchedulePanelProps) {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    start_time: '09:00',
    end_time: '17:00',
    work_days: [1, 2, 3, 4, 5],
    break_duration_minutes: 60,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    loadSchedules();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      setFormData(prev => ({ ...prev, employee_id: selectedUserId }));
      loadSchedules();
    }
  }, [selectedUserId]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, role')
        .in('role', ['administrador', 'tecnico', 'vendedor'])
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    }
  };

  const loadSchedules = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('work_schedules')
        .select(`
          *,
          profiles!work_schedules_employee_id_fkey(full_name, role)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (selectedUserId) {
        query = query.eq('employee_id', selectedUserId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setSchedules(data || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los horarios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id) {
      toast({
        title: "Error",
        description: "Selecciona un usuario",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const scheduleData = {
        employee_id: formData.employee_id,
        start_time: formData.start_time,
        end_time: formData.end_time,
        work_days: formData.work_days,
        break_duration_minutes: formData.break_duration_minutes,
      };

      let error;
      if (editingSchedule) {
        ({ error } = await supabase
          .from('work_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id));
      } else {
        ({ error } = await supabase
          .from('work_schedules')
          .insert([scheduleData]));
      }

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Horario ${editingSchedule ? 'actualizado' : 'creado'} correctamente`,
      });

      setIsDialogOpen(false);
      setEditingSchedule(null);
      resetForm();
      loadSchedules();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el horario",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('work_schedules')
        .update({ is_active: false })
        .eq('id', scheduleId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Horario eliminado correctamente",
      });

      loadSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el horario",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: selectedUserId || '',
      start_time: '09:00',
      end_time: '17:00',
      work_days: [1, 2, 3, 4, 5],
      break_duration_minutes: 60,
    });
  };

  const startEdit = (schedule: WorkSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      employee_id: schedule.employee_id,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      work_days: schedule.work_days,
      break_duration_minutes: schedule.break_duration_minutes,
    });
    setIsDialogOpen(true);
  };

  const handleWorkDayChange = (day: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      work_days: checked 
        ? [...prev.work_days, day].sort()
        : prev.work_days.filter(d => d !== day)
    }));
  };

  const formatWorkDays = (days: number[]) => {
    return days.map(day => weekDays[day]?.label).join(', ');
  };

  const selectedUser = users.find(u => u.user_id === selectedUserId);

  return (
    <div className="space-y-6">
      {selectedUserId && selectedUser && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">
              Horarios de {selectedUser.full_name}
            </CardTitle>
            <CardDescription>
              Gestiona los horarios de trabajo del {selectedUser.role}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          {selectedUserId ? 'Horarios del Usuario Seleccionado' : 'Todos los Horarios'}
        </h3>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingSchedule(null);
                resetForm();
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuevo Horario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? 'Editar Horario' : 'Nuevo Horario'}
              </DialogTitle>
              <DialogDescription>
                Configura el horario de trabajo del empleado
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="employee_id">Usuario</Label>
                <select
                  id="employee_id"
                  value={formData.employee_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Seleccionar usuario</option>
                  {users.map(user => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.full_name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Hora de Inicio</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">Hora de Fin</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Días de Trabajo</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {weekDays.map(day => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={formData.work_days.includes(day.value)}
                        onCheckedChange={(checked) => 
                          handleWorkDayChange(day.value, checked as boolean)
                        }
                      />
                      <Label htmlFor={`day-${day.value}`} className="text-sm">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="break_duration">Duración del Break (minutos)</Label>
                <Input
                  id="break_duration"
                  type="number"
                  min="0"
                  max="180"
                  value={formData.break_duration_minutes}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    break_duration_minutes: parseInt(e.target.value) || 0 
                  }))}
                  required
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={loading}>
                  {editingSchedule ? 'Actualizar' : 'Crear'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando horarios...</p>
        </div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {selectedUserId ? 'Este usuario no tiene horarios asignados' : 'No hay horarios registrados'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {schedules.map((schedule) => {
            const user = users.find(u => u.user_id === schedule.employee_id);
            return (
              <Card key={schedule.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">
                          {user?.full_name || 'Usuario no encontrado'}
                        </h4>
                        <Badge variant="outline">
                          {user?.role || 'Sin rol'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <strong>Horario:</strong> {schedule.start_time} - {schedule.end_time}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Días:</strong> {formatWorkDays(schedule.work_days)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Break:</strong> {schedule.break_duration_minutes} minutos
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(schedule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}