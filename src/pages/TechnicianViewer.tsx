import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye, Users, Clock, CheckCircle, Search } from 'lucide-react';



interface Order {
  id: string;
  order_number: string;
  client_name: string;
  status: string;
  estimated_cost: number;
  assigned_technician: string | null;
  technician_name?: string;
  created_at: string;
  updated_at: string;
  service_description: string;
}

interface Technician {
  user_id: string;
  full_name: string;
  status: 'online' | 'offline';
  current_orders: number;
  last_activity?: string;
}

export default function TechnicianViewer() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [technicianFilter, setTechnicianFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderCounts, setOrderCounts] = useState({
    pendiente_aprobacion: 0,
    pendiente: 0,
    pendiente_entrega: 0,
    total: 0
  });

  useEffect(() => {
    document.title = "Visor Técnico | SYSLAG";
    loadData();
    
    // Set up real-time updates for orders
    const ordersChannel = supabase
      .channel('orders-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'orders' }, 
        () => loadOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadOrders(), loadTechnicians()]);
    setLoading(false);
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          estimated_cost,
          assigned_technician,
          created_at,
          updated_at,
          status,
          client_id,
          service_type
        `)
        .in('status', ['pendiente_aprobacion', 'pendiente', 'en_camino', 'en_proceso', 'pendiente_entrega', 'finalizada'])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Get client and technician names separately
      const formattedOrders = await Promise.all((data || []).map(async (order) => {
        let technician_name = 'Sin asignar';
        let client_name = 'Cliente desconocido';
        
        if (order.assigned_technician) {
          const { data: techProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', order.assigned_technician)
            .single();
          
          technician_name = techProfile?.full_name || 'Sin asignar';
        }

        if (order.client_id) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('name')
            .eq('id', order.client_id)
            .single();
          
          client_name = clientData?.name || 'Cliente desconocido';
        }
        
        return {
          id: order.id,
          order_number: order.order_number,
          client_name,
          status: order.status,
          estimated_cost: order.estimated_cost,
          assigned_technician: order.assigned_technician,
          created_at: order.created_at,
          updated_at: order.updated_at,
          service_description: order.service_type || 'Servicio técnico',
          technician_name
        };
      }));

      setOrders(formattedOrders);
      
      // Calculate order counts
      const counts = {
        pendiente_aprobacion: formattedOrders.filter(o => o.status === 'pendiente_aprobacion').length,
        pendiente: formattedOrders.filter(o => o.status === 'pendiente').length,
        pendiente_entrega: formattedOrders.filter(o => o.status === 'pendiente_entrega').length,
        total: formattedOrders.length
      };
      setOrderCounts(counts);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes",
        variant: "destructive"
      });
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data: technicianData, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('role', 'tecnico');

      if (error) throw error;

      // Get technician activity and current orders
      const techniciansWithActivity = await Promise.all(
        (technicianData || []).map(async (tech) => {
          // Check if technician has active time record today
          const { data: timeRecord } = await supabase
            .from('time_records')
            .select('check_in_time, check_out_time')
            .eq('employee_id', tech.user_id)
            .eq('work_date', new Date().toISOString().split('T')[0])
            .single();

          const isOnline = timeRecord?.check_in_time && !timeRecord?.check_out_time;

          // Count current orders
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact' })
            .eq('assigned_technician', tech.user_id)
            .in('status', ['pendiente', 'en_camino', 'en_proceso']);

          return {
            user_id: tech.user_id,
            full_name: tech.full_name,
            status: (isOnline ? 'online' : 'offline') as 'online' | 'offline',
            current_orders: count || 0,
            last_activity: timeRecord?.check_in_time
          };
        })
      );

      setTechnicians(techniciansWithActivity);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'pendiente_aprobacion': { label: 'Pendiente Aprobación', variant: 'outline' as const, className: 'bg-red-50 text-red-700' },
      'pendiente': { label: 'Pendiente', variant: 'outline' as const, className: 'bg-yellow-50 text-yellow-700' },
      'en_camino': { label: 'En Camino', variant: 'default' as const, className: 'bg-blue-50 text-blue-700' },
      'en_proceso': { label: 'En Proceso', variant: 'default' as const, className: 'bg-orange-50 text-orange-700' },
      'pendiente_entrega': { label: 'Pendiente Entrega', variant: 'default' as const, className: 'bg-purple-50 text-purple-700' },
      'finalizada': { label: 'Finalizada', variant: 'default' as const, className: 'bg-green-50 text-green-700' }
    };

    const config = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const, className: '' };
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.service_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.technician_name && order.technician_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesTechnician = technicianFilter === 'all' || order.assigned_technician === technicianFilter;
    
    return matchesSearch && matchesStatus && matchesTechnician;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Visor Técnico</h1>
          <p className="text-muted-foreground">
            Supervisión en tiempo real de todas las operaciones técnicas
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendientes Aprobación</p>
                  <p className="text-2xl font-bold text-red-600">{orderCounts.pendiente_aprobacion}</p>
                </div>
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  ⏳
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-600">{orderCounts.pendiente}</p>
                </div>
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  📋
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendientes Entrega</p>
                  <p className="text-2xl font-bold text-purple-600">{orderCounts.pendiente_entrega}</p>
                </div>
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  🚚
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Órdenes</p>
                  <p className="text-2xl font-bold text-blue-600">{orderCounts.total}</p>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  📊
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="orders">Órdenes Activas</TabsTrigger>
            <TabsTrigger value="technicians">Personal Técnico</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Órdenes en Seguimiento
                </CardTitle>
                <CardDescription>
                  Todas las órdenes asignadas, en proceso y finalizadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por orden, cliente, descripción o técnico..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="pendiente_aprobacion">Pendiente Aprobación</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="en_camino">En Camino</SelectItem>
                      <SelectItem value="en_proceso">En Proceso</SelectItem>
                      <SelectItem value="pendiente_entrega">Pendiente Entrega</SelectItem>
                      <SelectItem value="finalizada">Finalizada</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los técnicos</SelectItem>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.user_id} value={tech.user_id}>
                          {tech.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Última Actualización</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.order_number}</div>
                            <div className="text-sm text-muted-foreground">
                              {order.service_description.substring(0, 50)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{order.client_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              technicians.find(t => t.user_id === order.assigned_technician)?.status === 'online' 
                                ? 'bg-green-500' 
                                : 'bg-gray-300'
                            }`} />
                            {order.technician_name}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>{formatCurrency(order.estimated_cost)}</TableCell>
                        <TableCell>
                          {new Date(order.updated_at).toLocaleDateString('es-CO', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {filteredOrders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No se encontraron órdenes con los filtros aplicados
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="technicians" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Personal Técnico Activo
                </CardTitle>
                <CardDescription>
                  Estado y carga de trabajo del equipo técnico
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {technicians.map((technician) => (
                    <Card key={technician.user_id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              technician.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                            }`} />
                            <h4 className="font-medium">{technician.full_name}</h4>
                          </div>
                          <Badge variant={technician.status === 'online' ? 'default' : 'secondary'}>
                            {technician.status === 'online' ? 'En línea' : 'Desconectado'}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-blue-500" />
                            <span>Órdenes activas: {technician.current_orders}</span>
                          </div>
                          
                          {technician.last_activity && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>
                                Entrada: {new Date(technician.last_activity).toLocaleTimeString('es-CO', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-muted-foreground">
                            Carga de trabajo: {technician.current_orders === 0 ? 'Disponible' : 
                              technician.current_orders <= 2 ? 'Normal' : 'Alta'}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {technicians.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay técnicos registrados en el sistema
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}