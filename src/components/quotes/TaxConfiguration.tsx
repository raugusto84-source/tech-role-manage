import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Plus, Trash2 } from 'lucide-react';

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
}

interface TaxConfigurationProps {
  item: QuoteItem;
  onItemChange: (updatedItem: QuoteItem) => void;
}

/**
 * Componente para configurar IVA y retenciones de un artículo
 * Permite ajustar tasas de IVA y agregar diferentes tipos de retenciones
 */
export function TaxConfiguration({ item, onItemChange }: TaxConfigurationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customVat, setCustomVat] = useState(item.vat_rate);
  const [customWithholdingRate, setCustomWithholdingRate] = useState(item.withholding_rate);
  const [customWithholdingType, setCustomWithholdingType] = useState(item.withholding_type);

  const vatOptions = [
    { value: 0, label: '0% - Exento' },
    { value: 5, label: '5% - Productos básicos' },
    { value: 16, label: '16% - Estándar' },
    { value: 19, label: '19% - Servicios' },
  ];

  const withholdingOptions = [
    { value: 0, type: '', label: 'Sin retención' },
    { value: 1, type: 'Retención en la fuente', label: '1% - Compras generales' },
    { value: 2, type: 'Retención en la fuente', label: '2% - Servicios' },
    { value: 3.5, type: 'Retención en la fuente', label: '3.5% - Servicios profesionales' },
    { value: 4, type: 'Retención en la fuente', label: '4% - Servicios técnicos' },
    { value: 6, type: 'Retención en la fuente', label: '6% - Honorarios' },
    { value: 10, type: 'Retención en la fuente', label: '10% - Pagos al exterior' },
  ];

  const calculateTotals = (vatRate: number, withholdingRate: number, withholdingType: string) => {
    const subtotal = item.quantity * item.unit_price;
    const vatAmount = subtotal * (vatRate / 100);
    const withholdingAmount = subtotal * (withholdingRate / 100);
    const total = subtotal + vatAmount - withholdingAmount;

    return {
      subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      withholding_rate: withholdingRate,
      withholding_amount: withholdingAmount,
      withholding_type: withholdingType,
      total
    };
  };

  const handleVatChange = (vatRate: number) => {
    setCustomVat(vatRate);
    const updatedTotals = calculateTotals(vatRate, customWithholdingRate, customWithholdingType);
    onItemChange({
      ...item,
      ...updatedTotals
    });
  };

  const handleWithholdingChange = (withholdingRate: number, withholdingType: string) => {
    setCustomWithholdingRate(withholdingRate);
    setCustomWithholdingType(withholdingType);
    const updatedTotals = calculateTotals(customVat, withholdingRate, withholdingType);
    onItemChange({
      ...item,
      ...updatedTotals
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-1" />
          IVA/Retenciones
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Impuestos y Retenciones</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Información del artículo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{item.name}</CardTitle>
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

          {/* Configuración de IVA */}
          <div className="space-y-3">
            <Label>Tasa de IVA</Label>
            <Select value={customVat.toString()} onValueChange={(value) => handleVatChange(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vatOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              IVA: {formatCurrency(item.vat_amount)}
            </div>
          </div>

          {/* Configuración de retenciones */}
          <div className="space-y-3">
            <Label>Retención en la Fuente</Label>
            <Select 
              value={`${customWithholdingRate}-${customWithholdingType}`} 
              onValueChange={(value) => {
                const [rate, type] = value.split('-');
                handleWithholdingChange(Number(rate), type === 'undefined' ? '' : type);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {withholdingOptions.map((option) => (
                  <SelectItem 
                    key={`${option.value}-${option.type}`} 
                    value={`${option.value}-${option.type}`}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {item.withholding_amount > 0 && (
              <div className="text-sm text-red-600">
                Retención: -{formatCurrency(item.withholding_amount)}
              </div>
            )}
          </div>

          {/* Total final */}
          <div className="border-t pt-3">
            <div className="flex justify-between font-bold text-lg">
              <span>Total final:</span>
              <span>{formatCurrency(item.total)}</span>
            </div>
          </div>

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