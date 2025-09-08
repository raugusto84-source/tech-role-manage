import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Gift, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ClientRewards {
  id: string;
  total_cashback: number;
  is_new_client: boolean;
  new_client_discount_used: boolean;
}

interface RewardTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
  expires_at: string | null;
}

export function ClientRewardsCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rewards, setRewards] = useState<ClientRewards | null>(null);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadRewardsData();
    }
  }, [user]);

  const loadRewardsData = async () => {
    try {
      setLoading(true);

      // Get client data using email from profile (each client is independent)
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

      // Get rewards data
      const { data: rewardsData } = await supabase
        .from('client_rewards')
        .select('*')
        .eq('client_id', client.id)
        .single();

      setRewards(rewardsData);

      // Get transaction history (exclude referral transactions)
      const { data: transactionsData } = await supabase
        .from('reward_transactions')
        .select('*')
        .eq('client_id', client.id)
        .neq('transaction_type', 'referral_bonus')
        .order('created_at', { ascending: false })
        .limit(10);

      setTransactions(transactionsData || []);

    } catch (error) {
      console.error('Error loading rewards data:', error);
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Recompensas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Cargando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-md compact-card">
      <CardHeader className="bg-gradient-primary text-white py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <Gift className="h-4 w-4" />
          Recompensas y Bonos
        </CardTitle>
        <CardDescription className="text-white/90 text-xs">
          Gana cashback y obtén descuentos especiales
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {/* Cashback Balance */}
        <div className="text-center p-4 bg-gradient-to-br from-success/10 to-success/20 rounded-lg border border-success/30">
          <div className="text-2xl font-bold text-success mb-1">
            {formatCurrency(rewards?.total_cashback || 0)}
          </div>
          <p className="text-xs text-success-foreground font-medium">Cashback disponible</p>
        </div>

        {/* New Client Discount */}
        {rewards?.is_new_client && !rewards?.new_client_discount_used && (
          <div className="p-3 bg-gradient-to-r from-warning/10 to-warning/20 rounded-lg border border-warning/30 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-warning rounded-full flex items-center justify-center">
                <Star className="h-4 w-4 text-warning-foreground" />
              </div>
              <div>
                <span className="font-bold text-warning-foreground text-sm">¡Bienvenido!</span>
                 <p className="text-xs text-warning-foreground/80">
                   <strong>2% cashback</strong> en servicios desde tu primera compra.
                 </p>
              </div>
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div>
          <h3 className="font-semibold mb-3">Historial de Recompensas</h3>
          {transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center p-2 rounded bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{transaction.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${
                      transaction.transaction_type === 'earned' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {transaction.transaction_type === 'earned' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </span>
                    {transaction.expires_at && (
                      <p className="text-xs text-muted-foreground">
                        Exp: {new Date(transaction.expires_at).toLocaleDateString('es-CO')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tienes transacciones de recompensas aún.
            </p>
          )}
        </div>

        {/* Info */}
        <div className="p-4 bg-gradient-to-r from-info/10 to-info/5 rounded-xl border border-info/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-info/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Gift className="h-4 w-4 text-info" />
            </div>
             <div className="text-xs text-info-foreground space-y-1">
               <p>• Gana <strong>2% de cashback</strong> en todas tus compras desde el primer servicio</p>
               <p>• El cashback expira después de <strong>1 año</strong></p>
             </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}