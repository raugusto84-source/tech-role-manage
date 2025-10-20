import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
// import { ServicesList } from '@/components/sales/ServicesList'; // ← ya no se usa
import { ServiceForm } from '@/components/sales/ServiceForm';
import ProfitMarginConfig from '@/components/sales/ProfitMarginConfig';
import { UnifiedDiagnosticManager } from '@/components/sales/UnifiedDiagnosticManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Package, Settings, Workflow, Wrench, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
// Removed useRewardSettings import - cashback system eliminated
import { ceilToTen } from '@/utils/currency';
import { PersonalTimeClockPanel } from '@/components/timetracking/PersonalTimeClockPanel';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Folder } from 'lucide-react';
import { MainCategoriesManager } from '@/components/admin/MainCategoriesManager';
import { SubcategoriesManager } from '@/components/admin/SubcategoriesManager';
import { QuickPriceCalculator } from '@/components/sales/QuickPriceCalculator';
const MAIN_CATEGORIES = ['Computadoras', 'Cámaras de Seguridad', 'Control de Acceso', 'Fraccionamientos', 'Cercas Eléctricas', 'Servicio Técnico'] as const;

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
    'otros': '📋'
  };
  return iconMap[categoryName.toLowerCase()] || '🔧';
};

// Tablas
const SERVICES_TABLE = 'service_types' as const;

// Campos a leer (incluye subcategory e item_type para compatibilidad)
const SERVICE_SELECT = 'id, name, description, base_price, cost_price, profit_margin_tiers, unit, vat_rate, category, item_type, subcategory, service_category';
type Service = {
  id: string;
  name: string;
  description?: string | null;
  base_price?: number | null;
  cost_price?: number | null;
  profit_margin_tiers?: any;
  unit?: string | null;
  vat_rate?: number | null;
  category?: string | null;
  item_type?: string | null; // tipo ('servicio' | 'articulo') o legado
  subcategory?: string | null; // nueva subcategoría
  service_category?: string | null; // nueva categorización Sistemas/Seguridad
};

