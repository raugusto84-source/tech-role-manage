import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Gift, Users, TrendingUp, Clock, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RewardSettingsManager } from "./RewardSettingsManager";

interface ClientRewardsSummary {
  client_id: string;
  client_name: string;
  client_email: string;
  total_cashback: number;
  is_new_client: boolean;
  new_client_discount_used: boolean;
}

interface RewardTransaction {
  id: string;
  client_name: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
  expires_at: string | null;
}

interface RewardsStats {
  total_cashback_given: number;
  new_clients_this_month: number;
  expired_cashback: number;
}

export function RewardsAdminPanel() {
  const { toast } = useToast();
  const [clientRewards, setClientRewards] = useState<ClientRewardsSummary[]>([]);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [stats, setStats] = useState<RewardsStats>({
    total_cashback_given: 0,
    new_clients_this_month: 0,
    expired_cashback: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadRewardsData();
  }, []);

  const loadRewardsData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadClientRewards(),
        loadTransactions(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error loading rewards data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientRewards = async () => {
    const { data } = await supabase
      .from('client_rewards')
      .select(`
        *,
        clients!inner(id, name, email)
      `);

    if (data) {
      const clientRewardsData = data.map((reward: any) => ({
        client_id: reward.client_id,
        client_name: reward.clients.name,
        client_email: reward.clients.email,
        total_cashback: reward.total_cashback,
        is_new_client: reward.is_new_client,
        new_client_discount_used: reward.new_client_discount_used,
      }));
      
      setClientRewards(clientRewardsData);
    }
  };

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('reward_transactions')
      .select(`
        *,
        clients!inner(name)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setTransactions(data.map((tx: any) => ({
        ...tx,
        client_name: tx.clients.name
      })));
    }
  };

  const loadStats = async () => {
    // Total cashback given
    const { data: cashbackData } = await supabase
      .from('reward_transactions')
      .select('amount')
      .eq('transaction_type', 'earned');

    // New clients this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { count: newClients } = await supabase
      .from('client_rewards')
      .select('*', { count: 'exact' })
      .eq('is_new_client', true)
      .gte('created_at', startOfMonth.toISOString());

    // Expired cashback
    const { data: expiredData } = await supabase
      .from('reward_transactions')
      .select('amount')
      .eq('transaction_type', 'expired');

    setStats({
      total_cashback_given: cashbackData?.reduce((sum, tx) => sum + tx.amount, 0) || 0,
      new_clients_this_month: newClients || 0,
      expired_cashback: expiredData?.reduce((sum, tx) => sum + tx.amount, 0) || 0
    });
  };

  const cleanExpiredRewards = async () => {
    try {
      await supabase.rpc('clean_expired_rewards');
      toast({
        title: "Limpieza completada",
        description: "Se han eliminado las recompensas expiradas"
      });
      loadRewardsData();
    } catch (error) {
      console.error('Error cleaning expired rewards:', error);
      toast({
        title: "Error",
        description: "No se pudieron limpiar las recompensas expiradas",
        variant: "destructive"
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

  const filteredClients = clientRewards.filter(client =>
    client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.client_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="clients" className="w-full">
         <TabsList className="grid w-full grid-cols-3 gap-1 p-1">
           <TabsTrigger value="settings" className="text-xs md:text-sm">
             <span className="md:hidden">Config</span>
             <span className="hidden md:inline">Configuración</span>
           </TabsTrigger>
           <TabsTrigger value="clients" className="text-xs md:text-sm">
             <span className="md:hidden">Clientes</span>
             <span className="hidden md:inline">Clientes</span>
           </TabsTrigger>
           <TabsTrigger value="transactions" className="text-xs md:text-sm">
             <span className="md:hidden">Trans.</span>
             <span className="hidden md:inline">Transacciones</span>
           </TabsTrigger>
          </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <RewardSettingsManager />
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Clientes con Cashback</CardTitle>
                  <CardDescription>
                    Todos los clientes que tienen o han tenido cashback
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Clock className="h-4 w-4 mr-2" />
                        Limpiar Expirados
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Limpiar recompensas expiradas</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará todas las recompensas que hayan expirado y recalculará 
                          los totales de cashback. ¿Estás seguro?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={cleanExpiredRewards}>
                          Limpiar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  <Button onClick={loadRewardsData} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Cashback Disponible</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.client_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{client.client_name}</div>
                          <div className="text-sm text-muted-foreground">{client.client_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-green-600">
                          {formatCurrency(client.total_cashback)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {client.is_new_client && (
                            <Badge variant={client.new_client_discount_used ? "secondary" : "default"}>
                              {client.new_client_discount_used ? "Descuento Usado" : "Nuevo Cliente"}
                            </Badge>
                          )}
                          {client.total_cashback > 0 && (
                            <Badge variant="outline">Con Cashback</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Transacciones</CardTitle>
              <CardDescription>
                Últimas 50 transacciones de recompensas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Expira</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{transaction.client_name}</TableCell>
                      <TableCell>
                        <Badge variant={
                          transaction.transaction_type === 'earned' ? "default" :
                          transaction.transaction_type === 'expired' ? "destructive" : "outline"
                        }>
                          {transaction.transaction_type === 'earned' ? 'Ganado' :
                           transaction.transaction_type === 'expired' ? 'Expirado' : 'Redimido'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={
                          transaction.transaction_type === 'earned' 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }>
                          {transaction.transaction_type === 'earned' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{transaction.description}</TableCell>
                      <TableCell>
                        {new Date(transaction.created_at).toLocaleDateString('es-CO')}
                      </TableCell>
                      <TableCell>
                        {transaction.expires_at ? 
                          new Date(transaction.expires_at).toLocaleDateString('es-CO') : 
                          '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}