import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTimeMexico } from "@/utils/dateUtils";
import { History, Eye, Filter, Search, Trash2, DollarSign, ShoppingCart, CreditCard, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DeletionRecord {
  id: string;
  table_name: string;
  record_id: string;
  record_data: any;
  deletion_reason: string;
  deleted_by: string;
  deleted_at: string;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export function DeletionHistoryPanel() {
  const [deletionHistory, setDeletionHistory] = useState<DeletionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState<DeletionRecord | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    loadDeletionHistory();
  }, []);

  const loadDeletionHistory = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('deletion_history')
        .select('*')
        .order('deleted_at', { ascending: false });

      if (error) throw error;

      // Get user profiles separately
      const userIds = [...new Set(data?.map(record => record.deleted_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      // Map profiles to records
      const enrichedData = data?.map(record => ({
        ...record,
        profiles: profiles?.find(p => p.user_id === record.deleted_by)
      })) || [];

      if (error) throw error;

      setDeletionHistory(enrichedData);
    } catch (error) {
      console.error('Error loading deletion history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = deletionHistory.filter(record => {
    const matchesSearch = !searchTerm || 
      record.deletion_reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.record_data?.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesTable = tableFilter === "all" || record.table_name === tableFilter;
    
    return matchesSearch && matchesTable;
  });

  const getTableIcon = (tableName: string) => {
    switch (tableName) {
      case 'orders':
        return <Receipt className="h-4 w-4" />;
      case 'order_payments':
        return <DollarSign className="h-4 w-4" />;
      case 'purchases':
        return <ShoppingCart className="h-4 w-4" />;
      case 'incomes':
        return <CreditCard className="h-4 w-4" />;
      case 'expenses':
        return <Receipt className="h-4 w-4" />;
      default:
        return <Trash2 className="h-4 w-4" />;
    }
  };

  const getTableLabel = (tableName: string) => {
    const labels: { [key: string]: string } = {
      'orders': 'Órdenes',
      'order_payments': 'Pagos',
      'purchases': 'Compras', 
      'incomes': 'Ingresos',
      'expenses': 'Gastos'
    };
    return labels[tableName] || tableName;
  };

  const getRecordIdentifier = (record: DeletionRecord) => {
    const data = record.record_data;
    if (data?.order_number) return data.order_number;
    if (data?.income_number) return data.income_number;
    if (data?.purchase_number) return data.purchase_number;
    if (data?.concept) return data.concept;
    return `ID: ${record.record_id.substring(0, 8)}...`;
  };

  if (profile?.role !== 'administrador') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No tiene permisos para ver el historial de eliminaciones
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de Eliminaciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por motivo, número de orden, usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="table-filter">Tabla</Label>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filtrar por tabla" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las tablas</SelectItem>
                  <SelectItem value="orders">Órdenes</SelectItem>
                  <SelectItem value="order_payments">Pagos</SelectItem>
                  <SelectItem value="purchases">Compras</SelectItem>
                  <SelectItem value="incomes">Ingresos</SelectItem>
                  <SelectItem value="expenses">Gastos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabla de historial */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tabla</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Eliminado por</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No se encontraron registros de eliminaciones
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDateTimeMexico(record.deleted_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {getTableIcon(record.table_name)}
                          {getTableLabel(record.table_name)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {getRecordIdentifier(record)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {record.deletion_reason}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {record.profiles?.full_name || 'Usuario desconocido'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {record.profiles?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRecord(record)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle>Detalles de Eliminación</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh]">
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Tabla</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                      {getTableIcon(record.table_name)}
                                      <span>{getTableLabel(record.table_name)}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <Label>Fecha de eliminación</Label>
                                    <div className="mt-1 font-mono text-sm">
                                      {formatDateTimeMexico(record.deleted_at)}
                                    </div>
                                  </div>
                                  <div>
                                    <Label>Eliminado por</Label>
                                    <div className="mt-1">
                                      <div className="font-medium">
                                        {record.profiles?.full_name || 'Usuario desconocido'}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {record.profiles?.email}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <Label>ID del registro</Label>
                                    <div className="mt-1 font-mono text-xs">
                                      {record.record_id}
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  <Label>Motivo de eliminación</Label>
                                  <div className="mt-1 p-3 bg-muted rounded-md">
                                    {record.deletion_reason}
                                  </div>
                                </div>

                                <div>
                                  <Label>Datos del registro eliminado</Label>
                                  <div className="mt-1 p-3 bg-muted rounded-md">
                                    <pre className="text-xs overflow-auto">
                                      {JSON.stringify(record.record_data, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && (
            <div className="text-sm text-muted-foreground">
              Mostrando {filteredHistory.length} de {deletionHistory.length} registros
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}