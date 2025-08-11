import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Star, Calendar } from 'lucide-react';

interface OrderSatisfactionSurvey {
  id: string;
  order_id: string;
  client_id: string;
  service_quality: number;
  service_time: number;
  would_recommend: number;
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
          service_quality,
          service_time,
          would_recommend,
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
          
          if (survey.orders?.assigned_technician) {
            const { data: tech } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', survey.orders.assigned_technician)
              .single();
            techProfile = tech;
          }
          
          return {
            id: survey.id,
            order_id: survey.order_id,
            client_id: survey.client_id,
            service_quality: survey.service_quality || 0,
            service_time: survey.service_time || 0,
            would_recommend: survey.would_recommend || 0,
            general_comments: survey.general_comments,
            created_at: survey.created_at,
            orders: survey.orders,
            technician_profile: techProfile
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
    
    const surveyDate = new Date(survey.created_at);
    const matchesDateRange = 
      (!startDate || surveyDate >= new Date(startDate)) &&
      (!endDate || surveyDate <= new Date(endDate + 'T23:59:59'));
    
    return matchesSearch && matchesDateRange;
  });

  // Calculate averages by technician (based on filtered data)
  const technicianAverages = filteredSurveys.reduce((acc, survey) => {
    const techName = survey.technician_profile?.full_name || 'Sin asignar';
    if (!acc[techName]) {
      acc[techName] = { surveys: [], avgQuality: 0, avgTime: 0, avgRecommend: 0, count: 0 };
    }
    acc[techName].surveys.push(survey);
    acc[techName].count++;
    return acc;
  }, {} as Record<string, any>);

  // Calculate actual averages
  Object.keys(technicianAverages).forEach(techName => {
    const surveys = technicianAverages[techName].surveys;
    const qualityAvg = surveys.reduce((sum: number, s: OrderSatisfactionSurvey) => 
      sum + s.service_quality, 0) / surveys.length;
    const timeAvg = surveys.reduce((sum: number, s: OrderSatisfactionSurvey) => 
      sum + s.service_time, 0) / surveys.length;
    const recommendAvg = surveys.reduce((sum: number, s: OrderSatisfactionSurvey) => 
      sum + s.would_recommend, 0) / surveys.length;
    
    technicianAverages[techName].avgQuality = qualityAvg;
    technicianAverages[techName].avgTime = timeAvg;
    technicianAverages[techName].avgRecommend = recommendAvg;
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
                    <span>Calidad:</span>
                    <span className="font-medium">{data.avgQuality.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tiempo:</span>
                    <span className="font-medium">{data.avgTime.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Recomendación:</span>
                    <span className="font-medium">{data.avgRecommend.toFixed(1)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.count} encuesta{data.count !== 1 ? 's' : ''}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtrar por período:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Desde:</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-auto"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Hasta:</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-auto"
            />
          </div>
          {(startDate || endDate) && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Encuestas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredSurveys.length}</div>
              <p className="text-xs text-muted-foreground">
                {startDate || endDate ? 'En período seleccionado' : 'Total histórico'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Promedio Calidad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredSurveys.length > 0 
                  ? (filteredSurveys.reduce((sum, s) => sum + s.service_quality, 0) / filteredSurveys.length).toFixed(1)
                  : '0'
                }
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Promedio Tiempo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredSurveys.length > 0 
                  ? (filteredSurveys.reduce((sum, s) => sum + s.service_time, 0) / filteredSurveys.length).toFixed(1)
                  : '0'
                }
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Promedio Recomendación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredSurveys.length > 0 
                  ? (filteredSurveys.reduce((sum, s) => sum + s.would_recommend, 0) / filteredSurveys.length).toFixed(1)
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
                          <p className="text-sm text-muted-foreground">Promedio General</p>
                          {renderStarRating(Math.round((survey.service_quality + survey.service_time + survey.would_recommend) / 3))}
                        </div>
                      </div>

                      {/* Simplified Survey Questions */}
                      <div className="space-y-6">
                        {/* Question 1: Service Quality */}
                        <div className="p-4 border rounded-lg bg-blue-50/50">
                          <h4 className="font-medium mb-2 text-blue-700">
                            1. ¿Cómo califica la calidad del servicio recibido?
                          </h4>
                          {renderStarRating(survey.service_quality || 0)}
                        </div>

                        {/* Question 2: Service Time */}
                        <div className="p-4 border rounded-lg bg-green-50/50">
                          <h4 className="font-medium mb-2 text-green-700">
                            2. ¿Cómo califica la puntualidad del servicio?
                          </h4>
                          {renderStarRating(survey.service_time || 0)}
                        </div>

                        {/* Question 3: Would Recommend */}
                        <div className="p-4 border rounded-lg bg-purple-50/50">
                          <h4 className="font-medium mb-2 text-purple-700">
                            3. ¿Recomendaría nuestros servicios a otros?
                          </h4>
                          {renderStarRating(survey.would_recommend || 0)}
                        </div>
                      </div>

                      {/* Comments */}
                      {survey.general_comments && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm"><strong>Comentarios:</strong> "{survey.general_comments}"</p>
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