import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Star, CheckCircle } from 'lucide-react';

interface SimpleSatisfactionSurveyProps {
  orderId: string;
  clientId: string;
  onComplete: () => void;
}

export function SimpleSatisfactionSurvey({ orderId, clientId, onComplete }: SimpleSatisfactionSurveyProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [ratings, setRatings] = useState({
    service_quality: 0,
    service_time: 0,
    would_recommend: 0
  });
  const [comments, setComments] = useState('');

  const questions = [
    {
      key: 'service_quality' as keyof typeof ratings,
      title: '¿Cómo califica la calidad del servicio recibido?',
      description: 'Evalúe la calidad técnica y profesional del trabajo realizado'
    },
    {
      key: 'service_time' as keyof typeof ratings,
      title: '¿Cómo califica la puntualidad del servicio?',
      description: 'Evalúe si el servicio se completó en el tiempo acordado'
    },
    {
      key: 'would_recommend' as keyof typeof ratings,
      title: '¿Recomendaría nuestros servicios a otros?',
      description: 'Califique qué tan probable es que nos recomiende'
    }
  ];

  const StarRating = ({ 
    rating, 
    onRatingChange, 
    disabled = false 
  }: { 
    rating: number; 
    onRatingChange: (rating: number) => void;
    disabled?: boolean;
  }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onRatingChange(star)}
            className={`transition-colors ${
              disabled 
                ? 'cursor-not-allowed opacity-50' 
                : 'hover:scale-110 transform transition-transform'
            }`}
          >
            <Star
              className={`h-8 w-8 ${
                star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const isFormValid = () => {
    return Object.values(ratings).every(rating => rating > 0);
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      toast({
        title: "Error",
        description: "Por favor, califique todas las preguntas",
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
          client_id: clientId,
          service_quality: ratings.service_quality,
          service_time: ratings.service_time,
          would_recommend: ratings.would_recommend,
          general_comments: comments.trim() || null
        });

      if (error) throw error;

      toast({
        title: "¡Gracias por su evaluación!",
        description: "Su encuesta ha sido registrada correctamente. La orden se ha cerrado exitosamente.",
        variant: "default"
      });

      onComplete();
    } catch (error) {
      console.error('Error saving survey:', error);
      toast({
        title: "Error",
        description: "No se pudo registrar la encuesta. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <Star className="h-6 w-6 text-yellow-500" />
            Encuesta de Satisfacción
          </CardTitle>
          <p className="text-muted-foreground">
            Sus comentarios nos ayudan a mejorar nuestros servicios
          </p>
        </CardHeader>
        
        <CardContent className="space-y-8">
          {questions.map((question, index) => (
            <div key={question.key} className="space-y-3">
              <div>
                <Label className="text-base font-medium">
                  {index + 1}. {question.title}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {question.description}
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <StarRating
                  rating={ratings[question.key]}
                  onRatingChange={(rating) => 
                    setRatings(prev => ({ ...prev, [question.key]: rating }))
                  }
                  disabled={loading}
                />
                <div className="text-sm text-muted-foreground">
                  {ratings[question.key] > 0 && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {ratings[question.key]}/5
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Comentarios adicionales */}
          <div className="space-y-2">
            <Label htmlFor="comments">Comentarios adicionales (opcional)</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Compártanos cualquier comentario adicional sobre el servicio..."
              rows={4}
              disabled={loading}
            />
          </div>

          {/* Botones de acción */}
          <div className="pt-4 space-y-3">
            <Button
              onClick={handleSubmit}
              disabled={loading || !isFormValid()}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Enviando encuesta...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Enviar Encuesta
                </>
              )}
            </Button>
            
            <Button
              onClick={onComplete}
              disabled={loading}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Omitir Encuesta
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Todas las respuestas son confidenciales y nos ayudan a mejorar nuestros servicios
          </div>
        </CardContent>
      </Card>
    </div>
  );
}