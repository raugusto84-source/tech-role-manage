import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Search, Package, Clock } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

/** ============================
 *  CATEGORÍAS / SUBCATEGORÍAS
 *  ============================ */
const MAIN_CATEGORIES = [
  'Computadoras',
  'Cámaras de Seguridad',
  'Control de Acceso',
  'Fraccionamientos',
  'Cercas Eléctricas',
  'Alarmas',
] as const;
type MainCategory = typeof MAIN_CATEGORIES[number];

const SUBCATEGORY_MAP: Record<MainCategory, string[]> = {
  'Computadoras': ['Programas', 'Antivirus', 'Mtto Fisico', 'Formateo con Respaldo', 'Formateo sin Respaldo'],
  'Cámaras de Seguridad': ['Kit 4 Camaras', 'Mtto General'],
  'Control de Acceso': [],
  'Fraccionamientos': [],
  'Cercas Eléctricas': [],
  'Alarmas': [],
};

/** ============================
 *  TIPOS / INTERFACES
 *  ============================ */
interface Service {
  id: string;
  name: string;
  description: string;
  category: string;      // principal
  item_type: string;     // tipo ('servicio' | 'articulo') o legado subcategoría
  subcategory?: string | null; // nueva subcategoría
  cost_price: number;
  base_price: number;
  vat_rate: number;
  profit_margin_tiers: Array<{
    min_qty: number;
    max_qty: number;
    margin: number;
  }>;
  unit: string;
  min_quantity: number;
  max_quantity: number;
  estimated_hours: number;
  is_active: boolean;
  created_at: string;
}

interface ServicesListProps {
  onEdit: (serviceId: string) => void;
  onRefresh: () => void;
}

/** Helpers para compatibilidad */
const isProduct = (service: Service) => {
  const hasTiers = Array.isArray(service.profit_margin_tiers) && service.profit_margin_tiers.length > 0;
  return hasTiers || service.item_type === 'articulo';
};
const marginFromTiers = (service: Service): number =>
  (service.profit_margin_tiers?.[0]?.margin ?? (service as any).profit_margin ?? 30);

/**
 * Componente principal
 */
