import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Question {
  id: string;
  question_text: string;
}

interface DiagnosticChecklistProps {
  problemId: string;
  onComplete: (answers: Record<string, boolean>) => void;
}

export function DiagnosticChecklist({ problemId, onComplete }: DiagnosticChecklistProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      // Use existing table and fields; we added problem_id via migration
      const { data } = await (supabase as any)
        .from('diagnostic_questions')
        .select('id, question_text')
        .eq('is_active', true)
        .eq('problem_id', problemId)
        .order('question_order');
      setQuestions(data || []);
      setAnswers({});
    };
    if (problemId) load();
  }, [problemId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist de diagnóstico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {questions.map((q) => (
            <label key={q.id} className="flex items-center gap-3">
              <Checkbox
                checked={!!answers[q.id]}
                onCheckedChange={(checked: any) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: checked === true }))
                }
              />
              <span>{q.question_text}</span>
            </label>
          ))}
          {questions.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No hay preguntas configuradas para este problema.
            </div>
          )}
        </div>

        <Button onClick={() => onComplete(answers)} disabled={questions.length === 0}>
          Obtener solución recomendada
        </Button>
      </CardContent>
    </Card>
  );
}
