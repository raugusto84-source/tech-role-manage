import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
// ⛔ QUITAMOS ServicesList para evitar depender de una tabla 'services' que no existe
// import { ServicesList } from '@/components/sales/ServicesList';
import { ServiceForm } from '@/components/sales/ServiceForm';
import ProfitMarginConfig from '@/components/sales/ProfitMarginConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Package, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PersonalTimeClockPanel } from '@/components/timetracking/PersonalTimeClockPanel';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

/**
 * Función utilitaria (tu snippet). Si la categoría no tiene icono en DB, usamos este mapa.
 */
const getCategoryIcon = (categoryName: string): string => {
  const iconMap: Record<string, string> = {
    'general': '🔧',
    'mantenimiento': '🛠️',
    'reparacion': '🔨',
    'instalacion': '📦',
    'consultoria': '💡',
    'soporte': '🆘',
    'desarrollo': '💻',
    'formacion': '📚',
    'formateo': '💾',
    'otros': '📋'
  };
  return iconMap[categoryName.toLowerCase()] || '🔧';
};

// Tablas reales según tu schema
const SERVICES_TABLE = 'service_types' as const;
const CATEGORIES_TABLE = 'service_categories' as const;

// Selects mínimos para evitar errores por columnas inexistentes
const SERVICE_SELECT = 'id, name, description, base_price, unit, vat_rate, category';
const CATEGORY_SELECT = 'id, name, icon, is_active';

type Category = { id: string; name: string; icon?: string | null; is_active?: boolean | null };
type Service = {
  id: string;
  name: string;
  description?: string | null;
  base_price?: number | null;
  unit?: string | null;
  vat_rate?: number | null;
  category?: string | null; // en service_types es STRING (nombre), no id
};

