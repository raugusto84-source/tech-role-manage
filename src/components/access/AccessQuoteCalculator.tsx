import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Calculator, FileDown, Save } from 'lucide-react';
import { generateAccessQuotePDF } from './AccessQuotePDF';

export interface QuoteInputs {
  name: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  vehicularGatesSingle: number;
  vehicularGatesDouble: number;
  pedestrianDoors: number;
  controlledExit: boolean;
  numHouses: number;
  notes: string;
}

export interface QuoteBreakdown {
  vehicularSingleTotal: number;
  vehicularDoubleTotal: number;
  pedestrianTotal: number;
  controlledExitTotal: number;
  housesBaseTotal: number;
  monthlyBase: number;
  plans: {
    months: number;
    label: string;
    discount: number;
    monthly: number;
    perHouse: number;
  }[];
  implementationFee: number;
}

interface Props {
  leadId?: string;
  initialData?: Partial<QuoteInputs>;
  onSaved?: () => void;
  onCancel?: () => void;
}

export function AccessQuoteCalculator({ leadId, initialData, onSaved, onCancel }: Props) {
  const [configs, setConfigs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<QuoteInputs>({
    name: initialData?.name || '',
    contactName: initialData?.contactName || '',
    contactPhone: initialData?.contactPhone || '',
    contactEmail: initialData?.contactEmail || '',
    address: initialData?.address || '',
    vehicularGatesSingle: initialData?.vehicularGatesSingle || 0,
    vehicularGatesDouble: initialData?.vehicularGatesDouble || 0,
    pedestrianDoors: initialData?.pedestrianDoors || 0,
    controlledExit: initialData?.controlledExit || false,
    numHouses: initialData?.numHouses || 0,
    notes: initialData?.notes || '',
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('access_quote_config')
        .select('config_key, config_value');
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach(c => { map[c.config_key] = Number(c.config_value); });
      setConfigs(map);
    } catch (error) {
      console.error('Error loading configs:', error);
      toast.error('Error al cargar configuración de precios');
    } finally {
      setLoading(false);
    }
  };

  const breakdown = useMemo<QuoteBreakdown | null>(() => {
    if (Object.keys(configs).length === 0 || inputs.numHouses === 0) return null;

    const vehicularSingleTotal = inputs.vehicularGatesSingle * (configs.vehicular_gate_single_cost || 0);
    const vehicularDoubleTotal = inputs.vehicularGatesDouble * (configs.vehicular_gate_double_cost || 0);
    const pedestrianTotal = inputs.pedestrianDoors * (configs.pedestrian_door_cost || 0);
    const controlledExitTotal = inputs.controlledExit ? (configs.controlled_exit_surcharge || 0) : 0;
    const housesBaseTotal = inputs.numHouses * (configs.per_house_base_cost || 0);

    const monthlyBase = vehicularSingleTotal + vehicularDoubleTotal + pedestrianTotal + controlledExitTotal + housesBaseTotal;

    const plans = [
      { months: 18, label: '18 meses', discountKey: 'discount_18_months' },
      { months: 24, label: '2 años', discountKey: 'discount_24_months' },
      { months: 36, label: '3 años', discountKey: 'discount_36_months' },
    ].map(p => {
      const discount = configs[p.discountKey] || 0;
      const monthly = monthlyBase * (1 - discount / 100);
      return {
        months: p.months,
        label: p.label,
        discount,
        monthly: Math.round(monthly * 100) / 100,
        perHouse: inputs.numHouses > 0 ? Math.round((monthly / inputs.numHouses) * 100) / 100 : 0,
      };
    });

    const implementationMonths = configs.implementation_fee_months || 1;
    // Use the 24-month plan as default for implementation fee
    const implementationFee = plans.length >= 2 ? plans[1].monthly * implementationMonths : monthlyBase * implementationMonths;

    return {
      vehicularSingleTotal,
      vehicularDoubleTotal,
      pedestrianTotal,
      controlledExitTotal,
      housesBaseTotal,
      monthlyBase,
      plans,
      implementationFee,
    };
  }, [configs, inputs]);

  const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);

  const handleSaveLead = async () => {
    if (!inputs.name) { toast.error('El nombre es requerido'); return; }
    if (!breakdown) { toast.error('Ingresa los datos para calcular'); return; }

    try {
      setSaving(true);
      const leadData = {
        name: inputs.name,
        address: inputs.address || null,
        contact_name: inputs.contactName || null,
        contact_phone: inputs.contactPhone || null,
        contact_email: inputs.contactEmail || null,
        monthly_payment_proposed: breakdown.plans[1]?.monthly || breakdown.monthlyBase,
        vehicular_gates_single: inputs.vehicularGatesSingle,
        vehicular_gates_double: inputs.vehicularGatesDouble,
        pedestrian_doors: inputs.pedestrianDoors,
        controlled_exit: inputs.controlledExit,
        num_houses: inputs.numHouses,
        contract_months: 24,
        quote_breakdown: breakdown as any,
        last_activity_at: new Date().toISOString(),
        last_activity_description: leadId ? 'Cotización actualizada' : 'Cotización creada',
      };

      if (leadId) {
        const { error } = await supabase
          .from('access_development_leads')
          .update(leadData)
          .eq('id', leadId);
        if (error) throw error;
        toast.success('Cotización actualizada');
      } else {
        const { error } = await supabase
          .from('access_development_leads')
          .insert([{ ...leadData, status: 'nuevo' }]);
        if (error) throw error;
        toast.success('Cotización creada');
      }
      onSaved?.();
    } catch (error) {
      console.error('Error saving quote:', error);
      toast.error('Error al guardar cotización');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = () => {
    if (!breakdown) { toast.error('Ingresa los datos para calcular'); return; }
    generateAccessQuotePDF(inputs, breakdown);
  };

  if (loading) return <div className="flex justify-center py-8">Cargando...</div>;

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Datos del Fraccionamiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Nombre del Fraccionamiento *</Label>
              <Input value={inputs.name} onChange={e => setInputs({ ...inputs, name: e.target.value })} placeholder="Ej: Cerrada Halcón" />
            </div>
            <div>
              <Label>Contacto</Label>
              <Input value={inputs.contactName} onChange={e => setInputs({ ...inputs, contactName: e.target.value })} placeholder="Nombre del contacto" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={inputs.contactPhone} onChange={e => setInputs({ ...inputs, contactPhone: e.target.value })} placeholder="Teléfono" />
            </div>
            <div>
              <Label>Correo</Label>
              <Input value={inputs.contactEmail} onChange={e => setInputs({ ...inputs, contactEmail: e.target.value })} placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={inputs.address} onChange={e => setInputs({ ...inputs, address: e.target.value })} placeholder="Dirección del fraccionamiento" />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Equipamiento</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Accesos vehiculares (1 hoja)</Label>
                <Input type="number" min="0" value={inputs.vehicularGatesSingle} onChange={e => setInputs({ ...inputs, vehicularGatesSingle: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Accesos vehiculares (2 hojas)</Label>
                <Input type="number" min="0" value={inputs.vehicularGatesDouble} onChange={e => setInputs({ ...inputs, vehicularGatesDouble: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Puertas peatonales</Label>
                <Input type="number" min="0" value={inputs.pedestrianDoors} onChange={e => setInputs({ ...inputs, pedestrianDoors: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Cantidad de casas</Label>
                <Input type="number" min="0" value={inputs.numHouses} onChange={e => setInputs({ ...inputs, numHouses: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <Switch checked={inputs.controlledExit} onCheckedChange={v => setInputs({ ...inputs, controlledExit: v })} />
              <Label>Salida Controlada</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {breakdown && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cotización Calculada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {inputs.vehicularGatesSingle > 0 && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-muted-foreground">Accesos vehiculares (1 hoja) × {inputs.vehicularGatesSingle}</p>
                  <p className="font-semibold">{fmt(breakdown.vehicularSingleTotal)}</p>
                </div>
              )}
              {inputs.vehicularGatesDouble > 0 && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-muted-foreground">Accesos vehiculares (2 hojas) × {inputs.vehicularGatesDouble}</p>
                  <p className="font-semibold">{fmt(breakdown.vehicularDoubleTotal)}</p>
                </div>
              )}
              {inputs.pedestrianDoors > 0 && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-muted-foreground">Puertas peatonales × {inputs.pedestrianDoors}</p>
                  <p className="font-semibold">{fmt(breakdown.pedestrianTotal)}</p>
                </div>
              )}
              {inputs.controlledExit && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-muted-foreground">Salida Controlada</p>
                  <p className="font-semibold">{fmt(breakdown.controlledExitTotal)}</p>
                </div>
              )}
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-muted-foreground">Base por casa × {inputs.numHouses}</p>
                <p className="font-semibold">{fmt(breakdown.housesBaseTotal)}</p>
              </div>
              <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
                <p className="text-muted-foreground">Total Mensual Base</p>
                <p className="font-bold text-primary text-lg">{fmt(breakdown.monthlyBase)}</p>
              </div>
            </div>

            {/* Pricing Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-3 font-semibold">Plazo</th>
                    <th className="text-right p-3 font-semibold">Descuento</th>
                    <th className="text-right p-3 font-semibold">Pago por Casa</th>
                    <th className="text-right p-3 font-semibold">Pago Mensual</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.plans.map(plan => (
                    <tr key={plan.months} className="border-t">
                      <td className="p-3 font-medium">{plan.label}</td>
                      <td className="p-3 text-right">{plan.discount > 0 ? `${plan.discount}%` : '-'}</td>
                      <td className="p-3 text-right">{fmt(plan.perHouse)}</td>
                      <td className="p-3 text-right font-semibold">{fmt(plan.monthly)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-muted-foreground">
              Se requiere un primer pago de implementación equivalente a {configs.implementation_fee_months || 1} mensualidad(es) 
              para iniciar con la preparación de los equipos y el sistema.
            </p>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSaveLead} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : (leadId ? 'Actualizar Cotización' : 'Guardar Cotización')}
              </Button>
              <Button variant="outline" onClick={handleExportPDF} className="gap-2">
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>
              {onCancel && (
                <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
