import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, Search, Filter, ExternalLink, Check, X, Clock, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface WarrantyClaim {
  id: string;
  order_id: string;
  client_id: string;
  order_item_id: string;
  claim_reason: string;
  claim_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  order_number: string;
  client_name: string;
  service_name: string;
  warranty_end_date: string;
  days_remaining: number;
}

interface WarrantyStats {
  total_claims: number;
  pending_claims: number;
  approved_claims: number;
  rejected_claims: number;
}

export default function Warranties() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [stats, setStats] = useState<WarrantyStats>({
    total_claims: 0,
    pending_claims: 0,
    approved_claims: 0,
    rejected_claims: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedClaim, setSelectedClaim] = useState<WarrantyClaim | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    loadWarrantyData();
  }, []);

  const loadWarrantyData = async () => {
    try {
      setLoading(true);

      // Load warranty claims with related data
      const { data: claimsData, error } = await supabase
        .from('warranty_claims')
        .select(`
          *,
          orders (
            order_number,
            clients (name)
          ),
          order_items (
            service_name,
            warranty_end_date
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedClaims = claimsData.map((claim: any) => {
        const warrantyEndDate = new Date(claim.order_items.warranty_end_date);
        const now = new Date();
        const daysRemaining = Math.ceil((warrantyEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: claim.id,
          order_id: claim.order_id,
          client_id: claim.client_id,
          order_item_id: claim.order_item_id,
          claim_reason: claim.claim_reason,
          claim_status: claim.claim_status,
          created_at: claim.created_at,
          resolved_at: claim.resolved_at,
          resolution_notes: claim.resolution_notes,
          order_number: claim.orders.order_number,
          client_name: claim.orders.clients.name,
          service_name: claim.order_items.service_name,
          warranty_end_date: claim.order_items.warranty_end_date,
          days_remaining: daysRemaining,
        };
      });

      setClaims(processedClaims);

      // Calculate stats
      const totalClaims = processedClaims.length;
      const pendingClaims = processedClaims.filter(c => c.claim_status === 'pending').length;
      const approvedClaims = processedClaims.filter(c => c.claim_status === 'approved').length;
      const rejectedClaims = processedClaims.filter(c => c.claim_status === 'rejected').length;

      setStats({
        total_claims: totalClaims,
        pending_claims: pendingClaims,
        approved_claims: approvedClaims,
        rejected_claims: rejectedClaims,
      });

    } catch (error) {
      console.error('Error loading warranty data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de garantías",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClaimAction = async (claimId: string, action: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('warranty_claims')
        .update({
          claim_status: action,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes || `Reclamación ${action === 'approved' ? 'aprobada' : 'rechazada'} por el administrador`,
        })
        .eq('id', claimId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Reclamación ${action === 'approved' ? 'aprobada' : 'rechazada'} correctamente`,
      });

      setSelectedClaim(null);
      setResolutionNotes('');
      loadWarrantyData();
    } catch (error) {
      console.error('Error updating claim:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la reclamación",
        variant: "destructive"
      });
    }
  };

  const openOrder = (orderId: string) => {
    // Implement navigation to order details
    navigate(`/orders?id=${orderId}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20"><Check className="w-3 h-3 mr-1" />Aprobada</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><X className="w-3 h-3 mr-1" />Rechazada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getWarrantyStatusBadge = (daysRemaining: number) => {
    if (daysRemaining < 0) {
      return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Vencida</Badge>;
    } else if (daysRemaining <= 7) {
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Por vencer</Badge>;
    } else {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Vigente</Badge>;
    }
  };

  const filteredClaims = claims.filter(claim => {
    const matchesSearch = 
      claim.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.service_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || claim.claim_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Cargando garantías...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestión de Garantías</h1>
            <p className="text-muted-foreground">
              Administra reclamaciones y garantías de servicios
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Reclamaciones</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total_claims}</p>
                </div>
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold text-foreground">{stats.pending_claims}</p>
                </div>
                <Clock className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Aprobadas</p>
                  <p className="text-2xl font-bold text-foreground">{stats.approved_claims}</p>
                </div>
                <Check className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Rechazadas</p>
                  <p className="text-2xl font-bold text-foreground">{stats.rejected_claims}</p>
                </div>
                <X className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por orden, cliente o servicio..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="w-full md:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="approved">Aprobada</SelectItem>
                    <SelectItem value="rejected">Rechazada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claims Table */}
        <Card>
          <CardHeader>
            <CardTitle>Reclamaciones de Garantía</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Garantía</TableHead>
                  <TableHead>Fecha Reclamación</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">
                      <Button
                        variant="link"
                        className="p-0 h-auto font-medium text-primary"
                        onClick={() => openOrder(claim.order_id)}
                      >
                        {claim.order_number}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </TableCell>
                    <TableCell>{claim.client_name}</TableCell>
                    <TableCell>{claim.service_name}</TableCell>
                    <TableCell>{getStatusBadge(claim.claim_status)}</TableCell>
                    <TableCell>{getWarrantyStatusBadge(claim.days_remaining)}</TableCell>
                    <TableCell>{new Date(claim.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {claim.claim_status === 'pending' && (
                          <>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  className="bg-success hover:bg-success/90"
                                  onClick={() => setSelectedClaim(claim)}
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Aprobar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Aprobar Reclamación</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    ¿Estás seguro de que deseas aprobar esta reclamación de garantía?
                                    <div className="mt-4">
                                      <Input
                                        placeholder="Notas de resolución (opcional)"
                                        value={resolutionNotes}
                                        onChange={(e) => setResolutionNotes(e.target.value)}
                                      />
                                    </div>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleClaimAction(claim.id, 'approved')}
                                    className="bg-success hover:bg-success/90"
                                  >
                                    Aprobar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => setSelectedClaim(claim)}
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Rechazar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Rechazar Reclamación</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    ¿Estás seguro de que deseas rechazar esta reclamación de garantía?
                                    <div className="mt-4">
                                      <Input
                                        placeholder="Motivo de rechazo (requerido)"
                                        value={resolutionNotes}
                                        onChange={(e) => setResolutionNotes(e.target.value)}
                                      />
                                    </div>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleClaimAction(claim.id, 'rejected')}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Rechazar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openOrder(claim.order_id)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Ver Orden
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredClaims.length === 0 && (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No se encontraron reclamaciones de garantía</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}