export default function Sales() {
  const { toast } = useToast();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<'list' | 'form' | 'margins'>('list');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Categorías / selección
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Ítems (service_types)
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // Cargar categorías
  useEffect(() => {
    let mounted = true;
    (async () => {
      setCategoriesLoading(true);
      const { data, error } = await supabase
        .from(CATEGORIES_TABLE)
        .select(CATEGORY_SELECT)
        .order('name', { ascending: true });

      if (!mounted) return;
      if (error) {
        toast({ title: 'Error cargando categorías', description: error.message, variant: 'destructive' });
        setCategories([]);
      } else {
        setCategories((data ?? []) as Category[]);
      }
      setCategoriesLoading(false);
    })();
    return () => { mounted = false; };
  }, [toast, refreshTrigger]);

  const activeCategory = useMemo(
    () => categories.find(c => c.id === activeCategoryId) || null,
    [categories, activeCategoryId]
  );

  // Cargar servicios (si hay categoría, filtra por nombre)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setServicesLoading(true);

      let query = supabase
        .from(SERVICES_TABLE)
        .select(SERVICE_SELECT)
        .order('name', { ascending: true });

      // OJO: service_types.category es string con el NOMBRE de la categoría
      const catName = activeCategory?.name;
      if (catName) query = query.eq('category', catName);

      const { data, error } = await query;

      if (!mounted) return;
      if (error) {
        toast({ title: 'Error cargando ítems', description: error.message, variant: 'destructive' });
        setServices([]);
      } else {
        setServices((data ?? []) as Service[]);
      }
      setServicesLoading(false);
    })();
    return () => { mounted = false; };
  }, [activeCategory?.name, toast, refreshTrigger]);

  const handleServiceCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('list');
    toast({ title: "Servicio creado", description: "El servicio ha sido agregado exitosamente." });
  };

  const handleServiceUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
    setSelectedService(null);
    setActiveTab('list');
    toast({ title: "Servicio actualizado", description: "Los cambios han sido guardados exitosamente." });
  };

  const handleEditService = (serviceId: string) => {
    setSelectedService(serviceId);
    setActiveTab('form');
  };

  const handleCancelEdit = () => {
    setSelectedService(null);
    setActiveTab('list');
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestión de Ventas y Servicios</h1>
            <p className="text-muted-foreground mt-2">
              Administra servicios, artículos y configuración de precios con IVA y márgenes de ganancia
            </p>
          </div>
          <Button
            onClick={() => { setSelectedService(null); setActiveTab('form'); }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nuevo Servicio
          </Button>
        </div>

        {/* Control de Tiempo Personal - Solo para vendedores */}
        {profile?.role === 'vendedor' && <PersonalTimeClockPanel />}

        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Servicios
            </TabsTrigger>
            <TabsTrigger value="form" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {selectedService ? 'Editar' : 'Nuevo'}
            </TabsTrigger>
            <TabsTrigger value="margins" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Márgenes
            </TabsTrigger>
          </TabsList>

          {/* LISTA */}
          <TabsContent value="list" className="space-y-6">
            {/* Botones de categorías */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Categorías</CardTitle>
                <CardDescription>Elige una categoría para ver sus artículos</CardDescription>
              </CardHeader>
              <CardContent>
                {categoriesLoading ? (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-9 w-28 rounded-full bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    <Button
                      type="button"
                      variant={activeCategoryId === null ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveCategoryId(null)}
                      className="rounded-full"
                      title="Todas las categorías"
                    >
                      ☆ Todas
                    </Button>
                    {categories.map((cat) => (
                      <Button
                        key={cat.id}
                        type="button"
                        variant={activeCategoryId === cat.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveCategoryId(cat.id)}
                        className="rounded-full"
                        title={cat.name}
                      >
                        <span className="mr-1">{cat.icon || getCategoryIcon(cat.name)}</span>
                        {cat.name}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grid de ítems (service_types) */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeCategory ? `Artículos de: ${activeCategory.name}` : 'Todos los artículos'}
                </CardTitle>
                <CardDescription>
                  {activeCategory ? 'Ítems de la categoría seleccionada' : 'Catálogo completo desde public.service_types'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {servicesLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardHeader>
                          <div className="h-5 w-40 bg-muted rounded" />
                          <div className="h-4 w-28 bg-muted rounded mt-2" />
                        </CardHeader>
                        <CardContent>
                          <div className="h-8 w-24 bg-muted rounded" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : services.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sin ítems</CardTitle>
                      <CardDescription>
                        {activeCategory ? 'No hay servicios en esta categoría.' : 'No hay artículos registrados.'}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {services.map((svc) => (
                      <Card key={svc.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-lg">{svc.name}</CardTitle>
                              {typeof svc.vat_rate === 'number' && (
                                <Badge variant="secondary">IVA {svc.vat_rate}%</Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {svc.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{svc.description}</p>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="text-xl font-bold">
                              {typeof svc.base_price === 'number' ? `$${svc.base_price.toFixed(2)}` : '—'}
                              {svc.unit ? <span className="text-sm text-muted-foreground ml-1">/{svc.unit}</span> : null}
                            </div>
                            <Button size="sm" onClick={() => handleEditService(svc.id)}>Editar</Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FORMULARIO (no modificado) */}
          <TabsContent value="form" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{selectedService ? 'Editar Servicio' : 'Nuevo Servicio'}</CardTitle>
                <CardDescription>
                  {selectedService
                    ? 'Modifica los datos del servicio seleccionado'
                    : 'Agrega un nuevo servicio o artículo al catálogo'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ServiceForm
                  serviceId={selectedService}
                  onSuccess={selectedService ? handleServiceUpdated : handleServiceCreated}
                  onCancel={handleCancelEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* MÁRGENES (sin cambios) */}
          <TabsContent value="margins" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Márgenes</CardTitle>
                <CardDescription>
                  Define los porcentajes de ganancia automáticos por rangos de precio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProfitMarginConfig />
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </AppLayout>
  );
}
