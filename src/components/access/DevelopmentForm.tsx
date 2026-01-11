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
import { Loader2, Plus, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string;
}

interface LeadData {
  name: string;
  address?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  monthly_payment_proposed?: number;
  has_investor?: boolean;
  investor_name?: string;
  investor_amount?: number;
}

interface Props {
  development?: AccessDevelopment;
  leadData?: LeadData;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DevelopmentForm({ development, leadData, onSuccess, onCancel }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientData, setNewClientData] = useState({ name: '', phone: '', email: '', address: '' });
  const [savingClient, setSavingClient] = useState(false);
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
    investor_account_type: 'no_fiscal' as 'fiscal' | 'no_fiscal',
    status: 'active',
    notes: ''
  });

  // Load clients on mount
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoadingClients(true);
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, email, address')
        .order('name');
      
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

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
        investor_account_type: 'no_fiscal',
        status: development.status,
        notes: development.notes || ''
      });
      // Try to find matching client
      if (development.contact_name) {
        const matchingClient = clients.find(c => c.name === development.contact_name);
        if (matchingClient) {
          setSelectedClientId(matchingClient.id);
        }
      }
    } else if (leadData) {
      setFormData(prev => ({
        ...prev,
        name: leadData.name || '',
        address: leadData.address || '',
        contact_name: leadData.contact_name || '',
        contact_phone: leadData.contact_phone || '',
        contact_email: leadData.contact_email || '',
        monthly_payment: leadData.monthly_payment_proposed || 0,
        has_investor: leadData.has_investor || false,
        investor_name: leadData.investor_name || '',
        investor_amount: leadData.investor_amount || 0,
      }));
    }
  }, [development, leadData, clients]);

  const handleSelectClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClientId(client.id);
      setFormData(prev => ({
        ...prev,
        contact_name: client.name,
        contact_phone: client.phone || '',
        contact_email: client.email || '',
        address: prev.address || client.address
      }));
    }
  };

  const handleCreateClient = async () => {
    if (!newClientData.name.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }

    setSavingClient(true);
    try {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          name: newClientData.name,
          phone: newClientData.phone || null,
          email: newClientData.email || null,
          address: newClientData.address || 'Sin dirección'
        })
        .select()
        .single();

      if (error) throw error;

      // Add to list and select
      setClients(prev => [...prev, newClient]);
      handleSelectClient(newClient.id);
      setShowNewClientDialog(false);
      setNewClientData({ name: '', phone: '', email: '', address: '' });
      toast.success('Cliente creado');
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Error al crear cliente');
    } finally {
      setSavingClient(false);
    }
  };

  const clearSelectedClient = () => {
    setSelectedClientId(null);
    setFormData(prev => ({
      ...prev,
      contact_name: '',
      contact_phone: '',
      contact_email: ''
    }));
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (client.phone && client.phone.includes(clientSearch)) ||
    (client.email && client.email.toLowerCase().includes(clientSearch.toLowerCase()))
  );

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

    if (!selectedClientId) {
      toast.error('Debe seleccionar un cliente para el contacto');
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

      // Remove investor_account_type from dataToSave as it's not a column
      const { investor_account_type, ...saveData } = dataToSave;

      if (development) {
        const { error } = await supabase
          .from('access_developments')
          .update(saveData)
          .eq('id', development.id);
        if (error) throw error;
        toast.success('Fraccionamiento actualizado');
      } else {
        const { data: newDev, error } = await supabase
          .from('access_developments')
          .insert(saveData)
          .select()
          .single();
        if (error) throw error;

        // If has investor, create investor loan record and loan payments
        if (formData.has_investor && newDev) {
          await createInvestorLoanWithPayments(newDev.id, formData, calculatedRecoveryMonths);
        }

        // Create initial order with selected client
        await createInitialOrder(newDev.id, formData, selectedClientId);

        // Generate scheduled orders and payments
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

  const createInvestorLoanWithPayments = async (
    developmentId: string, 
    data: typeof formData,
    recoveryMonths: number
  ) => {
    const loanNumber = `INV-${Date.now()}`;
    
    // Create loan in loans table
    const { data: newLoan, error: loanError } = await supabase.from('loans').insert({
      loan_number: loanNumber,
      amount: data.investor_amount,
      monthly_payment: data.monthly_payment,
      total_months: recoveryMonths,
      start_date: data.contract_start_date,
      payment_day: data.payment_day,
      account_type: data.investor_account_type,
      description: `Inversión de ${data.investor_name} en fraccionamiento: ${data.name}`,
      status: 'activo',
      remaining_amount: data.investor_amount
    }).select().single();

    if (loanError) {
      console.error('Error creating loan:', loanError);
      throw loanError;
    }

    // Create investor loan link
    await supabase.from('access_investor_loans').insert({
      development_id: developmentId,
      investor_name: data.investor_name,
      amount: data.investor_amount,
      profit_percent: data.investor_profit_percent,
      recovery_months: recoveryMonths,
      loan_id: newLoan.id
    });

    // Generate loan payments - include past months if contract started in the past
    const today = new Date();
    const contractStart = new Date(data.contract_start_date);
    const loanPayments = [];

    for (let i = 0; i < recoveryMonths; i++) {
      const paymentDate = new Date(contractStart);
      paymentDate.setMonth(paymentDate.getMonth() + i);
      paymentDate.setDate(data.payment_day);

      const isPastDue = paymentDate < today;

      loanPayments.push({
        loan_id: newLoan.id,
        payment_number: i + 1,
        due_date: paymentDate.toISOString().split('T')[0],
        amount: data.monthly_payment,
        paid_amount: 0,
        account_type: data.investor_account_type,
        status: isPastDue ? 'vencido' : 'pendiente'
      });
    }

    if (loanPayments.length > 0) {
      const { error: paymentsError } = await supabase.from('loan_payments').insert(loanPayments);
      if (paymentsError) {
        console.error('Error creating loan payments:', paymentsError);
      }
    }
  };

  const createInitialOrder = async (developmentId: string, data: typeof formData, clientId: string) => {
    // Get a default service type for access services
    const { data: serviceTypes } = await supabase
      .from('service_types')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    const serviceTypeId = serviceTypes?.[0]?.id;
    if (!serviceTypeId) {
      console.warn('No active service type found for initial order');
      return;
    }

    // Calculate delivery date: 25 days from now
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 25);

    // Create initial order with $0 cost
    const orderNumber = `ORD-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        client_id: clientId,
        service_type: serviceTypeId,
        failure_description: `Instalación inicial - ${data.name}`,
        estimated_cost: 0,
        delivery_date: deliveryDate.toISOString().split('T')[0],
        status: 'pendiente_aprobacion',
        order_category: 'fraccionamientos',
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating initial order:', orderError);
      return;
    }

    // Create order item with $0 cost
    await supabase.from('order_items').insert({
      order_id: newOrder.id,
      service_type_id: serviceTypeId,
      service_name: 'Instalación de Acceso',
      service_description: `Instalación inicial para ${data.name}`,
      quantity: 1,
      unit_cost_price: 0,
      unit_base_price: 0,
      profit_margin_rate: 0,
      subtotal: 0,
      vat_rate: 0,
      vat_amount: 0,
      total_amount: 0,
      item_type: 'servicio',
      status: 'pendiente',
      pricing_locked: true
    });

    // Link order to development
    await supabase.from('access_development_orders').insert({
      development_id: developmentId,
      scheduled_date: new Date().toISOString().split('T')[0],
      status: 'generated',
      order_id: newOrder.id,
      generated_at: new Date().toISOString(),
      notes: 'Orden de instalación inicial'
    });

    console.log(`Created initial order ${orderNumber} for ${data.name}`);
  };

  const generateInitialSchedules = async (developmentId: string, data: typeof formData) => {
    const startDate = new Date(data.contract_start_date);
    const today = new Date();
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

      // Determine if this is a past order/payment
      const isPastOrder = orderDate < today;
      const isPastPayment = paymentDate < today;

      ordersToCreate.push({
        development_id: developmentId,
        scheduled_date: orderDate.toISOString().split('T')[0],
        status: isPastOrder ? 'pending' : 'pending' // All pending for now, edge function will process
      });

      paymentsToCreate.push({
        development_id: developmentId,
        payment_period: new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1).toISOString().split('T')[0],
        due_date: paymentDate.toISOString().split('T')[0],
        amount: data.monthly_payment,
        investor_portion: investorPortion,
        company_portion: data.monthly_payment - investorPortion,
        is_recovery_period: isRecoveryPeriod,
        status: isPastPayment ? 'overdue' : 'pending'
      });
    }

    // Usar upsert para evitar duplicados (índice único por development_id + scheduled_date/payment_period)
    await supabase.from('access_development_orders').upsert(ordersToCreate, { 
      onConflict: 'development_id,scheduled_date',
      ignoreDuplicates: true 
    });
    await supabase.from('access_development_payments').upsert(paymentsToCreate, { 
      onConflict: 'development_id,payment_period',
      ignoreDuplicates: true 
    });
  };

  return (
    <>
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
          <div className="col-span-2">
            <Label>Cliente / Contacto *</Label>
            <div className="flex gap-2">
              {selectedClientId ? (
                <div className="flex-1 flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                  <div className="flex-1">
                    <p className="font-medium">{formData.contact_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formData.contact_phone || 'Sin teléfono'} • {formData.contact_email || 'Sin email'}
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    onClick={clearSelectedClient}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <Input
                      placeholder="Buscar cliente..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setShowNewClientDialog(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            {!selectedClientId && clientSearch && filteredClients.length > 0 && (
              <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
                {filteredClients.slice(0, 10).map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    className="w-full text-left p-2 hover:bg-muted/50 border-b last:border-b-0"
                    onClick={() => handleSelectClient(client.id)}
                  >
                    <p className="font-medium">{client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {client.phone || 'Sin teléfono'} • {client.email || 'Sin email'}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {!selectedClientId && clientSearch && filteredClients.length === 0 && !loadingClients && (
              <p className="text-xs text-muted-foreground mt-1">
                No se encontraron clientes. Use el botón + para crear uno nuevo.
              </p>
            )}
            {selectedClientId && (
              <p className="text-xs text-muted-foreground mt-1">
                Las órdenes de servicio se asociarán a este cliente
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="contact_phone">Teléfono</Label>
            <Input
              id="contact_phone"
              value={formData.contact_phone}
              readOnly
              className="bg-muted/50"
            />
          </div>
          <div>
            <Label htmlFor="contact_email">Email</Label>
            <Input
              id="contact_email"
              value={formData.contact_email}
              readOnly
              className="bg-muted/50"
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
            <div className="col-span-2">
              <Label htmlFor="investor_account_type">Tipo de Cuenta para el Préstamo *</Label>
              <Select
                value={formData.investor_account_type}
                onValueChange={(v) => setFormData({ ...formData, investor_account_type: v as 'fiscal' | 'no_fiscal' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fiscal">Cuenta Fiscal</SelectItem>
                  <SelectItem value="no_fiscal">Cuenta No Fiscal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Meses para recuperar inversión:</strong> {calculatedRecoveryMonths} meses
              </p>
              <p className="text-sm text-muted-foreground">
                Después de recuperar, el inversionista recibirá el {formData.investor_profit_percent}% del pago mensual (${((formData.monthly_payment * formData.investor_profit_percent) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })})
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Los pagos se registrarán en la cuenta <strong>{formData.investor_account_type === 'fiscal' ? 'Fiscal' : 'No Fiscal'}</strong>
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

    {/* New Client Dialog */}
    <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="new_client_name">Nombre *</Label>
            <Input
              id="new_client_name"
              value={newClientData.name}
              onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
              placeholder="Nombre del cliente"
            />
          </div>
          <div>
            <Label htmlFor="new_client_phone">Teléfono</Label>
            <Input
              id="new_client_phone"
              value={newClientData.phone}
              onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="new_client_email">Email</Label>
            <Input
              id="new_client_email"
              type="email"
              value={newClientData.email}
              onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="new_client_address">Dirección</Label>
            <Input
              id="new_client_address"
              value={newClientData.address}
              onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowNewClientDialog(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreateClient} disabled={savingClient}>
              {savingClient && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Cliente
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
