import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, UserPlus, Calendar } from "lucide-react";

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
        .order('created_at', { ascending: false });

      if (policyClientsError) throw policyClientsError;
      setPolicyClients(policyClientsData || []);

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
                client_number: ''
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

      // Upsert assignment to avoid duplicates and reactivate if exists
      const { error } = await supabase
        .from('policy_clients')
        .upsert([
          {
            policy_id: selectedPolicyId,
            client_id: clientIdToUse,
            assigned_by: user?.id,
            is_active: true,
          }
        ], { onConflict: 'policy_id,client_id' });

      if (error) throw error;

      // El primer pago se genera automáticamente mediante un trigger en la base de datos


      toast({
        title: 'Éxito',
        description: 'Cliente asignado a la póliza correctamente',
      });

      setIsDialogOpen(false);
      setSelectedPolicyId('');
      setSelectedClientId('');
      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error assigning client:', error);
      toast({
        title: 'Error',
        description: 'No se pudo asignar el cliente a la póliza',
        variant: 'destructive',
      });
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX');
  };

  if (loading) {
    return <div>Cargando asignaciones...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Asignación de Clientes</h2>
          <p className="text-muted-foreground">
            Asigna clientes a pólizas de seguros para activar beneficios
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (open) {
            // Clear current selections and refresh data when dialog opens
            setSelectedPolicyId('');
            setSelectedClientId('');
            console.log('Dialog opened, refreshing clients and policies...');
            loadClientsAndPolicies();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Asignar Cliente
            </Button>
          </DialogTrigger>
          
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Asignar Cliente a Póliza</DialogTitle>
              <DialogDescription>
                Selecciona la póliza y el cliente para crear la asignación
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Póliza</label>
                <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar póliza" />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map((policy) => (
                      <SelectItem key={policy.id} value={policy.id}>
                        {policy.policy_name} - {formatCurrency(policy.monthly_fee)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cliente</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={`client-${client.id}`} value={`client:${client.id}`}>
                        {client.name} - {client.email}
                      </SelectItem>
                    ))}
                    {profileCandidates.map((p) => (
                      <SelectItem key={`profile-${p.user_id}`} value={`profile:${p.user_id}`}>
                        {(p.full_name || p.email) ?? 'Cliente'} - {p.email} (perfil)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleAssignClient}>
                  Asignar Cliente
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
            Lista de clientes asignados a pólizas con sus detalles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policyClients.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay clientes asignados a pólizas. Asigna el primer cliente para comenzar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Cuota Mensual</TableHead>
                  <TableHead>Fecha de Inicio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policyClients.filter(pc => pc.is_active).map((policyClient) => (
                  <TableRow key={policyClient.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{policyClient.clients.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {policyClient.clients.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{policyClient.insurance_policies.policy_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {policyClient.insurance_policies.policy_number}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(policyClient.insurance_policies.monthly_fee)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(policyClient.start_date)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={policyClient.is_active ? "default" : "secondary"}>
                        {policyClient.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAssignment(policyClient.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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