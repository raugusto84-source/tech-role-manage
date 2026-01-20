import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Minus, Search, Shield, Monitor, Package, PenLine, X, ShoppingCart } from 'lucide-react';
import { ceilToTen, formatCOPCeilToTen } from '@/utils/currency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface AddEquipmentServicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: string;
  equipmentName: string;
  onServicesAdded: () => void;
}

interface ServiceType {
  id: string;
  name: string;
  description?: string;
  cost_price?: number;
  base_price?: number;
  vat_rate?: number;
  item_type: string;
  category?: string;
  profit_margin_rate?: number;
  profit_margin_tiers?: Array<{
    margin: number;
    min_qty?: number;
    max_qty?: number;
  }>;
}

interface SelectedService {
  service_type_id: string;
  service_name: string;
  description: string;
  price: number;
  quantity: number;
}

export function AddEquipmentServicesDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentName,
  onServicesAdded
}: AddEquipmentServicesDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Free item form
  const [showFreeItemForm, setShowFreeItemForm] = useState(false);
  const [freeItemName, setFreeItemName] = useState('');
  const [freeItemDescription, setFreeItemDescription] = useState('');
  const [freeItemType, setFreeItemType] = useState<'servicio' | 'articulo'>('servicio');
  const [freeItemPrice, setFreeItemPrice] = useState('');

  useEffect(() => {
    if (open) {
      loadServiceTypes();
      setSelectedServices([]);
      setSelectedMainCategory(null);
      setSearchTerm('');
      setShowFreeItemForm(false);
      resetFreeItemForm();
    }
  }, [open]);

  const resetFreeItemForm = () => {
    setFreeItemName('');
    setFreeItemDescription('');
    setFreeItemType('servicio');
    setFreeItemPrice('');
  };

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('category, name');

      if (error) throw error;

      const transformed = (data || []).map((service: any) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        cost_price: service.cost_price,
        base_price: service.base_price,
        vat_rate: service.vat_rate,
        item_type: service.item_type,
        category: service.category,
        profit_margin_rate: service.profit_margin_rate,
        profit_margin_tiers: Array.isArray(service.profit_margin_tiers) ? service.profit_margin_tiers : []
      }));
      setServiceTypes(transformed);
    } catch (error) {
      console.error('Error loading service types:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los servicios disponibles",
        variant: "destructive"
      });
    }
  };

  const calculateDisplayPrice = (service: ServiceType): number => {
    const salesVatRate = service.vat_rate || 16;

    if (service.item_type === 'servicio') {
      const basePrice = service.base_price || 0;
      const withVat = basePrice * (1 + salesVatRate / 100);
      return ceilToTen(withVat);
    } else {
      const purchaseVatRate = 16;
      const baseCost = service.cost_price || 0;
      const marginPercent = service.profit_margin_tiers?.[0]?.margin || 30;
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + marginPercent / 100);
      const withSalesVat = afterMargin * (1 + salesVatRate / 100);
      return ceilToTen(withSalesVat);
    }
  };

  const securityCategories = ['Alarmas', 'Cámaras', 'Cercas Eléctricas', 'Control de Acceso'];
  const systemsCategories = ['Computadoras', 'Fraccionamientos'];

  const getMainCategoryIcon = (mainCategory: string) => {
    switch (mainCategory) {
      case 'Seguridad': return Shield;
      case 'Sistemas': return Monitor;
      default: return Package;
    }
  };

  const getFilteredServices = (mainCategory: string, itemType: string) => {
    const categoryNames = mainCategory === 'Seguridad' ? securityCategories : systemsCategories;
    return serviceTypes.filter(service =>
      categoryNames.includes(service.category || '') &&
      service.item_type === itemType &&
      (searchTerm === '' ||
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase())))
    );
  };

  const addServiceToSelection = (service: ServiceType) => {
    const existingIndex = selectedServices.findIndex(s => s.service_type_id === service.id);

    if (existingIndex !== -1) {
      const updated = [...selectedServices];
      updated[existingIndex].quantity += 1;
      setSelectedServices(updated);
    } else {
      const price = calculateDisplayPrice(service);
      setSelectedServices(prev => [...prev, {
        service_type_id: service.id,
        service_name: service.name,
        description: service.description || '',
        price: price,
        quantity: 1
      }]);
    }
  };

  const addFreeItem = () => {
    if (!freeItemName.trim()) {
      toast({
        title: "Error",
        description: "Debe proporcionar un nombre para el ítem",
        variant: "destructive"
      });
      return;
    }

    const price = parseFloat(freeItemPrice) || 0;
    if (price <= 0) {
      toast({
        title: "Error",
        description: "El precio debe ser mayor a 0",
        variant: "destructive"
      });
      return;
    }

    setSelectedServices(prev => [...prev, {
      service_type_id: '',
      service_name: freeItemName.trim(),
      description: freeItemDescription.trim(),
      price: price,
      quantity: 1
    }]);

    resetFreeItemForm();
    setShowFreeItemForm(false);

    toast({
      title: "Ítem agregado",
      description: `${freeItemName} agregado a la selección`
    });
  };

  const removeFromSelection = (index: number) => {
    setSelectedServices(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...selectedServices];
    updated[index].quantity = Math.max(1, updated[index].quantity + delta);
    setSelectedServices(updated);
  };

  const getTotalSelected = () => {
    return selectedServices.reduce((sum, s) => sum + (s.price * s.quantity), 0);
  };

  const handleSubmit = async () => {
    if (selectedServices.length === 0) {
      toast({
        title: "Error",
        description: "Debe seleccionar al menos un servicio o producto",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const servicesToInsert = selectedServices.flatMap(s =>
        Array.from({ length: s.quantity }, () => ({
          order_equipment_id: equipmentId,
          service_name: s.service_name,
          description: s.description || null,
          price: s.price,
          is_selected: true
        }))
      );

      const { error } = await supabase
        .from('order_equipment_services')
        .insert(servicesToInsert);

      if (error) throw error;

      toast({
        title: "Servicios agregados",
        description: `${selectedServices.length} servicio(s) agregados al equipo`
      });

      onServicesAdded();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding services:', error);
      toast({
        title: "Error",
        description: "No se pudieron agregar los servicios",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryButton = (mainCategory: string, itemType: string) => {
    const IconComponent = getMainCategoryIcon(mainCategory);
    const count = getFilteredServices(mainCategory, itemType).length;
    
    return (
      <Button
        variant="outline"
        className="h-20 flex flex-col gap-2 hover:bg-primary/10"
        onClick={() => setSelectedMainCategory(`${mainCategory}-${itemType}`)}
        disabled={count === 0}
      >
        <IconComponent className="h-6 w-6" />
        <span className="text-xs font-medium">{mainCategory}</span>
        <span className="text-xs text-muted-foreground">
          {count} {itemType === 'servicio' ? 'servicios' : 'productos'}
        </span>
      </Button>
    );
  };

  const renderFreeItemForm = () => (
    <div className="space-y-4 p-4 border-2 border-dashed rounded-lg bg-muted/30">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Agregar Ítem Libre</h4>
        <Button variant="ghost" size="sm" onClick={() => setShowFreeItemForm(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={freeItemType} onValueChange={(v) => setFreeItemType(v as 'servicio' | 'articulo')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="servicio">Servicio</SelectItem>
              <SelectItem value="articulo">Producto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Nombre *</Label>
          <Input
            value={freeItemName}
            onChange={(e) => setFreeItemName(e.target.value)}
            placeholder="Nombre del servicio/producto"
          />
        </div>
        
        <div>
          <Label>Descripción</Label>
          <Textarea
            value={freeItemDescription}
            onChange={(e) => setFreeItemDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            rows={2}
          />
        </div>
        
        <div>
          <Label>Precio *</Label>
          <Input
            type="number"
            value={freeItemPrice}
            onChange={(e) => setFreeItemPrice(e.target.value)}
            placeholder="0"
          />
        </div>
        
        <Button onClick={addFreeItem} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Agregar Ítem Libre
        </Button>
      </div>
    </div>
  );

  const renderMainCategoryView = () => {
    if (showFreeItemForm) {
      return renderFreeItemForm();
    }

    if (!selectedMainCategory) {
      return (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setShowFreeItemForm(true)}
              className="gap-2 border-dashed border-2"
            >
              <PenLine className="h-4 w-4" />
              Agregar Ítem Libre
            </Button>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">Servicios</h3>
            <div className="grid grid-cols-2 gap-4">
              {renderCategoryButton('Seguridad', 'servicio')}
              {renderCategoryButton('Sistemas', 'servicio')}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">Productos</h3>
            <div className="grid grid-cols-2 gap-4">
              {renderCategoryButton('Seguridad', 'articulo')}
              {renderCategoryButton('Sistemas', 'articulo')}
            </div>
          </div>
        </div>
      );
    }

    const [mainCategory, itemType] = selectedMainCategory.split('-');
    const services = getFilteredServices(mainCategory, itemType);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMainCategory(null)}>
            ← Volver
          </Button>
          <h3 className="text-lg font-medium">
            {mainCategory} - {itemType === 'servicio' ? 'Servicios' : 'Productos'}
          </h3>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
          {services.map(service => (
            <Card key={service.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium text-sm">{service.name}</h4>
                    <Badge variant="default" className="text-xs">
                      {itemType === 'servicio' ? 'Servicio' : 'Producto'}
                    </Badge>
                  </div>
                  {service.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {service.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {formatCOPCeilToTen(calculateDisplayPrice(service))}
                    </span>
                    <Button size="sm" onClick={() => addServiceToSelection(service)} className="h-7 px-2">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {services.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron {itemType === 'servicio' ? 'servicios' : 'productos'} en esta categoría
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Agregar Servicios/Productos a: {equipmentName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {renderMainCategoryView()}

          {/* Selected services summary */}
          {selectedServices.length > 0 && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Servicios seleccionados ({selectedServices.length})
              </h4>
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedServices.map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{service.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCOPCeilToTen(service.price)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(index, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{service.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(index, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeFromSelection(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-medium">Total:</span>
                <span className="text-lg font-bold text-primary">
                  {formatCOPCeilToTen(getTotalSelected())}
                </span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || selectedServices.length === 0}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Agregar {selectedServices.length} servicio(s)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
