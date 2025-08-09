import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ServicesList } from '@/components/sales/ServicesList';
import { ServiceForm } from '@/components/sales/ServiceForm';
import ProfitMarginConfig from '@/components/sales/ProfitMarginConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calculator, Package, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

/**
 * Página principal de gestión de ventas y servicios
 * 
 * FUNCIONALIDADES:
 * - Listado de servicios/artículos con precios configurables
 * - Formulario para agregar/editar servicios
 * - Calculadora de precios con IVA y márgenes de ganancia
 * - Sistema de categorías para organización
 * 
 * COMPONENTES REUTILIZABLES:
 * - ServicesList: Lista principal de servicios (src/components/sales/ServicesList)
 * - ServiceForm: Formulario de edición/creación (src/components/sales/ServiceForm)
 * - PriceCalculator: Calculadora de precios (src/components/sales/PriceCalculator)
 * 
 * LÓGICA DE PRECIOS:
 * - Precio base (costo)
 * - Margen de ganancia configurable por niveles de cantidad
 * - IVA configurable por servicio
 * - Cálculo automático del precio final
 */
export default function Sales() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('list');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  /**
   * Maneja la creación exitosa de un servicio
   * Actualiza la lista y muestra confirmación
   */
  const handleServiceCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('list');
    toast({
      title: "Servicio creado",
      description: "El servicio ha sido agregado exitosamente.",
    });
  };

  /**
   * Maneja la actualización exitosa de un servicio
   * Actualiza la lista y muestra confirmación
   */
  const handleServiceUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
    setSelectedService(null);
    setActiveTab('list');
    toast({
      title: "Servicio actualizado",
      description: "Los cambios han sido guardados exitosamente.",
    });
  };

  /**
   * Maneja la selección de un servicio para editar
   */
  const handleEditService = (serviceId: string) => {
    setSelectedService(serviceId);
    setActiveTab('form');
  };

  /**
   * Cancela la edición y vuelve a la lista
   */
  const handleCancelEdit = () => {
    setSelectedService(null);
    setActiveTab('list');
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header de la página */}
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

        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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

          {/* Lista de servicios */}
          <TabsContent value="list" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Servicios y Artículos</CardTitle>
                <CardDescription>
                  Lista completa de servicios disponibles con precios configurados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ServicesList
                  key={refreshTrigger}
                  onEdit={handleEditService}
                  onRefresh={() => setRefreshTrigger(prev => prev + 1)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Formulario de servicio */}
          <TabsContent value="form" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedService ? 'Editar Servicio' : 'Nuevo Servicio'}
                </CardTitle>
                <CardDescription>
                  {selectedService 
                    ? 'Modifica los datos del servicio seleccionado'
                    : 'Agrega un nuevo servicio o artículo al catálogo'
                  }
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

          {/* Configuración de márgenes */}
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