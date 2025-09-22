import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FiscalWithdrawalDialog } from "./FiscalWithdrawalDialog";
import { Trash2, RotateCcw } from "lucide-react";

export function PurchaseHistoryPanel() {
  const { toast } = useToast();
  const [fiscalWithdrawalDialog, setFiscalWithdrawalDialog] = useState<{
    open: boolean;
    withdrawal: any;
  }>({
    open: false,
    withdrawal: null
  });

  // Query para retiros fiscales reactivados (disponibles nuevamente)
  const reactivatedWithdrawalsQuery = useQuery({
    queryKey: ["reactivated_fiscal_withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_withdrawals")
        .select(`
          id,
          amount,
          description,
          withdrawal_status,
          created_at,
          withdrawn_at
        `)
        .eq('withdrawal_status', 'available')
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    }
  });

  const handlePermanentDelete = async (withdrawalId: string) => {
    try {
      const { error } = await supabase
        .from("fiscal_withdrawals")
        .delete()
        .eq("id", withdrawalId);

      if (error) throw error;

      toast({
        title: "Retiro eliminado",
        description: "El retiro fiscal ha sido eliminado permanentemente"
      });

      reactivatedWithdrawalsQuery.refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el retiro",
        variant: "destructive"
      });
    }
  };

  const handleReapply = (withdrawal: any) => {
    setFiscalWithdrawalDialog({
      open: true,
      withdrawal
    });
  };

  const handleSuccess = () => {
    reactivatedWithdrawalsQuery.refetch();
  };

  const withdrawals = reactivatedWithdrawalsQuery.data || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Historial de Compras - Retiros Reactivados
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Retiros fiscales que fueron revertidos y están disponibles para aplicar nuevamente o eliminar permanentemente
          </p>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RotateCcw className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay retiros fiscales reactivados</p>
              <p className="text-sm">Los retiros revertidos aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {withdrawals.length} retiro{withdrawals.length !== 1 ? 's' : ''} disponible{withdrawals.length !== 1 ? 's' : ''}
                </p>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Pendientes de acción
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {withdrawals.map((withdrawal) => (
                  <Card key={withdrawal.id} className="border-l-4 border-l-yellow-400">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant="outline" 
                          className="bg-yellow-50 text-yellow-700 border-yellow-200"
                        >
                          Reactivado
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(withdrawal.created_at).toLocaleDateString('es-MX')}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Descripción</p>
                        <p className="text-sm font-medium" title={withdrawal.description}>
                          {withdrawal.description}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Monto</p>
                        <p className="text-2xl font-bold text-yellow-600">
                          ${withdrawal.amount.toLocaleString('es-MX', { 
                            minimumFractionDigits: 2 
                          })}
                        </p>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReapply(withdrawal)}
                          className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Aplicar
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar retiro permanentemente?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará permanentemente el retiro fiscal de $
                                {withdrawal.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}.
                                Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handlePermanentDelete(withdrawal.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Eliminar permanentemente
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <FiscalWithdrawalDialog
        open={fiscalWithdrawalDialog.open}
        onOpenChange={(open) => setFiscalWithdrawalDialog({ open, withdrawal: null })}
        withdrawal={fiscalWithdrawalDialog.withdrawal}
        onSuccess={handleSuccess}
      />
    </>
  );
}