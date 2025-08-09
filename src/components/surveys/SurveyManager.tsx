import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TechnicianSurvey } from './TechnicianSurvey';
import { SalesSurvey } from './SalesSurvey';

interface SurveyManagerProps {
  children: React.ReactNode;
}

interface PendingSurvey {
  id: string;
  type: 'technician' | 'sales';
  orderId?: string;
  quoteId?: string;
}

export function SurveyManager({ children }: SurveyManagerProps) {
  const { user, profile } = useAuth();
  const [pendingSurvey, setPendingSurvey] = useState<PendingSurvey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile?.role === 'cliente') {
      checkPendingSurveys();
    } else {
      setLoading(false);
    }
  }, [user, profile]);

  const checkPendingSurveys = async () => {
    try {
      // Check for pending technician surveys (only surveys that haven't been completed at all)
      const { data: techSurveys } = await supabase
        .from('technician_satisfaction_surveys')
        .select('id, order_id')
        .eq('client_id', user?.id)
        .is('technician_knowledge', null)
        .is('technician_customer_service', null)
        .is('technician_attitude', null)
        .is('overall_recommendation', null)
        .limit(1);

      if (techSurveys && techSurveys.length > 0) {
        setPendingSurvey({
          id: techSurveys[0].id,
          type: 'technician',
          orderId: techSurveys[0].order_id
        });
        setLoading(false);
        return;
      }

      // Check for pending sales surveys (only surveys that haven't been completed at all)
      const { data: salesSurveys } = await supabase
        .from('sales_satisfaction_surveys')
        .select('id, quote_id')
        .eq('client_id', user?.id)
        .is('sales_knowledge', null)
        .is('sales_customer_service', null)
        .is('sales_attitude', null)
        .is('overall_recommendation', null)
        .limit(1);

      if (salesSurveys && salesSurveys.length > 0) {
        setPendingSurvey({
          id: salesSurveys[0].id,
          type: 'sales',
          quoteId: salesSurveys[0].quote_id
        });
        setLoading(false);
        return;
      }

      setLoading(false);
    } catch (error) {
      console.error('Error checking pending surveys:', error);
      setLoading(false);
    }
  };

  const handleSurveyComplete = () => {
    setPendingSurvey(null);
  };

  const handleSurveySkip = async () => {
    try {
      if (pendingSurvey?.type === 'technician') {
        await supabase
          .from('technician_satisfaction_surveys')
          .update({
            technician_knowledge: 0, // Marca como omitido sin valor
            technician_customer_service: 0,
            technician_attitude: 0,
            overall_recommendation: 0,
            technician_comments: 'Encuesta omitida por el cliente',
            general_comments: 'Encuesta omitida por el cliente'
          })
          .eq('id', pendingSurvey.id);
      } else if (pendingSurvey?.type === 'sales') {
        await supabase
          .from('sales_satisfaction_surveys')
          .update({
            sales_knowledge: 0, // Marca como omitido sin valor
            sales_customer_service: 0,
            sales_attitude: 0,
            overall_recommendation: 0,
            sales_comments: 'Encuesta omitida por el cliente',
            general_comments: 'Encuesta omitida por el cliente'
          })
          .eq('id', pendingSurvey.id);
      }
      setPendingSurvey(null);
    } catch (error) {
      console.error('Error skipping survey:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si hay una encuesta pendiente, mostrar overlay modal bloqueando la navegación
  if (pendingSurvey) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
          {pendingSurvey.type === 'technician' && pendingSurvey.orderId && (
            <TechnicianSurvey
              orderId={pendingSurvey.orderId}
              onComplete={handleSurveyComplete}
              onSkip={handleSurveySkip}
            />
          )}
          {pendingSurvey.type === 'sales' && pendingSurvey.quoteId && (
            <SalesSurvey
              quoteId={pendingSurvey.quoteId}
              onComplete={handleSurveyComplete}
              onSkip={handleSurveySkip}
            />
          )}
        </div>
      </div>
    );
  }

  // Si no hay encuestas pendientes, mostrar contenido normal
  return <>{children}</>;
}