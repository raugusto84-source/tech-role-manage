import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Gift, Star, Users, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ClientRewards {
  id: string;
  total_cashback: number;
  is_new_client: boolean;
  new_client_discount_used: boolean;
}

interface ReferralData {
  id: string;
  referral_code: string;
  referral_bonus_given: number;
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
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      loadRewardsData();
    }
  }, [user]);

  const loadRewardsData = async () => {
    try {
      setLoading(true);

      // Get client data first
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!client) return;

      // Get rewards data
      const { data: rewardsData } = await supabase
        .from('client_rewards')
        .select('*')
        .eq('client_id', client.id)
        .single();

      setRewards(rewardsData);

      // Get referral data
      const { data: referralData } = await supabase
        .from('client_referrals')
        .select('*')
        .eq('referrer_client_id', client.id)
        .single();

      setReferral(referralData);

      // Get transaction history
      const { data: transactionsData } = await supabase
        .from('reward_transactions')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setTransactions(transactionsData || []);

    } catch (error) {
      console.error('Error loading rewards data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createReferralCode = async () => {
    try {
      // Get client data
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!client) return;

      // Generate referral code
      const { data: codeData } = await supabase.rpc('generate_referral_code');
      
      if (codeData) {
        const { error } = await supabase
          .from('client_referrals')
          .insert({
            referrer_client_id: client.id,
            referred_client_id: client.id, // Temporary, will be updated when someone uses the code
            referral_code: codeData
          });

        if (!error) {
          setReferral({ 
            id: '', 
            referral_code: codeData, 
            referral_bonus_given: 0 
          });
          toast({
            title: "Código de referido creado",
            description: "¡Ahora puedes compartir tu código con amigos!"
          });
        }
      }
    } catch (error) {
      console.error('Error creating referral code:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el código de referido",
        variant: "destructive"
      });
    }
  };

  const copyReferralCode = () => {
    if (referral?.referral_code) {
      navigator.clipboard.writeText(referral.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Código copiado",
        description: "El código de referido ha sido copiado al portapapeles"
      });
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
                  <strong>50% descuento</strong> en tu primer servicio.
                </p>
              </div>
            </div>
          </div>
        )}

        <Separator className="bg-border/50" />

        {/* Referral System */}
        <div>
          <h3 className="flex items-center gap-2 font-bold mb-3 text-foreground text-sm">
            <Users className="h-4 w-4 text-primary" />
            Sistema de Referencias
          </h3>
          
          {referral ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-info/10 to-info/20 rounded-xl border border-info/30">
                <div className="flex-1">
                  <span className="text-sm font-medium text-info-foreground">Tu código:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="font-mono font-bold text-lg text-info">{referral.referral_code}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyReferralCode}
                      className="h-8 w-8 p-0 hover:bg-info/20"
                    >
                      {copied ? 
                        <Check className="h-4 w-4 text-success" /> : 
                        <Copy className="h-4 w-4 text-info" />
                      }
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-3">
                  Comparte tu código y obtén <strong className="text-primary">5% de cashback</strong> de las primeras 3 compras de cada referido.
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-success/20 text-success-foreground border-success/30">
                    Bonos otorgados: {referral.referral_bonus_given}/3
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 px-4 bg-muted/30 rounded-xl border border-dashed border-muted-foreground/30">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Crea tu código de referido y gana <strong className="text-primary">5% de cashback</strong> por cada amigo que refiera.
              </p>
              <Button onClick={createReferralCode} className="btn-primary-mobile">
                Crear código de referido
              </Button>
            </div>
          )}
        </div>

        <Separator />

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
                      transaction.transaction_type === 'earned' || transaction.transaction_type === 'referral_bonus' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {transaction.transaction_type === 'earned' || transaction.transaction_type === 'referral_bonus' ? '+' : '-'}
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
              <p>• Gana <strong>2% de cashback</strong> en todos los servicios</p>
              <p>• El cashback expira después de <strong>1 año</strong></p>
              <p>• Los referidos deben usar tu código al registrarse</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}