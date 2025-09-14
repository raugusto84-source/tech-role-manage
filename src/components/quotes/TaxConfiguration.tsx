import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Plus, Trash2, Calculator } from 'lucide-react';
import { formatCOPCeilToTen } from '@/utils/currency';

interface Tax {
  id: string;
  tax_type: 'iva' | 'retencion';
  tax_name: string;
  tax_rate: number;
  tax_amount: number;
}

interface QuoteItem {
  id: string;
  service_type_id?: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  withholding_rate: number;
  withholding_amount: number;
  withholding_type: string;
  total: number;
  is_custom: boolean;
  taxes?: Tax[];
}

interface TaxConfigurationProps {
  item: QuoteItem;
  onItemChange: (updatedItem: QuoteItem) => void;
}

/**
 * Componente para configurar múltiples IVAs y retenciones de un artículo
 * Permite agregar/quitar diferentes tipos de impuestos simultáneamente
 */
export function TaxConfiguration({ item, onItemChange }: TaxConfigurationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [taxes, setTaxes] = useState<Tax[]>(item.taxes || []);

  const [availableTaxes, setAvailableTaxes] = useState<any[]>([]);

  // Cargar impuestos desde la base de datos
  useEffect(() => {
    const loadTaxes = async () => {
      const { data, error } = await supabase
        .from('tax_definitions')
        .select('*')
        .eq('is_active', true)
        .order('tax_type, tax_rate');
      
      if (!error && data) {
        setAvailableTaxes(data.map(tax => ({
          type: tax.tax_type,
          name: tax.tax_name,
          rate: tax.tax_rate,
          id: tax.id
        })));
      }
    };
    loadTaxes();
  }, []);

  const calculateTotals = (updatedTaxes: Tax[]) => {
    const subtotal = item.quantity * item.unit_price;
    let totalIva = 0;
    let totalRetenciones = 0;

    updatedTaxes.forEach(tax => {
      const taxAmount = subtotal * (tax.tax_rate / 100);
      if (tax.tax_type === 'iva') {
        totalIva += taxAmount;
      } else {
        totalRetenciones += taxAmount;
      }
    });

    const total = subtotal + totalIva - totalRetenciones;

    return {
      subtotal,
      totalIva,
      totalRetenciones,
      total,
      taxes: updatedTaxes.map(tax => ({
        ...tax,
        tax_amount: subtotal * (tax.tax_rate / 100)
      }))
    };
  };

  const addTax = (taxType: 'iva' | 'retencion', name: string, rate: number) => {
    const newTax: Tax = {
      id: `${taxType}-${Date.now()}-${Math.random()}`,
      tax_type: taxType,
      tax_name: name,
      tax_rate: rate,
      tax_amount: 0, // Will be calculated
    };

    const updatedTaxes = [...taxes, newTax];
    setTaxes(updatedTaxes);
    
    const totals = calculateTotals(updatedTaxes);
    
    // Update the item with new totals and backward compatibility fields
    const updatedItem = {
      ...item,
      subtotal: totals.subtotal,
      vat_rate: totals.taxes.find(t => t.tax_type === 'iva')?.tax_rate || 0,
      vat_amount: totals.totalIva,
      withholding_rate: totals.taxes.find(t => t.tax_type === 'retencion')?.tax_rate || 0,
      withholding_amount: totals.totalRetenciones,
      withholding_type: totals.taxes.find(t => t.tax_type === 'retencion')?.tax_name || '',
      total: totals.total,
      taxes: totals.taxes
    };

    onItemChange(updatedItem);
  };

  const removeTax = (taxId: string) => {
    const updatedTaxes = taxes.filter(tax => tax.id !== taxId);
    setTaxes(updatedTaxes);
    
    const totals = calculateTotals(updatedTaxes);
    
    const updatedItem = {
      ...item,
      subtotal: totals.subtotal,
      vat_rate: totals.taxes.find(t => t.tax_type === 'iva')?.tax_rate || 0,
      vat_amount: totals.totalIva,
      withholding_rate: totals.taxes.find(t => t.tax_type === 'retencion')?.tax_rate || 0,
      withholding_amount: totals.totalRetenciones,
      withholding_type: totals.taxes.find(t => t.tax_type === 'retencion')?.tax_name || '',
      total: totals.total,
      taxes: totals.taxes
    };

    onItemChange(updatedItem);
  };

  const formatCurrency = (amount: number) => formatCOPCeilToTen(amount);

  const { totalIva, totalRetenciones } = calculateTotals(taxes);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-1" />
          Impuestos
          {taxes.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {taxes.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Configurar Impuestos - {item.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Información del artículo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Resumen del Artículo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Cantidad:</span>
                <span>{item.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span>Precio unitario:</span>
                <span>{formatCurrency(item.unit_price)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Subtotal:</span>
                <span>{formatCurrency(item.subtotal)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Agregar impuestos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agregar Impuestos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* IVAs */}
                <div>
                  <Label className="text-sm font-medium text-green-700">IVAs Disponibles</Label>
                  <div className="space-y-2 mt-2">
                    {availableTaxes
                      .filter(tax => tax.type === 'iva')
                      .map((tax) => (
                        <Button
                          key={`${tax.type}-${tax.rate}`}
                          variant="outline"
                          size="sm"
                          onClick={() => addTax(tax.type, tax.name, tax.rate)}
                          className="w-full justify-between text-xs"
                          disabled={taxes.some(t => t.tax_type === 'iva' && t.tax_rate === tax.rate)}
                        >
                          <span>{tax.name}</span>
                          <span className="text-green-600">+{tax.rate}%</span>
                        </Button>
                      ))}
                  </div>
                </div>

                {/* Retenciones */}
                <div>
                  <Label className="text-sm font-medium text-red-700">Retenciones Disponibles</Label>
                  <div className="space-y-2 mt-2">
                    {availableTaxes
                      .filter(tax => tax.type === 'retencion')
                      .map((tax) => (
                        <Button
                          key={`${tax.type}-${tax.rate}`}
                          variant="outline"
                          size="sm"
                          onClick={() => addTax(tax.type, tax.name, tax.rate)}
                          className="w-full justify-between text-xs"
                          disabled={taxes.some(t => t.tax_type === 'retencion' && t.tax_rate === tax.rate)}
                        >
                          <span>{tax.name}</span>
                          <span className="text-red-600">-{tax.rate}%</span>
                        </Button>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Impuestos aplicados */}
          {taxes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Impuestos Aplicados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {taxes.map((tax) => (
                    <div key={tax.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={tax.tax_type === 'iva' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {tax.tax_type === 'iva' ? 'IVA' : 'RET'}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{tax.tax_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {tax.tax_rate}% = {formatCurrency(tax.tax_amount)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTax(tax.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumen de totales */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">Resumen de Totales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(item.subtotal)}</span>
              </div>
              {totalIva > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Total IVAs:</span>
                  <span>+{formatCurrency(totalIva)}</span>
                </div>
              )}
              {totalRetenciones > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>Total Retenciones:</span>
                  <span>-{formatCurrency(totalRetenciones)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total Final:</span>
                <span className="text-primary">{formatCurrency(item.total)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}