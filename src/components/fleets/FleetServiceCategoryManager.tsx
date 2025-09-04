/**
 * COMPONENTE: FleetServiceCategoryManager
 * 
 * PROPÓSITO:
 * - Gestiona las categorías de servicios asignadas a cada flotilla
 * - Permite configurar qué tipos de servicios maneja cada flotilla
 * - Establece la especialización de flotillas para asignación automática
 * 
 * FUNCIONALIDADES:
 * - Asignar/desasignar categorías de servicios a flotillas
 * - Asignar servicios específicos a flotillas
 * - Establecer prioridades de asignación
 * - Vista de especialización por flotilla
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, 
  Truck, 
  Package, 
  AlertCircle,
  CheckCircle,
  Save,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FleetGroup {
  id: string;
  name: string;
  description?: string;
}

interface MainCategory {
  id: string;
  name: string;
  description?: string;
}

interface ServiceType {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

interface FleetServiceCategory {
  id: string;
  fleet_group_id: string;
  service_category_id?: string;
  service_type_id?: string;
  priority: number;
  is_active: boolean;
}

export function FleetServiceCategoryManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Data states
  const [fleetGroups, setFleetGroups] = useState<FleetGroup[]>([]);
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [fleetServiceCategories, setFleetServiceCategories] = useState<FleetServiceCategory[]>([]);
  
  // UI states
  const [selectedFleet, setSelectedFleet] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadFleetGroups(),
        loadMainCategories(),
        loadServiceTypes(),
        loadFleetServiceCategories()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFleetGroups = async () => {
    const { data, error } = await supabase
      .from('fleet_groups')
      .select('id, name, description')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setFleetGroups(data || []);
  };

  const loadMainCategories = async () => {
    const { data, error } = await supabase
      .from('main_service_categories')
      .select('id, name, description')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setMainCategories(data || []);
  };

  const loadServiceTypes = async () => {
    const { data, error } = await supabase
      .from('service_types')
      .select('id, name, description, category')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setServiceTypes(data || []);
  };

  const loadFleetServiceCategories = async () => {
    const { data, error } = await supabase
      .from('fleet_service_categories')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;
    setFleetServiceCategories(data || []);
  };

  const handleCategoryToggle = async (fleetId: string, categoryId: string, checked: boolean) => {
    try {
      if (checked) {
        // Agregar categoría
        const { error } = await supabase
          .from('fleet_service_categories')
          .insert({
            fleet_group_id: fleetId,
            service_category_id: categoryId,
            priority: 1,
            is_active: true
          });

        if (error) throw error;
        
        toast({
          title: "Categoría asignada",
          description: "La categoría ha sido asignada a la flotilla"
        });
      } else {
        // Remover categoría
        const { error } = await supabase
          .from('fleet_service_categories')
          .delete()
          .eq('fleet_group_id', fleetId)
          .eq('service_category_id', categoryId);

        if (error) throw error;
        
        toast({
          title: "Categoría removida",
          description: "La categoría ha sido removida de la flotilla"
        });
      }

      // Recargar datos
      await loadFleetServiceCategories();
    } catch (error) {
      console.error('Error toggling category:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la categoría",
        variant: "destructive"
      });
    }
  };

  const handleServiceToggle = async (fleetId: string, serviceId: string, checked: boolean) => {
    try {
      if (checked) {
        // Agregar servicio específico
        const { error } = await supabase
          .from('fleet_service_categories')
          .insert({
            fleet_group_id: fleetId,
            service_type_id: serviceId,
            priority: 1,
            is_active: true
          });

        if (error) throw error;
        
        toast({
          title: "Servicio asignado",
          description: "El servicio ha sido asignado a la flotilla"
        });
      } else {
        // Remover servicio específico
        const { error } = await supabase
          .from('fleet_service_categories')
          .delete()
          .eq('fleet_group_id', fleetId)
          .eq('service_type_id', serviceId);

        if (error) throw error;
        
        toast({
          title: "Servicio removido",
          description: "El servicio ha sido removido de la flotilla"
        });
      }

      // Recargar datos
      await loadFleetServiceCategories();
    } catch (error) {
      console.error('Error toggling service:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el servicio",
        variant: "destructive"
      });
    }
  };

  const isCategoryAssigned = (fleetId: string, categoryId: string) => {
    return fleetServiceCategories.some(
      fsc => fsc.fleet_group_id === fleetId && fsc.service_category_id === categoryId
    );
  };

  const isServiceAssigned = (fleetId: string, serviceId: string) => {
    return fleetServiceCategories.some(
      fsc => fsc.fleet_group_id === fleetId && fsc.service_type_id === serviceId
    );
  };

  const getFleetSpecializations = (fleetId: string) => {
    const categories = fleetServiceCategories
      .filter(fsc => fsc.fleet_group_id === fleetId && fsc.service_category_id)
      .map(fsc => mainCategories.find(cat => cat.id === fsc.service_category_id)?.name)
      .filter(Boolean);

    const services = fleetServiceCategories
      .filter(fsc => fsc.fleet_group_id === fleetId && fsc.service_type_id)
      .map(fsc => serviceTypes.find(srv => srv.id === fsc.service_type_id)?.name)
      .filter(Boolean);

    return { categories, services };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Cargando configuración...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Especialización de Flotillas
          </CardTitle>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Configura qué tipos de servicios maneja cada flotilla para una asignación automática más precisa.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleetGroups.map(fleet => {
              const specializations = getFleetSpecializations(fleet.id);
              return (
                <Card key={fleet.id} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{fleet.name}</h3>
                    </div>
                    {fleet.description && (
                      <p className="text-xs text-muted-foreground">{fleet.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {/* Categorías asignadas */}
                      {specializations.categories.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-2">CATEGORÍAS</h4>
                          <div className="flex flex-wrap gap-1">
                            {specializations.categories.map((category, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {category}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Servicios específicos */}
                      {specializations.services.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-2">SERVICIOS</h4>
                          <div className="flex flex-wrap gap-1">
                            {specializations.services.map((service, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {service}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {specializations.categories.length === 0 && specializations.services.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Sin especialización configurada</p>
                      )}

                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setSelectedFleet(fleet.id)}
                        className="w-full"
                      >
                        Configurar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Configuración detallada de flotilla seleccionada */}
      {selectedFleet && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Configurar: {fleetGroups.find(f => f.id === selectedFleet)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="categories">
              <TabsList>
                <TabsTrigger value="categories">Por Categorías</TabsTrigger>
                <TabsTrigger value="services">Servicios Específicos</TabsTrigger>
              </TabsList>

              <TabsContent value="categories" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mainCategories.map(category => (
                    <Card key={category.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isCategoryAssigned(selectedFleet, category.id)}
                          onCheckedChange={(checked) => 
                            handleCategoryToggle(selectedFleet, category.id, checked as boolean)
                          }
                        />
                        <div className="flex-1">
                          <h3 className="font-medium">{category.name}</h3>
                          {category.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {category.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="services" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {serviceTypes.map(service => (
                    <Card key={service.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isServiceAssigned(selectedFleet, service.id)}
                          onCheckedChange={(checked) => 
                            handleServiceToggle(selectedFleet, service.id, checked as boolean)
                          }
                        />
                        <div className="flex-1">
                          <h3 className="font-medium">{service.name}</h3>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setSelectedFleet('')}>
                Cerrar
              </Button>
              <Button onClick={loadData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}