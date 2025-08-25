import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock } from 'lucide-react';
import { TimeClockWidget } from '@/components/timetracking/TimeClockWidget';

interface TimeTrackingGuardProps {
  children: ReactNode;
}

export function TimeTrackingGuard({ children }: TimeTrackingGuardProps) {
  const { user, profile, loading } = useAuth();
  const [hasLoggedTime, setHasLoggedTime] = useState<boolean | null>(null);
  const [checkingTime, setCheckingTime] = useState(true);

  useEffect(() => {
    checkTimeLogged();
  }, [user, profile]);

  const checkTimeLogged = async () => {
    if (!user || !profile || loading) return;

    // Solo aplicar para usuarios que no son clientes
    if (profile.role === 'cliente') {
      setHasLoggedTime(true);
      setCheckingTime(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('has_logged_time_today', {
        user_id: user.id
      });

      if (error) throw error;
      
      setHasLoggedTime(!!data);
    } catch (error) {
      console.error('Error checking time log:', error);
      // En caso de error, permitir acceso
      setHasLoggedTime(true);
    } finally {
      setCheckingTime(false);
    }
  };

  if (loading || checkingTime) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Verificando registro de entrada...</p>
        </div>
      </div>
    );
  }

  // Si no es cliente y no ha registrado entrada, mostrar el widget de tiempo
  if (hasLoggedTime === false && profile?.role !== 'cliente') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <CardTitle className="text-xl">Registro de Entrada Requerido</CardTitle>
            <CardDescription>
              Debe registrar su entrada antes de poder usar el sistema. Por favor tome su foto y registre su hora de entrada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <TimeClockWidget />
              <Button 
                onClick={() => checkTimeLogged()} 
                className="w-full"
              >
                Verificar Entrada
              </Button>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Clock className="h-4 w-4" />
                <span>Esta verificación se realiza por seguridad y control de personal</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}