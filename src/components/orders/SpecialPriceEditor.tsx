import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Tag, Percent } from 'lucide-react';
import { formatMXNExact } from '@/utils/currency';

interface SpecialPriceEditorProps {
  orderId: string;
  currentTotal: number;
  specialPriceEnabled: boolean;
  specialPrice: number | null;
  userId: string;
  onUpdate: () => void;
}

export function SpecialPriceEditor({
  orderId,
  currentTotal,
  specialPriceEnabled,
  specialPrice,
  userId,
  onUpdate
}: SpecialPriceEditorProps) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(specialPriceEnabled);
  const [price, setPrice] = useState<string>(specialPrice?.toString() || '');
  const [saving, setSaving] = useState(false);

  const discount = enabled && price ? currentTotal - parseFloat(price) : 0;
  const discountPercent = currentTotal > 0 && discount > 0 
    ? ((discount / currentTotal) * 100).toFixed(1) 
    : '0';

  const handleSave = async () => {
    if (enabled && (price === '' || parseFloat(price) < 0)) {
      toast({
        title: "Error",
        description: "Ingrese un precio especial válido (puede ser 0)",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      
      const updateData: any = {
        special_price_enabled: enabled,
        special_price: enabled ? parseFloat(price) : null,
        special_price_set_by: enabled ? userId : null,
        special_price_set_at: enabled ? new Date().toISOString() : null
      };

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Precio especial actualizado",
        description: enabled 
          ? `El cliente pagará ${formatMXNExact(parseFloat(price))} (descuento de ${discountPercent}%)`
          : "Se ha removido el precio especial"
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating special price:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el precio especial",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-dashed border-amber-300 bg-amber-50/50">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-amber-600" />
          <span className="font-medium text-amber-800">Precio Especial (Solo Admin)</span>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="special-price-enabled"
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked === true)}
          />
          <Label htmlFor="special-price-enabled" className="text-sm">
            Aplicar precio especial
          </Label>
        </div>

        {enabled && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>Total original: {formatMXNExact(currentTotal)}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="special-price">Precio que pagará el cliente</Label>
              <div className="flex gap-2">
                <Input
                  id="special-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej: 1500.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {price && parseFloat(price) > 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-100 rounded-md text-green-800 text-sm">
                <Percent className="h-4 w-4" />
                <span>
                  Descuento: {formatMXNExact(discount)} ({discountPercent}%)
                </span>
              </div>
            )}
          </div>
        )}

        <Button 
          onClick={handleSave} 
          disabled={saving}
          size="sm"
          className="w-full"
        >
          {saving ? 'Guardando...' : 'Guardar Precio Especial'}
        </Button>
      </CardContent>
    </Card>
  );
}
