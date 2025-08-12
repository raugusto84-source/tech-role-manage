import { useState, useEffect } from 'react';
import { Calendar, Download, Users, Clock, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatHoursAndMinutes, formatHoursCompact } from '@/utils/timeUtils';

interface Employee {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface WeeklyReport {
  id: string;
  employee_id: string;
  employee_name: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  days_worked: number;
  report_data: any;
}

/**
 * Componente para generar y visualizar reportes semanales de tiempo
 * Solo accesible para administradores y supervisores
 */
export function WeeklyTimeReport() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeek());
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Solo mostrar si es administrador o supervisor
  if (!profile || !['administrador', 'supervisor'].includes(profile.role)) {
    return null;
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadWeeklyReports();
    }
  }, [selectedEmployee, selectedWeek]);

  function getCurrentWeek(): string {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split('T')[0];
  }

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, role')
        .in('role', ['administrador', 'supervisor', 'vendedor', 'tecnico'])
        .order('full_name');

      if (error) throw error;

      const employeeList = data.map(profile => ({
        id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role
      }));

      setEmployees(employeeList);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los empleados",
        variant: "destructive"
      });
    }
  };

  const loadWeeklyReports = async () => {
    setLoading(true);
    try {
      const weekStart = new Date(selectedWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // Primero obtener los reportes
      let reportsQuery = supabase
        .from('weekly_reports')
        .select('*')
        .eq('week_start_date', weekStart.toISOString().split('T')[0]);

      if (selectedEmployee !== 'all') {
        reportsQuery = reportsQuery.eq('employee_id', selectedEmployee);
      }

      const { data: reportsData, error: reportsError } = await reportsQuery;

      if (reportsError) throw reportsError;

      // Luego obtener los perfiles de los empleados
      if (!reportsData || reportsData.length === 0) {
        setReports([]);
        return;
      }

      const employeeIds = reportsData.map(report => report.employee_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', employeeIds);

      if (profilesError) throw profilesError;

      // Combinar los datos
      const reportList = reportsData.map(report => {
        const profile = profilesData?.find(p => p.user_id === report.employee_id);
        return {
          id: report.id,
          employee_id: report.employee_id,
          employee_name: profile?.full_name || 'Empleado no encontrado',
          total_hours: report.total_hours,
          regular_hours: report.regular_hours,
          overtime_hours: report.overtime_hours,
          days_worked: report.days_worked,
          report_data: report.report_data
        };
      });

      setReports(reportList);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los reportes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateWeeklyReports = async () => {
    setGenerating(true);
    try {
      const weekStart = new Date(selectedWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const employeesToProcess = selectedEmployee === 'all' 
        ? employees.map(emp => emp.id)
        : [selectedEmployee];

      // Generar reportes para cada empleado seleccionado
      for (const employeeId of employeesToProcess) {
        const { error } = await supabase.rpc('generate_weekly_report', {
          p_employee_id: employeeId,
          p_week_start: weekStart.toISOString().split('T')[0],
          p_week_end: weekEnd.toISOString().split('T')[0]
        });

        if (error) {
          console.error(`Error generating report for employee ${employeeId}:`, error);
        }
      }

      await loadWeeklyReports();
      
      toast({
        title: "Reportes generados",
        description: "Los reportes semanales han sido generados exitosamente",
      });
    } catch (error) {
      console.error('Error generating reports:', error);
      toast({
        title: "Error al generar reportes",
        description: "No se pudieron generar los reportes semanales",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const exportToCSV = () => {
    if (reports.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay reportes para exportar",
        variant: "destructive"
      });
      return;
    }

    const csvContent = [
      ['Empleado', 'Horas Totales', 'Horas Regulares', 'Horas Extra', 'Días Trabajados'],
      ...reports.map(report => [
        report.employee_name,
        formatHoursCompact(report.total_hours),
        formatHoursCompact(report.regular_hours),
        formatHoursCompact(report.overtime_hours),
        report.days_worked.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_semanal_${selectedWeek}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTotalSummary = () => {
    const totalHours = reports.reduce((sum, report) => sum + report.total_hours, 0);
    const totalRegular = reports.reduce((sum, report) => sum + report.regular_hours, 0);
    const totalOvertime = reports.reduce((sum, report) => sum + report.overtime_hours, 0);
    
    return { totalHours, totalRegular, totalOvertime };
  };

  const getWeekOptions = () => {
    const options = [];
    const today = new Date();
    
    // Generar opciones para las últimas 8 semanas
    for (let i = 0; i < 8; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1 - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const startStr = weekStart.toISOString().split('T')[0];
      const label = `${weekStart.toLocaleDateString('es-ES')} - ${weekEnd.toLocaleDateString('es-ES')}`;
      
      options.push({ value: startStr, label });
    }
    
    return options;
  };

  const summary = getTotalSummary();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Reportes Semanales de Tiempo
          </CardTitle>
          <CardDescription>
            Genera y visualiza reportes de horas trabajadas por empleado
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Empleado</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Todos los empleados
                    </div>
                  </SelectItem>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name} ({employee.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Semana</label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar semana" />
                </SelectTrigger>
                <SelectContent>
                  {getWeekOptions().map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={generateWeeklyReports}
              disabled={generating || !selectedWeek}
              className="flex-1"
            >
              {generating ? (
                <Clock className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <BarChart3 className="h-4 w-4 mr-2" />
              )}
              Generar Reportes
            </Button>
            
            <Button
              onClick={exportToCSV}
              disabled={reports.length === 0}
              variant="outline"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      {reports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{formatHoursAndMinutes(summary.totalHours)}</div>
              <div className="text-sm text-muted-foreground">Horas Totales</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{formatHoursAndMinutes(summary.totalRegular)}</div>
              <div className="text-sm text-muted-foreground">Horas Regulares</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{formatHoursAndMinutes(summary.totalOvertime)}</div>
              <div className="text-sm text-muted-foreground">Horas Extra</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla de reportes */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p>Cargando reportes...</p>
          </CardContent>
        </Card>
      ) : reports.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Días</TableHead>
                  <TableHead className="text-right">Horas Totales</TableHead>
                  <TableHead className="text-right">Regulares</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Promedio/Día</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map(report => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {report.employee_name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">
                        {report.days_worked}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatHoursAndMinutes(report.total_hours)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatHoursAndMinutes(report.regular_hours)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {report.overtime_hours > 0 ? (
                        <Badge variant="secondary">
                          {formatHoursAndMinutes(report.overtime_hours)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0h 0m</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {report.days_worked > 0 
                        ? formatHoursAndMinutes(report.total_hours / report.days_worked)
                        : '0h 0m'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Sin reportes disponibles</h3>
            <p className="text-muted-foreground mb-4">
              No hay reportes generados para la semana seleccionada
            </p>
            <Button onClick={generateWeeklyReports} disabled={generating}>
              Generar Reportes
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}