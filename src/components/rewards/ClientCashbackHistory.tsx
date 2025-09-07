import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Gift, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CashbackTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
  expires_at: string | null;
  order_id: string | null;
}

interface ClientCashbackHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientCashbackHistory({ open, onOpenChange }: ClientCashbackHistoryProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<CashbackTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && user) {
      loadCashbackHistory();
    }
  }, [open, user]);

  const loadCashbackHistory = async () => {
    try {
      setLoading(true);

      // Get client data using email from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user?.id)
        .single();

      if (!profile?.email) return;

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('email', profile.email)
        .single();

      if (!client) return;

      // Get all cashback transactions
      const { data: transactionsData } = await supabase
        .from('reward_transactions')
        .select('*')
        .eq('client_id', client.id)
        .neq('transaction_type', 'referral_bonus')
        .order('created_at', { ascending: false });

      setTransactions(transactionsData || []);

    } catch (error) {
      console.error('Error loading cashback history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earned':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'used':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Gift className="h-4 w-4 text-primary" />;
    }
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'earned':
        return <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Ganado</Badge>;
      case 'used':
        return <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">Usado</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="bg-muted text-muted-foreground">Expirado</Badge>;
      default:
        return <Badge variant="outline">Otro</Badge>;
    }
  };

  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const totalEarned = transactions
    .filter(t => t.transaction_type === 'earned')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalUsed = transactions
    .filter(t => t.transaction_type === 'used')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpired = transactions
    .filter(t => t.transaction_type === 'expired')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Historial Completo de Cashback
          </DialogTitle>
          <DialogDescription>
            Revisa todo tu historial de cashback ganado, usado y expirado
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Cargando historial...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Ganado</p>
                      <p className="text-lg font-bold text-success">{formatCurrency(totalEarned)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Usado</p>
                      <p className="text-lg font-bold text-destructive">{formatCurrency(totalUsed)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Expirado</p>
                      <p className="text-lg font-bold text-muted-foreground">{formatCurrency(totalExpired)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Transactions List */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <Card key={transaction.id} className="transition-colors hover:bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getTransactionIcon(transaction.transaction_type)}
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-muted-foreground">
                                {new Date(transaction.created_at).toLocaleDateString('es-CO', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                              {transaction.order_id && (
                                <Badge variant="outline" className="text-xs">
                                  Orden: {transaction.order_id}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-lg font-bold ${
                              transaction.transaction_type === 'earned' 
                                ? 'text-success' 
                                : transaction.transaction_type === 'used'
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                            }`}>
                              {transaction.transaction_type === 'earned' ? '+' : '-'}
                              {formatCurrency(transaction.amount)}
                            </span>
                            {getTransactionBadge(transaction.transaction_type)}
                          </div>
                          
                          {transaction.expires_at && transaction.transaction_type === 'earned' && (
                            <div className="flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3" />
                              <span className={isExpiringSoon(transaction.expires_at) ? 'text-warning' : 'text-muted-foreground'}>
                                Expira: {new Date(transaction.expires_at).toLocaleDateString('es-CO')}
                              </span>
                              {isExpiringSoon(transaction.expires_at) && (
                                <Badge variant="outline" className="text-warning border-warning">
                                  ¡Próximo a expirar!
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8">
                  <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No tienes transacciones de cashback aún.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}