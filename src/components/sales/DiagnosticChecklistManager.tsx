import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, Save, X, Upload, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Problem {
  id: string;
  name: string;
  category_id: string | null;
}

interface DiagnosticQuestion {
  id: string;
  question_text: string;
  question_order: number;
  problem_id: string;
  is_active: boolean;
  image_url?: string | null;
  problem?: Problem;
}

export function DiagnosticChecklistManager() {
  const { toast } = useToast();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState({ text: '', order: 1 });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load problems
  useEffect(() => {
    const loadProblems = async () => {
      const { data } = await supabase
        .from('problems')
        .select('id, name, category_id')
        .eq('is_active', true)
        .order('name');
      setProblems(data || []);
    };
    loadProblems();
  }, []);

  // Load questions for selected problem
  useEffect(() => {
    if (!selectedProblemId) {
      setQuestions([]);
      return;
    }

    const loadQuestions = async () => {
      const { data } = await supabase
        .from('diagnostic_questions')
        .select(`
          id,
          question_text,
          question_order,
          problem_id,
          is_active,
          image_url,
          problems (id, name, category_id)
        `)
        .eq('problem_id', selectedProblemId)
        .order('question_order');
      
      setQuestions(data?.map(q => ({
        ...q,
        problem: q.problems as Problem
      })) || []);
    };
    loadQuestions();
  }, [selectedProblemId]);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `questions/${fileName}`;

      const { data, error } = await supabase.storage
        .from('diagnostic-images')
        .upload(filePath, file);

      if (error) {
        console.error('Error uploading image:', error);
        toast({
          title: 'Error',
          description: 'Error al subir la imagen: ' + error.message,
          variant: 'destructive',
        });
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('diagnostic-images')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleAddQuestion = async (imageFile?: File) => {
    if (!selectedProblemId || !newQuestion.text.trim()) {
      toast({
        title: 'Error',
        description: 'Selecciona un problema y escribe la pregunta.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    let imageUrl = null;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
    }

    const { error } = await supabase
      .from('diagnostic_questions')
      .insert({
        question_text: newQuestion.text.trim(),
        question_order: newQuestion.order,
        problem_id: selectedProblemId,
        is_active: true,
        image_url: imageUrl,
      });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Pregunta agregada',
        description: 'La pregunta ha sido agregada exitosamente.',
      });
      setNewQuestion({ text: '', order: 1 });
      // Reload questions
      const { data } = await supabase
        .from('diagnostic_questions')
        .select(`
          id,
          question_text,
          question_order,
          problem_id,
          is_active,
          image_url,
          problems (id, name, category_id)
        `)
        .eq('problem_id', selectedProblemId)
        .order('question_order');
      
      setQuestions(data?.map(q => ({
        ...q,
        problem: q.problems as Problem
      })) || []);
    }
    setLoading(false);
  };

  const handleUpdateQuestion = async (questionId: string, text: string, order: number, imageUrl?: string) => {
    setLoading(true);
    
    const updateData: any = {};
    if (text) updateData.question_text = text.trim();
    if (order) updateData.question_order = order;
    if (imageUrl !== undefined) updateData.image_url = imageUrl;

    const { error } = await supabase
      .from('diagnostic_questions')
      .update(updateData)
      .eq('id', questionId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Pregunta actualizada',
        description: 'Los cambios han sido guardados.',
      });
      setEditingQuestion(null);
      // Reload questions
      const { data } = await supabase
        .from('diagnostic_questions')
        .select(`
          id,
          question_text,
          question_order,
          problem_id,
          is_active,
          image_url,
          problems (id, name, category_id)
        `)
        .eq('problem_id', selectedProblemId)
        .order('question_order');
      
      setQuestions(data?.map(q => ({
        ...q,
        problem: q.problems as Problem
      })) || []);
    }
    setLoading(false);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta pregunta?')) return;

    setLoading(true);
    const { error } = await supabase
      .from('diagnostic_questions')
      .delete()
      .eq('id', questionId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Pregunta eliminada',
        description: 'La pregunta ha sido eliminada.',
      });
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    }
    setLoading(false);
  };

  const handleToggleActive = async (questionId: string, currentStatus: boolean) => {
    setLoading(true);
    const { error } = await supabase
      .from('diagnostic_questions')
      .update({ is_active: !currentStatus })
      .eq('id', questionId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: currentStatus ? 'Pregunta desactivada' : 'Pregunta activada',
        description: 'El estado ha sido actualizado.',
      });
      setQuestions(prev =>
        prev.map(q =>
          q.id === questionId ? { ...q, is_active: !currentStatus } : q
        )
      );
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configurar Checklist de Diagnóstico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Seleccionar Problema</Label>
            <Select value={selectedProblemId} onValueChange={setSelectedProblemId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un problema" />
              </SelectTrigger>
              <SelectContent>
                {problems.map((problem) => (
                  <SelectItem key={problem.id} value={problem.id}>
                    {problem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProblemId && (
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label>Nueva Pregunta</Label>
                  <Textarea
                    placeholder="Escribe la pregunta de diagnóstico..."
                    value={newQuestion.text}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, text: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Orden</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newQuestion.order}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, order: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button onClick={() => handleAddQuestion()} disabled={loading} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar Pregunta
                </Button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      await handleAddQuestion(file);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }
                  }}
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <ImageIcon className="h-4 w-4" />
                  Agregar con Imagen
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProblemId && questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preguntas Configuradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {questions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  isEditing={editingQuestion === question.id}
                  onEdit={() => setEditingQuestion(question.id)}
                  onCancelEdit={() => setEditingQuestion(null)}
                  onUpdate={handleUpdateQuestion}
                  onDelete={handleDeleteQuestion}
                  onToggleActive={handleToggleActive}
                  loading={loading}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface QuestionCardProps {
  question: DiagnosticQuestion;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (id: string, text: string, order: number, imageUrl?: string) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, currentStatus: boolean) => void;
  loading: boolean;
}

function QuestionCard({
  question,
  isEditing,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onToggleActive,
  loading,
}: QuestionCardProps) {
  const [editText, setEditText] = useState(question.question_text);
  const [editOrder, setEditOrder] = useState(question.question_order);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `questions/${fileName}`;

      const { data, error } = await supabase.storage
        .from('diagnostic-images')
        .upload(filePath, file);

      if (error) {
        console.error('Error uploading image:', error);
        toast({
          title: 'Error',
          description: 'Error al subir la imagen: ' + error.message,
          variant: 'destructive',
        });
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('diagnostic-images')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleSave = () => {
    onUpdate(question.id, editText, editOrder);
  };

  const handleImageUpload = async (file: File) => {
    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      onUpdate(question.id, editText, editOrder, imageUrl);
    }
  };

  return (
    <Card className={`${!question.is_active ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">#{question.question_order}</Badge>
              <Badge variant={question.is_active ? 'default' : 'secondary'}>
                {question.is_active ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>
            
            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <Input
                  type="number"
                  min="1"
                  value={editOrder}
                  onChange={(e) => setEditOrder(parseInt(e.target.value) || 1)}
                  className="w-32"
                />
                
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleImageUpload(file);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }
                    }}
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {question.image_url ? 'Cambiar imagen' : 'Agregar imagen'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm">{question.question_text}</p>
                {question.image_url && (
                  <div className="mt-2">
                    <img 
                      src={question.image_url} 
                      alt="Imagen de ayuda" 
                      className="max-w-xs max-h-40 rounded-lg object-cover border"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSave} disabled={loading}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={onCancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={onEdit}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={question.is_active ? 'secondary' : 'default'}
                  onClick={() => onToggleActive(question.id, question.is_active)}
                  disabled={loading}
                >
                  {question.is_active ? 'Desactivar' : 'Activar'}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(question.id)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}