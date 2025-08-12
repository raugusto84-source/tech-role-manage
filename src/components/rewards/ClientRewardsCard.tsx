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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Recompensas y Bonos
        </CardTitle>
        <CardDescription>
          Gana cashback y obtén descuentos especiales
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cashback Balance */}
        <div className="text-center p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
          <div className="text-2xl font-bold text-primary">
            {formatCurrency(rewards?.total_cashback || 0)}
          </div>
          <p className="text-sm text-muted-foreground">Cashback disponible</p>
        </div>

        {/* New Client Discount */}
        {rewards?.is_new_client && !rewards?.new_client_discount_used && (
          <div className="p-4 bg-accent rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-accent-foreground" />
              <span className="font-semibold">¡Bienvenido!</span>
            </div>
            <p className="text-sm text-accent-foreground">
              Tienes un <strong>50% de descuento</strong> en tu primer servicio.
            </p>
          </div>
        )}

        <Separator />

        {/* Referral System */}
        <div>
          <h3 className="flex items-center gap-2 font-semibold mb-3">
            <Users className="h-4 w-4" />
            Sistema de Referencias
          </h3>
          
          {referral ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="text-sm">Tu código:</span>
                <code className="font-mono font-bold">{referral.referral_code}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyReferralCode}
                  className="ml-auto"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Comparte tu código y obtén <strong>5% de cashback</strong> de las primeras 3 compras de cada referido.
              </p>
              <Badge variant="secondary">
                Bonos otorgados: {referral.referral_bonus_given}/3
              </Badge>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Crea tu código de referido y gana 5% de cashback por cada amigo que refiera.
              </p>
              <Button onClick={createReferralCode} variant="outline">
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
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            • Gana 2% de cashback en todos los servicios<br/>
            • El cashback expira después de 1 año<br/>
            • Los referidos deben usar tu código al registrarse
          </p>
        </div>
      </CardContent>
    </Card>
  );
}