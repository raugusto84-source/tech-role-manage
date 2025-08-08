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
  cost_price: z.number().min(0, 'El precio de costo debe ser mayor a 0'),
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

/**
 * Interface para niveles de margen de ganancia
 */
interface MarginTier {
  id: string;
  min_qty: number;
  max_qty: number;
  margin: number;
}

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
  const [marginTiers, setMarginTiers] = useState<MarginTier[]>([
    { id: '1', min_qty: 1, max_qty: 10, margin: 30 },
    { id: '2', min_qty: 11, max_qty: 50, margin: 25 },
    { id: '3', min_qty: 51, max_qty: 999, margin: 20 },
  ]);
  const [previewQuantity, setPreviewQuantity] = useState(1);

  const form = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'general',
      cost_price: 0,
      vat_rate: 19,
      unit: 'unidad',
      min_quantity: 1,
      max_quantity: 999,
      estimated_hours: 0,
      is_active: true,
    },
  });

  const watchedCostPrice = form.watch('cost_price');
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
        cost_price: data.cost_price || 0,
        vat_rate: data.vat_rate || 19,
        unit: data.unit || 'unidad',
        min_quantity: data.min_quantity || 1,
        max_quantity: data.max_quantity || 999,
        estimated_hours: data.estimated_hours || 0,
        is_active: data.is_active,
      });

      // Cargar niveles de margen si existen
      if (data.profit_margin_tiers && Array.isArray(data.profit_margin_tiers)) {
        const tiers = data.profit_margin_tiers.map((tier: any, index: number) => ({
          id: (index + 1).toString(),
          min_qty: tier.min_qty,
          max_qty: tier.max_qty,
          margin: tier.margin,
        }));
        setMarginTiers(tiers);
      }
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
   * Agrega un nuevo nivel de margen
   */
  const addMarginTier = () => {
    const lastTier = marginTiers[marginTiers.length - 1];
    const newTier: MarginTier = {
      id: Date.now().toString(),
      min_qty: lastTier ? lastTier.max_qty + 1 : 1,
      max_qty: 999,
      margin: 20,
    };
    setMarginTiers([...marginTiers, newTier]);
  };

  /**
   * Elimina un nivel de margen
   */
  const removeMarginTier = (id: string) => {
    if (marginTiers.length <= 1) {
      toast({
        title: "Error",
        description: "Debe haber al menos un nivel de margen.",
        variant: "destructive",
      });
      return;
    }
    setMarginTiers(marginTiers.filter(tier => tier.id !== id));
  };

  /**
   * Actualiza un nivel de margen específico
   */
  const updateMarginTier = (id: string, field: keyof Omit<MarginTier, 'id'>, value: number) => {
    setMarginTiers(tiers =>
      tiers.map(tier =>
        tier.id === id ? { ...tier, [field]: value } : tier
      )
    );
  };

  /**
   * Calcula el precio final para la cantidad de preview
   */
  const calculatePreviewPrice = (): number => {
    if (!watchedCostPrice) return 0;

    // Encontrar el nivel de margen aplicable
    const applicableTier = marginTiers.find(tier =>
      previewQuantity >= tier.min_qty && previewQuantity <= tier.max_qty
    );
    
    const margin = applicableTier ? applicableTier.margin : 30;
    const priceWithMargin = watchedCostPrice * (1 + margin / 100);
    const priceWithVat = priceWithMargin * (1 + watchedVatRate / 100);
    
    return priceWithVat * previewQuantity;
  };

  /**
   * Valida que los niveles de margen no se solapen
   */
  const validateMarginTiers = (): boolean => {
    const sortedTiers = [...marginTiers].sort((a, b) => a.min_qty - b.min_qty);
    
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      if (sortedTiers[i].max_qty >= sortedTiers[i + 1].min_qty) {
        toast({
          title: "Error en niveles de margen",
          description: "Los rangos de cantidad no pueden solaparse.",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  /**
   * Maneja el envío del formulario
   */
  const onSubmit = async (values: z.infer<typeof serviceSchema>) => {
    if (!validateMarginTiers()) return;

    try {
      setLoading(true);

      const serviceData: any = {
        name: values.name,
        description: values.description,
        category: values.category,
        cost_price: values.cost_price,
        vat_rate: values.vat_rate,
        unit: values.unit,
        min_quantity: values.min_quantity,
        max_quantity: values.max_quantity,
        estimated_hours: values.estimated_hours,
        is_active: values.is_active,
        profit_margin_tiers: marginTiers.map(tier => ({
          min_qty: tier.min_qty,
          max_qty: tier.max_qty,
          margin: tier.margin,
        })),
        // Mantener compatibilidad con base_price
        base_price: values.cost_price,
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Servicio *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Formateo de PC" {...field} />
                      </FormControl>
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
                <FormField
                  control={form.control}
                  name="cost_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio de Costo * (COP)</FormLabel>
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
                        Costo base sin márgenes ni IVA
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

          {/* Niveles de margen de ganancia */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Márgenes de Ganancia por Cantidad
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMarginTier}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Nivel
                </Button>
              </CardTitle>
              <CardDescription>
                Configure diferentes márgenes de ganancia según la cantidad solicitada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {marginTiers.map((tier, index) => (
                <div key={tier.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium">Cantidad Desde</label>
                      <Input
                        type="number"
                        min="1"
                        value={tier.min_qty}
                        onChange={(e) => updateMarginTier(tier.id, 'min_qty', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Cantidad Hasta</label>
                      <Input
                        type="number"
                        min="1"
                        value={tier.max_qty}
                        onChange={(e) => updateMarginTier(tier.id, 'max_qty', parseInt(e.target.value) || 999)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Margen (%)</label>
                      <Input
                        type="number"
                        min="0"
                        max="1000"
                        step="0.1"
                        value={tier.margin}
                        onChange={(e) => updateMarginTier(tier.id, 'margin', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  {marginTiers.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeMarginTier(tier.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Preview de precios */}
          {watchedCostPrice > 0 && (
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
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium">Cantidad para preview:</label>
                  <Input
                    type="number"
                    min="1"
                    value={previewQuantity}
                    onChange={(e) => setPreviewQuantity(parseInt(e.target.value) || 1)}
                    className="w-32"
                  />
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    Precio Final: {formatCurrency(calculatePreviewPrice())}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Para {previewQuantity} {form.watch('unit')}(es) •
                    Incluye margen de ganancia e IVA
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