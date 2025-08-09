import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SatisfactionSurveyProps {
  orderId: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface SurveyData {
  technician_rating: number;
  sales_rating: number;
  overall_rating: number;
  general_comments: string;
}

const StarRating = ({ value, onChange, disabled = false }: { 
  value: number; 
  onChange: (value: number) => void; 
  disabled?: boolean;
}) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={`transition-colors ${disabled ? 'cursor-default' : 'hover:scale-110'}`}
        >
          <Star
            size={24}
            className={`${
              star <= value 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-muted-foreground'
            } ${disabled ? '' : 'hover:text-yellow-400'}`}
          />
        </button>
      ))}
    </div>
  );
};

export function SatisfactionSurvey({ orderId, onComplete, onCancel }: SatisfactionSurveyProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [technicianName, setTechnicianName] = useState<string>('');
  const [salesName, setSalesName] = useState<string>('Vendedor');
  const [surveyData, setSurveyData] = useState<SurveyData>({
    technician_rating: 0,
    sales_rating: 0,
    overall_rating: 0,
    general_comments: ''
  });

  // Load order info to get technician name
  useEffect(() => {
    const loadOrderInfo = async () => {
      try {
        // First get the order with assigned technician
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('assigned_technician')
          .eq('id', orderId)
          .single();

        if (orderError) throw orderError;
        
        // Then get technician profile if assigned
        if (orderData?.assigned_technician) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', orderData.assigned_technician)
            .single();

          if (!profileError && profileData?.full_name) {
            setTechnicianName(profileData.full_name);
          }
        }
      } catch (error) {
        console.error('Error loading order info:', error);
      }
    };

    loadOrderInfo();
  }, [orderId]);

  const updateRating = (field: keyof SurveyData, value: number) => {
    setSurveyData(prev => ({ ...prev, [field]: value }));
  };

  const updateComment = (field: keyof SurveyData, value: string) => {
    setSurveyData(prev => ({ ...prev, [field]: value }));
  };

  const canSubmit = surveyData.technician_rating > 0 && 
                   surveyData.sales_rating > 0 && 
                   surveyData.overall_rating > 0;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({
        title: "Evaluación incompleta",
        description: "Por favor califica todos los aspectos requeridos.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('order_satisfaction_surveys')
        .insert({
          order_id: orderId,
          client_id: (await supabase.auth.getUser()).data.user?.id!,
          technician_knowledge: surveyData.technician_rating,
          technician_customer_service: surveyData.technician_rating,
          technician_attitude: surveyData.technician_rating,
          sales_knowledge: surveyData.sales_rating,
          sales_customer_service: surveyData.sales_rating,
          sales_attitude: surveyData.sales_rating,
          overall_recommendation: surveyData.overall_rating,
          general_comments: surveyData.general_comments
        });

      if (error) throw error;

      toast({
        title: "¡Gracias por tu evaluación!",
        description: "Tu opinión nos ayuda a mejorar nuestro servicio."
      });
      
      onComplete();
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar la evaluación. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Evaluación de Servicio</CardTitle>
        <CardDescription className="text-center">
          Tu opinión es muy importante para nosotros. Por favor evalúa nuestro servicio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. Evaluación del Técnico */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">
            1. ¿Cómo evalúas al Técnico {technicianName ? `"${technicianName}"` : ''}?
          </h3>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Califica del 1 al 5</span>
            <StarRating 
              value={surveyData.technician_rating} 
              onChange={(value) => updateRating('technician_rating', value)}
            />
          </div>
        </div>

        <Separator />

        {/* 2. Evaluación de Atención a Clientes */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">
            2. ¿Cómo evalúas la Atención a Clientes "{salesName}"?
          </h3>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Califica del 1 al 5</span>
            <StarRating 
              value={surveyData.sales_rating} 
              onChange={(value) => updateRating('sales_rating', value)}
            />
          </div>
        </div>

        <Separator />

        {/* 3. Evaluación General de SYSLAG */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">
            3. En general, ¿cómo evalúas a SYSLAG?
          </h3>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Califica del 1 al 5</span>
            <StarRating 
              value={surveyData.overall_rating} 
              onChange={(value) => updateRating('overall_rating', value)}
            />
          </div>
          
          <Textarea
            placeholder="Comentarios generales (opcional)"
            value={surveyData.general_comments}
            onChange={(e) => updateComment('general_comments', e.target.value)}
            className="resize-none"
            rows={3}
          />
        </div>

        {/* Botones de Acción */}
        <div className="flex gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="flex-1"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="flex-1"
          >
            {loading ? "Enviando..." : "Enviar Evaluación"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}