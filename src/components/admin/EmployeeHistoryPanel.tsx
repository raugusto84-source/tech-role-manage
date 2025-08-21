import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Clock, MapPin, Image } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface TimeRecord {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_time: string;
  check_out_time?: string;
  check_in_location?: any;
  check_out_location?: any;
  total_hours?: number;
  status: string;
  check_in_photo_url?: string;
  check_out_photo_url?: string;
  notes?: string;
  profiles: {
    full_name: string;
    email: string;
    role: string;
  } | null;
}

export function EmployeeHistoryPanel() {
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20;

  useEffect(() => {
    loadEmployees();
    loadRecords();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [records, selectedEmployee, dateFrom, dateTo, statusFilter]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, role')
        .in('role', ['tecnico', 'vendedor', 'administrador', 'supervisor'])
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .order('work_date', { ascending: false })
        .order('check_in_time', { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Get profiles separately and match them
      const employeeIds = [...new Set((data || []).map(record => record.employee_id))];
      
      let profilesData: any[] = [];
      if (employeeIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, role')
          .in('user_id', employeeIds);
        
        if (!profilesError) {
          profilesData = profiles || [];
        }
      }

      // Transform and match records with profiles
      const transformedRecords = (data || []).map(record => {
        const matchingProfile = profilesData.find(p => p.user_id === record.employee_id);
        return {
          ...record,
          profiles: matchingProfile ? {
            full_name: matchingProfile.full_name,
            email: matchingProfile.email,
            role: matchingProfile.role
          } : null
        };
      }) as TimeRecord[];
      
      setRecords(transformedRecords);
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...records];

    if (selectedEmployee !== 'all') {
      filtered = filtered.filter(record => record.employee_id === selectedEmployee);
    }

    if (dateFrom) {
      filtered = filtered.filter(record => record.work_date >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(record => record.work_date <= dateTo);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(record => record.status === statusFilter);
    }

    setFilteredRecords(filtered);
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      checked_in: { label: 'Entrada', variant: 'default' as const },
      checked_out: { label: 'Completo', variant: 'default' as const },
      incomplete: { label: 'Incompleto', variant: 'destructive' as const }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatLocation = (location: any) => {
    if (!location) return 'No disponible';
    return `${location.latitude?.toFixed(6)}, ${location.longitude?.toFixed(6)}`;
  };

  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cargando historial...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Historial Completo de Empleados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los empleados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los empleados</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp.user_id} value={emp.user_id}>
                  {emp.full_name} ({emp.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            placeholder="Fecha desde"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />

          <Input
            type="date"
            placeholder="Fecha hasta"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="checked_in">Solo entrada</SelectItem>
              <SelectItem value="checked_out">Completo</SelectItem>
              <SelectItem value="incomplete">Incompleto</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => {
            setSelectedEmployee('all');
            setDateFrom('');
            setDateTo('');
            setStatusFilter('all');
          }} variant="outline">
            Limpiar Filtros
          </Button>
        </div>

        {/* Estadísticas resumidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Total Registros</div>
            <div className="text-2xl font-bold">{filteredRecords.length}</div>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Completos</div>
            <div className="text-2xl font-bold text-green-600">
              {filteredRecords.filter(r => r.status === 'checked_out').length}
            </div>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Incompletos</div>
            <div className="text-2xl font-bold text-red-600">
              {filteredRecords.filter(r => r.status !== 'checked_out').length}
            </div>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Horas Totales</div>
            <div className="text-2xl font-bold">
              {filteredRecords.reduce((acc, r) => acc + (r.total_hours || 0), 0).toFixed(1)}
            </div>
          </div>
        </div>

        {/* Lista de registros */}
        <div className="space-y-3">
          {paginatedRecords.map(record => (
            <Card key={record.id} className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{record.profiles?.full_name || 'Usuario desconocido'}</span>
                    <Badge variant="outline">{record.profiles?.role || 'Sin rol'}</Badge>
                  </div>
                    {getStatusBadge(record.status)}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(record.work_date), 'dd/MM/yyyy', { locale: es })}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Entrada: {record.check_in_time ? format(new Date(record.check_in_time), 'HH:mm') : 'N/A'}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Salida: {record.check_out_time ? format(new Date(record.check_out_time), 'HH:mm') : 'N/A'}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Total: {record.total_hours ? `${record.total_hours.toFixed(1)}h` : 'N/A'}
                    </div>
                  </div>

                  {record.notes && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Notas:</strong> {record.notes}
                    </div>
                  )}
                </div>

                {/* Fotos e información de ubicación */}
                <div className="flex gap-2">
                  {record.check_in_photo_url && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                          <Image className="h-3 w-3" />
                          Entrada
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Foto de Entrada - {record.profiles?.full_name || 'Usuario'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <img 
                            src={record.check_in_photo_url} 
                            alt="Foto de entrada" 
                            className="w-full rounded-lg"
                          />
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong>Fecha:</strong> {format(new Date(record.work_date), 'dd/MM/yyyy')}
                            </div>
                            <div>
                              <strong>Hora:</strong> {record.check_in_time ? format(new Date(record.check_in_time), 'HH:mm') : 'N/A'}
                            </div>
                            <div className="col-span-2">
                              <strong>Ubicación:</strong>
                              <div className="flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                {formatLocation(record.check_in_location)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {record.check_out_photo_url && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                          <Image className="h-3 w-3" />
                          Salida
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Foto de Salida - {record.profiles?.full_name || 'Usuario'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <img 
                            src={record.check_out_photo_url} 
                            alt="Foto de salida" 
                            className="w-full rounded-lg"
                          />
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong>Fecha:</strong> {format(new Date(record.work_date), 'dd/MM/yyyy')}
                            </div>
                            <div>
                              <strong>Hora:</strong> {record.check_out_time ? format(new Date(record.check_out_time), 'HH:mm') : 'N/A'}
                            </div>
                            <div className="col-span-2">
                              <strong>Ubicación:</strong>
                              <div className="flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                {formatLocation(record.check_out_location)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
            </Button>
          </div>
        )}

        {paginatedRecords.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No se encontraron registros con los filtros aplicados.
          </div>
        )}
      </CardContent>
    </Card>
  );
}