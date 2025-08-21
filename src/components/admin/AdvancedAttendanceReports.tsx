import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, TrendingUp, Clock, AlertTriangle, Download, Calendar } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface AttendanceStats {
  employee_id: string;
  employee_name: string;
  employee_role: string;
  total_days: number;
  worked_days: number;
  absent_days: number;
  late_days: number;
  early_departure_days: number;
  total_hours: number;
  expected_hours: number;
  overtime_hours: number;
  attendance_rate: number;
  punctuality_rate: number;
  average_daily_hours: number;
}

export function AdvancedAttendanceReports() {
  const [stats, setStats] = useState<AttendanceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    loadEmployees();
    const today = new Date();
    
    switch (reportPeriod) {
      case 'week':
        setStartDate(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'month':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
    }
  }, [reportPeriod]);

  useEffect(() => {
    if (startDate && endDate) {
      loadAttendanceStats();
    }
  }, [startDate, endDate, selectedEmployee]);

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

  const loadAttendanceStats = async () => {
    setLoading(true);
    try {
      // Get all employees or selected employee
      let employeeFilter = employees;
      if (selectedEmployee !== 'all') {
        employeeFilter = employees.filter(emp => emp.user_id === selectedEmployee);
      }

      const statsPromises = employeeFilter.map(async (employee) => {
        // Get time records for the period
        const { data: timeRecords, error: recordsError } = await supabase
          .from('time_records')
          .select('*')
          .eq('employee_id', employee.user_id)
          .gte('work_date', startDate)
          .lte('work_date', endDate);

        if (recordsError) throw recordsError;

        // Get work schedule for expected hours calculation
        const { data: schedule, error: scheduleError } = await supabase
          .from('work_schedules')
          .select('*')
          .eq('employee_id', employee.user_id)
          .eq('is_active', true)
          .single();

        if (scheduleError && scheduleError.code !== 'PGRST116') {
          console.warn('Schedule not found for employee:', employee.full_name);
        }

        const totalDays = differenceInDays(new Date(endDate), new Date(startDate)) + 1;
        const workedDays = timeRecords?.filter(r => r.status === 'checked_out').length || 0;
        const absentDays = totalDays - (timeRecords?.length || 0);
        
        // Calculate late arrivals (assuming 9:00 AM standard start time)
        const standardStartTime = schedule?.start_time || '09:00:00';
        const lateDays = timeRecords?.filter(r => {
          if (!r.check_in_time) return false;
          const checkInTime = format(new Date(r.check_in_time), 'HH:mm:ss');
          return checkInTime > standardStartTime;
        }).length || 0;

        // Calculate early departures (assuming scheduled end time)
        const standardEndTime = schedule?.end_time || '18:00:00';
        const earlyDepartureDays = timeRecords?.filter(r => {
          if (!r.check_out_time) return false;
          const checkOutTime = format(new Date(r.check_out_time), 'HH:mm:ss');
          return checkOutTime < standardEndTime;
        }).length || 0;

        const totalHours = timeRecords?.reduce((acc, r) => acc + (r.total_hours || 0), 0) || 0;
        
        // Expected hours calculation
        const dailyExpectedHours = schedule ? 
          ((new Date(`1970-01-01T${schedule.end_time}`).getTime() - 
            new Date(`1970-01-01T${schedule.start_time}`).getTime()) / (1000 * 60 * 60)) -
          ((schedule.break_duration_minutes || 60) / 60) : 8;
        
        const workDaysInPeriod = schedule?.work_days?.length || 5;
        const weeksInPeriod = totalDays / 7;
        const expectedHours = dailyExpectedHours * workDaysInPeriod * weeksInPeriod;

        const overtimeHours = Math.max(0, totalHours - expectedHours);
        const attendanceRate = totalDays > 0 ? (workedDays / totalDays) * 100 : 0;
        const punctualityRate = workedDays > 0 ? ((workedDays - lateDays) / workedDays) * 100 : 0;
        const averageDailyHours = workedDays > 0 ? totalHours / workedDays : 0;

        return {
          employee_id: employee.user_id,
          employee_name: employee.full_name,
          employee_role: employee.role,
          total_days: totalDays,
          worked_days: workedDays,
          absent_days: absentDays,
          late_days: lateDays,
          early_departure_days: earlyDepartureDays,
          total_hours: totalHours,
          expected_hours: expectedHours,
          overtime_hours: overtimeHours,
          attendance_rate: attendanceRate,
          punctuality_rate: punctualityRate,
          average_daily_hours: averageDailyHours
        } as AttendanceStats;
      });

      const results = await Promise.all(statsPromises);
      setStats(results);
    } catch (error) {
      console.error('Error loading attendance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Empleado', 'Rol', 'Días Totales', 'Días Trabajados', 'Días Ausentes',
      'Días Tarde', 'Salidas Tempranas', 'Horas Totales', 'Horas Esperadas',
      'Horas Extra', 'Tasa Asistencia (%)', 'Tasa Puntualidad (%)', 'Promedio Horas/Día'
    ];

    const csvContent = [
      headers.join(','),
      ...stats.map(stat => [
        `"${stat.employee_name}"`,
        stat.employee_role,
        stat.total_days,
        stat.worked_days,
        stat.absent_days,
        stat.late_days,
        stat.early_departure_days,
        stat.total_hours.toFixed(2),
        stat.expected_hours.toFixed(2),
        stat.overtime_hours.toFixed(2),
        stat.attendance_rate.toFixed(1),
        stat.punctuality_rate.toFixed(1),
        stat.average_daily_hours.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_asistencia_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressVariant = (rate: number): "default" | "destructive" => {
    return rate >= 75 ? "default" : "destructive";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cargando reportes...</CardTitle>
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
          <BarChart className="h-5 w-5" />
          Reportes Avanzados de Asistencia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controles de período y filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Select value={reportPeriod} onValueChange={(value: 'week' | 'month' | 'custom') => setReportPeriod(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={reportPeriod !== 'custom'}
          />

          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={reportPeriod !== 'custom'}
          />

          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los empleados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los empleados</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp.user_id} value={emp.user_id}>
                  {emp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={loadAttendanceStats} className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Generar Reporte
          </Button>

          <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Resumen general */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Empleados Reportados</div>
              <div className="text-2xl font-bold">{stats.length}</div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Asistencia Promedio</div>
              <div className={`text-2xl font-bold ${getAttendanceColor(stats.reduce((acc, s) => acc + s.attendance_rate, 0) / stats.length)}`}>
                {((stats.reduce((acc, s) => acc + s.attendance_rate, 0) / stats.length) || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Horas Totales</div>
              <div className="text-2xl font-bold">
                {stats.reduce((acc, s) => acc + s.total_hours, 0).toFixed(1)}h
              </div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Horas Extra</div>
              <div className="text-2xl font-bold text-orange-600">
                {stats.reduce((acc, s) => acc + s.overtime_hours, 0).toFixed(1)}h
              </div>
            </div>
          </div>
        )}

        {/* Lista detallada por empleado */}
        <div className="space-y-4">
          {stats.map(stat => (
            <Card key={stat.employee_id} className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{stat.employee_name}</h3>
                    <Badge variant="outline">{stat.employee_role}</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`text-2xl font-bold ${getAttendanceColor(stat.attendance_rate)}`}>
                      {stat.attendance_rate.toFixed(1)}%
                    </div>
                    {stat.attendance_rate < 75 && (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Días Trabajados</div>
                    <div className="font-semibold">{stat.worked_days}/{stat.total_days}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Ausencias</div>
                    <div className={`font-semibold ${stat.absent_days > 2 ? 'text-red-600' : ''}`}>
                      {stat.absent_days}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Tardanzas</div>
                    <div className={`font-semibold ${stat.late_days > 3 ? 'text-orange-600' : ''}`}>
                      {stat.late_days}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Horas Totales</div>
                    <div className="font-semibold">{stat.total_hours.toFixed(1)}h</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Horas Extra</div>
                    <div className="font-semibold text-orange-600">{stat.overtime_hours.toFixed(1)}h</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Promedio Diario</div>
                    <div className="font-semibold">{stat.average_daily_hours.toFixed(1)}h</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Tasa de Asistencia</span>
                    <span className={getAttendanceColor(stat.attendance_rate)}>
                      {stat.attendance_rate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={stat.attendance_rate} 
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Tasa de Puntualidad</span>
                    <span className={getAttendanceColor(stat.punctuality_rate)}>
                      {stat.punctuality_rate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={stat.punctuality_rate} 
                    className="h-2"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {stats.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay datos de asistencia para el período seleccionado.</p>
            <p className="text-sm">Selecciona un período diferente o verifica que los empleados tengan registros de tiempo.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}