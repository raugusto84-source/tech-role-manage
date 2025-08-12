import { useState, useEffect } from 'react';
import { Users, Clock, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatHoursAndMinutes } from '@/utils/timeUtils';

interface EmployeePresence {
  user_id: string;
  full_name: string;
  role: string;
  currentRecord: any;
  status: 'present' | 'absent' | 'checked_out';
}

/**
 * Panel para que los administradores vean todos los empleados presentes
 */
export function TechnicianPresencePanel() {
  const [employees, setEmployees] = useState<EmployeePresence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTechnicianPresence();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(loadTechnicianPresence, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadTechnicianPresence = async () => {
    try {
      // Obtener todos los empleados (técnicos, vendedores, supervisores y administradores)
      const { data: employeeProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, role')
        .in('role', ['tecnico', 'vendedor', 'supervisor', 'administrador'])
        .order('full_name');

      if (profilesError) throw profilesError;

      // Obtener registros de tiempo del día actual para todos los empleados
      const today = new Date().toISOString().split('T')[0];
      
      const presenceData: EmployeePresence[] = [];

      for (const employee of employeeProfiles || []) {
        const { data: records, error: recordsError } = await supabase
          .from('time_records')
          .select('*')
          .eq('employee_id', employee.user_id)
          .eq('work_date', today)
          .order('created_at', { ascending: false })
          .limit(1);

        if (recordsError) {
          console.error(`Error loading records for ${employee.full_name}:`, recordsError);
          continue;
        }

        const latestRecord = records && records.length > 0 ? records[0] : null;
        
        let status: 'present' | 'absent' | 'checked_out' = 'absent';
        if (latestRecord) {
          if (latestRecord.status === 'checked_in') {
            status = 'present';
          } else if (latestRecord.status === 'checked_out') {
            status = 'checked_out';
          }
        }

        presenceData.push({
          user_id: employee.user_id,
          full_name: employee.full_name,
          role: employee.role,
          currentRecord: latestRecord,
          status
        });
      }

      setEmployees(presenceData);
    } catch (error) {
      console.error('Error loading employee presence:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Presente</Badge>;
      case 'checked_out':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Finalizado</Badge>;
      default:
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Ausente</Badge>;
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '--:--';
    return new Date(timeString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatLocation = (location: any) => {
    if (!location) return 'Sin ubicación';
    if (location.address) return location.address;
    return `${location.lat?.toFixed(4)}, ${location.lng?.toFixed(4)}`;
  };

  const getRoleBadge = (role: string) => {
    const roleLabels = {
      'administrador': 'Admin',
      'supervisor': 'Supervisor', 
      'tecnico': 'Técnico',
      'vendedor': 'Vendedor'
    };
    
    const roleColors = {
      'administrador': 'bg-red-500',
      'supervisor': 'bg-blue-500',
      'tecnico': 'bg-green-500', 
      'vendedor': 'bg-purple-500'
    };
    
    return (
      <Badge variant="outline" className={`${roleColors[role as keyof typeof roleColors]} text-white`}>
        {roleLabels[role as keyof typeof roleLabels] || role}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Personal Presente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Cargando...</div>
        </CardContent>
      </Card>
    );
  }

  const presentEmployees = employees.filter(e => e.status === 'present');
  const totalEmployees = employees.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Panel de Presencia - Personal
        </CardTitle>
        <CardDescription>
          {presentEmployees.length} de {totalEmployees} empleados presentes
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {employees.map((employee) => (
          <div
            key={employee.user_id}
            className="flex items-center justify-between p-3 bg-muted rounded-lg"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{employee.full_name}</span>
                {getRoleBadge(employee.role)}
                {getStatusBadge(employee.status)}
              </div>
              
              {employee.currentRecord && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Entrada: {formatTime(employee.currentRecord.check_in_time)}
                    </span>
                    
                    {employee.currentRecord.check_out_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Salida: {formatTime(employee.currentRecord.check_out_time)}
                      </span>
                    )}
                  </div>
                  
                  {employee.currentRecord.total_hours && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Total: {formatHoursAndMinutes(employee.currentRecord.total_hours)}
                    </div>
                  )}
                  
                  {employee.currentRecord.check_in_location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate max-w-xs">
                        {formatLocation(employee.currentRecord.check_in_location)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {!employee.currentRecord && (
                <div className="text-sm text-muted-foreground">
                  Sin registros hoy
                </div>
              )}
            </div>
          </div>
        ))}
        
        {employees.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No hay empleados registrados
          </div>
        )}
      </CardContent>
    </Card>
  );
}