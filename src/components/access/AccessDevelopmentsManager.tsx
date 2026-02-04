import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DevelopmentsList } from './DevelopmentsList';
import { DevelopmentForm } from './DevelopmentForm';
import { DevelopmentPayments } from './DevelopmentPayments';
import { DevelopmentOrders } from './DevelopmentOrders';
import { InvestorOverview } from './InvestorOverview';
import { DevelopmentLeadsList } from './DevelopmentLeadsList';
import { DevelopmentReceipts } from './DevelopmentReceipts';
import { DevelopmentPaymentNotices } from './DevelopmentPaymentNotices';
import { Building2, PlusCircle, CreditCard, ClipboardList, Users, FileText, Receipt, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface AccessDevelopment {
  id: string;
  name: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contract_start_date: string;
  contract_duration_months: number;
  monthly_payment: number;
  payment_day: number;
  service_day: number;
  auto_generate_orders: boolean;
  has_investor: boolean;
  investor_name: string | null;
  investor_amount: number;
  investor_profit_percent: number;
  investor_recovery_months: number;
  investor_start_earning_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export function AccessDevelopmentsManager() {
  const [developments, setDevelopments] = useState<AccessDevelopment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedDevelopment, setSelectedDevelopment] = useState<AccessDevelopment | null>(null);
  const [editingDevelopment, setEditingDevelopment] = useState<AccessDevelopment | null>(null);
  const [leadToConvert, setLeadToConvert] = useState<any>(null);

  useEffect(() => {
    loadDevelopments();
  }, []);

  const loadDevelopments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('access_developments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevelopments(data || []);
    } catch (error) {
      console.error('Error loading developments:', error);
      toast.error('Error al cargar fraccionamientos');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setShowNewForm(false);
    setEditingDevelopment(null);
    setLeadToConvert(null);
    loadDevelopments();
  };

  const handleConvertLead = (lead: any) => {
    setLeadToConvert(lead);
    setShowNewForm(true);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Cotizaciones
          </TabsTrigger>
          <TabsTrigger value="developments" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Fraccionamientos
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Cobros
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Órdenes de Servicio
          </TabsTrigger>
          <TabsTrigger value="investors" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Inversionistas
          </TabsTrigger>
          <TabsTrigger value="receipts" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Recibos
          </TabsTrigger>
          <TabsTrigger value="notices" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Avisos de Pago
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          <DevelopmentLeadsList onConvertToContract={handleConvertLead} />
        </TabsContent>

        <TabsContent value="developments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowNewForm(true)} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Nuevo Fraccionamiento
            </Button>
          </div>
          <DevelopmentsList 
            developments={developments} 
            loading={loading}
            onSelect={setSelectedDevelopment}
            onEdit={setEditingDevelopment}
            onRefresh={loadDevelopments}
          />
        </TabsContent>

        <TabsContent value="payments">
          <DevelopmentPayments developments={developments} />
        </TabsContent>

        <TabsContent value="orders">
          <DevelopmentOrders developments={developments} />
        </TabsContent>

        <TabsContent value="investors">
          <InvestorOverview developments={developments.filter(d => d.has_investor)} />
        </TabsContent>

        <TabsContent value="receipts">
          <DevelopmentReceipts developments={developments} />
        </TabsContent>

        <TabsContent value="notices">
          <DevelopmentPaymentNotices developments={developments} />
        </TabsContent>
      </Tabs>

      {/* New Development Dialog */}
      <Dialog open={showNewForm} onOpenChange={(open) => {
        setShowNewForm(open);
        if (!open) setLeadToConvert(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{leadToConvert ? 'Convertir Cotización a Contrato' : 'Nuevo Fraccionamiento'}</DialogTitle>
          </DialogHeader>
          <DevelopmentForm 
            leadData={leadToConvert}
            onSuccess={handleSuccess} 
            onCancel={() => {
              setShowNewForm(false);
              setLeadToConvert(null);
            }} 
          />
        </DialogContent>
      </Dialog>

      {/* Edit Development Dialog */}
      <Dialog open={!!editingDevelopment} onOpenChange={(open) => !open && setEditingDevelopment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Fraccionamiento</DialogTitle>
          </DialogHeader>
          {editingDevelopment && (
            <DevelopmentForm 
              development={editingDevelopment} 
              onSuccess={handleSuccess} 
              onCancel={() => setEditingDevelopment(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Development Details Dialog */}
      <Dialog open={!!selectedDevelopment} onOpenChange={(open) => !open && setSelectedDevelopment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDevelopment?.name}</DialogTitle>
          </DialogHeader>
          {selectedDevelopment && (
            <DevelopmentDetails development={selectedDevelopment} onUpdate={loadDevelopments} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Details component inline for simplicity
function DevelopmentDetails({ development, onUpdate }: { development: AccessDevelopment; onUpdate: () => void }) {
  const contractEndDate = new Date(development.contract_start_date);
  contractEndDate.setMonth(contractEndDate.getMonth() + development.contract_duration_months);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium text-sm text-muted-foreground">Dirección</h4>
          <p>{development.address || 'No especificada'}</p>
        </div>
        <div>
          <h4 className="font-medium text-sm text-muted-foreground">Contacto</h4>
          <p>{development.contact_name || 'No especificado'}</p>
          <p className="text-sm text-muted-foreground">{development.contact_phone}</p>
        </div>
        <div>
          <h4 className="font-medium text-sm text-muted-foreground">Inicio del Contrato</h4>
          <p>{new Date(development.contract_start_date).toLocaleDateString('es-MX')}</p>
        </div>
        <div>
          <h4 className="font-medium text-sm text-muted-foreground">Fin del Contrato</h4>
          <p>{contractEndDate.toLocaleDateString('es-MX')}</p>
        </div>
        <div>
          <h4 className="font-medium text-sm text-muted-foreground">Pago Mensual</h4>
          <p className="text-lg font-semibold text-primary">
            ${development.monthly_payment.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <h4 className="font-medium text-sm text-muted-foreground">Día de Cobro</h4>
          <p>Día {development.payment_day} de cada mes</p>
        </div>
        <div>
          <h4 className="font-medium text-sm text-muted-foreground">Día de Servicio</h4>
          <p>Día {development.service_day} de cada mes</p>
        </div>
        <div>
          <h4 className="font-medium text-sm text-muted-foreground">Generación Automática</h4>
          <p>{development.auto_generate_orders ? 'Sí' : 'No'}</p>
        </div>
      </div>

      {development.has_investor && (
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-3">Información del Inversionista</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">Nombre</h4>
              <p>{development.investor_name}</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">Monto Invertido</h4>
              <p className="text-lg font-semibold">
                ${development.investor_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">Meses para Recuperar</h4>
              <p>{development.investor_recovery_months} meses</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">% de Ganancia (post-recuperación)</h4>
              <p>{development.investor_profit_percent}% mensual</p>
            </div>
          </div>
        </div>
      )}

      {development.notes && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-sm text-muted-foreground mb-2">Notas</h4>
          <p className="text-sm">{development.notes}</p>
        </div>
      )}
    </div>
  );
}
