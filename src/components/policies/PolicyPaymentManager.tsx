import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, AlertTriangle, DollarSign, Calendar, CreditCard, Trash2 } from "lucide-react";

interface PolicyPayment {
  id: string;
  policy_client_id: string;
  payment_month: number;
  payment_year: number;
  amount: number;
  account_type: 'fiscal' | 'no_fiscal';
  payment_method: string;
  due_date: string;
  payment_date: string | null;
  is_paid: boolean;
  payment_status: string;
  invoice_number: string | null;
  created_at: string;
  policy_clients: {
    id: string;
    clients: {
      name: string;
      email: string;
    };
    insurance_policies: {
      policy_name: string;
      policy_number: string;
    };
  };
}

interface PolicyClient {
  id: string;
  clients: {
    name: string;
    email: string;
  };
  insurance_policies: {
    policy_name: string;
    monthly_fee: number;
  };
}

interface PolicyPaymentManagerProps {
  onStatsUpdate: () => void;
}

export function PolicyPaymentManager({ onStatsUpdate }: PolicyPaymentManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<PolicyPayment[]>([]);
  const [policyClients, setPolicyClients] = useState<PolicyClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('todos');
  const [formData, setFormData] = useState({
    policy_client_id: '',
    payment_month: new Date().getMonth() + 1,
    payment_year: new Date().getFullYear(),
    account_type: 'no_fiscal' as 'fiscal' | 'no_fiscal',
    payment_method: '',
    due_date: new Date(new Date().getFullYear(), new Date().getMonth(), 5).toISOString().split('T')[0],
    invoice_number: '',
  });

  // Update due_date whenever month or year changes
  useEffect(() => {
    const dueDate = new Date(formData.payment_year, formData.payment_month - 1, 5).toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, due_date: dueDate }));
  }, [formData.payment_month, formData.payment_year]);

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    const init = async () => {
      // Generate missing payments for all policy clients first
      try {
        await supabase.functions.invoke('generate-policy-payments', { 
          body: { generate_immediate: true } 
        });
      } catch (e) {
        console.warn('Payment generation failed:', e);
      }
      await loadData();
    };
    init();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('policy_payments')
        .select(`
          *,
          policy_clients(
            id,
            clients(name, email),
            insurance_policies(policy_name, policy_number)
          )
        `)
        .order('due_date', { ascending: true });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);

      // Load active policy clients
      const { data: policyClientsData, error: policyClientsError } = await supabase
        .from('policy_clients')
        .select(`
          id,
          clients(name, email),
          insurance_policies(policy_name, monthly_fee)
        `)
        .eq('is_active', true);

      if (policyClientsError) throw policyClientsError;
      setPolicyClients(policyClientsData || []);

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Get the policy client info to get the amount
      const policyClient = policyClients.find(pc => pc.id === formData.policy_client_id);
      if (!policyClient) {
        toast({
          title: "Error",
          description: "Cliente de póliza no encontrado",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('policy_payments')
        .insert([{
          ...formData,
          amount: policyClient.insurance_policies.monthly_fee,
          created_by: user?.id,
        }]);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Pago creado correctamente",
      });

      setIsDialogOpen(false);
      resetForm();
      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error creating payment:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el pago",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('policy_payments')
        .update({
          is_paid: true,
          payment_status: 'pagado',
          payment_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Pago marcado como pagado",
      });

      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error marking payment as paid:', error);
      toast({
        title: "Error",
        description: "No se pudo marcar el pago como pagado",
        variant: "destructive",
      });
    }
  };

  // Add function to delete a payment
  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este pago? Esta acción no se puede deshacer.')) return;

    try {
      const { error } = await supabase
        .from('policy_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Pago eliminado correctamente",
      });

      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el pago",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    setFormData({
      policy_client_id: '',
      payment_month: currentMonth,
      payment_year: currentYear,
      account_type: 'no_fiscal',
      payment_method: '',
      due_date: new Date(currentYear, currentMonth - 1, 5).toISOString().split('T')[0],
      invoice_number: '',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const [y, m, d] = dateString.split('-');
    return `${d}/${m}/${y}`;
  };

  const getStatusBadge = (payment: PolicyPayment) => {
    if (payment.is_paid) {
      return <Badge variant="default">Pagado</Badge>;
    }
    
    if (payment.payment_status === 'vencido') {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  const filteredPayments = payments.filter(payment => {
    if (filterStatus === 'todos') return true;
    if (filterStatus === 'pagados') return payment.is_paid;
    if (filterStatus === 'pendientes') return !payment.is_paid && payment.payment_status === 'pendiente';
    if (filterStatus === 'vencidos') return payment.payment_status === 'vencido';
    return true;
  });

  if (loading) {
    return <div>Cargando pagos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Pagos</h2>
          <p className="text-muted-foreground">
            Administra los pagos mensuales de las pólizas de seguros
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Crear Pago
            </Button>
          </DialogTrigger>
          
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Pago</DialogTitle>
              <DialogDescription>
                Genera un pago mensual para un cliente con póliza
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="policy_client_id">Cliente con Póliza *</Label>
                <Select 
                  value={formData.policy_client_id} 
                  onValueChange={(value) => setFormData({...formData, policy_client_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {policyClients.map((pc) => (
                      <SelectItem key={pc.id} value={pc.id}>
                        {pc.clients.name} - {pc.insurance_policies.policy_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_month">Mes *</Label>
                  <Select 
                    value={formData.payment_month.toString()} 
                    onValueChange={(value) => setFormData({...formData, payment_month: parseInt(value)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, index) => (
                        <SelectItem key={index + 1} value={(index + 1).toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_year">Año *</Label>
                  <Input
                    type="number"
                    value={formData.payment_year}
                    onChange={(e) => setFormData({...formData, payment_year: parseInt(e.target.value)})}
                    min="2020"
                    max="2030"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Fecha de Vencimiento (Día 5)</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                  title="La fecha de vencimiento siempre es el día 5 del mes seleccionado"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_type">Tipo de Cuenta *</Label>
                  <Select 
                    value={formData.account_type} 
                    onValueChange={(value: 'fiscal' | 'no_fiscal') => setFormData({...formData, account_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_fiscal">No Fiscal</SelectItem>
                      <SelectItem value="fiscal">Fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_method">Método de Pago</Label>
                  <Input
                    value={formData.payment_method}
                    onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                    placeholder="Transferencia, Efectivo, etc."
                  />
                </div>
              </div>

              {formData.account_type === 'fiscal' && (
                <div className="space-y-2">
                  <Label htmlFor="invoice_number">Número de Factura</Label>
                  <Input
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                    placeholder="Número de factura"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Crear Pago
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex space-x-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los pagos</SelectItem>
            <SelectItem value="pendientes">Pendientes</SelectItem>
            <SelectItem value="vencidos">Vencidos</SelectItem>
            <SelectItem value="pagados">Pagados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pagos de Pólizas</CardTitle>
          <CardDescription>
            Lista de pagos mensuales generados para las pólizas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay pagos registrados. Crea el primer pago para comenzar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {payment.policy_clients.clients.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.policy_clients.clients.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {payment.policy_clients.insurance_policies.policy_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.policy_clients.insurance_policies.policy_number}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{months[payment.payment_month - 1]} {payment.payment_year}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>{formatCurrency(payment.amount)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {payment.payment_status === 'vencido' && (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                        <span>{formatDate(payment.due_date)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(payment)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {!payment.is_paid && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsPaid(payment.id)}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Marcar Pagado
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePayment(payment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}