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
  technician_knowledge: number;
  technician_attitude: number;
  technician_customer_service: number;
  technician_comments?: string;
  sales_knowledge: number;
  sales_attitude: number;
  sales_customer_service: number;
  sales_comments?: string;
  overall_recommendation: number;
  general_comments?: string;
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
      
      // Load order satisfaction surveys
      const { data: surveys, error } = await supabase
        .from('order_satisfaction_surveys')
        .select(`
          *,
          orders!inner(
            order_number,
            assigned_technician,
            clients(name, email)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get technician profiles separately
      const surveyData = await Promise.all(
        (surveys || []).map(async (survey) => {
          if (survey.orders?.assigned_technician) {
            const { data: techProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', survey.orders.assigned_technician)
              .single();
            
            return {
              ...survey,
              technician_profile: techProfile
            };
          }
          return survey;
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
                  ? (orderSurveys.reduce((sum, s) => sum + ((s.technician_knowledge + s.technician_attitude + s.technician_customer_service) / 3), 0) / orderSurveys.length).toFixed(1)
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
                  ? (orderSurveys.reduce((sum, s) => sum + ((s.sales_knowledge + s.sales_attitude + s.sales_customer_service) / 3), 0) / orderSurveys.length).toFixed(1)
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
                          <p className="text-sm text-muted-foreground">Recomendación</p>
                          {renderStarRating(survey.overall_recommendation || 0)}
                        </div>
                      </div>

                      {/* Technical Ratings */}
                      <div>
                        <h4 className="font-medium mb-3 text-blue-700">Evaluación Técnica</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Conocimiento</p>
                            {renderStarRating(survey.technician_knowledge || 0)}
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Actitud</p>
                            {renderStarRating(survey.technician_attitude || 0)}
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Atención</p>
                            {renderStarRating(survey.technician_customer_service || 0)}
                          </div>
                        </div>
                        {survey.technician_comments && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm">"{survey.technician_comments}"</p>
                          </div>
                        )}
                      </div>

                      {/* Sales Ratings */}
                      <div>
                        <h4 className="font-medium mb-3 text-green-700">Evaluación Ventas</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Conocimiento</p>
                            {renderStarRating(survey.sales_knowledge || 0)}
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Actitud</p>
                            {renderStarRating(survey.sales_attitude || 0)}
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Atención</p>
                            {renderStarRating(survey.sales_customer_service || 0)}
                          </div>
                        </div>
                        {survey.sales_comments && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg">
                            <p className="text-sm">"{survey.sales_comments}"</p>
                          </div>
                        )}
                      </div>

                      {/* General Comments */}
                      {survey.general_comments && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm"><strong>Comentarios generales:</strong> "{survey.general_comments}"</p>
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