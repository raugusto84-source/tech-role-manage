import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Users, Bot, UserCheck, Clock, RefreshCw, Search, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to: string | null;
  status: string;
  priority: string;
  created_at: string;
  assigned_user_name?: string;
}

interface Technician {
  user_id: string;
  full_name: string;
  current_workload: number;
  status: string;
}

interface AutoAssignmentRule {
  id: string;
  name: string;
  priority_threshold: string;
  max_workload: number;
  skill_requirements: string[];
  is_active: boolean;
}

export function TaskAssignmentManager() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [autoRules, setAutoRules] = useState<AutoAssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showAutoRuleDialog, setShowAutoRuleDialog] = useState(false);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assigned_to: "",
    priority: "medium"
  });

  const [newRule, setNewRule] = useState({
    name: "",
    priority_threshold: "high",
    max_workload: 5,
    skill_requirements: [],
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTasks(),
        loadTechnicians(),
        loadAutoAssignmentRules()
      ]);
    } catch (error) {
      console.error('Error loading task data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select(`
        *,
        profiles(full_name)
      `)
      .order('created_at', { ascending: false });

    if (data) {
      setTasks(data.map((task: any) => ({
        ...task,
        assigned_user_name: task.profiles?.full_name || null
      })));
    }
  };

  const loadTechnicians = async () => {
    // Load technicians with their current workload
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, role')
      .eq('role', 'tecnico');

    if (data) {
      const techniciansWithWorkload = await Promise.all(
        data.map(async (tech) => {
          // Count active tasks assigned to this technician
          const { count } = await supabase
            .from('tasks')
            .select('*', { count: 'exact' })
            .eq('assigned_to', tech.user_id)
            .eq('status', 'pending');

          return {
            user_id: tech.user_id,
            full_name: tech.full_name,
            current_workload: count || 0,
            status: count === 0 ? 'available' : count <= 3 ? 'busy' : 'overloaded'
          };
        })
      );
      
      setTechnicians(techniciansWithWorkload);
    }
  };

  const loadAutoAssignmentRules = async () => {
    // For now, create mock rules since we don't have a table for this yet
    setAutoRules([
      {
        id: '1',
        name: 'Alta Prioridad - Técnicos Disponibles',
        priority_threshold: 'high',
        max_workload: 3,
        skill_requirements: [],
        is_active: true
      },
      {
        id: '2',
        name: 'Distribución Equilibrada',
        priority_threshold: 'medium',
        max_workload: 5,
        skill_requirements: [],
        is_active: true
      }
    ]);
  };

  const createTask = async () => {
    try {
      let assignedTo = newTask.assigned_to || null;
      
      // If no technician selected, try auto-assignment
      if (!assignedTo) {
        assignedTo = await autoAssignTask(newTask.priority);
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: newTask.title,
          description: newTask.description,
          assigned_to: assignedTo,
          priority: newTask.priority,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Tarea creada",
        description: assignedTo 
          ? "Tarea creada y asignada automáticamente" 
          : "Tarea creada sin asignar"
      });
      
      setShowNewTaskDialog(false);
      setNewTask({ title: "", description: "", assigned_to: "", priority: "medium" });
      loadData();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la tarea",
        variant: "destructive"
      });
    }
  };

  const autoAssignTask = async (priority: string): Promise<string | null> => {
    // Find the best available technician based on workload
    const availableTechs = technicians.filter(tech => 
      tech.current_workload < 5 && tech.status !== 'overloaded'
    );

    if (availableTechs.length === 0) return null;

    // Sort by workload (ascending) to assign to least busy technician
    availableTechs.sort((a, b) => a.current_workload - b.current_workload);
    
    return availableTechs[0].user_id;
  };

  const reassignTask = async (taskId: string, newAssignee: string) => {
    try {
      await supabase
        .from('tasks')
        .update({ assigned_to: newAssignee })
        .eq('id', taskId);

      toast({
        title: "Tarea reasignada",
        description: "La tarea se ha reasignado correctamente"
      });
      
      loadData();
    } catch (error) {
      console.error('Error reassigning task:', error);
      toast({
        title: "Error",
        description: "No se pudo reasignar la tarea",
        variant: "destructive"
      });
    }
  };

  const runAutoAssignment = async () => {
    try {
      // Get all unassigned tasks
      const unassignedTasks = tasks.filter(task => !task.assigned_to && task.status === 'pending');
      
      let assignedCount = 0;
      
      for (const task of unassignedTasks) {
        const assignedTo = await autoAssignTask(task.priority);
        if (assignedTo) {
          await supabase
            .from('tasks')
            .update({ assigned_to: assignedTo })
            .eq('id', task.id);
          assignedCount++;
        }
      }

      toast({
        title: "Asignación automática completada",
        description: `Se asignaron ${assignedCount} tareas automáticamente`
      });
      
      loadData();
    } catch (error) {
      console.error('Error in auto assignment:', error);
      toast({
        title: "Error",
        description: "Error en la asignación automática",
        variant: "destructive"
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">Alta</Badge>;
      case 'medium':
        return <Badge variant="default">Media</Badge>;
      case 'low':
        return <Badge variant="secondary">Baja</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pendiente</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-50 text-blue-700">En Progreso</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-50 text-green-700">Completada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTechnicianStatusBadge = (status: string, workload: number) => {
    switch (status) {
      case 'available':
        return <Badge variant="default" className="bg-green-50 text-green-700">Disponible ({workload})</Badge>;
      case 'busy':
        return <Badge variant="default" className="bg-yellow-50 text-yellow-700">Ocupado ({workload})</Badge>;
      case 'overloaded':
        return <Badge variant="destructive">Sobrecargado ({workload})</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.assigned_user_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gestión de Tareas</h2>
          <p className="text-muted-foreground">
            Asignación manual y automática de tareas al equipo técnico
          </p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <Bot className="h-4 w-4 mr-2" />
                Auto-Asignar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Asignación Automática</AlertDialogTitle>
                <AlertDialogDescription>
                  Esto asignará automáticamente todas las tareas pendientes a los técnicos disponibles 
                  basándose en su carga de trabajo actual. ¿Continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={runAutoAssignment}>
                  <Zap className="h-4 w-4 mr-2" />
                  Ejecutar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Tarea
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Tarea</DialogTitle>
                <DialogDescription>
                  Crea una nueva tarea y asígnarla manualmente o dejar que se asigne automáticamente
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="title">Título de la Tarea</Label>
                  <Input
                    id="title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Ej: Revisar sistema de ventilación"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Describe la tarea en detalle..."
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">Prioridad</Label>
                    <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar prioridad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baja</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="assignee">Asignar a (Opcional)</Label>
                    <Select value={newTask.assigned_to} onValueChange={(value) => setNewTask({ ...newTask, assigned_to: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Auto-asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Auto-asignar</SelectItem>
                        {technicians.map(tech => (
                          <SelectItem key={tech.user_id} value={tech.user_id}>
                            {tech.full_name} ({tech.current_workload} tareas)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewTaskDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={createTask}>
                  Crear Tarea
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
          <TabsTrigger value="technicians">Técnicos</TabsTrigger>
          <TabsTrigger value="auto-rules">Reglas Auto</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Lista de Tareas</CardTitle>
                  <CardDescription>
                    Gestiona todas las tareas del equipo técnico
                  </CardDescription>
                </div>
                <Button onClick={loadData} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tareas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarea</TableHead>
                    <TableHead>Asignado a</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{task.title}</div>
                          <div className="text-sm text-muted-foreground">{task.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.assigned_user_name ? (
                          <div className="flex items-center">
                            <UserCheck className="h-4 w-4 mr-2 text-green-500" />
                            {task.assigned_user_name}
                          </div>
                        ) : (
                          <Badge variant="outline">Sin asignar</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>
                        {new Date(task.created_at).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        <Select onValueChange={(value) => reassignTask(task.id, value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Reasignar" />
                          </SelectTrigger>
                          <SelectContent>
                            {technicians.map(tech => (
                              <SelectItem key={tech.user_id} value={tech.user_id}>
                                {tech.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technicians" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estado de Técnicos</CardTitle>
              <CardDescription>
                Carga de trabajo actual de cada técnico
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tareas Activas</TableHead>
                    <TableHead>Disponibilidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicians.map((tech) => (
                    <TableRow key={tech.user_id}>
                      <TableCell className="font-medium">{tech.full_name}</TableCell>
                      <TableCell>
                        {getTechnicianStatusBadge(tech.status, tech.current_workload)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                          {tech.current_workload}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              tech.current_workload <= 2 ? 'bg-green-500' :
                              tech.current_workload <= 4 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min((tech.current_workload / 6) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auto-rules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Reglas de Asignación Automática</CardTitle>
                  <CardDescription>
                    Configura cómo se asignan automáticamente las tareas
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Regla
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {autoRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{rule.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Prioridad: {rule.priority_threshold} | Máximo: {rule.max_workload} tareas
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={rule.is_active} />
                      <Badge variant={rule.is_active ? "default" : "secondary"}>
                        {rule.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}