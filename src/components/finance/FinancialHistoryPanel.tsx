import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface FinancialHistoryPanelProps {
  startDate: string;
  endDate: string;
}

export function FinancialHistoryPanel({ startDate, endDate }: FinancialHistoryPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const auditLogsQuery = useQuery({
    queryKey: ["financial_audit_logs", startDate, endDate],
    queryFn: async () => {
      let q = supabase.from("financial_audit_logs").select(`
        id,
        table_name,
        operation_type,
        record_id,
        old_data,
        new_data,
        changed_at,
        change_reason
      `).order("changed_at", { ascending: false });

      if (startDate) q = q.gte("changed_at", startDate);
      if (endDate) q = q.lte("changed_at", endDate + "T23:59:59");

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    }
  });

  const filteredLogs = auditLogsQuery.data?.filter(log => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    return (
      log.table_name?.toLowerCase().includes(searchLower) ||
      log.operation_type?.toLowerCase().includes(searchLower) ||
      log.change_reason?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.new_data)?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.old_data)?.toLowerCase().includes(searchLower)
    );
  });

  const getOperationBadge = (operation: string) => {
    const variants = {
      insert: "bg-green-100 text-green-800",
      update: "bg-blue-100 text-blue-800", 
      delete: "bg-red-100 text-red-800",
      reversed: "bg-orange-100 text-orange-800",
      withdrawal_withdrawn: "bg-purple-100 text-purple-800",
      withdrawal_available: "bg-yellow-100 text-yellow-800"
    };

    const labels = {
      insert: "Creado",
      update: "Actualizado",
      delete: "Eliminado", 
      reversed: "Revertido",
      withdrawal_withdrawn: "Retirado",
      withdrawal_available: "Disponible"
    };

    return (
      <Badge className={variants[operation as keyof typeof variants] || "bg-gray-100 text-gray-800"}>
        {labels[operation as keyof typeof labels] || operation}
      </Badge>
    );
  };

  const getTableBadge = (tableName: string) => {
    const variants = {
      incomes: "bg-green-100 text-green-800",
      expenses: "bg-red-100 text-red-800",
      order_payments: "bg-blue-100 text-blue-800",
      fiscal_withdrawals: "bg-orange-100 text-orange-800",
      purchases: "bg-purple-100 text-purple-800",
      fixed_expenses: "bg-yellow-100 text-yellow-800",
      fixed_incomes: "bg-emerald-100 text-emerald-800"
    };

    const labels = {
      incomes: "Ingresos",
      expenses: "Egresos", 
      order_payments: "Cobranzas",
      fiscal_withdrawals: "Retiros",
      purchases: "Compras",
      fixed_expenses: "Gastos Fijos",
      fixed_incomes: "Ingresos Fijos"
    };

    return (
      <Badge className={variants[tableName as keyof typeof variants] || "bg-gray-100 text-gray-800"}>
        {labels[tableName as keyof typeof labels] || tableName}
      </Badge>
    );
  };

  const getAmountFromData = (data: any) => {
    if (!data || typeof data !== 'object') return null;
    return data.amount || data.total_amount || null;
  };

  const getDescriptionFromData = (data: any) => {
    if (!data || typeof data !== 'object') return '';
    return data.description || data.concept || '';
  };

  const exportCsv = (data: any[]) => {
    if (!data?.length) return;
    
    const csvData = data.map(log => ({
      fecha: new Date(log.changed_at).toLocaleString(),
      tabla: log.table_name,
      operacion: log.operation_type,
      usuario: 'Sistema',
      razon: log.change_reason || '',
      monto_anterior: getAmountFromData(log.old_data) || '',
      monto_nuevo: getAmountFromData(log.new_data) || ''
    }));

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${row[h as keyof typeof row] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial_financiero_${startDate}_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Historial Completo de Movimientos Financieros</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => exportCsv(filteredLogs || [])}
            disabled={!filteredLogs?.length}
          >
            Exportar CSV
          </Button>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Buscar en historial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <span className="text-sm text-muted-foreground">
            {filteredLogs?.length || 0} registros
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tabla</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead>Descripción/Motivo</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Detalles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs?.map(log => {
                const oldAmount = getAmountFromData(log.old_data);
                const newAmount = getAmountFromData(log.new_data);
                
                return (
                  <TableRow key={log.id} className="hover:bg-muted/50">
                    <TableCell className="text-xs">
                      {new Date(log.changed_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {getTableBadge(log.table_name)}
                    </TableCell>
                    <TableCell>
                      {getOperationBadge(log.operation_type)}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="truncate" title={log.change_reason || ''}>
                        {log.change_reason || getDescriptionFromData(log.new_data) || getDescriptionFromData(log.old_data) || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {oldAmount && newAmount && oldAmount !== newAmount ? (
                        <div className="space-y-1">
                          <div className="text-red-600 line-through">
                            ${Number(oldAmount).toLocaleString()}
                          </div>
                          <div className="text-green-600">
                            ${Number(newAmount).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div>
                          {newAmount ? `$${Number(newAmount).toLocaleString()}` : 
                           oldAmount ? `$${Number(oldAmount).toLocaleString()}` : '-'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      Sistema
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="max-w-[150px] truncate">
                        {log.operation_type === 'delete' ? 
                          `Eliminado: ${getDescriptionFromData(log.old_data)}` :
                          log.operation_type === 'insert' ?
                          `Creado: ${getDescriptionFromData(log.new_data)}` :
                          log.operation_type === 'reversed' ?
                          `Revertido: ${getDescriptionFromData(log.old_data)}` :
                          `Actualizado`
                        }
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!auditLogsQuery.isLoading && (!filteredLogs || filteredLogs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-4xl">📋</div>
                      <div className="font-medium">No hay movimientos en el historial</div>
                      <div className="text-sm">
                        {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Los movimientos aparecerán aquí conforme se realicen operaciones'}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}