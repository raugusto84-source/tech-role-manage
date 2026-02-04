import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, X } from 'lucide-react';
import { getServiceCategoryInfo } from '@/utils/serviceCategoryUtils';

interface OrderCategoryEditorProps {
  orderId: string;
  currentCategory: 'sistemas' | 'seguridad' | 'fraccionamientos';
  canEdit: boolean;
  onUpdate: () => void;
}

export function OrderCategoryEditor({ 
  orderId, 
  currentCategory, 
  canEdit, 
  onUpdate 
}: OrderCategoryEditorProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(currentCategory);
  const [saving, setSaving] = useState(false);

  const categoryInfo = getServiceCategoryInfo(currentCategory);

  const handleSave = async () => {
    if (selectedCategory === currentCategory) {
      setIsEditing(false);
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('orders')
        .update({ order_category: selectedCategory })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Categoría actualizada",
        description: `La orden ahora pertenece a ${getServiceCategoryInfo(selectedCategory).label}`,
      });
      
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating order category:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la categoría",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedCategory(currentCategory);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className={`${categoryInfo.colors.cardBackground} ${categoryInfo.colors.cardBorder} ${categoryInfo.colors.titleText}`}
        >
          {categoryInfo.icon} {categoryInfo.label}
        </Badge>
        {canEdit && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 p-0"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select 
        value={selectedCategory} 
        onValueChange={(value: 'sistemas' | 'seguridad' | 'fraccionamientos') => setSelectedCategory(value)}
      >
        <SelectTrigger className="w-[180px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sistemas">
            💻 SISTEMAS
          </SelectItem>
          <SelectItem value="seguridad">
            🛡️ SEGURIDAD
          </SelectItem>
          <SelectItem value="fraccionamientos">
            🏘️ FRACCIONAMIENTOS
          </SelectItem>
        </SelectContent>
      </Select>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleSave}
        disabled={saving}
        className="h-6 w-6 p-0 text-primary hover:text-primary/80"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleCancel}
        disabled={saving}
        className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
