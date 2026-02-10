import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Settings } from 'lucide-react';

interface ConfigItem {
  id: string;
  config_key: string;
  config_value: number;
  label: string;
  description: string | null;
  display_order: number;
}

export function AccessQuoteConfig() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, number>>({});

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('access_quote_config')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setConfigs(data || []);
      const vals: Record<string, number> = {};
      (data || []).forEach(c => { vals[c.config_key] = c.config_value; });
      setValues(vals);
    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      for (const config of configs) {
        const newValue = values[config.config_key];
        if (newValue !== config.config_value) {
          const { error } = await supabase
            .from('access_quote_config')
            .update({ config_value: newValue, updated_at: new Date().toISOString() })
            .eq('id', config.id);
          if (error) throw error;
        }
      }
      toast.success('Configuración guardada');
      loadConfigs();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const isPercentage = (key: string) => key.startsWith('discount_');
  const isMonths = (key: string) => key === 'implementation_fee_months';

  if (loading) return <div className="flex justify-center py-8">Cargando configuración...</div>;

  // Group: costs vs discounts
  const costs = configs.filter(c => !isPercentage(c.config_key) && !isMonths(c.config_key));
  const discounts = configs.filter(c => isPercentage(c.config_key));
  const other = configs.filter(c => isMonths(c.config_key));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuración de Precios de Cotización
        </CardTitle>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-semibold mb-3">Costos Mensuales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {costs.map(c => (
              <div key={c.id} className="space-y-1">
                <Label>{c.label}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={values[c.config_key] || 0}
                    onChange={(e) => setValues({ ...values, [c.config_key]: Number(e.target.value) })}
                  />
                </div>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Descuentos por Plazo</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {discounts.map(c => (
              <div key={c.id} className="space-y-1">
                <Label>{c.label}</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="pr-7"
                    value={values[c.config_key] || 0}
                    onChange={(e) => setValues({ ...values, [c.config_key]: Number(e.target.value) })}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {other.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Otros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {other.map(c => (
                <div key={c.id} className="space-y-1">
                  <Label>{c.label}</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={values[c.config_key] || 0}
                    onChange={(e) => setValues({ ...values, [c.config_key]: Number(e.target.value) })}
                  />
                  {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
