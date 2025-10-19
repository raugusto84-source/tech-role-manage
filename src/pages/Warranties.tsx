import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, Filter, ExternalLink, Check, X, Clock, AlertTriangle, Calendar, RefreshCw } from "lucide-react";
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
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { WarrantyManager } from "@/components/warranty/WarrantyManager";

interface WarrantySummary {
  id: string;
  order_number: string;
  client_name: string;
  service_name: string;
  warranty_start_date: string;
  warranty_end_date: string;
  warranty_status: string;
  days_remaining: number;
  order_id: string;
}

interface SerialSearchResult {
  id: string;
  service_name: string;
  supplier: string;
  order_number: string;
  order_id: string;
  serial_number: string;
}

export default function Warranties() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Warranty List States
  const [warranties, setWarranties] = useState<WarrantySummary[]>([]);
  const [warrantyStats, setWarrantyStats] = useState({
    total: 0,
    active: 0,
    expiring_soon: 0,
    expired: 0,
    claimed: 0
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Serial Search States  
  const [serialSearch, setSerialSearch] = useState('');
  const [serialSearchResults, setSerialSearchResults] = useState<SerialSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    loadWarrantyData();
  }, []);

  const loadWarrantyData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadWarrantyList(),
        calculateWarrantyStats()
      ]);
    } catch (error) {
      console.error('Error loading warranty data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de garantías",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWarrantyList = async () => {
    // Generate warranty summary from order_items with warranties
    const { data } = await supabase
      .from('order_items')
      .select(`
        *,
        orders!inner(order_number, clients!inner(name))
      `)
      .not('warranty_start_date', 'is', null)
      .not('warranty_end_date', 'is', null)
      .order('warranty_end_date', { ascending: false });

    if (data) {
      const warrantySummary = data.map((item: any) => {
        const today = new Date();
        const endDate = new Date(item.warranty_end_date);
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let status = 'active';
        if (daysRemaining < 0) status = 'expired';
        else if (daysRemaining <= 30) status = 'expiring_soon';

        return {
          id: item.id,
          order_number: item.orders.order_number,
          client_name: item.orders.clients.name,
          service_name: item.service_name,
          warranty_start_date: item.warranty_start_date,
          warranty_end_date: item.warranty_end_date,
          warranty_status: status,
          days_remaining: daysRemaining,
          order_id: item.order_id
        };
      });
      
      setWarranties(warrantySummary);
    }
  };

  const calculateWarrantyStats = () => {
    const total = warranties.length;
    const active = warranties.filter(w => w.warranty_status === 'active').length;
    const expiring_soon = warranties.filter(w => w.warranty_status === 'expiring_soon').length;
    const expired = warranties.filter(w => w.warranty_status === 'expired').length;
    
    setWarrantyStats({
      total,
      active,
      expiring_soon,
      expired,
      claimed: 0 // This would need a warranty_claims table
    });
  };

  const getWarrantyStatusBadge = (status: string, daysRemaining: number) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-50 text-green-700">
            Activa ({daysRemaining} días)
          </Badge>
        );
      case 'expiring_soon':
        return (
          <Badge variant="destructive" className="bg-yellow-50 text-yellow-700">
            Por Vencer ({daysRemaining} días)
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="destructive">
            Vencida ({Math.abs(daysRemaining)} días)
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredWarranties = warranties.filter(warranty =>
    warranty.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warranty.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warranty.service_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const searchBySerial = async (serialNumber: string) => {
    if (!serialNumber.trim()) {
      setSerialSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          service_name,
          serial_number,
          supplier_name,
          orders!inner (
            order_number,
            clients!inner (
              name
            )
          )
        `)
        .ilike('serial_number', `%${serialNumber}%`)
        .not('serial_number', 'is', null);

      if (error) throw error;

      const results = data?.map(item => ({
        id: item.id,
        service_name: item.service_name,
        supplier: item.supplier_name || 'No especificado',
        order_number: item.orders.order_number,
        order_id: item.order_id,
        serial_number: item.serial_number
      })) || [];

      setSerialSearchResults(results);
    } catch (error) {
      console.error('Error searching by serial number:', error);
      toast({
        title: "Error",
        description: "Error al buscar por número de serie",
        variant: "destructive"
      });
    } finally {
      setSearchLoading(false);
    }
  };

  // Remove unused functions
  const handleClaimAction = async () => {};
  const openOrder = () => {};
  const getStatusBadge = () => {};
  const getWarrantyStatusBadge2 = () => {};

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
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gestión de Garantías</h1>
              <p className="text-muted-foreground">
                Administra y consulta las garantías de productos y servicios
              </p>
            </div>
          </div>
          <Button onClick={loadWarrantyData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        <Tabs defaultValue="search" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">Búsqueda por Serie</TabsTrigger>
            <TabsTrigger value="list">Lista de Garantías</TabsTrigger>
            <TabsTrigger value="manage">Configurar Garantías</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Buscar por Número de Serie</CardTitle>
                <CardDescription>
                  Ingresa un número de serie para encontrar el artículo y proveedor asociado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Input
                    placeholder="Número de serie..."
                    value={serialSearch}
                    onChange={(e) => setSerialSearch(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        searchBySerial(serialSearch);
                      }
                    }}
                  />
                  <Button 
                    onClick={() => searchBySerial(serialSearch)}
                    disabled={searchLoading || !serialSearch.trim()}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </Button>
                </div>

                {serialSearchResults.length > 0 && (
                  <div className="mt-4 space-y-4">
                    <h3 className="text-lg font-semibold">Resultados de búsqueda</h3>
                    {serialSearchResults.map((result, index) => (
                      <Card key={index} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Artículo</p>
                            <p className="font-medium">{result.service_name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Proveedor</p>
                            <p className="font-medium">{result.supplier}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Orden</p>
                            <Button 
                              variant="link" 
                              className="p-0 h-auto font-medium text-primary"
                              onClick={() => navigate(`/ordenes?order=${result.order_number}`)}
                            >
                              {result.order_number}
                              <ExternalLink className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {searchLoading && (
                  <div className="mt-4 text-center text-muted-foreground">
                    Buscando...
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            {/* Warranty Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Garantías</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{warrantyStats.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Activas</CardTitle>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{warrantyStats.active}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{warrantyStats.expiring_soon}</div>
                  <p className="text-xs text-muted-foreground">Próximos 30 días</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{warrantyStats.expired}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Reclamadas</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{warrantyStats.claimed}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Lista de Garantías</CardTitle>
                <CardDescription>Todas las garantías activas y su estado actual</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 mb-4">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar garantías..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWarranties.map((warranty) => (
                      <TableRow key={warranty.id}>
                        <TableCell className="font-medium">
                          <Button 
                            variant="link" 
                            className="p-0 h-auto font-medium text-primary"
                            onClick={() => navigate(`/ordenes?order=${warranty.order_number}`)}
                          >
                            {warranty.order_number}
                            <ExternalLink className="h-4 w-4 ml-1" />
                          </Button>
                        </TableCell>
                        <TableCell>{warranty.client_name}</TableCell>
                        <TableCell>{warranty.service_name}</TableCell>
                        <TableCell>
                          {new Date(warranty.warranty_start_date).toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell>
                          {new Date(warranty.warranty_end_date).toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell>
                          {getWarrantyStatusBadge(warranty.warranty_status, warranty.days_remaining)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage" className="space-y-4">
            <WarrantyManager />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}