import { useState, useEffect, useMemo } from 'react';
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
import { Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WarrantyConfigForm } from '@/components/warranty/WarrantyConfigForm';

/** ============================
 *  CATEGORÍAS / SUBCATEGORÍAS
 *  ============================ */
const MAIN_CATEGORIES = [
  'Computadoras',
  'Cámaras de Seguridad',
  'Control de Acceso',
  'Fraccionamientos',
  'Cercas Eléctricas',
  'Alarmas',
] as const;
type MainCategory = typeof MAIN_CATEGORIES[number];

const SUBCATEGORY_MAP: Record<MainCategory, string[]> = {
  'Computadoras': ['Programas', 'Antivirus', 'Mtto Fisico', 'Formateo con Respaldo', 'Formateo sin Respaldo'],
  'Cámaras de Seguridad': ['Kit 4 Camaras', 'Mtto General'],
  'Control de Acceso': [],
  'Fraccionamientos': [],
  'Cercas Eléctricas': [],
  'Alarmas': [],
};

/** ============================
 *  SCHEMA DE VALIDACIÓN
 *  ============================ */
// NOTA: usamos `kind` para el modo de precio (servicio|articulo) y
// guardamos en DB: category = principal, item_type = subcategoría.
const serviceSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  main_category: z.string().min(1, 'Selecciona una categoría'),
  subcategory: z.string().min(1, 'Selecciona o escribe una subcategoría'),
  kind: z.enum(['servicio', 'articulo'], { required_error: 'Selecciona el tipo' }), // ← reemplaza al antiguo item_type
  cost_price: z.number().min(0, 'El precio de costo debe ser mayor a 0'),
  base_price: z.number().min(0, 'El precio fijo debe ser mayor a 0'),
  profit_margin: z.number().min(0).max(1000, 'El margen debe estar entre 0 y 1000%'),
  vat_rate: z.number().min(0).max(100, 'El IVA debe estar entre 0 y 100%'),
  unit: z.string().min(1, 'Especifica la unidad de medida'),
  min_quantity: z.number().min(1, 'La cantidad mínima debe ser mayor a 0'),
  max_quantity: z.number().min(1, 'La cantidad máxima debe ser mayor a 0'),
  estimated_hours: z.number().min(0, 'Las horas estimadas deben ser 0 o más'),
  shared_time: z.boolean().default(false),
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

