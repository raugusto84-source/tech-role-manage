import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Schema de validación para servicios
 * Define reglas de negocio y validaciones
 */
const serviceSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  category: z.string().min(1, 'Selecciona una categoría'),
  item_type: z.enum(['servicio', 'articulo'], { required_error: 'Selecciona el tipo' }),
  cost_price: z.number().min(0, 'El precio de costo debe ser mayor a 0'),
  base_price: z.number().min(0, 'El precio fijo debe ser mayor a 0'),
  profit_margin: z.number().min(0).max(100, 'El margen debe estar entre 0 y 100%'),
  vat_rate: z.number().min(0).max(100, 'El IVA debe estar entre 0 y 100%'),
  unit: z.string().min(1, 'Especifica la unidad de medida'),
  min_quantity: z.number().min(1, 'La cantidad mínima debe ser mayor a 0'),
  max_quantity: z.number().min(1, 'La cantidad máxima debe ser mayor a 0'),
  estimated_hours: z.number().min(0, 'Las horas estimadas deben ser 0 o más'),
  is_active: z.boolean(),
}).refine(data => data.max_quantity >= data.min_quantity, {
  message: 'La cantidad máxima debe ser mayor o igual a la mínima',
  path: ['max_quantity'],
});


interface ServiceFormProps {
  serviceId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Formulario para crear/editar servicios
 * 
 * FUNCIONALIDADES:
 * - Validación completa de datos con Zod
 * - Configuración de márgenes por niveles de cantidad
 * - Preview de precios en tiempo real
 * - Gestión de categorías dinámicas
 * - Autoguardado de borradores (localStorage)
 * 
 * COMPONENTE REUTILIZABLE:
 * Este formulario puede ser reutilizado para:
 * - Modal de creación rápida en cotizaciones
 * - Importación masiva de servicios
 * - Duplicación de servicios existentes
 */
export function ServiceForm({ serviceId, onSuccess, onCancel }: ServiceFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'general',
      item_type: 'servicio',
      cost_price: 0,
      base_price: 0,
      profit_margin: 30,
      vat_rate: 19,
      unit: 'unidad',
      min_quantity: 1,
      max_quantity: 999,
      estimated_hours: 0,
      is_active: true,
    },
  });

  const watchedItemType = form.watch('item_type');
  const watchedCostPrice = form.watch('cost_price');
  const watchedBasePrice = form.watch('base_price');
  const watchedProfitMargin = form.watch('profit_margin');
  const watchedVatRate = form.watch('vat_rate');

  /**
   * Carga datos del servicio para edición
   */
  const loadServiceData = async () => {
    if (!serviceId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('id', serviceId)
        .single();

      if (error) {
        console.error('Error loading service:', error);
        toast({
          title: "Error",
          description: "No se pudo cargar el servicio.",
          variant: "destructive",
        });
        return;
      }

      // Poblar formulario con datos existentes
      form.reset({
        name: data.name,
        description: data.description,
        category: data.category || 'general',
        item_type: (data.item_type === 'articulo' ? 'articulo' : 'servicio') as 'servicio' | 'articulo',
        cost_price: data.cost_price || 0,
        base_price: data.base_price || 0,
        profit_margin: (data as any).profit_margin || 30,
        vat_rate: data.vat_rate || 19,
        unit: data.unit || 'unidad',
        min_quantity: data.min_quantity || 1,
        max_quantity: data.max_quantity || 999,
        estimated_hours: data.estimated_hours || 0,
        is_active: data.is_active,
      });

    } catch (error) {
      console.error('Error loading service:', error);
      toast({
        title: "Error",
        description: "Error inesperado al cargar el servicio.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calcula el precio final
   */
  const calculatePreviewPrice = (): number => {
    if (watchedItemType === 'servicio') {
      // Para servicios: precio base + IVA
      return watchedBasePrice * (1 + watchedVatRate / 100);
    } else {
      // Para artículos: precio base + margen + IVA
      const priceWithMargin = watchedBasePrice * (1 + watchedProfitMargin / 100);
      return priceWithMargin * (1 + watchedVatRate / 100);
    }
  };

  /**
   * Maneja el envío del formulario
   */
  const onSubmit = async (values: z.infer<typeof serviceSchema>) => {

    try {
      setLoading(true);

      const serviceData: any = {
        name: values.name,
        description: values.description,
        category: values.category,
        item_type: values.item_type,
        cost_price: values.cost_price,
        base_price: values.base_price,
        profit_margin: values.profit_margin,
        vat_rate: values.vat_rate,
        unit: values.unit,
        min_quantity: values.min_quantity,
        max_quantity: values.max_quantity,
        estimated_hours: values.estimated_hours,
        is_active: values.is_active,
      };

      if (serviceId) {
        // Actualizar servicio existente
        const { error } = await supabase
          .from('service_types')
          .update(serviceData)
          .eq('id', serviceId);

        if (error) {
          console.error('Error updating service:', error);
          toast({
            title: "Error",
            description: "No se pudo actualizar el servicio.",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Crear nuevo servicio
        const { error } = await supabase
          .from('service_types')
          .insert(serviceData);

        if (error) {
          console.error('Error creating service:', error);
          toast({
            title: "Error",
            description: "No se pudo crear el servicio.",
            variant: "destructive",
          });
          return;
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving service:', error);
      toast({
        title: "Error",
        description: "Error inesperado al guardar el servicio.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Formatea números como moneda
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
    if (serviceId) {
      loadServiceData();
    }
  }, [serviceId]);

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Información básica */}
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
              <CardDescription>
                Datos principales del servicio o artículo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Formateo de PC" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="item_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="servicio">🔧 Servicio</SelectItem>
                          <SelectItem value="articulo">📦 Artículo/Producto</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {watchedItemType === 'servicio' 
                          ? 'Precio fijo establecido manualmente'
                          : 'Costo base + margen de ganancia'
                        }
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="hardware">Hardware</SelectItem>
                          <SelectItem value="software">Software</SelectItem>
                          <SelectItem value="redes">Redes</SelectItem>
                          <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                          <SelectItem value="consultoria">Consultoría</SelectItem>
                          <SelectItem value="productos">Productos</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe detalladamente el servicio o artículo..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad de Medida *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unidad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unidad">Unidad</SelectItem>
                          <SelectItem value="hora">Hora</SelectItem>
                          <SelectItem value="dia">Día</SelectItem>
                          <SelectItem value="metro">Metro</SelectItem>
                          <SelectItem value="servicio">Servicio</SelectItem>
                          <SelectItem value="licencia">Licencia</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimated_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horas Estimadas</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Tiempo estimado para completar el servicio
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Activo</FormLabel>
                        <FormDescription>
                          Disponible para cotizaciones
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Configuración de precios */}
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Precios</CardTitle>
              <CardDescription>
                Define costos, IVA y cantidades permitidas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {watchedItemType === 'servicio' ? (
                  <FormField
                    control={form.control}
                    name="base_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio de Venta Fijo * (COP)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Precio establecido manualmente (sin costo base)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="base_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Precio Base * (COP)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="100"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            Precio base del artículo (sin margen ni IVA)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="profit_margin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Margen de Ganancia (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="1000"
                              step="0.1"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            % de ganancia sobre el precio base
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="vat_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IVA (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Porcentaje de IVA aplicable
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Cantidad Mínima y Máxima</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="min_quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Min"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="max_quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Max"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 999)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormDescription>
                    Rangos de cantidad permitidos
                  </FormDescription>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Preview de precios */}
          {(watchedBasePrice > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Preview de Precios
                </CardTitle>
                <CardDescription>
                  Visualiza cómo se calculan los precios finales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Precio Base:</span>
                      <span>{formatCurrency(watchedBasePrice)}</span>
                    </div>
                    {watchedItemType === 'articulo' && (
                      <div className="flex justify-between text-green-600">
                        <span>+ Margen ({watchedProfitMargin}%):</span>
                        <span>{formatCurrency(watchedBasePrice * watchedProfitMargin / 100)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-blue-600">
                      <span>+ IVA ({watchedVatRate}%):</span>
                      <span>{formatCurrency((watchedItemType === 'articulo' ? watchedBasePrice * (1 + watchedProfitMargin / 100) : watchedBasePrice) * watchedVatRate / 100)}</span>
                    </div>
                    <hr />
                    <div className="flex justify-between text-lg font-bold text-green-600">
                      <span>Precio Final:</span>
                      <span>{formatCurrency(calculatePreviewPrice())}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : serviceId ? 'Actualizar Servicio' : 'Crear Servicio'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}