import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  User, 
  FileText, 
  ShoppingCart, 
  Gift, 
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  Star,
  Copy,
  Signature
} from 'lucide-react';

export function UnifiedClientDashboard() {
  const { toast } = useToast();
  
  const [clientData, setClientData] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClientData();
  }, []);

  const loadClientData = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setClientData(profile);

      // Mock data para demo
      setQuotes([
        {
          id: '1',
          quote_number: 'COT-001',
          estimated_amount: 250000,
          status: 'aceptada',
          service_description: 'Reparación de aire acondicionado',
          request_date: new Date().toISOString()
        }
      ]);

      setOrders([
        {
          id: '1',
          order_number: 'ORD-001',
          status: 'finalizada',
          total_amount: 180000,
          created_at: new Date().toISOString(),
          services: [{ service_name: 'Mantenimiento preventivo', quantity: 1, total_amount: 180000 }],
          needs_signature: true
        }
      ]);

      setRewards({
        total_cashback: 15000,
        total_points: 120,
        is_new_client: false,
        referral_code: 'REF12345',
        referrals_count: 2
      });

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'solicitud': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'aceptada': 'bg-green-100 text-green-800 border-green-200',
      'finalizada': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (status: string) => {
    return status === 'aceptada' || status === 'finalizada' ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const copyReferralCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "¡Copiado!",
        description: "Código copiado al portapapeles",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="bg-gradient-to-br from-primary to-primary/80 p-3 rounded-full">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              ¡Hola, {clientData?.full_name || 'Cliente'}!
            </h1>
            <p className="text-muted-foreground">
              Bienvenido a tu panel personalizado
            </p>
          </div>
        </div>
        
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Recompensas */}
      {rewards && (
        <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <Gift className="h-5 w-5" />
              Mis Recompensas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(rewards.total_cashback)}
                </div>
                <div className="text-sm text-muted-foreground">Cashback</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {rewards.total_points}
                </div>
                <div className="text-sm text-muted-foreground">Puntos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {rewards.referrals_count}
                </div>
                <div className="text-sm text-muted-foreground">Referidos</div>
              </div>
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyReferralCode(rewards.referral_code)}
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  {rewards.referral_code}
                </Button>
                <div className="text-sm text-muted-foreground mt-1">Código</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="quotes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quotes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Cotizaciones
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Servicios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Mis Cotizaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quotes.map((quote) => (
                  <Card key={quote.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className={getStatusColor(quote.status)}>
                              {getStatusIcon(quote.status)}
                              <span className="ml-1 capitalize">{quote.status}</span>
                            </Badge>
                            <span className="font-mono text-sm text-muted-foreground">
                              #{quote.quote_number}
                            </span>
                          </div>
                          <h3 className="font-semibold text-foreground mb-1">
                            {quote.service_description}
                          </h3>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            {formatCurrency(quote.estimated_amount)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Mis Servicios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className={getStatusColor(order.status)}>
                              {getStatusIcon(order.status)}
                              <span className="ml-1 capitalize">{order.status}</span>
                            </Badge>
                            <span className="font-mono text-sm text-muted-foreground">
                              #{order.order_number}
                            </span>
                            {order.needs_signature && (
                              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                                <Signature className="h-3 w-3 mr-1" />
                                Firma Pendiente
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            {order.services.map((service: any, index: number) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium">{service.service_name}</span>
                                <span className="text-muted-foreground ml-2">
                                  (Cant: {service.quantity})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="text-right space-y-2">
                          <div className="text-lg font-bold text-primary">
                            {formatCurrency(order.total_amount)}
                          </div>
                          {order.needs_signature && (
                            <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                              <Signature className="h-4 w-4 mr-1" />
                              Firmar
                            </Button>
                          )}
                          {order.status === 'finalizada' && (
                            <Button size="sm" variant="outline">
                              <Star className="h-4 w-4 mr-1" />
                              Calificar
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}