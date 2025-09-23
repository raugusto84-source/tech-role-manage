import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RealtimeContextType {
  isConnected: boolean;
  lastUpdate: Date | null;
  forceRefresh: () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function PolicyRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Configurar suscripciones en tiempo real
    const scheduledServicesChannel = supabase
      .channel('scheduled-services-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_services'
        },
        (payload) => {
          setLastUpdate(new Date());
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Nuevo servicio programado",
              description: "Se ha programado un nuevo servicio",
              variant: "default"
            });
          } else if (payload.eventType === 'UPDATE') {
            toast({
              title: "Servicio actualizado", 
              description: "Se ha actualizado un servicio programado",
              variant: "default"
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    const policyPaymentsChannel = supabase
      .channel('policy-payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'policy_payments'
        },
        (payload) => {
          setLastUpdate(new Date());
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Nuevo pago registrado",
              description: "Se ha registrado un nuevo pago de póliza",
              variant: "default"
            });
          } else if (payload.eventType === 'UPDATE') {
            const newRecord = payload.new as any;
            if (newRecord.payment_status === 'pagado') {
              toast({
                title: "Pago confirmado",
                description: "Se ha confirmado el pago de una póliza",
                variant: "default"
              });
            } else if (newRecord.payment_status === 'vencido') {
              toast({
                title: "Pago vencido",
                description: "Un pago de póliza ha vencido y requiere atención",
                variant: "destructive"
              });
            }
          }
        }
      )
      .subscribe();

    const insurancePoliciesChannel = supabase
      .channel('insurance-policies-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public', 
          table: 'insurance_policies'
        },
        (payload) => {
          setLastUpdate(new Date());
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Nueva póliza creada",
              description: "Se ha creado una nueva póliza de seguro",
              variant: "default"
            });
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(scheduledServicesChannel);
      supabase.removeChannel(policyPaymentsChannel); 
      supabase.removeChannel(insurancePoliciesChannel);
    };
  }, [toast]);

  const forceRefresh = () => {
    setLastUpdate(new Date());
  };

  const value: RealtimeContextType = {
    isConnected,
    lastUpdate,
    forceRefresh
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeUpdates() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtimeUpdates must be used within a PolicyRealtimeProvider');
  }
  return context;
}