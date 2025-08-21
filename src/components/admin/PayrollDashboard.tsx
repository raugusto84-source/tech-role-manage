import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Calculator, FileText, Download, Calendar, AlertCircle } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface PayrollData {
  employee_id: string;
  employee_name: string;
  regular_hours: number;
  overtime_hours: number;
  regular_pay: number;
  overtime_pay: number;
  total_pay: number;
  days_worked: number;
}

interface WeeklyReport {
  id: string;
  employee_id: string;
  week_start_date: string;
  week_end_date: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  days_worked: number;
}

export function PayrollDashboard() {
  const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  useEffect(() => {
    loadEmployees();
    // Set current week as default
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    setSelectedWeek(format(currentWeekStart, 'yyyy-MM-dd'));
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadWeeklyReports();
      calculatePayroll();
    }
  }, [selectedWeek, selectedEmployee]);

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

  const loadWeeklyReports = async () => {
    try {
      const weekStart = new Date(selectedWeek);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      let query = supabase
        .from('weekly_reports')
        .select('*')
        .eq('week_start_date', format(weekStart, 'yyyy-MM-dd'))
        .eq('week_end_date', format(weekEnd, 'yyyy-MM-dd'));

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setWeeklyReports(data || []);
    } catch (error) {
      console.error('Error loading weekly reports:', error);
    }
  };

  const calculatePayroll = async () => {
    if (!selectedWeek) return;
    
    setLoading(true);
    try {
      const weekStart = new Date(selectedWeek);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      let employeesToProcess = employees;
      if (selectedEmployee !== 'all') {
        employeesToProcess = employees.filter(emp => emp.user_id === selectedEmployee);
      }

      const payrollPromises = employeesToProcess.map(async (employee) => {
        const { data, error } = await supabase.rpc('calculate_employee_weekly_payroll', {
          p_employee_id: employee.user_id,
          p_week_start: format(weekStart, 'yyyy-MM-dd'),
          p_week_end: format(weekEnd, 'yyyy-MM-dd')
        });

        if (error) {
          console.error(`Error calculating payroll for ${employee.full_name}:`, error);
          return null;
        }

        return data?.[0] || null;
      });

      const results = await Promise.all(payrollPromises);
      const validResults = results.filter(result => result !== null) as PayrollData[];
      setPayrollData(validResults);
    } catch (error) {
      console.error('Error calculating payroll:', error);
      toast.error('Error al calcular la nómina');
    } finally {
      setLoading(false);
    }
  };

  const generateWeeklyReports = async () => {
    if (!selectedWeek) return;

    setGenerating(true);
    try {
      const weekStart = new Date(selectedWeek);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      let employeesToProcess = employees;
      if (selectedEmployee !== 'all') {
        employeesToProcess = employees.filter(emp => emp.user_id === selectedEmployee);
      }

      const reportPromises = employeesToProcess.map(async (employee) => {
        const { data, error } = await supabase.rpc('generate_weekly_report', {
          p_employee_id: employee.user_id,
          p_week_start: format(weekStart, 'yyyy-MM-dd'),
          p_week_end: format(weekEnd, 'yyyy-MM-dd')
        });

        if (error) {
          console.error(`Error generating report for ${employee.full_name}:`, error);
          return false;
        }

        return true;
      });

      const results = await Promise.all(reportPromises);
      const successCount = results.filter(Boolean).length;
      
      if (successCount > 0) {
        toast.success(`Se generaron ${successCount} reportes semanales exitosamente`);
        loadWeeklyReports();
        calculatePayroll();
      } else {
        toast.error('No se pudieron generar los reportes');
      }
    } catch (error) {
      console.error('Error generating weekly reports:', error);
      toast.error('Error al generar los reportes semanales');
    } finally {
      setGenerating(false);
    }
  };

  const exportPayrollToCSV = () => {
    const headers = [
      'Empleado', 'Horas Regulares', 'Horas Extra', 'Pago Regular', 
      'Pago Extra', 'Total a Pagar', 'Días Trabajados'
    ];

    const csvContent = [
      headers.join(','),
      ...payrollData.map(data => [
        `"${data.employee_name}"`,
        (data.regular_hours || 0).toFixed(2),
        (data.overtime_hours || 0).toFixed(2),
        (data.regular_pay || 0).toFixed(2),
        (data.overtime_pay || 0).toFixed(2),
        (data.total_pay || 0).toFixed(2),
        data.days_worked || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const weekStart = format(new Date(selectedWeek), 'yyyy-MM-dd');
    link.setAttribute('download', `nomina_semanal_${weekStart}.csv`);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getWeekOptions = () => {
    const options = [];
    const today = new Date();
    
    // Previous 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      options.push({
        value: format(weekStart, 'yyyy-MM-dd'),
        label: `${format(weekStart, 'dd MMM', { locale: es })} - ${format(weekEnd, 'dd MMM yyyy', { locale: es })}`
      });
    }

    // Next week
    const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });
    options.push({
      value: format(nextWeekStart, 'yyyy-MM-dd'),
      label: `${format(nextWeekStart, 'dd MMM', { locale: es })} - ${format(nextWeekEnd, 'dd MMM yyyy', { locale: es })} (Próxima)`
    });

    return options;
  };

  const totalPayroll = payrollData.reduce((sum, data) => sum + (data.total_pay || 0), 0);
  const totalHours = payrollData.reduce((sum, data) => sum + ((data.regular_hours || 0) + (data.overtime_hours || 0)), 0);
  const totalOvertime = payrollData.reduce((sum, data) => sum + (data.overtime_hours || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Dashboard de Nómina Semanal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar semana" />
            </SelectTrigger>
            <SelectContent>
              {getWeekOptions().map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

          <Button 
            onClick={generateWeeklyReports}
            disabled={generating}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            {generating ? 'Generando...' : 'Generar Reportes'}
          </Button>

          <Button 
            onClick={calculatePayroll}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Calculator className="h-4 w-4" />
            {loading ? 'Calculando...' : 'Recalcular'}
          </Button>

          <Button 
            onClick={exportPayrollToCSV}
            disabled={payrollData.length === 0}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Resumen de nómina */}
        {payrollData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Nómina</div>
              <div className="text-2xl font-bold text-green-600">
                ${totalPayroll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Horas</div>
              <div className="text-2xl font-bold">
                {totalHours.toFixed(1)}h
              </div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Horas Extra</div>
              <div className="text-2xl font-bold text-orange-600">
                {totalOvertime.toFixed(1)}h
              </div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Empleados</div>
              <div className="text-2xl font-bold">
                {payrollData.length}
              </div>
            </div>
          </div>
        )}

        {/* Lista detallada de nómina por empleado */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Detalle de Nómina</h3>
            {selectedWeek && (
              <Badge variant="outline">
                <Calendar className="h-3 w-3 mr-1" />
                Semana del {format(new Date(selectedWeek), 'dd MMM yyyy', { locale: es })}
              </Badge>
            )}
          </div>

          {payrollData.map(data => (
            <Card key={data.employee_id} className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{data.employee_name}</h4>
                    <div className="text-sm text-muted-foreground">
                      {data.days_worked || 0} días trabajados
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      ${(data.total_pay || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-muted-foreground">Total a pagar</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{(data.regular_hours || 0).toFixed(1)}</div>
                    <div className="text-sm text-muted-foreground">Horas Regulares</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{(data.overtime_hours || 0).toFixed(1)}</div>
                    <div className="text-sm text-muted-foreground">Horas Extra</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">
                      ${(data.regular_pay || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-muted-foreground">Pago Regular</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      ${(data.overtime_pay || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-muted-foreground">Pago Extra</div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <span>Tarifa regular aplicada + tiempo extra (1.5x)</span>
                  <span className="text-muted-foreground">
                    Basado en horario configurado del empleado
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {payrollData.length === 0 && !loading && (
          <div className="text-center text-muted-foreground py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay datos de nómina para la semana seleccionada.</p>
            <p className="text-sm">
              Asegúrate de que los empleados tengan registros de tiempo y horarios configurados.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Calculando nómina...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}