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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Calculator, Upload, ImageIcon, X, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

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

// Mapa inicial de subcategorías - se actualizará dinámicamente
let SUBCATEGORY_MAP: Record<MainCategory, string[]> = {
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
  cost_price: z.number().min(0, 'El precio de costo debe ser mayor o igual a 0'),
  base_price: z.number().min(0, 'El precio fijo debe ser mayor a 0'),
  profit_margin: z.number().min(0).max(1000, 'El margen debe estar entre 0 y 1000%'),
  vat_rate: z.number().min(0).max(100, 'El IVA debe estar entre 0 y 100%'),
  unit: z.string().min(1, 'Especifica la unidad de medida'),
  min_quantity: z.number().min(1, 'La cantidad mínima debe ser mayor a 0'),
  max_quantity: z.number().min(1, 'La cantidad máxima debe ser mayor a 0'),
  estimated_hours: z.number().min(0, 'Las horas estimadas deben ser 0 o más'),
  shared_time: z.boolean().default(false),
  is_active: z.boolean(),
  warranty_duration_days: z.number().min(0, 'Los días de garantía deben ser 0 o más'),
  warranty_conditions: z.string().optional(),
  image_url: z.string().optional(),
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showNewSubcategoryDialog, setShowNewSubcategoryDialog] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [dynamicSubcategories, setDynamicSubcategories] = useState(SUBCATEGORY_MAP);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  const form = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      main_category: '',
      subcategory: '',
      kind: 'servicio',
      cost_price: 0,
      base_price: 0,
      profit_margin: 30,
      vat_rate: 16,
      unit: 'unidad',
      min_quantity: 1,
      max_quantity: 999,
      estimated_hours: 0,
      shared_time: false,
      is_active: true,
      warranty_duration_days: 0,
      warranty_conditions: '',
      image_url: '',
    },
  });

  const watchedKind = form.watch('kind');
  const watchedCostPrice = form.watch('cost_price');
  const watchedBasePrice = form.watch('base_price');
  const watchedProfitMargin = form.watch('profit_margin');
  const watchedVatRate = form.watch('vat_rate');
  const watchedMainCategory = form.watch('main_category');

  /** Si la categoría principal cambia, limpiar subcategoría */
  useEffect(() => {
    if (watchedMainCategory) {
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
      const rawItemType = (data.item_type as string) || '';
      const resolvedKind: 'servicio' | 'articulo' = (rawItemType === 'servicio' || rawItemType === 'articulo')
        ? (rawItemType as 'servicio' | 'articulo')
        : (hasTiers ? 'articulo' : 'servicio');

      form.reset({
        name: data.name,
        description: data.description || '',
        main_category: (data.category as string) || 'Computadoras',
        subcategory: (data.subcategory as string) || '', // Leer desde nueva columna
        kind: resolvedKind,
        cost_price: data.cost_price || 0,
        base_price: data.base_price || 0,
        profit_margin: hasTiers ? (data.profit_margin_tiers as any[])[0]?.margin ?? 30 : 30,
        vat_rate: data.vat_rate || 16,
        unit: data.unit || 'unidad',
        min_quantity: data.min_quantity || 1,
        max_quantity: data.max_quantity || 999,
        estimated_hours: data.estimated_hours || 0,
        shared_time: (data as any).shared_time || false,
        is_active: data.is_active,
        warranty_duration_days: data.warranty_duration_days || 0,
        warranty_conditions: data.warranty_conditions || '',
        image_url: (data as any).image_url || '',
      });

      // Cargar imagen si existe
      if ((data as any).image_url) {
        setImagePreview((data as any).image_url);
      }
    } catch (error) {
      console.error('Error loading service:', error);
      toast({ title: "Error", description: "Error inesperado al cargar el servicio.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /** Upload de imagen */
  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `service-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    try {
      const { data, error } = await supabase.storage
        .from('service-images')
        .upload(filePath, file);

      if (error) {
        console.error('Error uploading image:', error);
        toast({
          title: "Error",
          description: 'Error al subir la imagen: ' + error.message,
          variant: "destructive"
        });
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('service-images')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      form.setValue('image_url', imageUrl);
      setImagePreview(imageUrl);
    }
    setUploadingImage(false);
  };

  const removeImage = () => {
    form.setValue('image_url', '');
    setImagePreview(null);
  };

  /** Función para agregar nueva subcategoría */
  const handleAddSubcategory = () => {
    if (!newSubcategoryName.trim()) return;
    
    const mainCategory = watchedMainCategory as MainCategory;
    const subcategoryName = newSubcategoryName.trim();
    
    // Verificar que no exista ya
    const existingSubcategories = dynamicSubcategories[mainCategory] || [];
    if (existingSubcategories.includes(subcategoryName)) {
      toast({
        title: "Subcategoría ya existe",
        description: `"${subcategoryName}" ya existe en ${mainCategory}`,
        variant: "destructive"
      });
      return;
    }
    
    const updatedSubcategories = {
      ...dynamicSubcategories,
      [mainCategory]: [...existingSubcategories, subcategoryName].sort()
    };
    
    setDynamicSubcategories(updatedSubcategories);
    form.setValue('subcategory', subcategoryName);
    setNewSubcategoryName('');
    setShowNewSubcategoryDialog(false);
    
    toast({
      title: "Subcategoría agregada temporalmente",
      description: `"${subcategoryName}" se guardará cuando guardes el servicio`,
    });
  };

  /** Preview de precio */
  const calculatePreviewPrice = (): number => {
    if (watchedKind === 'servicio') {
      return watchedBasePrice * (1 + watchedVatRate / 100);
    } else {
      const priceWithMargin = watchedCostPrice * (1 + watchedProfitMargin / 100);
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
        item_type: values.kind,               // ← Usar 'servicio' o 'articulo'
        subcategory: values.subcategory,      // ← Guardar subcategoría en su propia columna
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
        warranty_duration_days: values.warranty_duration_days,
        warranty_conditions: values.warranty_conditions || 'Sin garantía específica',
        image_url: values.image_url || null,
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

      // Recargar subcategorías después de guardar para reflejar la nueva
      await loadExistingSubcategories();
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
    const costPrice = form.watch("cost_price");
    const kind = form.watch("kind");
    if (kind === "articulo" && costPrice > 0 && marginConfigs.length > 0) {
      const applicableConfig = marginConfigs.find(
        (config: any) => costPrice >= config.min_price && costPrice <= config.max_price
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
  }, [form.watch("cost_price"), form.watch("kind"), marginConfigs]);

  /** Cargar subcategorías existentes de la base de datos */
  const loadExistingSubcategories = async () => {
    try {
      setLoadingSubcategories(true);
      
      // Obtener todos los servicios activos con sus subcategorías
      const { data: services, error } = await supabase
        .from('service_types')
        .select('category, subcategory')
        .eq('is_active', true)
        .not('subcategory', 'is', null);
      
      if (error) {
        console.error('Error loading subcategories:', error);
        return;
      }
      
      // Procesar subcategorías por categoría
      const subcategoriesMap = { ...SUBCATEGORY_MAP }; // Empezar con las predefinidas
      
      services?.forEach(service => {
        const category = service.category as MainCategory;
        const subcategory = service.subcategory;
        
        if (category && subcategory && subcategory.trim()) {
          if (!subcategoriesMap[category]) {
            subcategoriesMap[category] = [];
          }
          
          // Agregar subcategoría si no existe ya
          if (!subcategoriesMap[category].includes(subcategory.trim())) {
            subcategoriesMap[category].push(subcategory.trim());
          }
        }
      });
      
      // Ordenar subcategorías alfabéticamente
      Object.keys(subcategoriesMap).forEach(category => {
        subcategoriesMap[category as MainCategory].sort();
      });
      
      setDynamicSubcategories(subcategoriesMap);
    } catch (error) {
      console.error('Error loading existing subcategories:', error);
    } finally {
      setLoadingSubcategories(false);
    }
  };

  useEffect(() => {
    loadExistingSubcategories();
  }, []);

  useEffect(() => {
    if (serviceId) loadServiceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const subcategoriesForSelected = useMemo(
    () => dynamicSubcategories[watchedMainCategory as MainCategory] || [],
    [watchedMainCategory, dynamicSubcategories]
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
                             <SelectValue placeholder="Selecciona una categoría" />
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
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center justify-between">
                        Subcategoría *
                        <Dialog open={showNewSubcategoryDialog} onOpenChange={setShowNewSubcategoryDialog}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" type="button">
                              <Plus className="h-3 w-3 mr-1" />
                              Nueva
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Agregar Subcategoría</DialogTitle>
                              <DialogDescription>
                                Crear una nueva subcategoría para "{watchedMainCategory}"
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="subcategory-name">Nombre de la subcategoría</Label>
                                <Input
                                  id="subcategory-name"
                                  value={newSubcategoryName}
                                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                                  placeholder="Ej: Instalación de Windows"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddSubcategory();
                                    }
                                  }}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  setShowNewSubcategoryDialog(false);
                                  setNewSubcategoryName('');
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button onClick={handleAddSubcategory} disabled={!newSubcategoryName.trim()}>
                                Agregar
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={`w-full justify-between ${!field.value && "text-muted-foreground"}`}
                            >
                              {field.value || "Selecciona o escribe subcategoría"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput 
                              placeholder="Buscar o escribir subcategoría..." 
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value);
                              }}
                            />
                            <CommandList>
                              {subcategoriesForSelected.length > 0 && (
                                <>
                                  <CommandEmpty>
                                    Presiona Enter para crear "{field.value}"
                                  </CommandEmpty>
                                  <CommandGroup heading={`Subcategorías de ${watchedMainCategory}`}>
                                    {subcategoriesForSelected.map((subcategory) => (
                                      <CommandItem
                                        key={subcategory}
                                        value={subcategory}
                                        onSelect={() => {
                                          field.onChange(subcategory);
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${
                                            field.value === subcategory ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                        {subcategory}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </>
                              )}
                              {subcategoriesForSelected.length === 0 && (
                                <CommandEmpty>
                                  Escribe para crear una nueva subcategoría
                                </CommandEmpty>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        {subcategoriesForSelected.length > 0 
                          ? `Selecciona del catálogo de ${watchedMainCategory} o escribe una nueva`
                          : 'Escribe una subcategoría personalizada'
                        }
                      </FormDescription>
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

              {/* Campo de imagen opcional */}
              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imagen del Producto/Servicio (Opcional)</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        {imagePreview ? (
                          <div className="relative inline-block">
                            <img 
                              src={imagePreview} 
                              alt="Preview del servicio/artículo"
                              className="w-32 h-32 object-cover rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                              onClick={removeImage}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id="image-upload"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleImageUpload(file);
                                }
                              }}
                              disabled={uploadingImage}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById('image-upload')?.click()}
                              disabled={uploadingImage}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {uploadingImage ? 'Subiendo...' : 'Subir Imagen'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      Agrega una imagen para mostrar el producto o servicio (formato: JPG, PNG)
                    </FormDescription>
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

              {/* Garantía */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="warranty_duration_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duración de Garantía (días)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>Días de garantía para este servicio/artículo</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="warranty_conditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condiciones de Garantía</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Condiciones específicas..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Términos y condiciones de la garantía</FormDescription>
                      <FormMessage />
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
                            step="1"
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
                      name="cost_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Costo Base * (COP)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>Costo base del artículo (sin margen ni IVA)</FormDescription>
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
          {(watchedKind === 'servicio' ? watchedBasePrice : watchedCostPrice) > 0 && (
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
                      <span>{watchedKind === 'servicio' ? 'Precio Base:' : 'Costo Base:'}</span>
                      <span>{formatCurrency(watchedKind === 'servicio' ? watchedBasePrice : watchedCostPrice)}</span>
                    </div>
                    {watchedKind === 'articulo' && (
                      <div className="flex justify-between text-green-600">
                        <span>+ Margen ({watchedProfitMargin}%):</span>
                        <span>{formatCurrency(watchedCostPrice * watchedProfitMargin / 100)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-blue-600">
                      <span>+ IVA ({watchedVatRate}%):</span>
                      <span>{formatCurrency((watchedKind === 'articulo' ? watchedCostPrice * (1 + watchedProfitMargin / 100) : watchedBasePrice) * watchedVatRate / 100)}</span>
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

          {/* Garantía - removed separate component */}

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
