import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
// import { ServicesList } from '@/components/sales/ServicesList'; // ← ya no se usa
import { ServiceForm } from '@/components/sales/ServiceForm';
import ProfitMarginConfig from '@/components/sales/ProfitMarginConfig';
import { ProblemsAndSolutionsManager } from '@/components/sales/ProblemsAndSolutionsManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Package, Settings, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PersonalTimeClockPanel } from '@/components/timetracking/PersonalTimeClockPanel';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

const MAIN_CATEGORIES = [
  'Computadoras',
  'Cámaras de Seguridad',
  'Control de Acceso',
  'Fraccionamientos',
  'Cercas Eléctricas',
  'Alarmas',
] as const;

// Emojis fallback si no hay icono en DB
const getCategoryIcon = (categoryName: string): string => {
  const iconMap: Record<string, string> = {
    'computadoras': '💻',
    'cámaras de seguridad': '📹',
    'camaras de seguridad': '📹',
    'control de acceso': '🚪',
    'fraccionamientos': '🏘️',
    'cercas eléctricas': '⚡',
    'cercas electricas': '⚡',
    'alarmas': '🚨',
    'general': '🔧',
    'otros': '📋',
  };
  return iconMap[categoryName.toLowerCase()] || '🔧';
};

// Tablas
const SERVICES_TABLE = 'service_types' as const;

// Campos a leer (incluye item_type para subcategorías)
const SERVICE_SELECT =
  'id, name, description, base_price, unit, vat_rate, category, item_type';

type Service = {
  id: string;
  name: string;
  description?: string | null;
  base_price?: number | null;
  unit?: string | null;
  vat_rate?: number | null;
  category?: string | null;
  item_type?: string | null; // ← subcategoría
};

export default function Sales() {
  const { toast } = useToast();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<'list' | 'form' | 'margins' | 'problems'>('list');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Categoría principal seleccionada (string exacto) y subcategoría
  const [activeMainCategory, setActiveMainCategory] = useState<string | null>(null);
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);

  // Mapa de iconos por nombre (si existen en service_categories)
  const [iconByName, setIconByName] = useState<Record<string, string>>({});

  // Ítems cargados para la categoría principal (o todo si null)
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // Cargar iconos de categorías (opcional)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('name, icon');
      if (!mounted) return;
      if (error) {
        // silencioso; usamos fallback
        return;
      }
      const map: Record<string, string> = {};
      (data ?? []).forEach((c: { name: string; icon: string | null }) => {
        if (c.name && c.icon) map[c.name] = c.icon;
      });
      setIconByName(map);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Cargar servicios por categoría principal
  useEffect(() => {
    let mounted = true;
    (async () => {
      setServicesLoading(true);

      let query = supabase
        .from(SERVICES_TABLE)
        .select(SERVICE_SELECT)
        .order('name', { ascending: true });

      if (activeMainCategory) {
        query = query.eq('category', activeMainCategory);
      }

      const { data, error } = await query;

      if (!mounted) return;
      if (error) {
        toast({
          title: 'Error cargando artículos',
          description: error.message,
          variant: 'destructive',
        });
        setServices([]);
      } else {
        setServices((data ?? []) as Service[]);
      }
      setServicesLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [activeMainCategory, toast, refreshTrigger]);

  // Subcategorías (únicas) derivadas de los servicios cargados
  const subcategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) {
      const val = (s.item_type ?? '').trim();
      if (val) set.add(val);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [services]);

  // Servicios mostrados según subcategoría activa
  const displayedServices = useMemo(() => {
    if (!activeSubCategory) return services;
    return services.filter(
      s => (s.item_type ?? '').trim() === activeSubCategory
    );
  }, [services, activeSubCategory]);

  const handleServiceCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('list');
    toast({
      title: 'Servicio creado',
      description: 'El servicio ha sido agregado exitosamente.',
    });
  };

  const handleServiceUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
    setSelectedService(null);
    setActiveTab('list');
    toast({
      title: 'Servicio actualizado',
      description: 'Los cambios han sido guardados exitosamente.',
    });
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
            onClick={() => {
              setSelectedService(null);
              setActiveTab('form');
            }}
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
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="problems" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Problemas
            </TabsTrigger>
          </TabsList>

          {/* LISTA */}
          <TabsContent value="list" className="space-y-6">
            {/* Botones de categoría principal */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Categorías principales</CardTitle>
                <CardDescription>Elige una categoría y luego una subcategoría</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  <Button
                    type="button"
                    variant={activeMainCategory === null ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setActiveMainCategory(null);
                      setActiveSubCategory(null);
                    }}
                    className="rounded-full"
                    title="Todas las categorías"
                  >
                    ☆ Todas
                  </Button>

                  {MAIN_CATEGORIES.map((name) => (
                    <Button
                      key={name}
                      type="button"
                      variant={activeMainCategory === name ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setActiveMainCategory(name);
                        setActiveSubCategory(null); // reset subcategoría al cambiar principal
                      }}
                      className="rounded-full"
                      title={name}
                    >
                      <span className="mr-1">{iconByName[name] || getCategoryIcon(name)}</span>
                      {name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Botones de subcategoría (solo cuando hay categoría principal seleccionada) */}
            {activeMainCategory && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Subcategorías</CardTitle>
                  <CardDescription>
                    Derivadas de <code>service_types.item_type</code> para “{activeMainCategory}”
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    <Button
                      type="button"
                      variant={activeSubCategory === null ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveSubCategory(null)}
                      className="rounded-full"
                      title="Todas las subcategorías"
                    >
                      Todas
                    </Button>
                    {subcategories.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No hay subcategorías detectadas.</span>
                    ) : (
                      subcategories.map((sc) => (
                        <Button
                          key={sc}
                          type="button"
                          variant={activeSubCategory === sc ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setActiveSubCategory(sc)}
                          className="rounded-full"
                          title={sc}
                        >
                          {sc}
                        </Button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grid de ítems */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeMainCategory
                    ? activeSubCategory
                      ? `Artículos: ${activeMainCategory} • ${activeSubCategory}`
                      : `Artículos de: ${activeMainCategory}`
                    : 'Todos los artículos'}
                </CardTitle>
                <CardDescription>
                  {activeMainCategory
                    ? activeSubCategory
                      ? `Filtrando por categoría y subcategoría`
                      : `Filtrando por categoría principal`
                    : 'Catálogo completo desde public.service_types'}
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
                ) : displayedServices.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sin ítems</CardTitle>
                      <CardDescription>
                        {activeMainCategory
                          ? 'No hay servicios que coincidan con la selección.'
                          : 'No hay artículos registrados.'}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayedServices.map((svc) => (
                      <Card key={svc.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-lg">{svc.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                {typeof svc.vat_rate === 'number' && (
                                  <Badge variant="secondary">IVA {svc.vat_rate}%</Badge>
                                )}
                                {svc.item_type && (
                                  <Badge variant="outline">{svc.item_type}</Badge>
                                )}
                              </div>
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

          {/* FORMULARIO (sin cambios) */}
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

          {/* MÁRGENES */}
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

          {/* PROBLEMAS Y SOLUCIONES */}
          <TabsContent value="problems" className="space-y-6">
            <ProblemsAndSolutionsManager />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