export function ServiceForm({ serviceId, onSuccess, onCancel }: ServiceFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [marginConfigs, setMarginConfigs] = useState<any[]>([]);
  const [autoMargin, setAutoMargin] = useState<number | null>(null);

  const form = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      main_category: 'Computadoras',
      subcategory: '',
      kind: 'servicio',
      cost_price: 0,
      base_price: 0,
      profit_margin: 30,
      vat_rate: 19,
      unit: 'unidad',
      min_quantity: 1,
      max_quantity: 999,
      estimated_hours: 0,
      shared_time: false,
      is_active: true,
    },
  });

  const watchedKind = form.watch('kind');
  const watchedCostPrice = form.watch('cost_price');
  const watchedBasePrice = form.watch('base_price');
  const watchedProfitMargin = form.watch('profit_margin');
  const watchedVatRate = form.watch('vat_rate');
  const watchedMainCategory = form.watch('main_category');

  /** Si la categoría principal cambia, proponemos la primera subcategoría disponible */
  useEffect(() => {
    const subs = SUBCATEGORY_MAP[watchedMainCategory as MainCategory] || [];
    const current = form.getValues('subcategory');
    if (subs.length > 0 && !subs.includes(current)) {
      form.setValue('subcategory', subs[0]);
    }
    if (subs.length === 0 && current === '') {
      // sin catálogo predefinido, dejar editable
      form.setValue('subcategory', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedMainCategory]);

  /** Carga datos para edición */
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
        toast({ title: "Error", description: "No se pudo cargar el servicio.", variant: "destructive" });
        return;
      }

      const hasTiers = Array.isArray(data.profit_margin_tiers) && (data.profit_margin_tiers as any[]).length > 0;

      form.reset({
        name: data.name,
        description: data.description || '',
        main_category: (data.category as string) || 'Computadoras',
        subcategory: (data.item_type as string) || '',
        kind: hasTiers ? 'articulo' : 'servicio',
        cost_price: data.cost_price || 0,
        base_price: data.base_price || 0,
        profit_margin: hasTiers ? (data.profit_margin_tiers as any[])[0]?.margin ?? 30 : 30,
        vat_rate: data.vat_rate || 19,
        unit: data.unit || 'unidad',
        min_quantity: data.min_quantity || 1,
        max_quantity: data.max_quantity || 999,
        estimated_hours: data.estimated_hours || 0,
        shared_time: (data as any).shared_time || false,
        is_active: data.is_active,
      });
    } catch (error) {
      console.error('Error loading service:', error);
      toast({ title: "Error", description: "Error inesperado al cargar el servicio.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /** Preview de precio */
  const calculatePreviewPrice = (): number => {
    if (watchedKind === 'servicio') {
      return watchedBasePrice * (1 + watchedVatRate / 100);
    } else {
      const priceWithMargin = watchedBasePrice * (1 + watchedProfitMargin / 100);
      return priceWithMargin * (1 + watchedVatRate / 100);
    }
  };

  /** Guardar */
  const onSubmit = async (values: z.infer<typeof serviceSchema>) => {
    try {
      setLoading(true);

      const serviceData: any = {
        name: values.name,
        description: values.description,
        category: values.main_category,       // ← Categoría principal
        item_type: values.subcategory,        // ← Subcategoría
        cost_price: values.cost_price,
        base_price: values.base_price,
        profit_margin_tiers: values.kind === 'articulo'
          ? [{ min_qty: 1, max_qty: 999, margin: values.profit_margin }]
          : [],
        vat_rate: values.vat_rate,
        unit: values.unit,
        min_quantity: values.min_quantity,
        max_quantity: values.max_quantity,
        estimated_hours: values.estimated_hours,
        shared_time: values.shared_time,
        is_active: values.is_active,
      };

      if (serviceId) {
        const { error } = await supabase.from('service_types').update(serviceData).eq('id', serviceId);
        if (error) {
          console.error('Error updating service:', error);
          toast({ title: "Error", description: "No se pudo actualizar el servicio.", variant: "destructive" });
          return;
        }
      } else {
        const { error } = await supabase.from('service_types').insert(serviceData);
        if (error) {
          console.error('Error creating service:', error);
          toast({ title: "Error", description: "No se pudo crear el servicio.", variant: "destructive" });
          return;
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving service:', error);
      toast({ title: "Error", description: "Error inesperado al guardar el servicio.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /** Moneda */
  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  /** Margen automático por rangos */
  useEffect(() => {
    const loadMarginConfigs = async () => {
      try {
        const { data } = await supabase
          .from("profit_margin_configs")
          .select("*")
          .eq("is_active", true)
          .order("min_price", { ascending: true });
        setMarginConfigs(data || []);
      } catch (error) {
        console.error("Error loading margin configs:", error);
      }
    };
    loadMarginConfigs();
  }, []);

  useEffect(() => {
    const basePrice = form.watch("base_price");
    const kind = form.watch("kind");
    if (kind === "articulo" && basePrice > 0 && marginConfigs.length > 0) {
      const applicableConfig = marginConfigs.find(
        (config: any) => basePrice >= config.min_price && basePrice <= config.max_price
      );
      if (applicableConfig) {
        setAutoMargin(applicableConfig.margin_percentage);
        form.setValue("profit_margin", applicableConfig.margin_percentage);
      } else {
        setAutoMargin(null);
      }
    } else {
      setAutoMargin(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch("base_price"), form.watch("kind"), marginConfigs]);

  useEffect(() => {
    if (serviceId) loadServiceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const subcategoriesForSelected = useMemo(
    () => SUBCATEGORY_MAP[watchedMainCategory as MainCategory] || [],
    [watchedMainCategory]
  );

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Información básica */}
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
              <CardDescription>Datos principales del servicio o artículo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                {/* Tipo de precio (servicio / artículo) */}
                <FormField
                  control={form.control}
                  name="kind"
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
                        {form.watch('kind') === 'servicio'
                          ? 'Precio fijo establecido manualmente'
                          : 'Costo base + margen de ganancia'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Categoría Principal */}
                <FormField
                  control={form.control}
                  name="main_category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría Principal *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MAIN_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Subcategoría */}
                <FormField
                  control={form.control}
                  name="subcategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subcategoría *</FormLabel>
                      {subcategoriesForSelected.length > 0 ? (
                        <>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Subcategoría" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {subcategoriesForSelected.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>Catálogo para {watchedMainCategory}</FormDescription>
                        </>
                      ) : (
                        <>
                          <FormControl>
                            <Input placeholder="Escribe la subcategoría…" {...field} />
                          </FormControl>
                          <FormDescription>Subcategoría libre</FormDescription>
                        </>
                      )}
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
                      <Textarea placeholder="Describe detalladamente el servicio o artículo..." className="min-h-[100px]" {...field} />
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                      <FormDescription>Tiempo estimado para completar el servicio</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shared_time"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-blue-50/50 border-blue-200">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-semibold text-blue-900">Tiempo Compartido</FormLabel>
                        <FormDescription className="text-blue-700">
                          ✓ Se aplica automáticamente al agregar a órdenes<br />
                          ✓ Múltiples artículos optimizan el tiempo total de servicio<br />
                          ✓ Configurable individualmente en cada orden si es necesario
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-blue-600" />
                      </FormControl>
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
                        <FormDescription>Disponible para cotizaciones</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
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
              <CardDescription>Define costos, IVA y cantidades permitidas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {watchedKind === 'servicio' ? (
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
                        <FormDescription>Precio establecido manualmente (sin costo base)</FormDescription>
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
                          <FormDescription>Precio base del artículo (sin margen ni IVA)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="profit_margin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Margen de Ganancia (%)
                            {autoMargin !== null && (
                              <span className="text-sm text-muted-foreground ml-2">(Auto: {autoMargin}%)</span>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="1000"
                              step="0.1"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              disabled={autoMargin !== null}
                            />
                          </FormControl>
                          <FormDescription>
                            % de ganancia sobre el precio base
                            {autoMargin !== null && " (calculado automáticamente)"}
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
                      <FormDescription>Porcentaje de IVA aplicable</FormDescription>
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
                  <FormDescription>Rangos de cantidad permitidos</FormDescription>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview de precios */}
          {watchedBasePrice > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Preview de Precios
                </CardTitle>
                <CardDescription>Visualiza cómo se calculan los precios finales</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Precio Base:</span>
                      <span>{formatCurrency(watchedBasePrice)}</span>
                    </div>
                    {watchedKind === 'articulo' && (
                      <div className="flex justify-between text-green-600">
                        <span>+ Margen ({watchedProfitMargin}%):</span>
                        <span>{formatCurrency(watchedBasePrice * watchedProfitMargin / 100)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-blue-600">
                      <span>+ IVA ({watchedVatRate}%):</span>
                      <span>{formatCurrency((watchedKind === 'articulo' ? watchedBasePrice * (1 + watchedProfitMargin / 100) : watchedBasePrice) * watchedVatRate / 100)}</span>
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

          {/* Garantía */}
          {serviceId && (
            <WarrantyConfigForm
              serviceTypeId={serviceId}
              onSave={() => {
                toast({ title: "Éxito", description: "Configuración de garantía actualizada" });
              }}
            />
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
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
