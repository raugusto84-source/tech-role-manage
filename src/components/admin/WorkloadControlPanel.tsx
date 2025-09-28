import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OrderProgressBar } from "@/components/orders/OrderProgressBar";
import { 
  Clock, 
  AlertTriangle, 
  Filter,
  Search,
  RefreshCw,
  User,
  Calendar,
  Timer
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface WorkOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  estimated_delivery_date: string | null;
  priority_level: 'baja' | 'media' | 'alta' | 'critica';
  time_elapsed_hours: number;
  clients: {
    name: string;
  } | null;
  technician_name: string | null;
  service_type: string;
  failure_description: string;
  estimated_cost: number;
}

type SortField = 'priority' | 'time' | 'created_at' | 'delivery_date' | 'status';
type SortOrder = 'asc' | 'desc';

const PRIORITY_ORDER = { 'critica': 4, 'alta': 3, 'media': 2, 'baja': 1 };
const STATUS_LABELS = {
  'pendiente_aprobacion': 'Pendiente Aprobación',
  'pendiente': 'Pendiente',
  'en_camino': 'En Camino',
  'en_proceso': 'En Proceso',
  'pendiente_entrega': 'Pendiente Entrega',
  'finalizada': 'Finalizada',
  'cancelada': 'Cancelada',
  'rechazada': 'Rechazada'
};

