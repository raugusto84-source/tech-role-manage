import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calculator } from 'lucide-react';
import { formatMXNInt } from '@/utils/currency';

export function QuickPriceCalculator() {
  const [baseCost, setBaseCost] = useState<number>(0);
  const [margin, setMargin] = useState<number>(100);
  const [hasISR, setHasISR] = useState<boolean>(false);

  const purchaseVAT = 16; // Fixed 16%
  const salesVAT = 16; // Fixed 16%
  const isrRate = 10; // Fixed 10% ISR

  // Calculations
  const purchaseVATAmount = baseCost * (purchaseVAT / 100);
  const afterPurchaseVAT = baseCost + purchaseVATAmount;
  const marginAmount = afterPurchaseVAT * (margin / 100);
  const afterMargin = afterPurchaseVAT + marginAmount;
  
  // Price for invoice (base + purchase VAT + margin) - used when ISR applies
  const priceForInvoice = afterMargin;
  
  // Sales VAT and final price
  const salesVATAmount = afterMargin * (salesVAT / 100);
  const finalPrice = afterMargin + salesVATAmount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Preview de Precios
        </CardTitle>
        <CardDescription>
          Visualiza cómo se calculan los precios finales
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseCost">Costo Base</Label>
              <Input
                id="baseCost"
                type="number"
                min="0"
                step="10"
                value={baseCost || ''}
                onChange={(e) => setBaseCost(Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="margin">Margen de Ganancia (%)</Label>
              <Input
                id="margin"
                type="number"
                min="0"
                step="10"
                value={margin || ''}
                onChange={(e) => setMargin(Number(e.target.value))}
                placeholder="100"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasISR"
                checked={hasISR}
                onCheckedChange={(checked) => setHasISR(checked === true)}
              />
              <Label htmlFor="hasISR" className="text-sm font-normal cursor-pointer">
                Aplica retención de ISR (10%)
              </Label>
            </div>
          </div>

          {/* Calculation Breakdown */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Costo Base:</span>
              <span className="font-semibold">{formatMXNInt(baseCost)}</span>
            </div>

            <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
              <span className="text-sm">+ IVA de compra (16%):</span>
              <span className="font-semibold">{formatMXNInt(purchaseVATAmount)}</span>
            </div>

            <div className="flex justify-between items-center text-green-600 dark:text-green-400">
              <span className="text-sm">+ Margen ({margin}%):</span>
              <span className="font-semibold">{formatMXNInt(marginAmount)}</span>
            </div>

            {!hasISR && (
              <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                <span className="text-sm">+ IVA de venta (16%):</span>
                <span className="font-semibold">{formatMXNInt(salesVATAmount)}</span>
              </div>
            )}

            {hasISR && (
              <div className="border-t pt-3 mb-3">
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-orange-600 dark:text-orange-400">
                    Precio para Factura:
                  </span>
                  <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {formatMXNInt(priceForInvoice)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Base + IVA compra + Margen (sin IVA de venta)
                </p>
              </div>
            )}

            {!hasISR && (
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    Precio Final:
                  </span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatMXNInt(finalPrice)}
                  </span>
                </div>
              </div>
            )}

            {hasISR && (
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    Total con IVA:
                  </span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatMXNInt(finalPrice)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
