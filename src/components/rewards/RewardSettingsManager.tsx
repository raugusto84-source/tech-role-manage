import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings, Percent, Calculator, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RewardSettings {
  id: string;
  new_client_cashback_percent: number;
  general_cashback_percent: number;
  apply_cashback_to_items: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function RewardSettingsManager() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<RewardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    new_client_cashback_percent: 5.0,
    general_cashback_percent: 2.0,
    apply_cashback_to_items: false
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reward_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error loading reward settings:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las configuraciones de recompensas",
          variant: "destructive"
        });
        return;
      }

      if (data) {
        setSettings(data);
        setFormData({
          new_client_cashback_percent: data.new_client_cashback_percent,
          general_cashback_percent: data.general_cashback_percent,
          apply_cashback_to_items: data.apply_cashback_to_items
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      if (settings) {
        // Update existing settings
        const { error } = await supabase
          .from('reward_settings')
          .update({
            new_client_cashback_percent: formData.new_client_cashback_percent,
            general_cashback_percent: formData.general_cashback_percent,
            apply_cashback_to_items: formData.apply_cashback_to_items
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Create new settings
        const { error } = await supabase
          .from('reward_settings')
          .insert({
            new_client_cashback_percent: formData.new_client_cashback_percent,
            general_cashback_percent: formData.general_cashback_percent,
            apply_cashback_to_items: formData.apply_cashback_to_items,
            is_active: true
          });

        if (error) throw error;
      }

      toast({
        title: "Configuración guardada",
        description: "Los cambios en el sistema de recompensas han sido aplicados",
        variant: "default"
      });

      // Reload settings to get the updated data
      await loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar las configuraciones",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración de Recompensas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuración de Recompensas
        </CardTitle>
        <CardDescription>
          Configura los porcentajes de cashback y cómo se aplican en el sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cashback Percentages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="new-client-percent" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Cashback Cliente Nuevo (%)
            </Label>
            <Input
              id="new-client-percent"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.new_client_cashback_percent}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                new_client_cashback_percent: parseFloat(e.target.value) || 0
              }))}
            />
            <p className="text-sm text-muted-foreground">
              Porcentaje de cashback para la primera compra de un cliente
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="general-percent" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Cashback General (%)
            </Label>
            <Input
              id="general-percent"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.general_cashback_percent}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                general_cashback_percent: parseFloat(e.target.value) || 0
              }))}
            />
            <p className="text-sm text-muted-foreground">
              Porcentaje de cashback para compras posteriores
            </p>
          </div>
        </div>

        {/* Apply to Items Toggle */}
        <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="apply-to-items" className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              Aplicar cashback general al precio
            </Label>
            <p className="text-sm text-muted-foreground">
              Si está activado, el porcentaje de cashback GENERAL se suma al precio del servicio/artículo.
              El cashback de cliente nuevo siempre se otorga como recompensa posterior (nunca se aplica al precio).
            </p>
          </div>
          <Switch
            id="apply-to-items"
            checked={formData.apply_cashback_to_items}
            onCheckedChange={(checked) => setFormData(prev => ({
              ...prev,
              apply_cashback_to_items: checked
            }))}
          />
        </div>

        {/* Preview Example */}
        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Ejemplo de cálculo:
          </h4>
          <div className="text-sm space-y-3">
            <div>
              <p className="font-medium">Servicio de $100.000 para cliente nuevo (primera orden):</p>
              <div className="pl-4 mt-1">
                <p>• Precio final: $100.000 (sin modificación)</p>
                <p>• Cashback otorgado: ${(100000 * formData.new_client_cashback_percent / 100).toLocaleString()}</p>
                <Badge variant="secondary">Siempre como recompensa posterior</Badge>
              </div>
            </div>
            
            <div>
              <p className="font-medium">Servicio de $100.000 para cliente existente:</p>
              {formData.apply_cashback_to_items ? (
                <div className="pl-4 mt-1">
                  <p>• Precio final: $100.000 + {formData.general_cashback_percent}% = ${(100000 * (1 + formData.general_cashback_percent / 100)).toLocaleString()}</p>
                  <Badge variant="outline">Aplicado al precio</Badge>
                </div>
              ) : (
                <div className="pl-4 mt-1">
                  <p>• Precio final: $100.000</p>
                  <p>• Cashback otorgado: ${(100000 * formData.general_cashback_percent / 100).toLocaleString()}</p>
                  <Badge variant="secondary">Recompensa posterior</Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>

        {/* Current Settings Info */}
        {settings && (
          <div className="text-xs text-muted-foreground border-t pt-4">
            <p>Última actualización: {new Date(settings.updated_at).toLocaleString('es-CO')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}