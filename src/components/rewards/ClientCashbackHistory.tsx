import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
export function ClientCashbackHistory({
  open,
  onOpenChange
}: ClientCashbackHistoryProps) {
  const {
    user
  } = useAuth();
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
      const {
        data: profile
      } = await supabase.from('profiles').select('email').eq('user_id', user?.id).single();
      if (!profile?.email) return;
      const {
        data: client
      } = await supabase.from('clients').select('id').eq('email', profile.email).single();
      if (!client) return;

      // Get all cashback transactions
      const {
        data: transactionsData
      } = await supabase.from('reward_transactions').select('*').eq('client_id', client.id).neq('transaction_type', 'referral_bonus').order('created_at', {
        ascending: false
      });
      setTransactions(transactionsData || []);
    } catch (error) {
      console.error('Error loading cashback history:', error);
    } finally {
      setLoading(false);
    }
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earned':
      case 'cashback_earned':
      case 'referral_bonus':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'used':
      case 'redeemed':
      case 'cashback_used':
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
      case 'cashback_earned':
      case 'referral_bonus':
        return <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Ganado</Badge>;
      case 'used':
      case 'redeemed':
      case 'cashback_used':
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
  const totalEarned = transactions.filter(t => ['earned', 'cashback_earned', 'referral_bonus'].includes(t.transaction_type)).reduce((sum, t) => sum + t.amount, 0);
  const totalUsed = transactions.filter(t => ['used', 'redeemed', 'cashback_used'].includes(t.transaction_type)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalExpired = transactions.filter(t => t.transaction_type === 'expired').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full flex flex-col max-h-[90svh] sm:max-h-[80vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Historial Completo de Cashback
          </DialogTitle>
          <DialogDescription className="text-sm">
            Revisa todo tu historial de cashback ganado, usado y expirado
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          {loading ? <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Cargando historial...</p>
            </div> : <div className="space-y-4 sm:space-y-6 h-full overflow-y-auto">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 flex-shrink-0">
                <Card>
                <CardContent className="pt-3 sm:pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Total Ganado</p>
                      <p className="text-base sm:text-lg font-bold text-success">{formatCurrency(totalEarned)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 sm:pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Total Usado</p>
                      <p className="text-base sm:text-lg font-bold text-destructive">{formatCurrency(totalUsed)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 sm:pt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Total Expirado</p>
                      <p className="text-base sm:text-lg font-bold text-muted-foreground">{formatCurrency(totalExpired)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

              <Separator className="flex-shrink-0" />

              {/* Transactions List */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-3 sm:space-y-4 pr-4">
                {transactions.length > 0 ? transactions.map(transaction => <Card key={transaction.id} className="transition-colors hover:bg-muted/50">
                      <CardContent className="pt-3 sm:pt-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-start gap-3">
                            {getTransactionIcon(transaction.transaction_type)}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm sm:text-base truncate">{transaction.description}</p>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  {new Date(transaction.created_at).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })} {new Date(transaction.created_at).toLocaleTimeString('es-CO', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-base sm:text-lg font-bold ${
                                ['earned', 'cashback_earned', 'referral_bonus'].includes(transaction.transaction_type) ? 'text-success' : 
                                ['used', 'redeemed', 'cashback_used'].includes(transaction.transaction_type) ? 'text-destructive' : 
                                'text-muted-foreground'
                              }`}>
                                {['earned', 'cashback_earned', 'referral_bonus'].includes(transaction.transaction_type) ? '+' : '-'}
                                {formatCurrency(Math.abs(transaction.amount))}
                              </span>
                              {getTransactionBadge(transaction.transaction_type)}
                            </div>
                            
                            {transaction.expires_at && transaction.transaction_type === 'earned' && <div className="flex items-center gap-1 text-xs flex-wrap">
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span className={isExpiringSoon(transaction.expires_at) ? 'text-warning' : 'text-muted-foreground'}>
                                  Expira: {new Date(transaction.expires_at).toLocaleDateString('es-CO')}
                                </span>
                                {isExpiringSoon(transaction.expires_at) && <Badge variant="outline" className="text-warning border-warning text-xs">
                                    ¡Próximo a expirar!
                                  </Badge>}
                              </div>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>) : <div className="text-center py-8">
                    <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm sm:text-base">No tienes transacciones de cashback aún.</p>
                  </div>}
                </div>
              </ScrollArea>
            </div>}
        </div>
      </DialogContent>
    </Dialog>;
}