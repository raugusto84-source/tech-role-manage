import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckSquare, Plus, Clock, User } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  assigned_to_name: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

interface TaskMetricsProps {
  compact?: boolean;
}

export function TasksMetrics({ compact = false }: TaskMetricsProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [availableTechnicians, setAvailableTechnicians] = useState<Array<{ id: string; name: string; isIdle: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium' as 'low' | 'medium' | 'high'
  });
  const { toast } = useToast();

  useEffect(() => {
    loadTasksData();
    autoAssignTasks();
  }, []);

  const loadTasksData = async () => {
    try {
      // Mock tasks data since table doesn't exist yet
      const mockTasks: Task[] = [
        {
          id: '1',
          title: 'Revisar inventario de equipos',
          description: 'Verificar stock de equipos y materiales',
          assigned_to: '',
          assigned_to_name: 'Sin asignar',
          status: 'pending',
          priority: 'medium',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Capacitación en nuevos servicios',
          description: 'Entrenar equipo en instalación de alarmas',
          assigned_to: '',
          assigned_to_name: 'Sin asignar',
          status: 'pending',
          priority: 'high',
          created_at: new Date().toISOString()
        }
      ];

      // Get technicians and their current workload
      const { data: technicians } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('role', 'tecnico');

      // Get today's active orders by technician
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('assigned_technician')
        .in('status', ['en_proceso', 'en_camino']);

      // Get today's time records to see who's working
      const today = new Date().toISOString().split('T')[0];
      const { data: timeRecords } = await supabase
        .from('time_records')
        .select('employee_id, total_hours')
        .eq('work_date', today)
        .eq('status', 'checked_in');

      const workingTechnicians = new Set(timeRecords?.map(tr => tr.employee_id) || []);
      const busyTechnicians = new Set(activeOrders?.map(o => o.assigned_technician).filter(Boolean) || []);

      const availableTechs = technicians?.map(tech => ({
        id: tech.user_id,
        name: tech.full_name,
        isIdle: workingTechnicians.has(tech.user_id) && !busyTechnicians.has(tech.user_id)
      })) || [];

      setTasks(mockTasks);
      setAvailableTechnicians(availableTechs);
    } catch (error) {
      console.error('Error loading tasks data:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoAssignTasks = async () => {
    // Mock auto-assignment logic
    console.log('Auto-assignment system active (mock)');
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;

    // Mock task creation
    const mockTask: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      assigned_to: newTask.assigned_to || '',
      assigned_to_name: availableTechnicians.find(t => t.id === newTask.assigned_to)?.name || 'Sin asignar',
      status: 'pending',
      priority: newTask.priority,
      created_at: new Date().toISOString()
    };

    setTasks(prev => [mockTask, ...prev]);

    toast({
      title: "Tarea agregada",
      description: "La tarea ha sido creada exitosamente",
    });

    setShowAddDialog(false);
    setNewTask({ title: '', description: '', assigned_to: '', priority: 'medium' });
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const idleTechnicians = availableTechnicians.filter(t => t.isIdle).length;

  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tareas</CardTitle>
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingTasks}</div>
          <p className="text-xs text-muted-foreground">
            Tareas pendientes
          </p>
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              {idleTechnicians} técnicos libres
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tareas Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingTasks}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Técnicos Libres</CardTitle>
            <User className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{idleTechnicians}</div>
            <p className="text-xs text-muted-foreground">
              Disponibles para tareas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agregar Tarea</CardTitle>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nueva Tarea</DialogTitle>
                  <DialogDescription>
                    Crea una nueva tarea y opcionalmente asígnala a un técnico
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Título de la tarea"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  />
                  <Input
                    placeholder="Descripción (opcional)"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  />
                  <Select value={newTask.assigned_to} onValueChange={(value) => setNewTask({ ...newTask, assigned_to: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Asignar a técnico (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTechnicians.map(tech => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name} {tech.isIdle && '(Disponible)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button onClick={addTask}>Crear Tarea</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sistema de asignación automática activo
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tareas Pendientes</CardTitle>
          <CardDescription>Lista de tareas por completar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasks.slice(0, 5).map(task => (
              <div key={task.id} className="flex justify-between items-center p-3 border rounded-lg">
                <div className="space-y-1">
                  <h4 className="font-medium">{task.title}</h4>
                  {task.description && (
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  )}
                  <div className="flex gap-2">
                    <Badge variant="outline">{task.assigned_to_name}</Badge>
                    <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}>
                      {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(task.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No hay tareas pendientes
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}