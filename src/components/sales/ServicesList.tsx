import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Search, DollarSign, Package, Clock } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

/**
 * Interface para servicios con campos extendidos de precios
 */
interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  item_type: string;
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

/**
 * Componente principal para listar servicios separados por tipo
 * 
 * FUNCIONALIDADES:
 * - Listado separado: servicios vs productos
 * - Filtros por categoría y búsqueda
 * - Visualización específica según tipo
 * - Cálculo de precios correcto por tipo
 */
export function ServicesList({ onEdit, onRefresh }: ServicesListProps) {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);

  /**
   * Carga la lista de servicios desde la base de datos
   */
  const loadServices = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('service_types')
        .select('*')
        .order('name');

      // Aplicar filtro de categoría
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      // Aplicar filtro de búsqueda
      if (searchTerm.trim()) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading services:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los servicios.",
          variant: "destructive",
        });
        return;
      }

      // Transformar datos para que coincidan con nuestra interface
      const transformedServices = (data || []).map(service => ({
        ...service,
        item_type: service.item_type || 'servicio',
        profit_margin_tiers: Array.isArray(service.profit_margin_tiers) 
          ? service.profit_margin_tiers as Array<{min_qty: number, max_qty: number, margin: number}>
          : []
      }));

      setServices(transformedServices);
    } catch (error) {
      console.error('Error loading services:', error);
      toast({
        title: "Error",
        description: "Error inesperado al cargar los servicios.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Carga las categorías únicas disponibles
   */
  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('category')
        .not('category', 'is', null);

      if (error) {
        console.error('Error loading categories:', error);
        return;
      }

      const uniqueCategories = [...new Set(data?.map(item => item.category) || [])];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  /**
   * Elimina un servicio después de confirmación
   */
  const handleDeleteService = async (serviceId: string, serviceName: string) => {
    try {
      const { error } = await supabase
        .from('service_types')
        .delete()
        .eq('id', serviceId);

      if (error) {
        console.error('Error deleting service:', error);
        toast({
          title: "Error",
          description: "No se pudo eliminar el servicio.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Servicio eliminado",
        description: `${serviceName} ha sido eliminado exitosamente.`,
      });

      loadServices();
      onRefresh();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({
        title: "Error",
        description: "Error inesperado al eliminar el servicio.",
        variant: "destructive",
      });
    }
  };

  /**
   * Calcula el precio de venta según el tipo
   */
  const getDisplayPrice = (service: Service): number => {
    if (service.item_type === 'servicio') {
      // Para servicios: precio base + IVA
      return service.base_price * (1 + service.vat_rate / 100);
    } else {
      // Para artículos: precio base + margen + IVA
      const profitMargin = (service as any).profit_margin || 30;
      const priceWithMargin = service.base_price * (1 + profitMargin / 100);
      return priceWithMargin * (1 + service.vat_rate / 100);
    }
  };

  /**
   * Obtiene el margen de ganancia (solo artículos)
   */
  const getMarginText = (service: Service): string => {
    if (service.item_type === 'servicio') return 'N/A';
    const profitMargin = (service as any).profit_margin || 30;
    return `${profitMargin}%`;
  };

  /**
   * Formatea números como moneda colombiana
   */
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  useEffect(() => {
    loadServices();
    loadCategories();
  }, [searchTerm, categoryFilter]);

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

  const servicios = services.filter(s => s.item_type === 'servicio');
  const productos = services.filter(s => s.item_type === 'articulo');

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar servicios y productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vista separada por tipo */}
      {services.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay servicios disponibles</h3>
            <p className="text-muted-foreground">
              {searchTerm || categoryFilter !== 'all' 
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
                          {!service.is_active && (
                            <Badge variant="secondary">Inactivo</Badge>
                          )}
                        </CardTitle>
                        <p className="text-muted-foreground text-sm mt-1">
                          {service.description}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(service.id)}
                        >
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
                              <AlertDialogAction
                                onClick={() => handleDeleteService(service.id, service.name)}
                              >
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
                          <Badge variant="outline" className="bg-blue-50">{service.category}</Badge>
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
                          <div className="text-xl font-bold text-blue-600">
                            {formatCurrency(service.base_price)}
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-blue-50 rounded text-center">
                        <div className="text-sm font-medium text-blue-800">
                          Precio Final: {formatCurrency(getDisplayPrice(service))}
                        </div>
                        <div className="text-xs text-blue-600">
                          (Incluye IVA {service.vat_rate}%)
                        </div>
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
                          {!service.is_active && (
                            <Badge variant="secondary">Inactivo</Badge>
                          )}
                        </CardTitle>
                        <p className="text-muted-foreground text-sm mt-1">
                          {service.description}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(service.id)}
                        >
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
                              <AlertDialogAction
                                onClick={() => handleDeleteService(service.id, service.name)}
                              >
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
                          <Badge variant="outline" className="bg-green-50">{service.category}</Badge>
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
                           <div>
                             <span className="font-medium">Precio Base:</span> {formatCurrency(service.base_price)}
                           </div>
                           <div>
                             <span className="font-medium">Margen:</span> {getMarginText(service)}
                           </div>
                          <div>
                            <span className="font-medium">IVA:</span> {service.vat_rate}%
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-green-50 rounded text-center">
                        <div className="text-sm font-medium text-green-800">
                          Precio Venta: {formatCurrency(getDisplayPrice(service))}
                        </div>
                         <div className="text-xs text-green-600">
                           (Con margen + IVA)
                         </div>
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