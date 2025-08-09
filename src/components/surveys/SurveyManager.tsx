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
  // Las encuestas ya no se muestran automáticamente al iniciar sesión
  // Solo se pueden responder desde los detalles de la orden/cotización

  // Simplemente renderizar el contenido sin verificar encuestas pendientes
  return <>{children}</>;
}