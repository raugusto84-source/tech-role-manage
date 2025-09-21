import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Mail, Phone, MapPin, Users, Gift, Star, Users as UsersIcon } from 'lucide-react';

interface Client {
  user_id: string;
  client_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
  type: 'profile' | 'client';
  orders_count?: number;
  quotes_count?: number;
  total_spent?: number;
  // Recompensas
  total_cashback?: number;
  is_new_client?: boolean;
  new_client_discount_used?: boolean;
  referral_code?: string;
  referral_count?: number;
  active_rewards?: number;
}

/**
 * Componente para listar y gestionar clientes
 * Incluye búsqueda, filtros y creación de nuevos clientes
 */
export function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      
      // Cargar usuarios registrados con rol de cliente
      const { data: profileClients, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone, created_at')
        .eq('role', 'cliente');

      if (profileError) throw profileError;

      // Cargar clientes de la tabla clients que tienen user_id (vinculados)
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, user_id, name, email, phone, address, created_at')
        .not('user_id', 'is', null);

      if (clientsError) throw clientsError;

      // Combinar ambos tipos de clientes y evitar duplicados
      const allClients = [];
      
      // Agregar usuarios con rol cliente
      for (const profile of profileClients || []) {
        const client = {
          user_id: profile.user_id,
          client_id: null,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          created_at: profile.created_at,
          type: 'profile'
        };
        allClients.push(client);
      }
      
      // Agregar clientes de tabla clients (solo si no están ya en profiles)
      for (const client of clientsData || []) {
        const existingProfile = profileClients?.find(p => p.user_id === client.user_id);
        if (!existingProfile) {
          allClients.push({
            user_id: client.user_id,
            client_id: client.id,
            full_name: client.name,
            email: client.email,
            phone: client.phone,
            created_at: client.created_at,
            type: 'client'
          });
        } else {
          // Actualizar con client_id si existe
          const existingClient = allClients.find(c => c.user_id === client.user_id);
          if (existingClient) {
            existingClient.client_id = client.id;
          }
        }
      }

      // Calcular estadísticas para cada cliente
      const clientsWithStats = await Promise.all(
        allClients.map(async (client) => {
          let orders_count = 0;
          let totalSpent = 0;
          let quotes_count = 0;

          // Contar órdenes por client_id si existe
          if (client.client_id) {
            const { data: ordersData } = await supabase
              .from('orders')
              .select('estimated_cost')
              .eq('client_id', client.client_id);

            orders_count = ordersData?.length || 0;
            totalSpent = ordersData?.reduce((sum, order) => sum + (order.estimated_cost || 0), 0) || 0;
          }

          // Contar cotizaciones por user_id
          if (client.user_id) {
            const { data: quotesData } = await supabase
              .from('quotes')
              .select('id')
              .eq('user_id', client.user_id);

            quotes_count = quotesData?.length || 0;
          }

          // También buscar cotizaciones por email si no hay user_id
          if (!quotes_count && client.email) {
            const { data: quotesDataByEmail } = await supabase
              .from('quotes')
              .select('id')
              .eq('client_email', client.email);

            quotes_count = quotesDataByEmail?.length || 0;
          }

          // Cargar datos de recompensas si tiene client_id
          let rewardsData = {
            total_cashback: 0,
            is_new_client: false,
            new_client_discount_used: false,
            referral_code: null,
            referral_count: 0,
            active_rewards: 0
          };

          if (client.client_id) {
            // Calcular cashback actual real desde el historial de transacciones
            let actualCashback = 0;

            // Cashback ganado (no expirado)
            const { data: earnedTransactions } = await supabase
              .from('reward_transactions')
              .select('amount')
              .eq('client_id', client.client_id)
              .eq('transaction_type', 'cashback_earned')
              .or('expires_at.is.null,expires_at.gt.now()'); // No expiradas

            const totalEarned = earnedTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

            // Cashback usado
            const { data: usedTransactions } = await supabase
              .from('reward_transactions')
              .select('amount')
              .eq('client_id', client.client_id)
              .eq('transaction_type', 'cashback_used');

            const totalUsed = usedTransactions?.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;

            // Calcular saldo actual
            actualCashback = Math.max(0, totalEarned - totalUsed);

            // Datos de client_rewards para otros campos
            const { data: clientRewards } = await supabase
              .from('client_rewards')
              .select('is_new_client, new_client_discount_used')
              .eq('client_id', client.client_id)
              .maybeSingle();

            if (clientRewards) {
              rewardsData.is_new_client = clientRewards.is_new_client || false;
              rewardsData.new_client_discount_used = clientRewards.new_client_discount_used || false;
            }

            // Usar cashback calculado en lugar del campo de la tabla
            rewardsData.total_cashback = actualCashback;
            rewardsData.active_rewards = actualCashback; // El disponible es el mismo que el total actual

            // Datos de referidos
            const { data: referralData } = await supabase
              .from('client_referrals')
              .select('referral_code')
              .eq('referrer_client_id', client.client_id)
              .maybeSingle();

            if (referralData) {
              rewardsData.referral_code = referralData.referral_code;
            }

            // Contar referidos activos
            const { data: referredClients } = await supabase
              .from('client_referrals')
              .select('id')
              .eq('referrer_client_id', client.client_id)
              .eq('status', 'active');

            rewardsData.referral_count = referredClients?.length || 0;
          }

          return {
            ...client,
            orders_count,
            quotes_count,
            total_spent: totalSpent,
            ...rewardsData
          };
        })
      );

      setClients(clientsWithStats);
    } catch (error: any) {
      console.error('Error loading clients:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Lista de Clientes ({clients.length})
        </CardTitle>
        
        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid gap-4">
          {filteredClients.map((client) => (
            <Card key={client.user_id} className="p-4">
                <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{client.full_name}</h3>
                    <Badge variant="outline">
                      Cliente desde {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'Fecha no disponible'}
                    </Badge>
                    {client.is_new_client && !client.new_client_discount_used && (
                      <Badge className="bg-green-100 text-green-800">
                        <Gift className="h-3 w-3 mr-1" />
                        Nuevo cliente
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {client.email}
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {client.phone}
                      </div>
                    )}
                  </div>

                  {/* Sección de Recompensas */}
                  {client.client_id && (
                    <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border">
                      <h4 className="font-medium text-sm text-purple-800 mb-2 flex items-center gap-1">
                        <Gift className="h-4 w-4" />
                        Programa de Recompensas
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="text-center">
                          <div className="font-bold text-green-600 text-lg">
                            {formatCurrency(client.total_cashback || 0)}
                          </div>
                          <div className="text-green-700">Cashback Total</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="font-bold text-blue-600 text-lg">
                            {formatCurrency(client.active_rewards || 0)}
                          </div>
                          <div className="text-blue-700">Disponible</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="font-bold text-orange-600 text-lg">
                            {client.referral_count || 0}
                          </div>
                          <div className="text-orange-700">Referidos</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex items-center justify-center">
                            {client.referral_code ? (
                              <Badge variant="outline" className="text-xs">
                                {client.referral_code}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">Sin código</span>
                            )}
                          </div>
                          <div className="text-gray-700">Cód. Referido</div>
                        </div>
                      </div>

                      {/* Beneficios activos */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {client.is_new_client && !client.new_client_discount_used && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                            10% Descuento nuevo cliente
                          </Badge>
                        )}
                        {(client.total_cashback || 0) > 0 && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                            Cashback 2% en servicios
                          </Badge>
                        )}
                        {(client.referral_count || 0) > 0 && (
                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                            Bono 5% por referidos
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="text-right space-y-2">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-primary">{client.quotes_count}</div>
                      <div className="text-xs text-muted-foreground">Cotizaciones</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">{client.orders_count}</div>
                      <div className="text-xs text-muted-foreground">Órdenes</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(client.total_spent || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total gastado</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          
          {filteredClients.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No se encontraron clientes con ese criterio' : 'No hay clientes registrados'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}