import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calculator, DollarSign, Package, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Interface para servicios simplificada para la calculadora
 */
interface Service {
  id: string;
  name: string;
  item_type: string;
  cost_price: number;
  base_price: number;
  vat_rate: number;
  profit_margin_tiers: Array<{
    min_qty: number;
    max_qty: number;
    margin: number;
  }>;
  unit: string;
  min_quantity: number;
  max_quantity: number;
}

/**
 * Interface para resultados de cálculo de precios
 */
interface PriceCalculation {
  cost_price: number;
  profit_margin: number;
  vat_amount: number;
  final_price: number;
  unit_price: number;
  margin_percentage: number;
}

/**
 * Calculadora de precios independiente
 * 
 * FUNCIONALIDADES:
 * - Selección de servicio desde catálogo
 * - Cálculo dinámico de precios según cantidad
 * - Desglose detallado de costos
 * - Comparación de precios por niveles
 * - Exportación de cotizaciones rápidas
 * 
 * COMPONENTE REUTILIZABLE:
 * Esta calculadora puede ser utilizada en:
 * - Modal de precios en módulo de cotizaciones
 * - Widget de dashboard para vendedores
 * - API endpoint para cálculos automatizados
 * - App móvil para vendedores en campo
 */
export function PriceCalculator() {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [calculation, setCalculation] = useState<PriceCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [comparisonTiers, setComparisonTiers] = useState<Array<{
    quantity: number;
    price: number;
    savings: number;
  }>>([]);

  /**
   * Carga la lista de servicios activos
   */
  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('id, name, item_type, cost_price, base_price, vat_rate, profit_margin_tiers, unit, min_quantity, max_quantity')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error loading services:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los servicios.",
          variant: "destructive",
        });
        return;
      }

      // Transformar datos para que coincidan con nuestra interface
      const transformedServices = (data || []).map(service => ({
        ...service,
        item_type: service.item_type || 'servicio',
        profit_margin_tiers: Array.isArray(service.profit_margin_tiers) 
          ? service.profit_margin_tiers as Array<{min_qty: number, max_qty: number, margin: number}>
          : []
      }));

      setServices(transformedServices);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  /**
   * Calcula precios usando la función de base de datos
   */
  const calculatePrice = async () => {
    if (!selectedServiceId || quantity <= 0) {
      setCalculation(null);
      setComparisonTiers([]);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .rpc('calculate_service_price', {
          p_service_id: selectedServiceId,
          p_quantity: quantity,
        });

      if (error) {
        console.error('Error calculating price:', error);
        toast({
          title: "Error",
          description: "No se pudo calcular el precio.",
          variant: "destructive",
        });
        return;
      }

      if (data && data.length > 0) {
        const result = data[0];
        const selectedService = services.find(s => s.id === selectedServiceId);
        
        if (selectedService) {
          // Encontrar el nivel de margen aplicable
          const applicableTier = selectedService.profit_margin_tiers?.find(tier =>
            quantity >= tier.min_qty && quantity <= tier.max_qty
          );
          
          const marginPercentage = applicableTier ? applicableTier.margin : 30;

          setCalculation({
            cost_price: result.cost_price,
            profit_margin: result.profit_margin,
            vat_amount: result.vat_amount,
            final_price: result.final_price,
            unit_price: result.unit_price,
            margin_percentage: marginPercentage,
          });

          // Generar comparaciones para diferentes cantidades
          generateComparisons(selectedService);
        }
      }
    } catch (error) {
      console.error('Error calculating price:', error);
      toast({
        title: "Error",
        description: "Error inesperado al calcular el precio.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Genera comparaciones de precios para diferentes cantidades
   */
  const generateComparisons = async (service: Service) => {
    const quantities = [1, 5, 10, 25, 50, 100].filter(q => 
      q >= service.min_quantity && q <= service.max_quantity
    );

    const comparisons = [];

    for (const qty of quantities) {
      try {
        const { data, error } = await supabase
          .rpc('calculate_service_price', {
            p_service_id: service.id,
            p_quantity: qty,
          });

        if (data && data.length > 0) {
          const result = data[0];
          const unitPrice = result.final_price / qty;
          const savings = qty > 1 ? ((result.unit_price - unitPrice) / result.unit_price) * 100 : 0;

          comparisons.push({
            quantity: qty,
            price: unitPrice,
            savings: savings,
          });
        }
      } catch (error) {
        console.error('Error calculating comparison:', error);
      }
    }

    setComparisonTiers(comparisons);
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

  /**
   * Obtiene el servicio seleccionado
   */
  const getSelectedService = (): Service | undefined => {
    return services.find(s => s.id === selectedServiceId);
  };

  /**
   * Valida si la cantidad está en el rango permitido
   */
  const isQuantityValid = (): boolean => {
    const service = getSelectedService();
    if (!service) return false;
    return quantity >= service.min_quantity && quantity <= service.max_quantity;
  };

  /**
   * Genera una cotización rápida (funcionalidad futura)
   */
  const generateQuickQuote = () => {
    if (!calculation || !selectedServiceId) return;

    const service = getSelectedService();
    if (!service) return;

    const quoteData = {
      service: service.name,
      quantity: quantity,
      unit: service.unit,
      unit_price: calculation.unit_price,
      total_price: calculation.final_price,
      margin_percentage: calculation.margin_percentage,
      vat_rate: service.vat_rate,
      generated_at: new Date().toISOString(),
    };

    // Aquí se podría integrar con un sistema de cotizaciones
    console.log('Quick quote generated:', quoteData);
    
    toast({
      title: "Cotización generada",
      description: "Los datos están listos para generar una cotización formal.",
    });
  };

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    calculatePrice();
  }, [selectedServiceId, quantity]);

  return (
    <div className="space-y-6">
      {/* Selector de servicio y cantidad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculadora de Precios
          </CardTitle>
          <CardDescription>
            Selecciona un servicio y cantidad para calcular precios automáticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Servicio</label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un servicio" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - {service.item_type === 'servicio' 
                        ? formatCurrency(service.base_price) 
                        : formatCurrency(service.cost_price)
                      }/{service.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cantidad</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className={!isQuantityValid() && selectedServiceId ? 'border-destructive' : ''}
                />
                {getSelectedService() && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {getSelectedService()?.unit}
                  </span>
                )}
              </div>
              {!isQuantityValid() && selectedServiceId && (
                <p className="text-sm text-destructive">
                  Cantidad debe estar entre {getSelectedService()?.min_quantity} y {getSelectedService()?.max_quantity}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados del cálculo */}
      {calculation && isQuantityValid() && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Desglose de precios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Desglose de Precios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Costo base:</span>
                  <span className="font-medium">{formatCurrency(calculation.cost_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Margen ({calculation.margin_percentage}%):
                  </span>
                  <span className="font-medium text-green-600">
                    +{formatCurrency(calculation.profit_margin)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    IVA ({getSelectedService()?.vat_rate}%):
                  </span>
                  <span className="font-medium text-blue-600">
                    +{formatCurrency(calculation.vat_amount)}
                  </span>
                </div>
                <hr />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-green-600">{formatCurrency(calculation.final_price)}</span>
                </div>
                <div className="text-center">
                  <Badge variant="secondary">
                    {formatCurrency(calculation.unit_price)} por {getSelectedService()?.unit}
                  </Badge>
                </div>
              </div>

              <Button 
                onClick={generateQuickQuote} 
                className="w-full mt-4"
                variant="outline"
              >
                Generar Cotización Rápida
              </Button>
            </CardContent>
          </Card>

          {/* Comparación por cantidades */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Comparación por Cantidad
              </CardTitle>
              <CardDescription>
                Precios por unidad según cantidad solicitada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {comparisonTiers.map((tier) => (
                  <div
                    key={tier.quantity}
                    className={`flex justify-between items-center p-3 rounded-lg ${
                      tier.quantity === quantity ? 'bg-primary/10 border border-primary' : 'bg-muted'
                    }`}
                  >
                    <div>
                      <span className="font-medium">{tier.quantity} {getSelectedService()?.unit}</span>
                      {tier.savings > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          -{tier.savings.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    <span className="font-bold">
                      {formatCurrency(tier.price)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Estado de carga */}
      {loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Calculando precios...</p>
          </CardContent>
        </Card>
      )}

      {/* Estado vacío */}
      {!selectedServiceId && !loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Selecciona un servicio</h3>
            <p className="text-muted-foreground">
              Elige un servicio del catálogo para comenzar a calcular precios
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}