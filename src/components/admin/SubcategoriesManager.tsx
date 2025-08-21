import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash2, AlertTriangle, Package } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

// Definir las subcategorías predefinidas (no se pueden eliminar)
const PREDEFINED_SUBCATEGORIES: Record<string, string[]> = {
  'Computadoras': ['Programas', 'Antivirus', 'Mtto Fisico', 'Formateo con Respaldo', 'Formateo sin Respaldo'],
  'Cámaras de Seguridad': ['Kit 4 Camaras', 'Mtto General'],
  'Control de Acceso': [],
  'Fraccionamientos': [],
  'Cercas Eléctricas': [],
  'Alarmas': [],
};

interface SubcategoryData {
  name: string;
  category: string;
  isPredefined: boolean;
  servicesCount: number;
  services: Array<{ id: string; name: string }>;
}

export function SubcategoriesManager() {
  const { toast } = useToast();
  const [subcategories, setSubcategories] = useState<SubcategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Array<{ name: string }>>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar categorías principales
      const { data: categoriesData } = await supabase
        .from('main_service_categories')
        .select('name')
        .eq('is_active', true)
        .order('name');

      setCategories(categoriesData || []);

      // Cargar servicios con sus subcategorías
      const { data: services } = await supabase
        .from('service_types')
        .select('id, name, category, subcategory, item_type')
        .eq('is_active', true);

      console.log('Loaded services:', services); // Debug

      if (!services) {
        setSubcategories([]);
        return;
      }

      // Procesar subcategorías
      const subcategoryMap = new Map<string, {
        category: string;
        services: Array<{ id: string; name: string }>;
        isPredefined: boolean;
      }>();

      // NO agregar subcategorías predefinidas vacías por defecto
      // Solo mostrar las que realmente se usan

      // Agregar subcategorías de servicios existentes
      services.forEach(service => {
        let subcategoryName = '';
        
        // Priorizar el campo subcategory, pero también revisar item_type por compatibilidad
        if (service.subcategory && service.subcategory.trim()) {
          subcategoryName = service.subcategory.trim();
        } else if (service.item_type && service.item_type.trim() && 
                   service.item_type !== 'servicio' && service.item_type !== 'articulo') {
          // Si item_type no es 'servicio' o 'articulo', podría ser una subcategoría legacy
          subcategoryName = service.item_type.trim();
        }

        if (subcategoryName) {
          const key = `${service.category}-${subcategoryName}`;
          const existing = subcategoryMap.get(key);
          
          // Determinar si es predefinida
          const categoryPredefined = PREDEFINED_SUBCATEGORIES[service.category] || [];
          const isPredefined = categoryPredefined.includes(subcategoryName);
          
          if (existing) {
            existing.services.push({
              id: service.id,
              name: service.name
            });
          } else {
            subcategoryMap.set(key, {
              category: service.category,
              services: [{
                id: service.id,
                name: service.name
              }],
              isPredefined
            });
          }
        }
      });

      // Convertir a array ordenado
      const subcategoriesArray: SubcategoryData[] = Array.from(subcategoryMap.entries()).map(([key, data]) => {
        // Mejorar el parsing del nombre de subcategoría
        const parts = key.split('-');
        const subcategoryName = parts.slice(1).join('-'); // Todo después del primer guión
        return {
          name: subcategoryName,
          category: data.category,
          isPredefined: data.isPredefined,
          servicesCount: data.services.length,
          services: data.services
        };
      }).sort((a, b) => {
        // Ordenar por categoría, luego por nombre
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });

      console.log('Processed subcategories:', subcategoriesArray); // Debug
      setSubcategories(subcategoriesArray);
    } catch (error) {
      console.error('Error loading subcategories:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las subcategorías.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteSubcategory = async (subcategory: SubcategoryData) => {
    try {
      setLoading(true);

      // Si tiene servicios asociados, preguntar qué hacer
      if (subcategory.servicesCount > 0) {
        // Actualizar servicios para remover la subcategoría
        const { error } = await supabase
          .from('service_types')
          .update({ subcategory: null })
          .eq('category', subcategory.category)
          .eq('subcategory', subcategory.name);

        if (error) {
          throw error;
        }

        toast({
          title: "Subcategoría eliminada",
          description: `Se eliminó "${subcategory.name}" y se actualizaron ${subcategory.servicesCount} servicios.`,
        });
      } else {
        toast({
          title: "Subcategoría eliminada",
          description: `Se eliminó "${subcategory.name}".`,
        });
      }

      // Recargar datos
      await loadData();
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la subcategoría.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Agrupar subcategorías por categoría
  const groupedSubcategories = subcategories.reduce((acc, sub) => {
    if (!acc[sub.category]) {
      acc[sub.category] = [];
    }
    acc[sub.category].push(sub);
    return acc;
  }, {} as Record<string, SubcategoryData[]>);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Administrador de Subcategorías</CardTitle>
          <CardDescription>
            Gestiona las subcategorías de servicios. Las subcategorías predefinidas no se pueden eliminar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Al eliminar una subcategoría, todos los servicios que la usen serán actualizados para no tener subcategoría específica.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {Object.entries(groupedSubcategories).map(([categoryName, subs]) => (
        <Card key={categoryName}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {categoryName}
            </CardTitle>
            <CardDescription>
              {subs.length} subcategorías en esta categoría
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {subs.map((subcategory, index) => (
                <div key={`${categoryName}-${subcategory.name}`}>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{subcategory.name}</span>
                          {subcategory.isPredefined ? (
                            <Badge variant="secondary">Predefinida</Badge>
                          ) : (
                            <Badge variant="outline">Personalizada</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {subcategory.servicesCount} servicio{subcategory.servicesCount !== 1 ? 's' : ''}
                          {subcategory.servicesCount > 0 && (
                            <span className="ml-1">
                              ({subcategory.services.map(s => s.name).join(', ')})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!subcategory.isPredefined && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar subcategoría?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Estás a punto de eliminar la subcategoría "{subcategory.name}".
                                {subcategory.servicesCount > 0 && (
                                  <>
                                    <br /><br />
                                    <strong>Atención:</strong> Esta subcategoría está siendo usada por {subcategory.servicesCount} servicio{subcategory.servicesCount !== 1 ? 's' : ''}:
                                    <ul className="list-disc list-inside mt-2">
                                      {subcategory.services.map(service => (
                                        <li key={service.id} className="text-sm">{service.name}</li>
                                      ))}
                                    </ul>
                                    <br />
                                    Estos servicios serán actualizados para no tener subcategoría específica.
                                  </>
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteSubcategory(subcategory)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  {index < subs.length - 1 && <Separator className="mt-3" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {subcategories.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <Package className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">No hay subcategorías en uso</h3>
              <p className="text-muted-foreground mt-2">
                Para crear subcategorías, ve a <strong>Servicios &gt; Nuevo</strong> y especifica una subcategoría en el formulario de creación de servicios.
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                Las subcategorías personalizadas aparecerán aquí y podrás eliminarlas. Las subcategorías predefinidas no se pueden eliminar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}