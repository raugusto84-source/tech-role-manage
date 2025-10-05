import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck, CheckCircle2, Circle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  order: number;
}

interface ChecklistProgress {
  id: string;
  checklist_item_id: string;
  is_completed: boolean;
  completed_by?: string;
  completed_at?: string;
  notes?: string;
  completed_by_name?: string;
}

interface ServiceChecklistProps {
  orderItemId: string;
  serviceTypeId: string;
  serviceName: string;
  readonly?: boolean;
}

export function ServiceChecklist({ orderItemId, serviceTypeId, serviceName, readonly = false }: ServiceChecklistProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [progress, setProgress] = useState<Record<string, ChecklistProgress>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hasChecklist, setHasChecklist] = useState(false);

  useEffect(() => {
    loadChecklistData();
    
    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel(`checklist-progress-${orderItemId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_checklist_progress',
        filter: `order_item_id=eq.${orderItemId}`
      }, () => {
        loadChecklistProgress();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderItemId, serviceTypeId]);

  const loadChecklistData = async () => {
    try {
      setLoading(true);
      
      // Cargar la configuración del checklist del servicio
      const { data: serviceData, error: serviceError } = await supabase
        .from('service_types')
        .select('checklist_enabled, checklist_items')
        .eq('id', serviceTypeId)
        .single();

      if (serviceError) throw serviceError;

      if (serviceData?.checklist_enabled && serviceData.checklist_items) {
        const items = Array.isArray(serviceData.checklist_items) 
          ? serviceData.checklist_items as unknown as ChecklistItem[]
          : [];
        setChecklistItems(items.sort((a, b) => a.order - b.order));
        setHasChecklist(true);
        
        // Cargar el progreso
        await loadChecklistProgress();
      } else {
        setHasChecklist(false);
      }
    } catch (error) {
      console.error('Error loading checklist data:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el checklist del servicio",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadChecklistProgress = async () => {
    try {
      const { data, error } = await supabase
        .from('order_checklist_progress')
        .select(`
          *,
          profiles:completed_by (full_name)
        `)
        .eq('order_item_id', orderItemId);

      if (error) throw error;

      const progressMap: Record<string, ChecklistProgress> = {};
      data?.forEach(item => {
        progressMap[item.checklist_item_id] = {
          ...item,
          completed_by_name: item.profiles?.full_name
        };
      });
      setProgress(progressMap);
    } catch (error) {
      console.error('Error loading checklist progress:', error);
    }
  };

  const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    if (readonly) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressData = {
        order_item_id: orderItemId,
        checklist_item_id: itemId,
        is_completed: isCompleted,
        completed_by: isCompleted ? user.id : null,
        completed_at: isCompleted ? new Date().toISOString() : null,
        notes: notes[itemId] || null
      };

      const { error } = await supabase
        .from('order_checklist_progress')
        .upsert(progressData, {
          onConflict: 'order_item_id,checklist_item_id'
        });

      if (error) throw error;

      toast({
        title: isCompleted ? "Paso completado" : "Paso marcado como pendiente",
        description: checklistItems.find(i => i.id === itemId)?.title
      });

      await loadChecklistProgress();
    } catch (error) {
      console.error('Error updating checklist progress:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el progreso",
        variant: "destructive"
      });
    }
  };

  const updateNotes = async (itemId: string, newNotes: string) => {
    if (readonly) return;

    setNotes(prev => ({ ...prev, [itemId]: newNotes }));

    // Actualizar notas si ya existe el progreso
    if (progress[itemId]) {
      try {
        const { error } = await supabase
          .from('order_checklist_progress')
          .update({ notes: newNotes })
          .eq('order_item_id', orderItemId)
          .eq('checklist_item_id', itemId);

        if (error) throw error;
      } catch (error) {
        console.error('Error updating notes:', error);
      }
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasChecklist || checklistItems.length === 0) {
    return null;
  }

  const completedCount = Object.values(progress).filter(p => p.is_completed).length;
  const totalCount = checklistItems.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Checklist: {serviceName}
          </CardTitle>
          <Badge variant={completedCount === totalCount ? "default" : "secondary"}>
            {completedCount}/{totalCount} ({progressPercentage}%)
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {checklistItems.map((item, index) => {
            const itemProgress = progress[item.id];
            const isCompleted = itemProgress?.is_completed || false;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isCompleted
                    ? 'border-green-500 bg-green-50/50'
                    : 'border-border bg-background'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-primary text-xs font-bold text-primary flex-shrink-0 mt-1">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isCompleted}
                        onCheckedChange={(checked) => toggleChecklistItem(item.id, checked === true)}
                        disabled={readonly}
                        className="mt-1"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                            {item.title}
                          </h4>
                          {isCompleted && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}

                        {isCompleted && itemProgress && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Completado por {itemProgress.completed_by_name || 'Usuario'} 
                            {itemProgress.completed_at && ` el ${format(new Date(itemProgress.completed_at), "dd/MM/yyyy HH:mm", { locale: es })}`}
                          </div>
                        )}

                        {!readonly && (
                          <Textarea
                            placeholder="Notas adicionales..."
                            value={notes[item.id] || itemProgress?.notes || ''}
                            onChange={(e) => updateNotes(item.id, e.target.value)}
                            className="mt-2 h-20 text-sm"
                          />
                        )}

                        {readonly && itemProgress?.notes && (
                          <div className="mt-2 p-2 bg-muted rounded text-sm">
                            <strong>Notas:</strong> {itemProgress.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
