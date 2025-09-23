import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AutomationResult {
  process: string;
  success: boolean;
  processed: number;
  errors: any[];
  execution_time: number;
}

interface AutomationResponse {
  success: boolean;
  action: string;
  timestamp: string;
  execution_time_ms: number;
  summary: {
    processes_run: number;
    processes_successful: number;
    total_items_processed: number;
    total_errors: number;
  };
  results: AutomationResult[];
  health_check: {
    database: boolean;
    edge_functions: boolean;
    automation_status: 'healthy' | 'issues_detected' | 'critical_error';
  };
}

export const usePolicyAutomation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<AutomationResponse | null>(null);
  const { toast } = useToast();

  const runAutomation = async (action: string = 'daily', force: boolean = false) => {
    setIsLoading(true);
    try {
      console.log(`🚀 Triggering policy automation: ${action}`);
      
      const { data, error } = await supabase.functions.invoke('policy-automation-engine', {
        body: { action, force }
      });

      if (error) {
        throw error;
      }

      setLastResult(data);

      if (data.success) {
        toast({
          title: "Automatización Completada",
          description: `${data.summary.total_items_processed} elementos procesados en ${data.summary.processes_successful}/${data.summary.processes_run} procesos`,
          variant: "default"
        });

        if (data.summary.total_errors > 0) {
          toast({
            title: "Advertencia",
            description: `Se encontraron ${data.summary.total_errors} errores durante la automatización`,
            variant: "destructive"
          });
        }
      } else {
        throw new Error(data.error || 'Error desconocido en automatización');
      }

      return data;
    } catch (error: any) {
      console.error('Error running automation:', error);
      toast({
        title: "Error de Automatización",
        description: error.message || 'No se pudo ejecutar la automatización',
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const runDailyAutomation = () => runAutomation('daily', false);
  const runWeeklyAutomation = () => runAutomation('weekly', false);
  const runMonthlyAutomation = () => runAutomation('monthly', false);
  
  // Individual process triggers
  const triggerPayments = () => runAutomation('payments', true);
  const triggerServices = () => runAutomation('services', true);
  const triggerFollowUps = () => runAutomation('followups', true);
  const triggerOverdue = () => runAutomation('overdue', true);
  const triggerProjections = () => runAutomation('projections', true);

  const getHealthStatus = () => {
    if (!lastResult) return 'unknown';
    return lastResult.health_check.automation_status;
  };

  const getLastExecutionTime = () => {
    if (!lastResult) return null;
    return new Date(lastResult.timestamp);
  };

  return {
    isLoading,
    lastResult,
    runAutomation,
    runDailyAutomation,
    runWeeklyAutomation,
    runMonthlyAutomation,
    triggerPayments,
    triggerServices,
    triggerFollowUps,
    triggerOverdue,
    triggerProjections,
    getHealthStatus,
    getLastExecutionTime
  };
};