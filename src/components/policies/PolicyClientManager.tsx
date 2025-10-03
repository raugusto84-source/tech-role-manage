import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, UserPlus, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  user_id?: string | null;
  name: string;
  email: string | null;
  phone: string | null;
}

interface InsurancePolicy {
  id: string;
  policy_number: string;
  policy_name: string;
  monthly_fee: number;
}

interface PolicyClient {
  id: string;
  policy_id: string;
  client_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  billing_frequency_type: 'minutes' | 'days' | 'monthly_on_day';
  billing_frequency_value: number;
  next_billing_run: string;
  clients: Client;
  insurance_policies: InsurancePolicy;
}

interface PolicyClientManagerProps {
  onStatsUpdate: () => void;
}

export function PolicyClientManager({ onStatsUpdate }: PolicyClientManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [policyClients, setPolicyClients] = useState<PolicyClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profileCandidates, setProfileCandidates] = useState<Array<{ user_id: string; full_name: string | null; email: string | null; phone: string | null }>>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load policy clients
      const { data: policyClientsData, error: policyClientsError } = await supabase
        .from('policy_clients')
        .select(`
          *,
          clients(id, name, email, phone),
          insurance_policies(id, policy_number, policy_name, monthly_fee)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (policyClientsError) throw policyClientsError;
      setPolicyClients(policyClientsData as PolicyClient[] || []);

      await loadClientsAndPolicies();

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

  const loadClientsAndPolicies = async () => {
    try {
      // Load available clients including user_id for mapping
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, user_id, name, email, phone')
        .order('name');

      if (clientsError) {
        console.error('Clients loading error:', clientsError);
        throw clientsError;
      }
      console.log('Loaded clients:', clientsData?.length || 0);
      setClients(clientsData || []);

      // Load profile-only candidates (role cliente) that are NOT in clients table
      const { data: profileData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .eq('role', 'cliente');

      if (profilesError) {
        console.error('Profiles loading error:', profilesError);
        throw profilesError;
      }

      const clientsUserIds = new Set((clientsData || []).map((c) => c.user_id).filter(Boolean));
      const clientsEmails = new Set((clientsData || []).map((c) => c.email).filter(Boolean));

      const candidates = (profileData || []).filter((p) => {
        const byUserId = p.user_id && !clientsUserIds.has(p.user_id);
        const byEmail = p.email == null || !clientsEmails.has(p.email);
        return byUserId && byEmail;
      });

      setProfileCandidates(candidates as any);

      // Load active policies
      const { data: policiesData, error: policiesError } = await supabase
        .from('insurance_policies')
        .select('id, policy_number, policy_name, monthly_fee')
        .eq('is_active', true)
        .order('policy_name');

      if (policiesError) {
        console.error('Policies loading error:', policiesError);
        throw policiesError;
      }
      console.log('Loaded policies:', policiesData?.length || 0);
      setPolicies(policiesData || []);

    } catch (error: any) {
      console.error('Error loading clients and policies:', error);
      toast({
        title: "Error",
        description: `No se pudieron cargar los clientes y pólizas disponibles: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const resetDialog = () => {
    setSelectedPolicyId('');
    setSelectedClientId('');
    setStartDate(new Date());
    setIsSubmitting(false);
  };

  const handleAssignClient = async () => {
    if (!selectedPolicyId || !selectedClientId) {
      toast({
        title: "Error",
        description: "Debe seleccionar una póliza y un cliente",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      let clientIdToUse = '';

      if (selectedClientId.startsWith('client:')) {
        clientIdToUse = selectedClientId.split(':')[1];
      } else if (selectedClientId.startsWith('profile:')) {
        const profileUserId = selectedClientId.split(':')[1];

        // Try to find existing client linked to this profile
        const { data: existingClient, error: existingErr } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', profileUserId)
          .maybeSingle();
        if (existingErr) console.warn('Existing client check error:', existingErr);

        if (existingClient?.id) {
          clientIdToUse = existingClient.id;
        } else {
          const profile = profileCandidates.find((p) => p.user_id === profileUserId);
          if (!profile) {
            toast({
              title: 'Error',
              description: 'No se encontró el perfil seleccionado',
              variant: 'destructive',
            });
            return;
          }

          // Create client record from profile
          const { data: inserted, error: insertErr } = await supabase
            .from('clients')
            .insert([
              {
                user_id: profile.user_id,
                name: (profile.full_name || profile.email || 'Cliente') as string,
                email: profile.email,
                phone: profile.phone,
                address: '',
                client_number: '',
                created_by: user?.id
              }
            ])
            .select('id')
            .single();

          if (insertErr) throw insertErr;
          clientIdToUse = inserted.id;

          // Refresh lists so the newly created client appears next time
          await loadClientsAndPolicies();
        }
      } else {
        clientIdToUse = selectedClientId; // fallback
      }

      // Check if assignment already exists
      const { data: existingAssignment } = await supabase
        .from('policy_clients')
        .select('id, is_active')
        .eq('policy_id', selectedPolicyId)
        .eq('client_id', clientIdToUse)
        .maybeSingle();

      if (existingAssignment) {
        if (existingAssignment.is_active) {
          toast({
            title: "Información",
            description: "Este cliente ya está asignado a esta póliza",
            variant: "default",
          });
          return;
        } else {
          // Reactivate existing assignment
          const { error: updateError } = await supabase
            .from('policy_clients')
            .update({ is_active: true })
            .eq('id', existingAssignment.id);

          if (updateError) throw updateError;

          toast({
            title: 'Éxito',
            description: 'Cliente reasignado a la póliza correctamente',
          });
        }
      } else {
        // Calculate next billing run - always 1st of next month
        const nextBillingRun = new Date();
        nextBillingRun.setMonth(nextBillingRun.getMonth() + 1);
        nextBillingRun.setDate(1);
        nextBillingRun.setHours(0, 0, 0, 0);

        // Create new assignment with selected start date
        const { error: assignmentError } = await supabase
          .from('policy_clients')
          .insert([
            {
              policy_id: selectedPolicyId,
              client_id: clientIdToUse,
              start_date: startDate?.toISOString().split('T')[0],
              assigned_by: user?.id,
              created_by: user?.id,
              is_active: true,
              billing_frequency_type: 'monthly_on_day',
              billing_frequency_value: 1,
              next_billing_run: nextBillingRun.toISOString(),
            }
          ]);

        if (assignmentError) throw assignmentError;

        // Generate all historical payments from start date to today
        await generateHistoricalPayments(selectedPolicyId, clientIdToUse, startDate || new Date());
      }

      setIsDialogOpen(false);
      resetDialog();
      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error assigning client:', error);
      toast({
        title: 'Error',
        description: 'No se pudo completar la asignación: ' + (error.message || 'Error desconocido'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateHistoricalPayments = async (policyId: string, clientId: string, startDate: Date) => {
    try {
      // Load policy, client and assignment
      const [{ data: policyData }, { data: clientData }, { data: policyClientData }] = await Promise.all([
        supabase.from('insurance_policies').select('monthly_fee, policy_name').eq('id', policyId).maybeSingle(),
        supabase.from('clients').select('name, email').eq('id', clientId).maybeSingle(),
        supabase.from('policy_clients').select('id, start_date, next_billing_run').eq('policy_id', policyId).eq('client_id', clientId).eq('is_active', true).maybeSingle(),
      ]);

      if (!policyData || !clientData || !policyClientData) {
        console.error('Missing data for payment generation', { policyData, clientData, policyClientData });
        return;
      }

      const today = new Date();
      const policyStart = new Date(startDate);
      
      // Fetch existing payments to prevent duplicates
      const { data: existing } = await supabase
        .from('policy_payments')
        .select('payment_month, payment_year')
        .eq('policy_client_id', policyClientData.id);

      const existingSet = new Set((existing || []).map((p: any) => `${p.payment_year}-${p.payment_month}`));

      const paymentsToCreate: any[] = [];
      const notificationsToCreate: any[] = [];

      // Start from policy start month
      let iterMonth = policyStart.getMonth() + 1;
      let iterYear = policyStart.getFullYear();

      // Generate payments for each month where day 1 has passed
      while (true) {
        const firstOfMonth = new Date(iterYear, iterMonth - 1, 1);
        
        // Stop if this month's 1st hasn't arrived yet
        if (firstOfMonth > today) {
          break;
        }

        const monthKey = `${iterYear}-${iterMonth}`;
        if (!existingSet.has(monthKey)) {
          const dueDate = new Date(iterYear, iterMonth - 1, 5).toISOString().split('T')[0];
          paymentsToCreate.push({
            policy_client_id: policyClientData.id,
            payment_month: iterMonth,
            payment_year: iterYear,
            amount: policyData.monthly_fee,
            account_type: 'no_fiscal',
            due_date: dueDate,
            is_paid: false,
            payment_status: 'pendiente',
          });
          notificationsToCreate.push({
            policy_client_id: policyClientData.id,
            client_name: clientData.name,
            client_email: clientData.email,
            policy_name: policyData.policy_name,
            amount: policyData.monthly_fee,
            due_date: dueDate,
            collection_type: 'policy_payment',
            status: 'pending',
            created_by: user?.id,
            order_id: null,
            order_number: null,
            balance: 0,
          });
        }

        // Move to next month
        iterMonth++;
        if (iterMonth > 12) {
          iterMonth = 1;
          iterYear++;
        }
      }

      // Insert all payments
      if (paymentsToCreate.length > 0) {
        const { error: paymentError } = await supabase.from('policy_payments').insert(paymentsToCreate);
        if (paymentError) throw paymentError;
      }

      // Insert notifications
      if (notificationsToCreate.length > 0) {
        const { error: notificationError } = await supabase.from('pending_collections').insert(notificationsToCreate as any);
        if (notificationError) console.error('Error creating notifications:', notificationError);
      }

      const createdCount = paymentsToCreate.length;
      console.log(`Generated ${createdCount} payment(s) for current and next month`);
      toast({
        title: 'Cobros generados',
        description: `Se crearon ${createdCount} cobro${createdCount > 1 ? 's' : ''} (mes actual${createdCount > 1 ? ' y siguiente' : ''})`,
      });
    } catch (error) {
      console.error('Error in generateHistoricalPayments:', error);
      throw error;
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('¿Estás seguro de que quieres remover esta asignación?')) return;

    try {
      const { error } = await supabase
        .from('policy_clients')
        .update({ is_active: false })
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Asignación removida correctamente",
      });

      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error removing assignment:', error);
      toast({
        title: "Error",
        description: "No se pudo remover la asignación",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  if (loading) {
    return <div>Cargando asignaciones de clientes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Asignación de Clientes a Pólizas</h2>
          <p className="text-muted-foreground">
            Asigna clientes a pólizas de seguros para activar servicios automáticos
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetDialog();
              setIsDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Asignar Cliente
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Asignar Cliente a Póliza</DialogTitle>
              <DialogDescription>
                Selecciona una póliza y un cliente para crear la asignación
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="policy_id">Póliza de Seguro *</Label>
                <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar póliza..." />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map((policy) => (
                      <SelectItem key={policy.id} value={policy.id}>
                        {policy.policy_name} - {formatCurrency(policy.monthly_fee)}/mes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_id">Cliente *</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length > 0 && (
                      <>
                        {clients.map((client) => (
                          <SelectItem key={`client:${client.id}`} value={`client:${client.id}`}>
                            {client.name} - {client.email}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {profileCandidates.length > 0 && (
                      <>
                        {clients.length > 0 && <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Usuarios sin registro</div>}
                        {profileCandidates.map((profile) => (
                          <SelectItem key={`profile:${profile.user_id}`} value={`profile:${profile.user_id}`}>
                            {profile.full_name || profile.email} - {profile.email}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Fecha de Inicio del Contrato *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Se generarán los cobros mensuales desde esta fecha hasta hoy
                </p>
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="bg-muted/50 p-3 rounded-md">
                  <h4 className="font-medium text-sm mb-1">Configuración de Cobro</h4>
                  <p className="text-sm text-muted-foreground">
                    Los pagos se generarán automáticamente el día 1 de cada mes
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  resetDialog();
                }}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAssignClient}
                  disabled={!selectedPolicyId || !selectedClientId || isSubmitting}
                >
                  {isSubmitting ? 'Asignando...' : 'Asignar Cliente'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes Asignados</CardTitle>
          <CardDescription>
            Lista de clientes asignados a pólizas de seguros activas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policyClients.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay clientes asignados. Crea la primera asignación.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Cuota Mensual</TableHead>
                  <TableHead>Frecuencia de Cobro</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policyClients.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{assignment.clients.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {assignment.clients.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{assignment.insurance_policies.policy_name}</div>
                        <div className="text-sm text-muted-foreground">
                          #{assignment.insurance_policies.policy_number}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(assignment.insurance_policies.monthly_fee)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <Badge variant="outline" className="mb-1">
                          {assignment.billing_frequency_type === 'minutes' ? `${assignment.billing_frequency_value} min` :
                           assignment.billing_frequency_type === 'days' ? `${assignment.billing_frequency_value} días` :
                           `Día ${assignment.billing_frequency_value} del mes`}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={assignment.is_active ? "default" : "secondary"}>
                        {assignment.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          disabled={!assignment.is_active}
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