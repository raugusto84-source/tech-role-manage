import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Package, Clock } from 'lucide-react';

export interface OrderItem {
  id: string;
  service_type_id: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  estimated_hours: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  item_type: string;
}

interface OrderItemsListProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
}

export function OrderItemsList({ items, onItemsChange }: OrderItemsListProps) {
  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }

    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        const subtotal = newQuantity * item.unit_price;
        const vatAmount = subtotal * (item.vat_rate / 100);
        const total = subtotal + vatAmount;
        const totalEstimatedHours = newQuantity * item.estimated_hours;
        
        return { 
          ...item, 
          quantity: newQuantity, 
          subtotal, 
          vat_amount: vatAmount, 
          total,
          estimated_hours: totalEstimatedHours
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
  };

  const removeItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId);
    onItemsChange(updatedItems);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    return `${hours} h`;
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const getTotalHours = () => {
    return items.reduce((sum, item) => sum + item.estimated_hours, 0);
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay artículos agregados a la orden</p>
            <p className="text-sm text-muted-foreground mt-1">
              Selecciona servicios o productos para comenzar
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Artículos de la Orden ({getTotalItems()})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id}>
              {index > 0 && <Separator />}
              <div className="flex justify-between items-start py-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{item.name}</h4>
                    <Badge variant={item.item_type === 'servicio' ? 'default' : 'secondary'}>
                      {item.item_type}
                    </Badge>
                  </div>
                  
                  {item.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {item.description}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-xs">Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                        className="w-20 h-8 mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs">Precio Unit.</Label>
                      <div className="text-green-600 font-medium mt-1">
                        {formatCurrency(item.unit_price)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <div>
                        <Label className="text-xs">Tiempo Est.</Label>
                        <div className="text-blue-600 mt-1">
                          {formatHours(item.estimated_hours)}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Total</Label>
                      <div className="font-bold text-primary mt-1">
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Subtotal: {formatCurrency(item.subtotal)}</span>
                    <span>IVA ({item.vat_rate}%): {formatCurrency(item.vat_amount)}</span>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  className="text-destructive hover:text-destructive ml-4"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Resumen Total */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{getTotalItems()}</div>
              <div className="text-sm text-muted-foreground">Artículos</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-5 w-5 text-blue-600" />
                <div className="text-2xl font-bold text-blue-600">{formatHours(getTotalHours())}</div>
              </div>
              <div className="text-sm text-muted-foreground">Tiempo Total Est.</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(getTotalAmount())}</div>
              <div className="text-sm text-muted-foreground">Total General</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}