// Funciones auxiliares para calcular precios
const isProduct = (service: Service) => {
  const hasTiers = Array.isArray(service.profit_margin_tiers) && service.profit_margin_tiers.length > 0;
  return hasTiers || service.item_type === 'articulo';
};
const marginFromTiers = (service: Service): number => service.profit_margin_tiers?.[0]?.margin ?? 30;
const formatCurrency = (amount: number): string => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
}).format(ceilToTen(amount));
// Normaliza la categoría seleccionada a los posibles valores del campo service_types.category
const categoryFilterValues = (name: string): string[] => {
  const n = name.toLowerCase();
  if (n.includes('servicio')) return ['Servicio Técnico', 'general', 'mantenimiento'];
  if (n.includes('cámara') || n.includes('camaras') || n.includes('cámaras')) return ['Cámaras de Seguridad', 'Camaras de Seguridad'];
  if (n.includes('computadora')) return ['Computadoras', 'Computadora'];
  if (n.includes('cerca')) return ['Cercas Eléctricas', 'Cercas Electricas'];
  if (n.includes('control de acceso')) return ['Control de Acceso'];
  if (n.includes('fraccion')) return ['Fraccionamientos'];
  if (n.includes('alarma')) return ['Alarmas'];
  return [name];
};
export default function Sales() {
  const {
    toast
  } = useToast();
  const {
    profile
  } = useAuth();
  // Removed useRewardSettings - cashback system eliminated

  // Function to calculate display price with proper rounding
  const getDisplayPrice = (service: Service): number => {
    const salesVatRate = service.vat_rate || 16; // IVA de venta (configurable, por defecto 16%)
    // Removed cashback calculation - cashback system eliminated

    if (!isProduct(service)) {
      // Para servicios: precio base + IVA
      const basePrice = service.base_price || 0;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      return ceilToTen(afterSalesVat);
    } else {
      // Para artículos: costo base + IVA compra + margen + IVA venta
      const purchaseVatRate = 16; // IVA de compra fijo 16%
      const baseCost = service.cost_price || 0;
      const profitMargin = marginFromTiers(service); // Usar margen real del producto
      
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      return ceilToTen(afterSalesVat);
    }
  };
  const [activeTab, setActiveTab] = useState<'list' | 'form' | 'margins' | 'diagnostics' | 'categories' | 'subcategories'>('list');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Categoría principal seleccionada (string exacto) y subcategoría
  const [activeMainCategory, setActiveMainCategory] = useState<string | null>(null);
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);

  // Mapa de iconos por nombre (si existen en service_categories)
  const [iconByName, setIconByName] = useState<Record<string, string>>({});
  const [mainCategories, setMainCategories] = useState<string[]>([]);

  // Ítems cargados para la categoría principal (o todo si null)
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // Cargar categorías principales e iconos desde main_service_categories
  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data,
        error
      } = await supabase.from('main_service_categories').select('name, icon, is_active').order('name', {
        ascending: true
      });
      if (!mounted) return;
      if (error) {
        // silencioso; usamos fallback
        return;
      }
      const names: string[] = [];
      const map: Record<string, string> = {};
      (data ?? []).forEach((c: {
        name: string;
        icon: string | null;
        is_active: boolean;
      }) => {
        if (!c?.name) return;
        if (c.is_active) names.push(c.name);
        if (c.icon) map[c.name] = c.icon;
      });
      setMainCategories(names);
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
      let query = supabase.from(SERVICES_TABLE).select(SERVICE_SELECT).order('name', {
        ascending: true
      });
      if (activeMainCategory) {
        const vals = categoryFilterValues(activeMainCategory);
        if (vals.length === 1) {
          query = query.eq('category', vals[0]);
        } else {
          query = query.in('category', vals);
        }
      }
      const {
        data,
        error
      } = await query;
      if (!mounted) return;
      if (error) {
        toast({
          title: 'Error cargando artículos',
          description: error.message,
          variant: 'destructive'
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
      const val = (s.subcategory ?? s.item_type ?? '').trim();
      if (val) set.add(val);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [services]);

  // Servicios mostrados según subcategoría activa
  const displayedServices = useMemo(() => {
    if (!activeSubCategory) return services;
    return services.filter(s => (s.subcategory ?? s.item_type ?? '').trim() === activeSubCategory);
  }, [services, activeSubCategory]);
  const handleServiceCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('list');
    toast({
      title: 'Servicio creado',
      description: 'El servicio ha sido agregado exitosamente.'
    });
  };
  const handleServiceUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
    setSelectedService(null);
    setActiveTab('list');
    toast({
      title: 'Servicio actualizado',
      description: 'Los cambios han sido guardados exitosamente.'
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
  const handleDeleteService = async (serviceId: string, serviceName: string) => {
    try {
      const {
        error
      } = await supabase.from('service_types').delete().eq('id', serviceId);
      if (error) {
        console.error('Error deleting service:', error);
        toast({
          title: "Error",
          description: "No se pudo eliminar el servicio.",
          variant: "destructive"
        });
        return;
      }
      toast({
        title: "Servicio eliminado",
        description: `${serviceName} ha sido eliminado exitosamente.`
      });
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({
        title: "Error",
        description: "Error inesperado al eliminar el servicio.",
        variant: "destructive"
      });
    }
  };
  return <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestión de Ventas y Servicios</h1>
            <p className="text-muted-foreground mt-2">
              Administra servicios, artículos y configuración de precios con IVA y márgenes de ganancia
            </p>
          </div>
          <Button onClick={() => {
          setSelectedService(null);
          setActiveTab('form');
        }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Servicio
          </Button>
        </div>

        {/* Control de Tiempo Personal - Solo para vendedores */}
        {profile?.role === 'vendedor' && <PersonalTimeClockPanel />}

        {/* Quick Price Calculator */}
        <QuickPriceCalculator />

        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Servicios
            </TabsTrigger>
            <TabsTrigger value="form" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {selectedService ? 'Editar' : 'Nuevo'}
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Categorías
            </TabsTrigger>
            <TabsTrigger value="subcategories" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Subcategorías
            </TabsTrigger>
            <TabsTrigger value="margins" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Márgenes
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="flex items-center gap-2">
              <Workflow className="h-4 w-4" />
              Problemas y Diagnósticos
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
                  <Button type="button" variant={activeMainCategory === null ? 'default' : 'outline'} size="sm" onClick={() => {
                  setActiveMainCategory(null);
                  setActiveSubCategory(null);
                }} className="rounded-full" title="Todas las categorías">
                    ☆ Todas
                  </Button>

                  {mainCategories.map(name => <Button key={name} type="button" variant={activeMainCategory === name ? 'default' : 'outline'} size="sm" onClick={() => {
                  setActiveMainCategory(name);
                  setActiveSubCategory(null); // reset subcategoría al cambiar principal
                }} className="rounded-full" title={name}>
                      
                      {name}
                    </Button>)}
                </div>
              </CardContent>
            </Card>

            {/* Botones de subcategoría (solo cuando hay categoría principal seleccionada) */}
            {activeMainCategory && <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Subcategorías</CardTitle>
                  <CardDescription>
                    Derivadas de <code>service_types.item_type</code> para "{activeMainCategory}"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    <Button type="button" variant={activeSubCategory === null ? 'default' : 'outline'} size="sm" onClick={() => setActiveSubCategory(null)} className="rounded-full" title="Todas las subcategorías">
                      Todas
                    </Button>
                    {subcategories.length === 0 ? <span className="text-sm text-muted-foreground">No hay subcategorías detectadas.</span> : subcategories.map(sc => <Button key={sc} type="button" variant={activeSubCategory === sc ? 'default' : 'outline'} size="sm" onClick={() => setActiveSubCategory(sc)} className="rounded-full" title={sc}>
                          {sc}
                        </Button>)}
                  </div>
                </CardContent>
              </Card>}

            {/* Grid de ítems */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeMainCategory ? activeSubCategory ? `Artículos: ${activeMainCategory} • ${activeSubCategory}` : `Artículos de: ${activeMainCategory}` : 'Todos los artículos'}
                </CardTitle>
                <CardDescription>
                  {activeMainCategory ? activeSubCategory ? `Filtrando por categoría y subcategoría` : `Filtrando por categoría principal` : 'Catálogo completo desde public.service_types'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {servicesLoading ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Cargando...</CardTitle>
                        <CardDescription>
                          Espera un momento, estamos cargando los articulos.
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </div>
                ) : displayedServices.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sin ítems</CardTitle>
                      <CardDescription>
                        {activeMainCategory ? 'No hay servicios que coincidan con la selección.' : 'No hay artículos registrados.'}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {/* Servicios - Sistemas */}
                    <Card className="border-2 border-blue-200 dark:border-blue-800">
                      <CardHeader className="bg-blue-50 dark:bg-blue-950/20">
                        <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                          <Wrench className="h-5 w-5" />
                          💻 SERVICIOS - SISTEMAS
                          <Badge variant="secondary" className="ml-auto">
                            {displayedServices.filter(svc => !isProduct(svc) && svc.service_category === 'sistemas').length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {displayedServices.filter(svc => !isProduct(svc) && svc.service_category === 'sistemas').length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">No hay servicios de sistemas registrados</p>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {displayedServices.filter(svc => !isProduct(svc) && svc.service_category === 'sistemas').map(svc => (
                              <Card key={svc.id} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                                <CardHeader>
                                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    {getCategoryIcon(svc.category ?? 'general')} {svc.name}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="py-2 text-sm text-muted-foreground">
                                  {svc.description ? <p className="line-clamp-2">{svc.description}</p> : <p>Sin descripción</p>}
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="font-bold">{formatCurrency(getDisplayPrice(svc))}</span>
                                    <Button size="sm" variant="outline" onClick={() => handleEditService(svc.id)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Servicios - Seguridad */}
                    <Card className="border-2 border-red-200 dark:border-red-800">
                      <CardHeader className="bg-red-50 dark:bg-red-950/20">
                        <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                          <Wrench className="h-5 w-5" />
                          🛡️ SERVICIOS - SEGURIDAD
                          <Badge variant="secondary" className="ml-auto">
                            {displayedServices.filter(svc => !isProduct(svc) && svc.service_category === 'seguridad').length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {displayedServices.filter(svc => !isProduct(svc) && svc.service_category === 'seguridad').length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">No hay servicios de seguridad registrados</p>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {displayedServices.filter(svc => !isProduct(svc) && svc.service_category === 'seguridad').map(svc => (
                              <Card key={svc.id} className="hover:shadow-md transition-shadow border-l-4 border-l-red-500">
                                <CardHeader>
                                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    {getCategoryIcon(svc.category ?? 'general')} {svc.name}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="py-2 text-sm text-muted-foreground">
                                  {svc.description ? <p className="line-clamp-2">{svc.description}</p> : <p>Sin descripción</p>}
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="font-bold">{formatCurrency(getDisplayPrice(svc))}</span>
                                    <Button size="sm" variant="outline" onClick={() => handleEditService(svc.id)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Productos - Sistemas */}
                    <Card className="border-2 border-blue-200 dark:border-blue-800">
                      <CardHeader className="bg-blue-50 dark:bg-blue-950/20">
                        <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          💻 PRODUCTOS - SISTEMAS
                          <Badge variant="secondary" className="ml-auto">
                            {displayedServices.filter(svc => isProduct(svc) && svc.service_category === 'sistemas').length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {displayedServices.filter(svc => isProduct(svc) && svc.service_category === 'sistemas').length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">No hay productos de sistemas registrados</p>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {displayedServices.filter(svc => isProduct(svc) && svc.service_category === 'sistemas').map(svc => (
                              <Card key={svc.id} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                                <CardHeader>
                                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    {getCategoryIcon(svc.category ?? 'general')} {svc.name}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="py-2 text-sm text-muted-foreground">
                                  {svc.description ? <p className="line-clamp-2">{svc.description}</p> : <p>Sin descripción</p>}
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="font-bold">{formatCurrency(getDisplayPrice(svc))}</span>
                                    <Button size="sm" variant="outline" onClick={() => handleEditService(svc.id)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Productos - Seguridad */}
                    <Card className="border-2 border-red-200 dark:border-red-800">
                      <CardHeader className="bg-red-50 dark:bg-red-950/20">
                        <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          🛡️ PRODUCTOS - SEGURIDAD
                          <Badge variant="secondary" className="ml-auto">
                            {displayedServices.filter(svc => isProduct(svc) && svc.service_category === 'seguridad').length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {displayedServices.filter(svc => isProduct(svc) && svc.service_category === 'seguridad').length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">No hay productos de seguridad registrados</p>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {displayedServices.filter(svc => isProduct(svc) && svc.service_category === 'seguridad').map(svc => (
                              <Card key={svc.id} className="hover:shadow-md transition-shadow border-l-4 border-l-red-500">
                                <CardHeader>
                                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    {getCategoryIcon(svc.category ?? 'general')} {svc.name}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="py-2 text-sm text-muted-foreground">
                                  {svc.description ? <p className="line-clamp-2">{svc.description}</p> : <p>Sin descripción</p>}
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="font-bold">{formatCurrency(getDisplayPrice(svc))}</span>
                                    <Button size="sm" variant="outline" onClick={() => handleEditService(svc.id)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
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
                  {selectedService ? 'Modifica los datos del servicio seleccionado' : 'Agrega un nuevo servicio o artículo al catálogo'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ServiceForm serviceId={selectedService} onSuccess={selectedService ? handleServiceUpdated : handleServiceCreated} onCancel={handleCancelEdit} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* CATEGORÍAS */}
          <TabsContent value="categories" className="space-y-6">
            <MainCategoriesManager />
          </TabsContent>

          {/* SUBCATEGORÍAS */}
          <TabsContent value="subcategories" className="space-y-6">
            <SubcategoriesManager />
          </TabsContent>

          {/* MÁRGENES */}
          <TabsContent value="margins" className="space-y-6">
            <ProfitMarginConfig />
          </TabsContent>

          {/* PROBLEMAS Y DIAGNÓSTICOS UNIFICADO */}
          <TabsContent value="diagnostics" className="space-y-6">
            <UnifiedDiagnosticManager />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>;
}

