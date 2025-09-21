import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Gift, Search, Trophy, Users, TrendingUp, Star } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RewardsAdminPanel } from '@/components/rewards/RewardsAdminPanel';
import { ClientRewardsCard } from '@/components/rewards/ClientRewardsCard';
import { useToast } from '@/hooks/use-toast';

interface ClientRewardsSummary {
  client_id: string;
  client_name: string;
  client_email: string;
  total_cashback: number;
  is_new_client: boolean;
  new_client_discount_used: boolean;
}

interface RewardsStats {
  total_clients: number;
  total_cashback: number;
  new_clients: number;
}

export default function Rewards() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [clientRewards, setClientRewards] = useState<ClientRewardsSummary[]>([]);
  const [stats, setStats] = useState<RewardsStats>({
    total_clients: 0,
    total_cashback: 0,
    new_clients: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRewardsData();
  }, []);

  const loadRewardsData = async () => {
    try {
      setLoading(true);
      
      if (profile?.role === 'cliente') {
        // Client view - show only their rewards
        return;
      }

      // Admin/Staff view - show all client rewards
      const { data, error } = await supabase
        .from('client_rewards')
        .select(`
          *,
          clients (name, email)
        `);

      if (error) throw error;

      const clientRewardsData = data.map((reward: any) => ({
        client_id: reward.client_id,
        client_name: reward.clients.name,
        client_email: reward.clients.email,
        total_cashback: reward.total_cashback,
        is_new_client: reward.is_new_client,
        new_client_discount_used: reward.new_client_discount_used,
      }));

      setClientRewards(clientRewardsData);

      // Calculate stats
      const totalClients = clientRewardsData.length;
      const totalCashback = clientRewardsData.reduce((sum, r) => sum + (r.total_cashback || 0), 0);
      const newClients = clientRewardsData.filter(r => r.is_new_client).length;

      setStats({
        total_clients: totalClients,
        total_cashback: totalCashback,
        new_clients: newClients,
      });

    } catch (error) {
      console.error('Error loading rewards data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de recompensas",
        variant: "destructive"
      });
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

  const filteredRewards = clientRewards.filter(reward =>
    reward.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reward.client_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Cargando recompensas...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Client view
  if (profile?.role === 'cliente') {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Gift className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Mis Recompensas</h1>
            <p className="text-muted-foreground">
              Gestiona tu cashback y recompensas
            </p>
            </div>
          </div>

          <ClientRewardsCard />
        </div>
      </AppLayout>
    );
  }

  // Admin/Staff view
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Gift className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sistema de Recompensas</h1>
            <p className="text-muted-foreground">
              Gestiona recompensas y cashback para clientes
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Clientes</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total_clients}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cashback Total</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.total_cashback)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-info">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Clientes Nuevos</p>
                  <p className="text-2xl font-bold text-foreground">{stats.new_clients}</p>
                </div>
                <Star className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email del cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Admin Panel */}
        <RewardsAdminPanel />
      </div>
    </AppLayout>
  );
}