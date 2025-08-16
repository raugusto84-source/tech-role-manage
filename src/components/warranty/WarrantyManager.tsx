import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Clock, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';

interface WarrantyItem {
  id: string;
  order_id: string;
  order_number: string;
  service_name: string;
  warranty_start_date: string;
  warranty_end_date: string;
  warranty_conditions: string;
  client_name: string;
  days_remaining: number;
  status: string;
}

interface WarrantyClaim {
  id: string;
  order_item_id: string;
  claim_description: string;
  claim_type: string;
  status: string;
  created_at: string;
  service_name: string;
  order_number: string;
  client_name: string;
}

export function WarrantyManager() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [warranties, setWarranties] = useState<WarrantyItem[]>([]);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [selectedClaim, setSelectedClaim] = useState<WarrantyClaim | null>(null);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);

  useEffect(() => {
    loadWarranties();
    loadClaims();
  }, []);

  const loadWarranties = async () => {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id,
          service_name,
          warranty_start_date,
          warranty_end_date,
          warranty_conditions,
          orders!inner(
            id,
            order_number,
            status,
            clients!inner(
              name
            )
          )
        `)
        .not('warranty_start_date', 'is', null)
        .eq('orders.status', 'finalizada');

      if (error) throw error;

      const processedWarranties = data?.map(item => {
        const endDate = new Date(item.warranty_end_date);
        const today = new Date();
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: item.id,
          order_id: item.orders.id,
          order_number: item.orders.order_number,
          service_name: item.service_name,
          warranty_start_date: item.warranty_start_date,
          warranty_end_date: item.warranty_end_date,
          warranty_conditions: item.warranty_conditions || 'Sin condiciones específicas',
          client_name: item.orders.clients.name,
          days_remaining: daysRemaining,
          status: daysRemaining > 0 ? 'vigente' : 'vencida'
        };
      }) || [];

      setWarranties(processedWarranties);
    } catch (error) {
      console.error('Error loading warranties:', error);
      toast({
        title: "Error",
        description: "Error al cargar las garantías",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadClaims = async () => {
    try {
      const { data, error } = await supabase
        .from('warranty_claims')
        .select(`
          *,
          order_items!inner(
            service_name,
            orders!inner(
              order_number,
              clients!inner(
                name
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedClaims = data?.map(claim => ({
        id: claim.id,
        order_item_id: claim.order_item_id,
        claim_description: claim.claim_description,
        claim_type: claim.claim_type,
        status: claim.status,
        created_at: claim.created_at,
        service_name: claim.order_items.service_name,
        order_number: claim.order_items.orders.order_number,
        client_name: claim.order_items.orders.clients.name
      })) || [];

      setClaims(processedClaims);
    } catch (error) {
      console.error('Error loading claims:', error);
    }
  };

  const updateClaimStatus = async (claimId: string, newStatus: string, resolutionNotes?: string) => {
    try {
      const { error } = await supabase
        .from('warranty_claims')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile?.user_id,
          resolution_notes: resolutionNotes
        })
        .eq('id', claimId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Reclamo ${newStatus} exitosamente`
      });

      loadClaims();
      setClaimDialogOpen(false);
    } catch (error) {
      console.error('Error updating claim:', error);
      toast({
        title: "Error",
        description: "Error al actualizar el reclamo",
        variant: "destructive"
      });
    }
  };

  const getWarrantyStatusBadge = (status: string, daysRemaining: number) => {
    if (status === 'vencida') {
      return <Badge variant="destructive">Vencida</Badge>;
    } else if (daysRemaining <= 7) {
      return <Badge variant="secondary">Por vencer</Badge>;
    } else {
      return <Badge variant="default">Vigente</Badge>;
    }
  };

  const getClaimStatusBadge = (status: string) => {
    const statusMap = {
      pendiente: { variant: "secondary" as const, label: "Pendiente" },
      en_revision: { variant: "default" as const, label: "En Revisión" },
      aprobado: { variant: "default" as const, label: "Aprobado" },
      rechazado: { variant: "destructive" as const, label: "Rechazado" },
      resuelto: { variant: "default" as const, label: "Resuelto" }
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { variant: "secondary" as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const activeWarranties = warranties.filter(w => w.status === 'vigente');
  const expiredWarranties = warranties.filter(w => w.status === 'vencida');

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">Cargando garantías...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestión de Garantías
          </CardTitle>
          <CardDescription>
            Gestiona las garantías de servicios y artículos entregados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">Garantías Vigentes ({activeWarranties.length})</TabsTrigger>
              <TabsTrigger value="expired">Garantías Vencidas ({expiredWarranties.length})</TabsTrigger>
              <TabsTrigger value="claims">Reclamos ({claims.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Días Restantes</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeWarranties.map((warranty) => (
                    <TableRow key={warranty.id}>
                      <TableCell className="font-medium">{warranty.order_number}</TableCell>
                      <TableCell>{warranty.client_name}</TableCell>
                      <TableCell>{warranty.service_name}</TableCell>
                      <TableCell>{new Date(warranty.warranty_start_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(warranty.warranty_end_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {warranty.days_remaining} días
                        </div>
                      </TableCell>
                      <TableCell>{getWarrantyStatusBadge(warranty.status, warranty.days_remaining)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="expired" className="mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiredWarranties.map((warranty) => (
                    <TableRow key={warranty.id}>
                      <TableCell className="font-medium">{warranty.order_number}</TableCell>
                      <TableCell>{warranty.client_name}</TableCell>
                      <TableCell>{warranty.service_name}</TableCell>
                      <TableCell>{new Date(warranty.warranty_end_date).toLocaleDateString()}</TableCell>
                      <TableCell>{getWarrantyStatusBadge(warranty.status, warranty.days_remaining)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="claims" className="mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Tipo de Reclamo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell className="font-medium">{claim.order_number}</TableCell>
                      <TableCell>{claim.client_name}</TableCell>
                      <TableCell>{claim.service_name}</TableCell>
                      <TableCell className="capitalize">{claim.claim_type.replace('_', ' ')}</TableCell>
                      <TableCell>{getClaimStatusBadge(claim.status)}</TableCell>
                      <TableCell>{new Date(claim.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Dialog open={claimDialogOpen && selectedClaim?.id === claim.id} onOpenChange={(open) => {
                          setClaimDialogOpen(open);
                          if (open) setSelectedClaim(claim);
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">Ver</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reclamo de Garantía</DialogTitle>
                              <DialogDescription>
                                Gestionar reclamo para orden {claim.order_number}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Descripción del Reclamo</Label>
                                <p className="text-sm mt-1">{claim.claim_description}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Tipo</Label>
                                  <p className="text-sm mt-1 capitalize">{claim.claim_type.replace('_', ' ')}</p>
                                </div>
                                <div>
                                  <Label>Estado Actual</Label>
                                  <div className="mt-1">{getClaimStatusBadge(claim.status)}</div>
                                </div>
                              </div>
                              {claim.status === 'pendiente' && (
                                <div className="flex gap-2">
                                  <Button 
                                    onClick={() => updateClaimStatus(claim.id, 'aprobado')}
                                    className="flex-1"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Aprobar
                                  </Button>
                                  <Button 
                                    variant="destructive"
                                    onClick={() => updateClaimStatus(claim.id, 'rechazado')}
                                    className="flex-1"
                                  >
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    Rechazar
                                  </Button>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}