export function ServicesList({ onEdit, onRefresh }: ServicesListProps) {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // NUEVOS filtros: botones de categoría y chips de subcategoría
  const [mainCategory, setMainCategory] = useState<'all' | MainCategory>('all');
  const [subCategory, setSubCategory] = useState<'all' | string>('all');

  const loadServices = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('service_types')
        .select('*')
        .order('name');

      if (mainCategory !== 'all') {
        query = query.eq('category', mainCategory);
      }
      if (subCategory !== 'all') {
        // Compatibilidad: buscar por subcategory o por item_type legado
        query = query.or(`subcategory.eq.${subCategory},item_type.eq.${subCategory}`);
      }
      if (searchTerm.trim()) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error loading services:', error);
        toast({ title: "Error", description: "No se pudieron cargar los servicios.", variant: "destructive" });
        return;
      }

      const transformed = (data || []).map((s: any) => ({
        ...s,
        profit_margin_tiers: Array.isArray(s.profit_margin_tiers) ? s.profit_margin_tiers : [],
      })) as Service[];

      setServices(transformed);
    } catch (error) {
      console.error('Error loading services:', error);
      toast({ title: "Error", description: "Error inesperado al cargar los servicios.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteService = async (serviceId: string, serviceName: string) => {
    try {
      const { error } = await supabase.from('service_types').delete().eq('id', serviceId);
      if (error) {
        console.error('Error deleting service:', error);
        toast({ title: "Error", description: "No se pudo eliminar el servicio.", variant: "destructive" });
        return;
      }
      toast({ title: "Servicio eliminado", description: `${serviceName} ha sido eliminado exitosamente.` });
      loadServices();
      onRefresh();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({ title: "Error", description: "Error inesperado al eliminar el servicio.", variant: "destructive" });
    }
  };

  const getDisplayPrice = (service: Service): number => {
    if (!isProduct(service)) {
      return service.base_price * (1 + service.vat_rate / 100);
    } else {
      const profitMargin = marginFromTiers(service);
      const priceWithMargin = service.base_price * (1 + profitMargin / 100);
      return priceWithMargin * (1 + service.vat_rate / 100);
    }
  };

  const getMarginText = (service: Service): string => {
    if (!isProduct(service)) return 'N/A';
    return `${marginFromTiers(service)}%`;
  };

  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  useEffect(() => {
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, mainCategory, subCategory]);

  const servicios = useMemo(() => services.filter((s) => !isProduct(s)), [services]);
  const productos = useMemo(() => services.filter((s) => isProduct(s)), [services]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Subcategorías disponibles para la categoría actual
  const availableSubs = mainCategory === 'all' ? [] : SUBCATEGORY_MAP[mainCategory] || [];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar servicios y productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Botones de Categoría Principal */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={mainCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setMainCategory('all'); setSubCategory('all'); }}
          >
            Todas
          </Button>
          {MAIN_CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={mainCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setMainCategory(cat); setSubCategory('all'); }}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Chips de Subcategoría (cuando hay categoría seleccionada) */}
        {mainCategory !== 'all' && (
          <div className="flex flex-wrap gap-2">
            <Badge
              onClick={() => setSubCategory('all')}
              variant={subCategory === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
            >
              Todas
            </Badge>
            {availableSubs.map((sub) => (
              <Badge
                key={sub}
                onClick={() => setSubCategory(sub)}
                variant={subCategory === sub ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                {sub}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Vista separada por tipo */}
      {services.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay servicios disponibles</h3>
            <p className="text-muted-foreground">
              {searchTerm || mainCategory !== 'all' || subCategory !== 'all'
                ? 'No se encontraron servicios con los filtros aplicados.'
                : 'Comienza agregando tu primer servicio al catálogo.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna de Servicios */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
              <h3 className="text-lg font-semibold">🔧 Servicios ({servicios.length})</h3>
            </div>

            {servicios.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-muted-foreground">
                  <p>No hay servicios registrados</p>
                </CardContent>
              </Card>
            ) : (
              servicios.map((service) => (
                <Card key={service.id} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {service.name}
                          {!service.is_active && (<Badge variant="secondary">Inactivo</Badge>)}
                        </CardTitle>
                        <p className="text-muted-foreground text-sm mt-1">{service.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEdit(service.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar servicio?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. El servicio "{service.name}" será eliminado permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteService(service.id, service.name)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <div className="flex gap-2">
                            <Badge variant="outline" className="bg-blue-50">{service.category}</Badge>
                            {/* Mostrar subcategoría si no es 'servicio'/'articulo' (compatibilidad con datos viejos) */}
                            {service.item_type && !['servicio', 'articulo'].includes(service.item_type) && (
                              <Badge variant="outline">{service.item_type}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Package className="h-3 w-3" />
                            {service.unit}
                          </div>
                          {service.estimated_hours > 0 && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {service.estimated_hours}h
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-muted-foreground">Precio Fijo</div>
                          <div className="text-xl font-bold text-blue-600">{formatCurrency(service.base_price)}</div>
                        </div>
                      </div>
                      <div className="p-3 bg-blue-50 rounded text-center">
                        <div className="text-sm font-medium text-blue-800">
                          Precio Final: {formatCurrency(getDisplayPrice(service))}
                        </div>
                        <div className="text-xs text-blue-600">(Incluye IVA {service.vat_rate}%)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Columna de Productos/Artículos */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 bg-green-500 rounded-full"></div>
              <h3 className="text-lg font-semibold">📦 Productos ({productos.length})</h3>
            </div>

            {productos.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-muted-foreground">
                  <p>No hay productos registrados</p>
                </CardContent>
              </Card>
            ) : (
              productos.map((service) => (
                <Card key={service.id} className="hover:shadow-md transition-shadow border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {service.name}
                          {!service.is_active && (<Badge variant="secondary">Inactivo</Badge>)}
                        </CardTitle>
                        <p className="text-muted-foreground text-sm mt-1">{service.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEdit(service.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. El producto "{service.name}" será eliminado permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteService(service.id, service.name)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex gap-2">
                            <Badge variant="outline" className="bg-green-50">{service.category}</Badge>
                            {service.item_type && !['servicio', 'articulo'].includes(service.item_type) && (
                              <Badge variant="outline">{service.item_type}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Package className="h-3 w-3" />
                            {service.unit}
                          </div>
                          {service.estimated_hours > 0 && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {service.estimated_hours}h
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 text-right text-sm">
                          <div><span className="font-medium">Precio Base:</span> {formatCurrency(service.base_price)}</div>
                          <div><span className="font-medium">Margen:</span> {getMarginText(service)}</div>
                          <div><span className="font-medium">IVA:</span> {service.vat_rate}%</div>
                        </div>
                      </div>
                      <div className="p-3 bg-green-50 rounded text-center">
                        <div className="text-sm font-medium text-green-800">
                          Precio Venta: {formatCurrency(getDisplayPrice(service))}
                        </div>
                        <div className="text-xs text-green-600">(Con margen + IVA)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
