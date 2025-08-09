import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Star, Search, Eye, Users, BarChart3, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TechnicianSurvey {
  id: string;
  order_id: string;
  client_id: string;
  technician_knowledge: number | null;
  technician_customer_service: number | null;
  technician_attitude: number | null;
  technician_comments: string | null;
  overall_recommendation: number | null;
  general_comments: string | null;
  created_at: string;
  updated_at: string;
  order?: {
    order_number: string;
    assigned_technician: string;
  } | null;
  client?: {
    full_name: string;
    email: string;
  } | null;
  technician?: {
    full_name: string;
  } | null;
}

interface SalesSurvey {
  id: string;
  quote_id: string;
  client_id: string;
  sales_knowledge: number | null;
  sales_customer_service: number | null;
  sales_attitude: number | null;
  sales_comments: string | null;
  overall_recommendation: number | null;
  general_comments: string | null;
  created_at: string;
  updated_at: string;
  quote?: {
    quote_number: string;
    created_by: string;
  } | null;
  client?: {
    full_name: string;
    email: string;
  } | null;
  salesperson?: {
    full_name: string;
  } | null;
}

const StarRating = ({ value }: { value: number | null }) => {
  if (value === null) return <span className="text-muted-foreground text-sm">Sin evaluar</span>;
  if (value === 0) return <Badge variant="outline">Omitida</Badge>;
  
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={14}
          className={`${
            i < value 
              ? 'fill-yellow-400 text-yellow-400' 
              : 'text-muted-foreground'
          }`}
        />
      ))}
      <span className="text-sm text-muted-foreground ml-1">({value}/5)</span>
    </div>
  );
};

