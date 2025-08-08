import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Camera, 
  Key, 
  ShieldAlert, 
  Wifi, 
  Lightbulb,
  Package,
  Wrench,
  Settings,
  Monitor,
  Smartphone,
  Server,
  Cpu
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
}

interface CategoryManagerProps {
  type: 'sales' | 'technical';
  categories: Category[];
  onCategoriesChange: () => void;
}

const AVAILABLE_ICONS = {
  // General
  'package': Package,
  'settings': Settings,
  // Electronics
  'camera': Camera,
  'monitor': Monitor,
  'smartphone': Smartphone,
  'server': Server,
  'cpu': Cpu,
  // Security
  'key': Key,
  'shield-alert': ShieldAlert,
  // Network
  'wifi': Wifi,
  // Tools
  'wrench': Wrench,
  // Lighting
  'lightbulb': Lightbulb,
};

const ICON_OPTIONS = Object.keys(AVAILABLE_ICONS);

export function CategoryManager({ type, categories, onCategoriesChange }: CategoryManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'package'
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const tableName = 'sales_categories'; // Only sales categories for now
  const categoryTypeLabel = type === 'sales' ? 'ventas' : 'técnicas';

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: 'package'
    });
    setEditingCategory(null);
  };

  const openDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        icon: category.icon
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre de la categoría es requerido',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      const categoryData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        icon: formData.icon
      };

      if (editingCategory) {
        const { error } = await supabase
          .from(tableName)
          .update(categoryData)
          .eq('id', editingCategory.id);

        if (error) throw error;

        toast({
          title: 'Categoría actualizada',
          description: 'Los cambios se han guardado correctamente'
        });
      } else {
        const { error } = await supabase
          .from(tableName)
          .insert([categoryData]);

        if (error) throw error;

        toast({
          title: 'Categoría creada',
          description: 'La nueva categoría se ha creado exitosamente'
        });
      }

      setIsDialogOpen(false);
      resetForm();
      onCategoriesChange();
    } catch (error: any) {
      console.error('Error saving category:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar la categoría',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from(tableName)
        .update({ is_active: false })
        .eq('id', categoryId);

      if (error) throw error;

      toast({
        title: 'Categoría eliminada',
        description: 'La categoría se ha desactivado correctamente'
      });

      onCategoriesChange();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar la categoría',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = AVAILABLE_ICONS[iconName as keyof typeof AVAILABLE_ICONS] || Package;
    return IconComponent;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Categorías {categoryTypeLabel} ({categories.length})
        </h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nueva Categoría
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre de la Categoría</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Cámaras de Seguridad"
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción de la categoría"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="icon">Icono</Label>
                <Select value={formData.icon} onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}>
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const IconComponent = getIconComponent(formData.icon);
                          return <IconComponent className="h-4 w-4" />;
                        })()}
                        {formData.icon}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((iconName) => {
                      const IconComponent = getIconComponent(iconName);
                      return (
                        <SelectItem key={iconName} value={iconName}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            {iconName}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={loading} className="flex-1">
                  {loading ? 'Guardando...' : (editingCategory ? 'Actualizar' : 'Crear')}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No hay categorías {categoryTypeLabel} disponibles
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Haz clic en "Nueva Categoría" para agregar la primera
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const IconComponent = getIconComponent(category.icon);
            return (
              <Card key={category.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{category.name}</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Activa
                    </Badge>
                  </div>
                  {category.description && (
                    <p className="text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDialog(category)}
                      className="flex-1"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción desactivará la categoría "{category.name}". 
                            Los conocimientos/habilidades asociados se mantendrán pero la categoría no estará disponible para nuevas asignaciones.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(category.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}