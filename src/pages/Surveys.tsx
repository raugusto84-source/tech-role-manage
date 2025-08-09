import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Star } from 'lucide-react';

interface OrderSatisfactionSurvey {
  id: string;
  order_id: string;
  client_id: string;
  technician_rating: number;
  sales_rating: number;
  overall_rating: number;
  comments?: string;
  created_at: string;
  orders?: {
    order_number: string;
    assigned_technician?: string;
    clients?: {
      name: string;
      email: string;
    };
  };
  technician_profile?: {
    full_name: string;
  };
  sales_profile?: {
    full_name: string;
  };
}

export default function Surveys() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [orderSurveys, setOrderSurveys] = useState<OrderSatisfactionSurvey[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (profile?.role === 'administrador') {
      loadSurveys();
    }
  }, [profile]);

  const loadSurveys = async () => {
    try {
      setLoading(true);
      
      // Load order satisfaction surveys with simplified structure
      const { data: surveys, error } = await supabase
        .from('order_satisfaction_surveys')
        .select(`
          id,
          order_id,
          client_id,
          technician_knowledge,
          sales_knowledge,
          overall_recommendation,
          general_comments,
          created_at,
          orders!inner(
            order_number,
            assigned_technician,
            clients(name, email)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get technician and sales profiles
      const surveyData = await Promise.all(
        (surveys || []).map(async (survey) => {
          let techProfile = null;
          let salesProfile = null;
          
          if (survey.orders?.assigned_technician) {
            const { data: tech } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', survey.orders.assigned_technician)
              .single();
            techProfile = tech;
          }
          
          // Get sales person - for now we'll use a default or first admin/vendedor
          const { data: sales } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('role', 'vendedor')
            .limit(1)
            .single();
          salesProfile = sales;
          
          return {
            id: survey.id,
            order_id: survey.order_id,
            client_id: survey.client_id,
            technician_rating: survey.technician_knowledge || 0,
            sales_rating: survey.sales_knowledge || 0,
            overall_rating: survey.overall_recommendation || 0,
            comments: survey.general_comments,
            created_at: survey.created_at,
            orders: survey.orders,
            technician_profile: techProfile,
            sales_profile: salesProfile
          };
        })
      );

      setOrderSurveys(surveyData);
      
    } catch (error) {
      console.error('Error loading surveys:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las encuestas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
        <span className="ml-2 text-sm text-muted-foreground">({rating})</span>
      </div>
    );
  };

  const filteredSurveys = orderSurveys.filter(survey => {
    const matchesSearch = 
      survey.orders?.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      survey.orders?.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      survey.technician_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Calculate averages by technician
  const technicianAverages = orderSurveys.reduce((acc, survey) => {
    const techName = survey.technician_profile?.full_name || 'Sin asignar';
    if (!acc[techName]) {
      acc[techName] = { surveys: [], avgTech: 0, avgSales: 0, count: 0 };
    }
    acc[techName].surveys.push(survey);
    acc[techName].count++;
    return acc;
  }, {} as Record<string, any>);

  // Calculate actual averages
  Object.keys(technicianAverages).forEach(techName => {
    const surveys = technicianAverages[techName].surveys;
    const techAvg = surveys.reduce((sum: number, s: OrderSatisfactionSurvey) => 
      sum + s.technician_rating, 0) / surveys.length;
    const salesAvg = surveys.reduce((sum: number, s: OrderSatisfactionSurvey) => 
      sum + s.sales_rating, 0) / surveys.length;
    
    technicianAverages[techName].avgTech = techAvg;
    technicianAverages[techName].avgSales = salesAvg;
  });

  if (profile?.role !== 'administrador') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No tienes permisos para ver las encuestas.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Panel de Encuestas de Satisfacción</h1>
          <p className="text-muted-foreground">Encuestas de órdenes completadas</p>
        </header>

        {/* Statistics by Technician */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Promedios por Técnico</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(technicianAverages).map(([techName, data]) => (
              <Card key={techName}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{techName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Técnico:</span>
                    <span className="font-medium">{data.avgTech.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Ventas:</span>
                    <span className="font-medium">{data.avgSales.toFixed(1)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.count} encuesta{data.count !== 1 ? 's' : ''}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Encuestas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orderSurveys.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Promedio Técnico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orderSurveys.length > 0 
                  ? (orderSurveys.reduce((sum, s) => sum + s.technician_rating, 0) / orderSurveys.length).toFixed(1)
                  : '0'
                }
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Promedio Ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orderSurveys.length > 0 
                  ? (orderSurveys.reduce((sum, s) => sum + s.sales_rating, 0) / orderSurveys.length).toFixed(1)
                  : '0'
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por número de orden, cliente o técnico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Surveys List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredSurveys.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No se encontraron encuestas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredSurveys.map((survey) => (
                <Card key={survey.id}>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <h3 className="font-semibold text-lg">{survey.orders?.order_number}</h3>
                          <Badge variant="outline">{survey.orders?.clients?.name}</Badge>
                          {survey.technician_profile?.full_name && (
                            <Badge variant="secondary">Técnico: {survey.technician_profile.full_name}</Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Evaluación General SYSLAG</p>
                          {renderStarRating(survey.overall_rating || 0)}
                        </div>
                      </div>

                      {/* Simplified Survey Questions */}
                      <div className="space-y-6">
                        {/* Question 1: Technician Evaluation */}
                        <div className="p-4 border rounded-lg bg-blue-50/50">
                          <h4 className="font-medium mb-2 text-blue-700">
                            1. ¿Cómo evalúas al Técnico "{survey.technician_profile?.full_name || 'Sin asignar'}"?
                          </h4>
                          {renderStarRating(survey.technician_rating || 0)}
                        </div>

                        {/* Question 2: Sales/Customer Service Evaluation */}
                        <div className="p-4 border rounded-lg bg-green-50/50">
                          <h4 className="font-medium mb-2 text-green-700">
                            2. ¿Cómo evalúas la Atención a Clientes "{survey.sales_profile?.full_name || 'Departamento de Ventas'}"?
                          </h4>
                          {renderStarRating(survey.sales_rating || 0)}
                        </div>

                        {/* Question 3: Overall SYSLAG Evaluation */}
                        <div className="p-4 border rounded-lg bg-purple-50/50">
                          <h4 className="font-medium mb-2 text-purple-700">
                            3. En general, ¿cómo evalúas a SYSLAG?
                          </h4>
                          {renderStarRating(survey.overall_rating || 0)}
                        </div>
                      </div>

                      {/* Comments */}
                      {survey.comments && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm"><strong>Comentarios:</strong> "{survey.comments}"</p>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex justify-between items-center pt-3 border-t text-xs text-muted-foreground">
                        <span>Cliente: {survey.orders?.clients?.email}</span>
                        <span>{new Date(survey.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}