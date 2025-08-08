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
 * Componente principal para listar servicios
 * 
 * FUNCIONALIDADES:
 * - Listado paginado de servicios
 * - Filtros por categoría y búsqueda por nombre
 * - Indicadores visuales de precios y márgenes
 * - Acciones de editar y eliminar
 * - Vista responsive con cards
 * 
 * COMPONENTE REUTILIZABLE:
 * Este componente puede ser reutilizado en:
 * - Módulo de cotizaciones para seleccionar servicios
 * - Dashboard administrativo para resumen de servicios
 * - Reportes de ventas para análisis de servicios
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
   * Aplica filtros de búsqueda y categoría
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
   * Calcula el precio mínimo con el margen más alto
   */
  const getMinPrice = (service: Service): number => {
    if (!service.profit_margin_tiers || service.profit_margin_tiers.length === 0) {
      return service.cost_price * 1.3; // 30% por defecto
    }

    const maxMargin = Math.max(...service.profit_margin_tiers.map(tier => tier.margin));
    const priceWithMargin = service.cost_price * (1 + maxMargin / 100);
    const priceWithVat = priceWithMargin * (1 + service.vat_rate / 100);
    
    return priceWithVat;
  };

  /**
   * Obtiene el rango de márgenes configurados
   */
  const getMarginRange = (service: Service): string => {
    if (!service.profit_margin_tiers || service.profit_margin_tiers.length === 0) {
      return '30%';
    }

    const margins = service.profit_margin_tiers.map(tier => tier.margin);
    const min = Math.min(...margins);
    const max = Math.max(...margins);
    
    return min === max ? `${min}%` : `${min}%-${max}%`;
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

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar servicios..."
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

      {/* Lista de servicios */}
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
        <div className="grid gap-4">
          {services.map((service) => (
            <Card key={service.id} className="hover:shadow-md transition-shadow">
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Información básica */}
                  <div className="space-y-2">
                    <Badge variant="outline">{service.category}</Badge>
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

                  {/* Precios */}
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Costo Base</div>
                    <div className="text-lg font-bold text-muted-foreground">
                      {formatCurrency(service.cost_price)}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-medium">Precio Venta (min)</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(getMinPrice(service))}
                    </div>
                  </div>

                  {/* Configuración */}
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">IVA:</span> {service.vat_rate}%
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Margen:</span> {getMarginRange(service)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Qty: {service.min_quantity}-{service.max_quantity}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}