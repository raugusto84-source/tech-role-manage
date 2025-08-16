import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Shield, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WarrantyConfigFormProps {
  serviceTypeId: string;
  currentWarrantyDays?: number;
  currentWarrantyConditions?: string;
  onSave?: () => void;
}

export function WarrantyConfigForm({ 
  serviceTypeId, 
  currentWarrantyDays = 0, 
  currentWarrantyConditions = '', 
  onSave 
}: WarrantyConfigFormProps) {
  const { toast } = useToast();
  const [warrantyDays, setWarrantyDays] = useState(currentWarrantyDays);
  const [warrantyConditions, setWarrantyConditions] = useState(currentWarrantyConditions);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('service_types')
        .update({
          warranty_duration_days: warrantyDays,
          warranty_conditions: warrantyConditions || 'Sin garantía específica'
        })
        .eq('id', serviceTypeId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Configuración de garantía guardada exitosamente"
      });

      onSave?.();
    } catch (error) {
      console.error('Error saving warranty config:', error);
      toast({
        title: "Error",
        description: "Error al guardar la configuración de garantía",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4" />
          Configuración de Garantía
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="warranty-days">Duración de Garantía (días)</Label>
          <Input
            id="warranty-days"
            type="number"
            min="0"
            value={warrantyDays}
            onChange={(e) => setWarrantyDays(parseInt(e.target.value) || 0)}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Ingrese 0 para sin garantía
          </p>
        </div>

        <div>
          <Label htmlFor="warranty-conditions">Condiciones de Garantía</Label>
          <Textarea
            id="warranty-conditions"
            value={warrantyConditions}
            onChange={(e) => setWarrantyConditions(e.target.value)}
            placeholder="Especifique las condiciones de la garantía..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Describa las condiciones, limitaciones y cobertura de la garantía
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving} 
          className="w-full"
          size="sm"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </CardContent>
    </Card>
  );
}