import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Package, Camera, Monitor, Computer, Zap, ShieldCheck, Key, Home, Wrench, Settings, Phone, Wifi, Lock, Users, Building, Car } from 'lucide-react';

type Category = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CategoryForm = {
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
};

const INITIAL_FORM: CategoryForm = {
  name: '',
  description: '',
  icon: 'package',
  is_active: true,
};

const ICON_COMPONENTS: Record<string, React.ComponentType<any>> = {
  camera: Camera,
  monitor: Monitor,
  computer: Computer,
  zap: Zap,
  'shield-check': ShieldCheck,
  key: Key,
  home: Home,
  wrench: Wrench,
  settings: Settings,
  package: Package,
  'shield-alert': Package, // fallback
  phone: Phone,
  wifi: Wifi,
  lock: Lock,
  users: Users,
  building: Building,
  car: Car,
};

const AVAILABLE_ICONS = Object.keys(ICON_COMPONENTS);

export function MainCategoriesManager() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(INITIAL_FORM);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load categories
  useEffect(() => {
    loadCategories();
  }, [refreshTrigger]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('main_service_categories')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las categorías.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la categoría es requerido.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from('main_service_categories')
          .update({
            name: form.name.trim(),
            description: form.description.trim() || null,
            icon: form.icon.trim() || null,
            is_active: form.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id);

        if (error) throw error;

        toast({
          title: "Categoría actualizada",
          description: `${form.name} ha sido actualizada exitosamente.`,
        });
      } else {
        // Create new category
        const { error } = await supabase
          .from('main_service_categories')
          .insert({
            name: form.name.trim(),
            description: form.description.trim() || null,
            icon: form.icon.trim() || null,
            is_active: form.is_active,
          });

        if (error) throw error;

        toast({
          title: "Categoría creada",
          description: `${form.name} ha sido creada exitosamente.`,
        });
      }

      // Reset form and close dialog
      setForm(INITIAL_FORM);
      setEditingCategory(null);
      setDialogOpen(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error saving category:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la categoría.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      description: category.description || '',
      icon: category.icon || 'package',
      is_active: category.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (category: Category) => {
    try {
      const { error } = await supabase
        .from('main_service_categories')
        .delete()
        .eq('id', category.id);

      if (error) throw error;

      toast({
        title: "Categoría eliminada",
        description: `${category.name} ha sido eliminada exitosamente.`,
      });
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la categoría.",
        variant: "destructive",
      });
    }
  };

  const handleNewCategory = () => {
    setEditingCategory(null);
    setForm(INITIAL_FORM);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setForm(INITIAL_FORM);
  };

  const getIconComponent = (iconName: string) => {
    return ICON_COMPONENTS[iconName] || Package;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gestión de Categorías</h2>
          <p className="text-muted-foreground">
            Administra las categorías principales para servicios y diagnósticos
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewCategory} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nueva Categoría
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                </DialogTitle>
                <DialogDescription>
                  {editingCategory 
                    ? 'Modifica los datos de la categoría existente.'
                    : 'Crea una nueva categoría para organizar servicios y diagnósticos.'
                  }
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Computadoras, Cámaras de Seguridad"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descripción de la categoría..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="icon">Icono</Label>
                  <div className="flex flex-wrap gap-1">
                    {AVAILABLE_ICONS.map((iconName) => {
                      const IconComponent = getIconComponent(iconName);
                      return (
                        <Button
                          key={iconName}
                          type="button"
                          variant={form.icon === iconName ? "default" : "outline"}
                          size="sm"
                          className="p-2"
                          onClick={() => setForm(prev => ({ ...prev, icon: iconName }))}
                          title={iconName}
                        >
                          <IconComponent className="h-4 w-4" />
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Activa</Label>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingCategory ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>Categorías Registradas ({categories.length})</CardTitle>
          <CardDescription>
            Lista de todas las categorías disponibles en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-5 w-32 bg-muted rounded" />
                    <div className="h-4 w-20 bg-muted rounded" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No hay categorías</h3>
              <p className="text-muted-foreground">
                Comienza creando tu primera categoría.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => {
                const IconComponent = getIconComponent(category.icon || 'package');
                return (
                   <Card key={category.id} className="hover:shadow-md transition-shadow">
                     <CardHeader>
                         <div className="flex items-start justify-between">
                           <div className="flex items-center gap-3">
                             <IconComponent className="h-6 w-6 text-primary" />
                             <div>
                               <CardTitle className="text-base">{category.name}</CardTitle>
                               <div className="flex items-center gap-2 mt-1">
                                 <Badge variant={category.is_active ? "default" : "secondary"}>
                                   {category.is_active ? 'Activa' : 'Inactiva'}
                                 </Badge>
                               </div>
                             </div>
                           </div>
                         </div>
                     </CardHeader>
                    <CardContent className="space-y-3">
                      {category.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {category.description}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(category)}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. La categoría "{category.name}" 
                                será eliminada permanentemente.
                                {category.is_active && (
                                  <span className="block mt-2 text-destructive font-medium">
                                    ⚠️ Esta categoría está activa y puede tener servicios asociados.
                                  </span>
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(category)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
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
        </CardContent>
      </Card>
    </div>
  );
}