import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, ClipboardCheck } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  order: number;
}

interface ChecklistManagerProps {
  checklistEnabled: boolean;
  checklistItems: ChecklistItem[];
  onChecklistEnabledChange: (enabled: boolean) => void;
  onChecklistItemsChange: (items: ChecklistItem[]) => void;
}

export function ChecklistManager({
  checklistEnabled,
  checklistItems,
  onChecklistEnabledChange,
  onChecklistItemsChange
}: ChecklistManagerProps) {
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');

  const addChecklistItem = () => {
    if (!newItemTitle.trim()) return;

    const newItem: ChecklistItem = {
      id: `temp-${Date.now()}`,
      title: newItemTitle.trim(),
      description: newItemDescription.trim() || undefined,
      order: checklistItems.length
    };

    onChecklistItemsChange([...checklistItems, newItem]);
    setNewItemTitle('');
    setNewItemDescription('');
  };

  const removeChecklistItem = (itemId: string) => {
    const updatedItems = checklistItems
      .filter(item => item.id !== itemId)
      .map((item, index) => ({ ...item, order: index }));
    
    onChecklistItemsChange(updatedItems);
  };

  const updateChecklistItem = (itemId: string, field: 'title' | 'description', value: string) => {
    const updatedItems = checklistItems.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    );
    onChecklistItemsChange(updatedItems);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(checklistItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const reorderedItems = items.map((item, index) => ({
      ...item,
      order: index
    }));

    onChecklistItemsChange(reorderedItems);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Checklist de Servicio
            </CardTitle>
            <CardDescription>
              Configura los pasos a seguir para realizar este servicio
            </CardDescription>
          </div>
          <Switch
            checked={checklistEnabled}
            onCheckedChange={onChecklistEnabledChange}
          />
        </div>
      </CardHeader>

      {checklistEnabled && (
        <CardContent className="space-y-6">
          {/* Lista de items existentes */}
          {checklistItems.length > 0 && (
            <div className="space-y-3">
              <Label>Pasos del Checklist ({checklistItems.length})</Label>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="checklist-items">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {checklistItems.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`p-3 rounded-lg border-2 ${
                                snapshot.isDragging
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border bg-background'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  {...provided.dragHandleProps}
                                  className="mt-2 cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>

                                <Badge variant="secondary" className="mt-2">
                                  {index + 1}
                                </Badge>

                                <div className="flex-1 space-y-2">
                                  <Input
                                    placeholder="Título del paso"
                                    value={item.title}
                                    onChange={(e) => updateChecklistItem(item.id, 'title', e.target.value)}
                                  />
                                  <Textarea
                                    placeholder="Descripción (opcional)"
                                    value={item.description || ''}
                                    onChange={(e) => updateChecklistItem(item.id, 'description', e.target.value)}
                                    className="h-16"
                                  />
                                </div>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeChecklistItem(item.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}

          {/* Formulario para agregar nuevo item */}
          <div className="space-y-3 p-4 rounded-lg border-2 border-dashed border-border">
            <Label>Agregar Nuevo Paso</Label>
            <Input
              placeholder="Título del paso (ej: Revisión de cableado)"
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newItemTitle.trim()) {
                  addChecklistItem();
                }
              }}
            />
            <Textarea
              placeholder="Descripción del paso (opcional)"
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
              className="h-20"
            />
            <Button
              onClick={addChecklistItem}
              disabled={!newItemTitle.trim()}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Paso
            </Button>
          </div>

          {checklistItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay pasos en el checklist</p>
              <p className="text-sm">Agrega pasos para que los técnicos puedan seguir</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
