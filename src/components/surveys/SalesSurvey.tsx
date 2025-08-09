import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SalesSurveyProps {
  quoteId: string;
  onComplete: () => void;
  onSkip: () => void;
}

interface SurveyData {
  sales_knowledge: number;
  sales_customer_service: number;
  sales_attitude: number;
  sales_comments: string;
  overall_recommendation: number;
  general_comments: string;
}

interface QuoteInfo {
  quote_number: string;
  created_by: string;
  sales_name?: string;
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

export function SalesSurvey({ quoteId, onComplete, onSkip }: SalesSurveyProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [quoteInfo, setQuoteInfo] = useState<QuoteInfo | null>(null);
  const [surveyData, setSurveyData] = useState<SurveyData>({
    sales_knowledge: 0,
    sales_customer_service: 0,
    sales_attitude: 0,
    sales_comments: '',
    overall_recommendation: 0,
    general_comments: ''
  });

  useEffect(() => {
    loadQuoteInfo();
  }, [quoteId]);

  const loadQuoteInfo = async () => {
    try {
      const { data: quote, error } = await supabase
        .from('quotes')
        .select(`
          quote_number,
          created_by
        `)
        .eq('id', quoteId)
        .single();

      if (error) throw error;

      if (quote?.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', quote.created_by)
          .single();

        setQuoteInfo({
          quote_number: quote.quote_number,
          created_by: quote.created_by,
          sales_name: profile?.full_name || 'No asignado'
        });
      } else {
        setQuoteInfo({
          quote_number: quote?.quote_number || 'Sin número',
          created_by: '',
          sales_name: 'No asignado'
        });
      }
    } catch (error) {
      console.error('Error loading quote info:', error);
    }
  };

  const updateRating = (field: keyof SurveyData, value: number) => {
    setSurveyData(prev => ({ ...prev, [field]: value }));
  };

  const updateComment = (field: keyof SurveyData, value: string) => {
    setSurveyData(prev => ({ ...prev, [field]: value }));
  };

  const canSubmit = surveyData.sales_knowledge > 0 && 
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
        .from('sales_satisfaction_surveys')
        .update({
          ...surveyData
        })
        .eq('quote_id', quoteId)
        .eq('client_id', (await supabase.auth.getUser()).data.user?.id!);

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
        <div className="flex justify-between items-start mb-2">
          <div>
            <CardTitle className="text-center">Evaluación de Ventas</CardTitle>
            <CardDescription className="text-center">
              Tu opinión sobre nuestro proceso de ventas es muy importante para nosotros.
            </CardDescription>
          </div>
        </div>
        {quoteInfo && (
          <div className="flex gap-2 justify-center">
            <Badge variant="outline">Cotización: {quoteInfo.quote_number}</Badge>
            <Badge variant="secondary">Vendedor: {quoteInfo.sales_name}</Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
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
            onClick={onSkip}
            className="flex-1"
            disabled={loading}
          >
            Omitir
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