export function WorkloadControlPanel() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const { toast } = useToast();

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [orders, searchTerm, statusFilter, priorityFilter, sortField, sortOrder]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          created_at,
          estimated_delivery_date,
          failure_description,
          estimated_cost,
          assigned_technician,
          clients!inner(name)
        `)
        .in('status', ['pendiente_aprobacion', 'pendiente', 'en_camino', 'en_proceso', 'pendiente_entrega'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get technician names separately
      const orderIds = data?.map(order => order.id) || [];
      const technicianIds = data?.map(order => order.assigned_technician).filter(Boolean) || [];
      
      let technicians: { [key: string]: string } = {};
      if (technicianIds.length > 0) {
        const { data: techData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', technicianIds);
        
        technicians = techData?.reduce((acc, tech) => {
          acc[tech.user_id] = tech.full_name;
          return acc;
        }, {} as { [key: string]: string }) || {};
      }

      // Transform data and calculate additional fields
      const transformedOrders: WorkOrder[] = (data || []).map(order => {
        const createdAt = new Date(order.created_at);
        const now = new Date();
        const timeElapsedHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        
        // Calculate priority based on time elapsed and delivery date
        let priority: 'baja' | 'media' | 'alta' | 'critica' = 'media';
        
        if (order.estimated_delivery_date) {
          const deliveryDate = new Date(order.estimated_delivery_date);
          const daysUntilDelivery = (deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysUntilDelivery < 0) priority = 'critica'; // Overdue
          else if (daysUntilDelivery < 1) priority = 'alta'; // Due today
          else if (daysUntilDelivery < 3) priority = 'media'; // Due soon
          else priority = 'baja'; // Not urgent
        } else if (timeElapsedHours > 72) {
          priority = 'critica'; // Long pending
        } else if (timeElapsedHours > 48) {
          priority = 'alta';
        }

        return {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          created_at: order.created_at,
          estimated_delivery_date: order.estimated_delivery_date,
          priority_level: priority,
          time_elapsed_hours: timeElapsedHours,
          clients: order.clients,
          technician_name: order.assigned_technician ? technicians[order.assigned_technician] || null : null,
          service_type: 'Servicio TI', // Default, could be expanded
          failure_description: order.failure_description || '',
          estimated_cost: order.estimated_cost || 0
        };
      });

      setOrders(transformedOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...orders];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.failure_description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(order => order.priority_level === priorityFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'priority':
          aValue = PRIORITY_ORDER[a.priority_level];
          bValue = PRIORITY_ORDER[b.priority_level];
          break;
        case 'time':
          aValue = a.time_elapsed_hours;
          bValue = b.time_elapsed_hours;
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'delivery_date':
          aValue = a.estimated_delivery_date ? new Date(a.estimated_delivery_date).getTime() : 0;
          bValue = b.estimated_delivery_date ? new Date(b.estimated_delivery_date).getTime() : 0;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    setFilteredOrders(filtered);
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      'critica': <Badge className="bg-red-600 text-white">Crítica</Badge>,
      'alta': <Badge className="bg-orange-500 text-white">Alta</Badge>,
      'media': <Badge className="bg-yellow-500 text-white">Media</Badge>,
      'baja': <Badge className="bg-green-500 text-white">Baja</Badge>
    };
    
    return variants[priority as keyof typeof variants] || variants.media;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'pendiente_aprobacion': <Badge variant="outline" className="border-blue-500 text-blue-600">Pendiente Aprobación</Badge>,
      'pendiente': <Badge variant="outline" className="border-gray-500 text-gray-600">Pendiente</Badge>,
      'en_camino': <Badge variant="outline" className="border-purple-500 text-purple-600">En Camino</Badge>,
      'en_proceso': <Badge variant="outline" className="border-green-500 text-green-600">En Proceso</Badge>,
      'pendiente_entrega': <Badge variant="outline" className="border-orange-500 text-orange-600">Pendiente Entrega</Badge>
    };
    
    return variants[status as keyof typeof variants] || <Badge variant="outline">{status}</Badge>;
  };

  const formatTimeElapsed = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    } else if (hours < 24) {
      return `${Math.round(hours)} h`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return `${days}d ${remainingHours}h`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const criticalOrders = filteredOrders.filter(o => o.priority_level === 'critica').length;
  const highPriorityOrders = filteredOrders.filter(o => o.priority_level === 'alta').length;
  const overdueOrders = filteredOrders.filter(o => {
    if (!o.estimated_delivery_date) return false;
    return new Date(o.estimated_delivery_date) < new Date();
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Panel de Control de Carga de Trabajo</h2>
          <p className="text-muted-foreground">
            Gestión y seguimiento de órdenes activas por prioridad y tiempo
          </p>
        </div>
        <Button onClick={loadOrders} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activas</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredOrders.length}</div>
            <p className="text-xs text-muted-foreground">
              órdenes en progreso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalOrders}</div>
            <p className="text-xs text-muted-foreground">
              requieren atención inmediata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alta Prioridad</CardTitle>
            <Timer className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{highPriorityOrders}</div>
            <p className="text-xs text-muted-foreground">
              necesitan seguimiento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            <Calendar className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueOrders}</div>
            <p className="text-xs text-muted-foreground">
              pasaron fecha límite
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros y Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar órdenes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pendiente_aprobacion">Pendiente Aprobación</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_camino">En Camino</SelectItem>
                <SelectItem value="en_proceso">En Proceso</SelectItem>
                <SelectItem value="pendiente_entrega">Pendiente Entrega</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las prioridades</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
              <SelectTrigger>
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Prioridad</SelectItem>
                <SelectItem value="time">Tiempo transcurrido</SelectItem>
                <SelectItem value="created_at">Fecha creación</SelectItem>
                <SelectItem value="delivery_date">Fecha entrega</SelectItem>
                <SelectItem value="status">Estado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
              <SelectTrigger>
                <SelectValue placeholder="Orden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descendente</SelectItem>
                <SelectItem value="asc">Ascendente</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setPriorityFilter('all');
                setSortField('priority');
                setSortOrder('desc');
              }}
            >
              Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Órdenes de Trabajo Activas</CardTitle>
          <CardDescription>
            Lista detallada de todos los trabajos en progreso ordenados por prioridad
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Tiempo Transcurrido</TableHead>
                <TableHead>Fecha Entrega</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Costo Est.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id} className={order.priority_level === 'critica' ? 'bg-red-50' : ''}>
                  <TableCell className="font-medium">
                    {order.order_number}
                    <div className="text-xs text-muted-foreground mt-1">
                      {order.failure_description.length > 30 
                        ? `${order.failure_description.substring(0, 30)}...`
                        : order.failure_description
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    {getPriorityBadge(order.priority_level)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {order.clients?.name || 'Sin cliente'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(order.status)}
                  </TableCell>
                  <TableCell>
                    <OrderProgressBar 
                      orderId={order.id} 
                      status={order.status}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className={`font-medium ${order.time_elapsed_hours > 48 ? 'text-red-600' : ''}`}>
                        {formatTimeElapsed(order.time_elapsed_hours)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(order.created_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.estimated_delivery_date ? (
                      <div className="flex flex-col">
                        <span className={new Date(order.estimated_delivery_date) < new Date() ? 'text-red-600 font-medium' : ''}>
                          {new Date(order.estimated_delivery_date).toLocaleDateString('es-ES')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(order.estimated_delivery_date), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sin fecha</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.technician_name || (
                      <span className="text-orange-600 font-medium">Sin asignar</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      ${order.estimated_cost?.toLocaleString('es-ES') || '0'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' 
                ? 'No se encontraron órdenes con los filtros aplicados'
                : 'No hay órdenes activas en este momento'
              }
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}