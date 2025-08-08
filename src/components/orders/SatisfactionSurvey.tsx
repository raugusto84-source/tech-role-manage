import React, { useState } from 'react';
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
  technician_knowledge: number;
  technician_customer_service: number;
  technician_attitude: number;
  technician_comments: string;
  sales_knowledge: number;
  sales_customer_service: number;
  sales_attitude: number;
  sales_comments: string;
  overall_recommendation: number;
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
  const [surveyData, setSurveyData] = useState<SurveyData>({
    technician_knowledge: 0,
    technician_customer_service: 0,
    technician_attitude: 0,
    technician_comments: '',
    sales_knowledge: 0,
    sales_customer_service: 0,
    sales_attitude: 0,
    sales_comments: '',
    overall_recommendation: 0,
    general_comments: ''
  });

  const updateRating = (field: keyof SurveyData, value: number) => {
    setSurveyData(prev => ({ ...prev, [field]: value }));
  };

  const updateComment = (field: keyof SurveyData, value: string) => {
    setSurveyData(prev => ({ ...prev, [field]: value }));
  };

  const canSubmit = surveyData.technician_knowledge > 0 && 
                   surveyData.technician_customer_service > 0 && 
                   surveyData.technician_attitude > 0 &&
                   surveyData.sales_knowledge > 0 && 
                   surveyData.sales_customer_service > 0 && 
                   surveyData.sales_attitude > 0 &&
                   surveyData.overall_recommendation > 0;

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
          ...surveyData
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
        {/* Evaluación del Técnico */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Evaluación del Técnico</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Conocimiento Técnico</span>
              <StarRating 
                value={surveyData.technician_knowledge} 
                onChange={(value) => updateRating('technician_knowledge', value)}
              />
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Atención al Cliente</span>
              <StarRating 
                value={surveyData.technician_customer_service} 
                onChange={(value) => updateRating('technician_customer_service', value)}
              />
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Actitud Positiva</span>
              <StarRating 
                value={surveyData.technician_attitude} 
                onChange={(value) => updateRating('technician_attitude', value)}
              />
            </div>
            
            <Textarea
              placeholder="Comentarios sobre el técnico (opcional)"
              value={surveyData.technician_comments}
              onChange={(e) => updateComment('technician_comments', e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>
        </div>

        <Separator />

        {/* Evaluación del Ejecutivo de Ventas */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Evaluación del Ejecutivo de Ventas</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Conocimiento</span>
              <StarRating 
                value={surveyData.sales_knowledge} 
                onChange={(value) => updateRating('sales_knowledge', value)}
              />
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Atención al Cliente</span>
              <StarRating 
                value={surveyData.sales_customer_service} 
                onChange={(value) => updateRating('sales_customer_service', value)}
              />
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Actitud Positiva</span>
              <StarRating 
                value={surveyData.sales_attitude} 
                onChange={(value) => updateRating('sales_attitude', value)}
              />
            </div>
            
            <Textarea
              placeholder="Comentarios sobre el ejecutivo de ventas (opcional)"
              value={surveyData.sales_comments}
              onChange={(e) => updateComment('sales_comments', e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>
        </div>

        <Separator />

        {/* Evaluación General */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Evaluación General</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">¿Recomendarías a SYSLAG por este servicio?</span>
              <StarRating 
                value={surveyData.overall_recommendation} 
                onChange={(value) => updateRating('overall_recommendation', value)}
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