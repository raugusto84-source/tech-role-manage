import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccessDevelopment } from './AccessDevelopmentsManager';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  development?: AccessDevelopment;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DevelopmentForm({ development, onSuccess, onCancel }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    contract_start_date: new Date().toISOString().split('T')[0],
    contract_duration_months: 12,
    monthly_payment: 0,
    payment_day: 1,
    service_day: 15,
    auto_generate_orders: true,
    has_investor: false,
    investor_name: '',
    investor_amount: 0,
    investor_profit_percent: 0,
    status: 'active',
    notes: ''
  });

  useEffect(() => {
    if (development) {
      setFormData({
        name: development.name,
        address: development.address || '',
        contact_name: development.contact_name || '',
        contact_phone: development.contact_phone || '',
        contact_email: development.contact_email || '',
        contract_start_date: development.contract_start_date,
        contract_duration_months: development.contract_duration_months,
        monthly_payment: development.monthly_payment,
        payment_day: development.payment_day,
        service_day: development.service_day,
        auto_generate_orders: development.auto_generate_orders,
        has_investor: development.has_investor,
        investor_name: development.investor_name || '',
        investor_amount: development.investor_amount,
        investor_profit_percent: development.investor_profit_percent,
        status: development.status,
        notes: development.notes || ''
      });
    }
  }, [development]);

  // Calculate recovery months based on investment and monthly payment
  const calculatedRecoveryMonths = formData.has_investor && formData.monthly_payment > 0
    ? Math.ceil(formData.investor_amount / formData.monthly_payment)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    if (formData.monthly_payment <= 0) {
      toast.error('El pago mensual debe ser mayor a 0');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        investor_recovery_months: calculatedRecoveryMonths,
        investor_start_earning_date: formData.has_investor 
          ? calculateEarningStartDate(formData.contract_start_date, calculatedRecoveryMonths)
          : null,
        created_by: development ? undefined : user?.id
      };

      if (development) {
        const { error } = await supabase
          .from('access_developments')
          .update(dataToSave)
          .eq('id', development.id);
        if (error) throw error;
        toast.success('Fraccionamiento actualizado');
      } else {
        const { data: newDev, error } = await supabase
          .from('access_developments')
          .insert(dataToSave)
          .select()
          .single();
        if (error) throw error;

        // If has investor, create investor loan record
        if (formData.has_investor && newDev) {
          await supabase.from('access_investor_loans').insert({
            development_id: newDev.id,
            investor_name: formData.investor_name,
            amount: formData.investor_amount,
            profit_percent: formData.investor_profit_percent,
            recovery_months: calculatedRecoveryMonths
          });

          // Create loan in loans table for finance integration
          await supabase.from('loans').insert({
            lender_name: formData.investor_name,
            loan_amount: formData.investor_amount,
            interest_rate: 0,
            loan_date: formData.contract_start_date,
            due_date: calculateEarningStartDate(formData.contract_start_date, calculatedRecoveryMonths),
            purpose: `Inversión en fraccionamiento: ${formData.name}`,
            status: 'activo'
          });
        }

        // Generate initial scheduled orders and payments
        await generateInitialSchedules(newDev.id, formData);

        toast.success('Fraccionamiento creado');
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving development:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const calculateEarningStartDate = (startDate: string, months: number) => {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  };

  const generateInitialSchedules = async (developmentId: string, data: typeof formData) => {
    const startDate = new Date(data.contract_start_date);
    const ordersToCreate = [];
    const paymentsToCreate = [];

    for (let i = 0; i < data.contract_duration_months; i++) {
      const orderDate = new Date(startDate);
      orderDate.setMonth(orderDate.getMonth() + i);
      orderDate.setDate(data.service_day);

      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + i);
      paymentDate.setDate(data.payment_day);

      const isRecoveryPeriod = i < calculatedRecoveryMonths;
      const investorPortion = data.has_investor
        ? (isRecoveryPeriod 
            ? data.monthly_payment 
            : data.monthly_payment * (data.investor_profit_percent / 100))
        : 0;

      ordersToCreate.push({
        development_id: developmentId,
        scheduled_date: orderDate.toISOString().split('T')[0],
        status: 'pending'
      });

      paymentsToCreate.push({
        development_id: developmentId,
        payment_period: new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1).toISOString().split('T')[0],
        due_date: paymentDate.toISOString().split('T')[0],
        amount: data.monthly_payment,
        investor_portion: investorPortion,
        company_portion: data.monthly_payment - investorPortion,
        is_recovery_period: isRecoveryPeriod,
        status: 'pending'
      });
    }

    await supabase.from('access_development_orders').insert(ordersToCreate);
    await supabase.from('access_development_payments').insert(paymentsToCreate);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="font-medium border-b pb-2">Información General</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="name">Nombre del Fraccionamiento *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Residencial Las Palmas"
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="contact_name">Nombre de Contacto</Label>
            <Input
              id="contact_name"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="contact_phone">Teléfono</Label>
            <Input
              id="contact_phone"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Contract Info */}
      <div className="space-y-4">
        <h3 className="font-medium border-b pb-2">Contrato</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contract_start_date">Fecha de Inicio *</Label>
            <Input
              id="contract_start_date"
              type="date"
              value={formData.contract_start_date}
              onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="contract_duration_months">Duración (meses) *</Label>
            <Input
              id="contract_duration_months"
              type="number"
              min={1}
              value={formData.contract_duration_months}
              onChange={(e) => setFormData({ ...formData, contract_duration_months: parseInt(e.target.value) || 12 })}
            />
          </div>
          <div>
            <Label htmlFor="monthly_payment">Pago Mensual *</Label>
            <Input
              id="monthly_payment"
              type="number"
              min={0}
              step={0.01}
              value={formData.monthly_payment}
              onChange={(e) => setFormData({ ...formData, monthly_payment: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="payment_day">Día de Cobro</Label>
            <Select
              value={formData.payment_day.toString()}
              onValueChange={(v) => setFormData({ ...formData, payment_day: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>Día {day}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="service_day">Día de Servicio</Label>
            <Select
              value={formData.service_day.toString()}
              onValueChange={(v) => setFormData({ ...formData, service_day: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>Día {day}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="auto_generate_orders"
              checked={formData.auto_generate_orders}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_generate_orders: checked })}
            />
            <Label htmlFor="auto_generate_orders">Generar órdenes automáticamente</Label>
          </div>
        </div>
      </div>

      {/* Investor Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <Switch
            id="has_investor"
            checked={formData.has_investor}
            onCheckedChange={(checked) => setFormData({ ...formData, has_investor: checked })}
          />
          <Label htmlFor="has_investor" className="font-medium">Tiene Inversionista</Label>
        </div>

        {formData.has_investor && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="investor_name">Nombre del Inversionista *</Label>
              <Input
                id="investor_name"
                value={formData.investor_name}
                onChange={(e) => setFormData({ ...formData, investor_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="investor_amount">Monto Invertido *</Label>
              <Input
                id="investor_amount"
                type="number"
                min={0}
                step={0.01}
                value={formData.investor_amount}
                onChange={(e) => setFormData({ ...formData, investor_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="investor_profit_percent">% de Ganancia (después de recuperar)</Label>
              <Input
                id="investor_profit_percent"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={formData.investor_profit_percent}
                onChange={(e) => setFormData({ ...formData, investor_profit_percent: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-2 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Meses para recuperar inversión:</strong> {calculatedRecoveryMonths} meses
              </p>
              <p className="text-sm text-muted-foreground">
                Después de recuperar, el inversionista recibirá el {formData.investor_profit_percent}% del pago mensual (${((formData.monthly_payment * formData.investor_profit_percent) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })})
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status and Notes */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="status">Estado</Label>
          <Select
            value={formData.status}
            onValueChange={(v) => setFormData({ ...formData, status: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="suspended">Suspendido</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {development ? 'Actualizar' : 'Crear Fraccionamiento'}
        </Button>
      </div>
    </form>
  );
}