export default function Surveys() {
  const [technicianSurveys, setTechnicianSurveys] = useState<TechnicianSurvey[]>([]);
  const [salesSurveys, setSalesSurveys] = useState<SalesSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [surveyType, setSurveyType] = useState<'technician' | 'sales'>('technician');
  const { toast } = useToast();

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    try {
      setLoading(true);
      
      // Cargar encuestas de técnicos con información de órdenes
      const { data: techSurveys, error: techError } = await supabase
        .from('technician_satisfaction_surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (techError) throw techError;

      // Cargar información adicional para encuestas de técnicos
      const techSurveysWithDetails = [];
      for (const survey of techSurveys || []) {
        // Obtener información de la orden
        const { data: order } = await supabase
          .from('orders')
          .select('order_number, assigned_technician')
          .eq('id', survey.order_id)
          .single();

        // Obtener información del cliente
        const { data: client } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', survey.client_id)
          .single();

        // Obtener información del técnico
        let technician = null;
        if (order?.assigned_technician) {
          const { data: techData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', order.assigned_technician)
            .single();
          technician = techData;
        }

        techSurveysWithDetails.push({
          ...survey,
          order,
          client,
          technician
        });
      }

      setTechnicianSurveys(techSurveysWithDetails);

      // Cargar encuestas de ventas con información de cotizaciones
      const { data: saleSurveys, error: salesError } = await supabase
        .from('sales_satisfaction_surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      // Cargar información adicional para encuestas de ventas
      const saleSurveysWithDetails = [];
      for (const survey of saleSurveys || []) {
        // Obtener información de la cotización
        const { data: quote } = await supabase
          .from('quotes')
          .select('quote_number, created_by')
          .eq('id', survey.quote_id)
          .single();

        // Obtener información del cliente
        const { data: client } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', survey.client_id)
          .single();

        // Obtener información del vendedor
        let salesperson = null;
        if (quote?.created_by) {
          const { data: salesData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', quote.created_by)
            .single();
          salesperson = salesData;
        }

        saleSurveysWithDetails.push({
          ...survey,
          quote,
          client,
          salesperson
        });
      }

      setSalesSurveys(saleSurveysWithDetails);

    } catch (error) {
      console.error('Error loading surveys:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las encuestas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredSurveys = (surveys: any[]) => {
    return surveys.filter(survey => {
      // Filtro por término de búsqueda
      const searchMatch = 
        survey.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        survey.client?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (surveyType === 'technician' && survey.order?.order_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (surveyType === 'sales' && survey.quote?.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()));

      // Filtro por estado
      const isCompleted = surveyType === 'technician' 
        ? survey.technician_knowledge !== null 
        : survey.sales_knowledge !== null;

      const statusMatch = statusFilter === 'all' || 
        (statusFilter === 'completed' && isCompleted) ||
        (statusFilter === 'pending' && !isCompleted);

      return searchMatch && statusMatch;
    });
  };

  const getSurveyStatus = (survey: any) => {
    const isCompleted = surveyType === 'technician' 
      ? survey.technician_knowledge !== null 
      : survey.sales_knowledge !== null;
    
    return isCompleted ? 'completed' : 'pending';
  };

  const getAverageRating = (survey: any) => {
    if (surveyType === 'technician') {
      const ratings = [
        survey.technician_knowledge,
        survey.technician_customer_service,
        survey.technician_attitude,
        survey.overall_recommendation
      ].filter(r => r !== null && r > 0);
      
      return ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 'N/A';
    } else {
      const ratings = [
        survey.sales_knowledge,
        survey.sales_customer_service,
        survey.sales_attitude,
        survey.overall_recommendation
      ].filter(r => r !== null && r > 0);
      
      return ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 'N/A';
    }
  };

  const getStats = (surveys: any[]) => {
    const completed = surveys.filter(s => getSurveyStatus(s) === 'completed').length;
    const pending = surveys.filter(s => getSurveyStatus(s) === 'pending').length;
    const total = surveys.length;
    
    return { completed, pending, total };
  };

  const renderSurveyDetails = (survey: any, type: 'technician' | 'sales') => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium">Cliente:</span>
          <p>{survey.client?.full_name}</p>
          <p className="text-muted-foreground">{survey.client?.email}</p>
        </div>
        <div>
          <span className="font-medium">
            {type === 'technician' ? 'Orden:' : 'Cotización:'}
          </span>
          <p>{type === 'technician' ? survey.order?.order_number : survey.quote?.quote_number}</p>
          <p className="text-muted-foreground">
            {type === 'technician' ? survey.technician?.full_name : survey.salesperson?.full_name}
          </p>
        </div>
      </div>

      {getSurveyStatus(survey) === 'completed' && (
        <>
          <div className="space-y-3">
            <h4 className="font-medium">Calificaciones</h4>
            {type === 'technician' ? (
              <>
                <div className="flex justify-between items-center">
                  <span>Conocimiento Técnico:</span>
                  <StarRating value={survey.technician_knowledge} />
                </div>
                <div className="flex justify-between items-center">
                  <span>Atención al Cliente:</span>
                  <StarRating value={survey.technician_customer_service} />
                </div>
                <div className="flex justify-between items-center">
                  <span>Actitud:</span>
                  <StarRating value={survey.technician_attitude} />
                </div>
                <div className="flex justify-between items-center">
                  <span>Recomendación:</span>
                  <StarRating value={survey.overall_recommendation} />
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span>Conocimiento:</span>
                  <StarRating value={survey.sales_knowledge} />
                </div>
                <div className="flex justify-between items-center">
                  <span>Atención al Cliente:</span>
                  <StarRating value={survey.sales_customer_service} />
                </div>
                <div className="flex justify-between items-center">
                  <span>Actitud:</span>
                  <StarRating value={survey.sales_attitude} />
                </div>
                <div className="flex justify-between items-center">
                  <span>Recomendación:</span>
                  <StarRating value={survey.overall_recommendation} />
                </div>
              </>
            )}
          </div>

          {((type === 'technician' && survey.technician_comments) || 
            (type === 'sales' && survey.sales_comments)) && (
            <div>
              <span className="font-medium text-sm">Comentarios específicos:</span>
              <p className="text-sm text-muted-foreground mt-1">
                {type === 'technician' ? survey.technician_comments : survey.sales_comments}
              </p>
            </div>
          )}

          {survey.general_comments && (
            <div>
              <span className="font-medium text-sm">Comentarios generales:</span>
              <p className="text-sm text-muted-foreground mt-1">{survey.general_comments}</p>
            </div>
          )}
        </>
      )}

      <div className="text-xs text-muted-foreground">
        Creada: {format(new Date(survey.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
      </div>
    </div>
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Panel de Encuestas</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona y revisa las encuestas de satisfacción de clientes
          </p>
        </div>

        <Tabs defaultValue="technician" onValueChange={(value) => setSurveyType(value as 'technician' | 'sales')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="technician" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Encuestas de Técnicos
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Encuestas de Ventas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="technician" className="space-y-6">
            {/* Estadísticas de técnicos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(() => {
                const stats = getStats(technicianSurveys);
                return (
                  <>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="ml-2 text-sm font-medium">Total</span>
                        </div>
                        <div className="text-2xl font-bold">{stats.total}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="ml-2 text-sm font-medium">Completadas</span>
                        </div>
                        <div className="text-2xl font-bold">{stats.completed}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-orange-600" />
                          <span className="ml-2 text-sm font-medium">Pendientes</span>
                        </div>
                        <div className="text-2xl font-bold">{stats.pending}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-600" />
                          <span className="ml-2 text-sm font-medium">Tasa Completado</span>
                        </div>
                        <div className="text-2xl font-bold">
                          {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                        </div>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>

            {/* Filtros */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente, email o número de orden..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="completed">Completadas</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de encuestas de técnicos */}
            <div className="space-y-4">
              {getFilteredSurveys(technicianSurveys).map((survey) => (
                <Card key={survey.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{survey.client?.full_name}</h3>
                          <Badge variant={getSurveyStatus(survey) === 'completed' ? 'default' : 'secondary'}>
                            {getSurveyStatus(survey) === 'completed' ? 'Completada' : 'Pendiente'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Orden: {survey.order?.order_number}</p>
                          <p>Técnico: {survey.technician?.full_name || 'No asignado'}</p>
                          <p>Cliente: {survey.client?.email}</p>
                        </div>
                        {getSurveyStatus(survey) === 'completed' && (
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm">Promedio: {getAverageRating(survey)}/5</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedSurvey(survey)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalles
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Detalles de la Encuesta - Técnico</DialogTitle>
                            </DialogHeader>
                            {selectedSurvey && renderSurveyDetails(selectedSurvey, 'technician')}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sales" className="space-y-6">
            {/* Estadísticas de ventas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(() => {
                const stats = getStats(salesSurveys);
                return (
                  <>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <span className="ml-2 text-sm font-medium">Total</span>
                        </div>
                        <div className="text-2xl font-bold">{stats.total}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="ml-2 text-sm font-medium">Completadas</span>
                        </div>
                        <div className="text-2xl font-bold">{stats.completed}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-orange-600" />
                          <span className="ml-2 text-sm font-medium">Pendientes</span>
                        </div>
                        <div className="text-2xl font-bold">{stats.pending}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-600" />
                          <span className="ml-2 text-sm font-medium">Tasa Completado</span>
                        </div>
                        <div className="text-2xl font-bold">
                          {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                        </div>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>

            {/* Filtros */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente, email o número de cotización..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="completed">Completadas</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de encuestas de ventas */}
            <div className="space-y-4">
              {getFilteredSurveys(salesSurveys).map((survey) => (
                <Card key={survey.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{survey.client?.full_name}</h3>
                          <Badge variant={getSurveyStatus(survey) === 'completed' ? 'default' : 'secondary'}>
                            {getSurveyStatus(survey) === 'completed' ? 'Completada' : 'Pendiente'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Cotización: {survey.quote?.quote_number}</p>
                          <p>Vendedor: {survey.salesperson?.full_name || 'No asignado'}</p>
                          <p>Cliente: {survey.client?.email}</p>
                        </div>
                        {getSurveyStatus(survey) === 'completed' && (
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm">Promedio: {getAverageRating(survey)}/5</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedSurvey(survey)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalles
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Detalles de la Encuesta - Ventas</DialogTitle>
                            </DialogHeader>
                            {selectedSurvey && renderSurveyDetails(selectedSurvey, 'sales')}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}