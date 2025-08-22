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
  name: string;
  email: string;
  phone: string;
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

      // Load available clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, email, phone')
        .order('name');

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Load active policies
      const { data: policiesData, error: policiesError } = await supabase
        .from('insurance_policies')
        .select('id, policy_number, policy_name, monthly_fee')
        .eq('is_active', true)
        .order('policy_name');

      if (policiesError) throw policiesError;
      setPolicies(policiesData || []);

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
      // Check if assignment already exists
      const { data: existing, error: checkError } = await supabase
        .from('policy_clients')
        .select('id')
        .eq('policy_id', selectedPolicyId)
        .eq('client_id', selectedClientId)
        .eq('is_active', true)
        .single();

      if (existing) {
        toast({
          title: "Error", 
          description: "Este cliente ya está asignado a esta póliza",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('policy_clients')
        .insert([{
          policy_id: selectedPolicyId,
          client_id: selectedClientId,
          assigned_by: user?.id,
          is_active: true,
        }]);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Cliente asignado a la póliza correctamente",
      });

      setIsDialogOpen(false);
      setSelectedPolicyId('');
      setSelectedClientId('');
      loadData();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error assigning client:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar el cliente a la póliza",
        variant: "destructive",
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
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} - {client.email}
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