import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, FileText, Calendar, Building, Shield } from "lucide-react";

interface SerialNumberSearchProps {
  trigger?: React.ReactNode;
}

export function SerialNumberSearch({ trigger }: SerialNumberSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: searchResults = [], isLoading, refetch } = useQuery({
    queryKey: ["purchase-items-search", searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];
      
      const { data, error } = await supabase
        .from("purchase_items")
        .select(`
          *,
          expenses!inner(
            id,
            description,
            expense_date,
            amount,
            account_type,
            suppliers(supplier_name)
          )
        `)
        .or(`serial_number.ilike.%${searchTerm}%,item_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: false
  });

  const handleSearch = () => {
    if (searchTerm.trim()) {
      refetch();
    }
  };

  const getWarrantyStatus = (warrantyEndDate: string | null) => {
    if (!warrantyEndDate) return { status: "sin_garantia", label: "Sin garantía", variant: "secondary" as const };
    
    const today = new Date();
    const endDate = new Date(warrantyEndDate);
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining < 0) {
      return { status: "expirada", label: "Expirada", variant: "destructive" as const };
    } else if (daysRemaining <= 30) {
      return { status: "por_expirar", label: `${daysRemaining} días`, variant: "outline" as const };
    } else {
      return { status: "vigente", label: `${daysRemaining} días`, variant: "default" as const };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Search className="w-4 h-4 mr-2" />
            Buscar por Número de Serie
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar Artículos por Número de Serie</DialogTitle>
          <DialogDescription>
            Busque artículos por número de serie, nombre, marca o modelo para consultar información de compra y garantía
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Criterios de Búsqueda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Label htmlFor="searchTerm">Buscar</Label>
                  <Input
                    id="searchTerm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Número de serie, nombre del artículo, marca o modelo..."
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleSearch} disabled={isLoading || !searchTerm.trim()}>
                    <Search className="w-4 h-4 mr-2" />
                    {isLoading ? "Buscando..." : "Buscar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resultados de Búsqueda ({searchResults.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Artículo</TableHead>
                        <TableHead>Marca/Modelo</TableHead>
                        <TableHead>No. Serie</TableHead>
                        <TableHead>Compra</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Fecha Compra</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Garantía</TableHead>
                        <TableHead>Estado Garantía</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((item: any) => {
                        const warrantyStatus = getWarrantyStatus(item.warranty_end_date);
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.item_name}</div>
                                {item.notes && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {item.notes}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.brand && item.model ? `${item.brand} ${item.model}` : item.brand || item.model || "-"}
                            </TableCell>
                            <TableCell>
                              <code className="bg-muted px-2 py-1 rounded text-sm">
                                {item.serial_number}
                              </code>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{item.expenses.description}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                <Building className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {item.expenses.suppliers?.supplier_name || "Sin proveedor"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{formatDate(item.expenses.expense_date)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-right">
                                <div className="font-medium">
                                  ${item.unit_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </div>
                                {item.quantity > 1 && (
                                  <div className="text-xs text-muted-foreground">
                                    {item.quantity} x ${item.unit_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                <Shield className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {item.warranty_months ? `${item.warranty_months} meses` : "Sin garantía"}
                                </span>
                              </div>
                              {item.warranty_start_date && item.warranty_end_date && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {formatDate(item.warranty_start_date)} - {formatDate(item.warranty_end_date)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={warrantyStatus.variant}>
                                {warrantyStatus.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {searchResults.length === 0 && searchTerm && !isLoading && (
            <Card>
              <CardContent className="text-center py-8">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No se encontraron artículos que coincidan con "{searchTerm}"
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Intente buscar por número de serie, nombre del artículo, marca o modelo
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}