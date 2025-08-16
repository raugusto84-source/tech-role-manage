import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ServicesList } from '@/components/sales/ServicesList';
import { ServiceForm } from '@/components/sales/ServiceForm';
import ProfitMarginConfig from '@/components/sales/ProfitMarginConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Package, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PersonalTimeClockPanel } from '@/components/timetracking/PersonalTimeClockPanel';
import { useAuth } from '@/hooks/useAuth';

// Supabase
import { supabase } from '@/integrations/supabase/client';
// Opcional si muestras IVA (puede quedarse)
import { Badge } from '@/components/ui/badge';

/** 
 * 🔧 Config: si ya sabes cómo se llama tu tabla de ítems,
 * cambia esta constante y se usará directamente.
 * Si la dejas en null, el código intentará resolverla automáticamente.
 */
const EXPLICIT_SERVICES_TABLE: string | null = null; // p.ej. 'sales_services' | 'products' | 'items'

/** Candidatos comunes para autodetección */
const SERVICE_TABLE_CANDIDATES = ['services', 'sales_services', 'products', 'items', 'catalog_items'] as const;

/** Selección minimal para evitar errores por columnas inexistentes */
const SERVICE_SELECT = 'id, name, description, price, category_id';

/** Tipos locales */
type Category = { id: string; name: string; color?: string | null };
type Service = {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  category_id?: string | null;
  // Campos opcionales, muestra si existen
  unit?: string | null;
  iva_rate?: number | null;
  sku?: string | null;
};

export default function Sales() {
  const { toast } = useToast();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<'list' | 'form' | 'margins'>('list');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Categorías
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Tabla de servicios resuelta
  const [servicesTable, setServicesTable] = useState<string | null>(EXPLICIT_SERVICES_TABLE);
  const [servicesTableError, setServicesTableError] = useState<string | null>(null);

  // Ítems de la categoría
  const [categoryServices, setCategoryServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState<boolean>(false);

  // Cargar categorías (sin 'color' para evitar error si no existe)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setCategoriesLoading(true);
      const { data, error } = await supabase
        .from('service_categories') // si tu tabla se llama distinto, cámbiala aquí
        .select('id, name')
        .order('name', { ascending: true });

      if (!mounted) return;
      if (error) {
        toast({
          title: 'Error cargando categorías',
          description: error.message,
          variant: 'destructive',
        });
        setCategories([]);
      } else {
        setCategories((data || []) as Category[]);
      }
      setCategoriesLoading(false);
    })();
    return () => { mounted = false; };
  }, [toast, refreshTrigger]);

  // Resolver tabla de servicios si no fue fijada explícitamente
  useEffect(() => {
    let mounted = true;
    if (EXPLICIT_SERVICES_TABLE) {
      setServicesTable(EXPLICIT_SERVICES_TABLE);
      setServicesTableError(null);
      return;
    }
    (async () => {
      setServicesTableError(null);
      for (const candidate of SERVICE_TABLE_CANDIDATES) {
        const { error } = await (supabase as any).from(candidate).select('id').limit(1);
        if (!error) {
          if (!mounted) return;
          setServicesTable(candidate);
          return;
        }
      }
      if (!mounted) return;
      setServicesTable(null);
      setServicesTableError(
        `No encontré una tabla de ítems entre: ${SERVICE_TABLE_CANDIDATES.join(', ')}. ` +
        `Define EXPLICIT_SERVICES_TABLE con el nombre correcto.`
      );
    })();
    return () => { mounted = false; };
  }, []);

  // Cargar servicios al cambiar de categoría y cuando ya sabemos la tabla
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!activeCategoryId) {
        setCategoryServices([]);
        return;
      }
      if (!servicesTable) {
        setCategoryServices([]);
        return;
      }
      setServicesLoading(true);

      const { data, error } = await (supabase as any)
        .from(servicesTable)
        .select(SERVICE_SELECT)
        .eq('category_id', activeCategoryId)
        .order('name', { ascending: true });

      if (!mounted) return;
      if (error) {
        toast({
          title: 'Error cargando servicios',
          description: error.message,
          variant: 'destructive',
        });
        setCategoryServices([]);
      } else {
        setCategoryServices((data ?? []) as Service[]);
      }
      setServicesLoading(false);
    })();
    return () => { mounted = false; };
  }, [activeCategoryId, servicesTable, toast, refreshTrigger]);

  const activeCategory = useMemo(
    () => categories.find(c => c.id === activeCategoryId) || null,
    [categories, activeCategoryId]
  );

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

        {/* Reloj personal solo vendedores */}
        {profile?.role === 'vendedor' && <PersonalTimeClockPanel />}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Servicios
            </TabsTrigger>
            <TabsTrigger value="form" className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> {selectedService ? 'Editar' : 'Nuevo'}
            </TabsTrigger>
            <TabsTrigger value="margins" className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Márgenes
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
                    >
                      Todas
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
                        {cat.name}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Si hay categoría seleccionada, mostrar ítems de esa categoría; si no, la lista completa existente */}
            {activeCategoryId ? (
              <Card>
                <CardHeader>
                  <CardTitle>Artículos de: {activeCategory ? activeCategory.name : '…'}</CardTitle>
                  <CardDescription>Ítems de la categoría seleccionada</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Mensaje si no resolvimos tabla */}
                  {!servicesTable && (
                    <Card className="mb-4">
                      <CardHeader>
                        <CardTitle className="text-base">No se encontró la tabla de ítems</CardTitle>
                        <CardDescription>
                          {servicesTableError ?? 'Define EXPLICIT_SERVICES_TABLE con el nombre de tu tabla.'}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  )}

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
                  ) : categoryServices.length === 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Sin ítems</CardTitle>
                        <CardDescription>No hay servicios registrados en esta categoría.</CardDescription>
                      </CardHeader>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {categoryServices.map((svc) => (
                        <Card key={svc.id} className="hover:shadow-md transition-shadow">
                          <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <CardTitle className="text-lg">{svc.name}</CardTitle>
                                {/* Muestra SKU/IVA/Unidad si existen en tu tabla y luego los agregas al select */}
                                {/* {svc.sku && <CardDescription>SKU: {svc.sku}</CardDescription>} */}
                              </div>
                              {typeof (svc as any).iva_rate === 'number' && (
                                <Badge variant="secondary">IVA {(svc as any).iva_rate}%</Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {svc.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{svc.description}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="text-xl font-bold">
                                {typeof svc.price === 'number' ? `$${svc.price.toFixed(2)}` : '—'}
                                {(svc as any).unit ? (
                                  <span className="text-sm text-muted-foreground ml-1">/{(svc as any).unit}</span>
                                ) : null}
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
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Servicios y Artículos</CardTitle>
                  <CardDescription>Lista completa de servicios disponibles con precios configurados</CardDescription>
                </CardHeader>
                <CardContent>
                  <ServicesList
                    key={refreshTrigger}
                    onEdit={handleEditService}
                    onRefresh={() => setRefreshTrigger(prev => prev + 1)}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* FORM */}
          <TabsContent value="form" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{selectedService ? 'Editar Servicio' : 'Nuevo Servicio'}</CardTitle>
                <CardDescription>
                  {selectedService ? 'Modifica los datos del servicio seleccionado' : 'Agrega un nuevo servicio o artículo al catálogo'}
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

          {/* MARGINS */}
          <TabsContent value="margins" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Márgenes</CardTitle>
                <CardDescription>Define los porcentajes de ganancia automáticos por rangos de precio</CardDescription>
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
