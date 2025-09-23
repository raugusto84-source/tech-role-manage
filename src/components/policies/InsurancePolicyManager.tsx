import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Shield, DollarSign } from "lucide-react";
interface InsurancePolicy {
  id: string;
  policy_number: string;
  policy_name: string;
  description: string;
  monthly_fee: number;
  service_discount_percentage: number;
  free_services: boolean;
  products_generate_cashback: boolean;
  cashback_percentage: number;
  is_active: boolean;
  created_at: string;
  policy_clients: any[];
}
interface InsurancePolicyManagerProps {
  onStatsUpdate: () => void;
}
export function InsurancePolicyManager({
  onStatsUpdate
}: InsurancePolicyManagerProps) {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null);
  const [formData, setFormData] = useState({
    policy_name: '',
    description: '',
    monthly_fee: 0,
    service_discount_percentage: 0,
    free_services: false,
    products_generate_cashback: true,
    cashback_percentage: 2.0,
    is_active: true
  });
  useEffect(() => {
    loadPolicies();
  }, []);
  const loadPolicies = async () => {
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from('insurance_policies').select(`
          *,
          policy_clients(count)
        `).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setPolicies(data || []);
    } catch (error: any) {
      console.error('Error loading policies:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las pólizas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPolicy) {
        const {
          error
        } = await supabase.from('insurance_policies').update({
          ...formData,
          updated_at: new Date().toISOString()
        }).eq('id', editingPolicy.id);
        if (error) throw error;
        toast({
          title: "Éxito",
          description: "Póliza actualizada correctamente"
        });
      } else {
        const {
          error
        } = await supabase.from('insurance_policies').insert({
          ...formData,
          policy_number: `POL-${Date.now()}`
        });
        if (error) throw error;
        toast({
          title: "Éxito",
          description: "Póliza creada correctamente"
        });
      }
      setIsDialogOpen(false);
      setEditingPolicy(null);
      resetForm();
      loadPolicies();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error saving policy:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la póliza",
        variant: "destructive"
      });
    }
  };
  const handleEdit = (policy: InsurancePolicy) => {
    setEditingPolicy(policy);
    setFormData({
      policy_name: policy.policy_name,
      description: policy.description || '',
      monthly_fee: policy.monthly_fee,
      service_discount_percentage: policy.service_discount_percentage,
      free_services: policy.free_services,
      products_generate_cashback: policy.products_generate_cashback,
      cashback_percentage: policy.cashback_percentage,
      is_active: policy.is_active
    });
    setIsDialogOpen(true);
  };
  const handleDelete = async (policyId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta póliza?')) return;
    try {
      const {
        error
      } = await supabase.from('insurance_policies').delete().eq('id', policyId);
      if (error) throw error;
      toast({
        title: "Éxito",
        description: "Póliza eliminada correctamente"
      });
      loadPolicies();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error deleting policy:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la póliza",
        variant: "destructive"
      });
    }
  };
  const resetForm = () => {
    setFormData({
      policy_name: '',
      description: '',
      monthly_fee: 0,
      service_discount_percentage: 0,
      free_services: false,
      products_generate_cashback: true,
      cashback_percentage: 2.0,
      is_active: true
    });
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };
  if (loading) {
    return <div>Cargando pólizas...</div>;
  }
  return <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Pólizas</h2>
          <p className="text-muted-foreground">
            Administra las pólizas de seguros y sus configuraciones
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
            setEditingPolicy(null);
            resetForm();
            setIsDialogOpen(true);
          }}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Póliza
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPolicy ? 'Editar Póliza' : 'Nueva Póliza'}
              </DialogTitle>
              <DialogDescription>
                {editingPolicy ? 'Modifica los datos de la póliza seleccionada' : 'Crea una nueva póliza de seguros con sus configuraciones'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="policy_name">Nombre de la Póliza *</Label>
                  <Input id="policy_name" value={formData.policy_name} onChange={e => setFormData({
                  ...formData,
                  policy_name: e.target.value
                })} placeholder="Póliza Premium" required />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="monthly_fee">Cuota Mensual *</Label>
                  <Input id="monthly_fee" type="number" step="0.01" min="0" value={formData.monthly_fee} onChange={e => setFormData({
                  ...formData,
                  monthly_fee: parseFloat(e.target.value) || 0
                })} placeholder="1500.00" required />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" value={formData.description} onChange={e => setFormData({
                ...formData,
                description: e.target.value
              })} placeholder="Descripción detallada de la póliza y sus beneficios" rows={3} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service_discount_percentage">Descuento en Servicios (%)</Label>
                  <Input id="service_discount_percentage" type="number" step="0.1" min="0" max="100" value={formData.service_discount_percentage} onChange={e => setFormData({
                  ...formData,
                  service_discount_percentage: parseFloat(e.target.value) || 0
                })} placeholder="15.0" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cashback_percentage">Cashback en Productos (%)</Label>
                  <Input id="cashback_percentage" type="number" step="0.1" min="0" max="100" value={formData.cashback_percentage} onChange={e => setFormData({
                  ...formData,
                  cashback_percentage: parseFloat(e.target.value) || 0
                })} placeholder="2.0" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch id="free_services" checked={formData.free_services} onCheckedChange={checked => setFormData({
                  ...formData,
                  free_services: checked
                })} />
                  <Label htmlFor="free_services">Servicios Gratuitos</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch id="products_generate_cashback" checked={formData.products_generate_cashback} onCheckedChange={checked => setFormData({
                  ...formData,
                  products_generate_cashback: checked
                })} />
                  <Label htmlFor="products_generate_cashback">Productos Generan Cashback</Label>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="is_active" checked={formData.is_active} onCheckedChange={checked => setFormData({
                ...formData,
                is_active: checked
              })} />
                <Label htmlFor="is_active">Póliza Activa</Label>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                setIsDialogOpen(false);
                setEditingPolicy(null);
                resetForm();
              }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingPolicy ? 'Actualizar' : 'Crear'} Póliza
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pólizas Registradas</CardTitle>
          <CardDescription>
            Lista de todas las pólizas de seguros configuradas en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay pólizas registradas. Crea la primera póliza para comenzar.
              </p>
            </div> : <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Cuota Mensual</TableHead>
                  <TableHead>Servicios</TableHead>
                  <TableHead>Cashback</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map(policy => <TableRow key={policy.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{policy.policy_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {policy.policy_number}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(policy.monthly_fee)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {policy.free_services ? <Badge variant="default">Gratuitos</Badge> : policy.service_discount_percentage > 0 ? <Badge variant="secondary">
                            {policy.service_discount_percentage}% desc.
                          </Badge> : <Badge variant="outline">Precio normal</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {policy.products_generate_cashback ? <Badge variant="default">
                          <DollarSign className="h-3 w-3 mr-1" />
                          {policy.cashback_percentage}%
                        </Badge> : <Badge variant="outline">Sin cashback</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {policy.policy_clients?.length || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={policy.is_active ? "default" : "secondary"}>
                        {policy.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(policy)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(policy.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>}
        </CardContent>
      </Card>
    </div>;
}