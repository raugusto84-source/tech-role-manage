/**
 * COMPONENTE: UserRanking
 * 
 * PROPÓSITO:
 * - Mostrar el ranking de usuarios basado en calificaciones de encuestas de satisfacción
 * - Calcular promedios de estrellas para técnicos y vendedores
 * - Mostrar estadísticas detalladas de desempeño
 * 
 * FUNCIONALIDADES:
 * - Ranking visual con estrellas
 * - Filtros por rol y período
 * - Estadísticas detalladas por usuario
 * - Exportación de reportes de desempeño
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Star, 
  Trophy, 
  TrendingUp, 
  Users, 
  Calendar,
  Award,
  Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserRankingData {
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  average_rating: number;
  total_surveys: number;
  technician_rating?: number;
  sales_rating?: number;
  technician_surveys?: number;
  sales_surveys?: number;
  overall_recommendation?: number;
  rank_position: number;
}

interface UserRankingProps {
  selectedPeriod?: string;
  selectedRole?: string;
}

export function UserRanking({ 
  selectedPeriod = 'all', 
  selectedRole = 'all' 
}: UserRankingProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [rankings, setRankings] = useState<UserRankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(selectedPeriod);
  const [roleFilter, setRoleFilter] = useState(selectedRole);

  useEffect(() => {
    if (profile?.role === 'administrador') {
      loadUserRankings();
    }
  }, [profile, period, roleFilter]);

  const loadUserRankings = async () => {
    try {
      setLoading(true);
      
      // Obtener encuestas con información de técnicos y vendedores
      let surveysQuery = supabase
        .from('order_satisfaction_surveys')
        .select(`
          *,
          orders!inner (
            assigned_technician,
            created_by
          )
        `);

      // Aplicar filtros de período
      if (period !== 'all') {
        const days = period === '30' ? 30 : period === '90' ? 90 : 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        surveysQuery = surveysQuery.gte('created_at', startDate.toISOString());
      }

      const surveysResponse = await surveysQuery;
      if (surveysResponse.error) throw surveysResponse.error;

      // Obtener información de perfiles
      const profilesResponse = await supabase
        .from('profiles')
        .select('user_id, full_name, email, role')
        .in('role', ['tecnico', 'vendedor', 'administrador']);

      if (profilesResponse.error) throw profilesResponse.error;

      const profilesMap = new Map(
        profilesResponse.data?.map(profile => [profile.user_id, profile]) || []
      );

      // Procesar datos de técnicos
      const technicianRatings = new Map<string, {
        user_id: string;
        user_name: string;
        user_email: string;
        user_role: string;
        ratings: number[];
        total_surveys: number;
        recommendations: number[];
      }>();

      // Procesar datos de vendedores
      const salesRatings = new Map<string, {
        user_id: string;
        user_name: string;
        user_email: string;
        user_role: string;
        ratings: number[];
        total_surveys: number;
        recommendations: number[];
      }>();

      surveysResponse.data?.forEach((survey: any) => {
        const order = survey.orders;
        
        // Procesar técnico asignado
        if (order?.assigned_technician) {
          const techProfile = profilesMap.get(order.assigned_technician);
          if (techProfile && techProfile.role === 'tecnico') {
            const key = techProfile.user_id;
            
            if (!technicianRatings.has(key)) {
              technicianRatings.set(key, {
                user_id: techProfile.user_id,
                user_name: techProfile.full_name,
                user_email: techProfile.email,
                user_role: techProfile.role,
                ratings: [],
                total_surveys: 0,
                recommendations: []
              });
            }
            
            const userRating = technicianRatings.get(key)!;
            if (survey.technician_knowledge) userRating.ratings.push(survey.technician_knowledge);
            if (survey.technician_customer_service) userRating.ratings.push(survey.technician_customer_service);
            if (survey.technician_attitude) userRating.ratings.push(survey.technician_attitude);
            if (survey.overall_recommendation) userRating.recommendations.push(survey.overall_recommendation);
            userRating.total_surveys++;
          }
        }

        // Procesar vendedor (created_by)
        if (order?.created_by) {
          const salesProfile = profilesMap.get(order.created_by);
          if (salesProfile && salesProfile.role === 'vendedor') {
            const key = salesProfile.user_id;
            
            if (!salesRatings.has(key)) {
              salesRatings.set(key, {
                user_id: salesProfile.user_id,
                user_name: salesProfile.full_name,
                user_email: salesProfile.email,
                user_role: salesProfile.role,
                ratings: [],
                total_surveys: 0,
                recommendations: []
              });
            }
            
            const userRating = salesRatings.get(key)!;
            if (survey.sales_knowledge) userRating.ratings.push(survey.sales_knowledge);
            if (survey.sales_customer_service) userRating.ratings.push(survey.sales_customer_service);
            if (survey.sales_attitude) userRating.ratings.push(survey.sales_attitude);
            if (survey.overall_recommendation) userRating.recommendations.push(survey.overall_recommendation);
            userRating.total_surveys++;
          }
        }
      });

      // Combinar y calcular rankings
      const allRankings: UserRankingData[] = [];

      // Procesar técnicos
      technicianRatings.forEach((data) => {
        if (roleFilter === 'all' || roleFilter === 'tecnico') {
          const average = data.ratings.length > 0 
            ? data.ratings.reduce((sum, rating) => sum + rating, 0) / data.ratings.length 
            : 0;
          const recommendation = data.recommendations.length > 0
            ? data.recommendations.reduce((sum, rec) => sum + rec, 0) / data.recommendations.length
            : 0;

          allRankings.push({
            user_id: data.user_id,
            user_name: data.user_name,
            user_email: data.user_email,
            user_role: data.user_role,
            average_rating: average,
            total_surveys: data.total_surveys,
            technician_rating: average,
            technician_surveys: data.total_surveys,
            overall_recommendation: recommendation,
            rank_position: 0 // Se calculará después
          });
        }
      });

      // Procesar vendedores
      salesRatings.forEach((data) => {
        if (roleFilter === 'all' || roleFilter === 'vendedor') {
          const average = data.ratings.length > 0 
            ? data.ratings.reduce((sum, rating) => sum + rating, 0) / data.ratings.length 
            : 0;
          const recommendation = data.recommendations.length > 0
            ? data.recommendations.reduce((sum, rec) => sum + rec, 0) / data.recommendations.length
            : 0;

          allRankings.push({
            user_id: data.user_id,
            user_name: data.user_name,
            user_email: data.user_email,
            user_role: data.user_role,
            average_rating: average,
            total_surveys: data.total_surveys,
            sales_rating: average,
            sales_surveys: data.total_surveys,
            overall_recommendation: recommendation,
            rank_position: 0 // Se calculará después
          });
        }
      });

      // Ordenar por calificación promedio y asignar posiciones
      allRankings.sort((a, b) => b.average_rating - a.average_rating);
      allRankings.forEach((ranking, index) => {
        ranking.rank_position = index + 1;
      });

      setRankings(allRankings);
    } catch (error) {
      console.error('Error loading user rankings:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los rankings de usuarios",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getRankingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-4 w-4 ${i < Math.round(rating) ? 'text-green-500 fill-green-500' : 'text-muted-foreground'}`} 
      />
    ));
  };

  const getRankingBadge = (position: number) => {
    if (position === 1) return <Badge className="bg-yellow-500 text-white"><Trophy className="h-3 w-3 mr-1" />1° Lugar</Badge>;
    if (position === 2) return <Badge className="bg-gray-400 text-white"><Award className="h-3 w-3 mr-1" />2° Lugar</Badge>;
    if (position === 3) return <Badge className="bg-amber-600 text-white"><Award className="h-3 w-3 mr-1" />3° Lugar</Badge>;
    return <Badge variant="outline">#{position}</Badge>;
  };

  const getRoleDisplay = (role: string) => {
    const roleMap = {
      'tecnico': 'Técnico',
      'vendedor': 'Vendedor',
      'administrador': 'Administrador'
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  if (profile?.role !== 'administrador') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Solo los administradores pueden ver los rankings de usuarios.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controles de filtro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Ranking de Usuarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tiempos</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                  <SelectItem value="90">Últimos 90 días</SelectItem>
                  <SelectItem value="365">Último año</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Rol</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="tecnico">Técnicos</SelectItem>
                  <SelectItem value="vendedor">Vendedores</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={loadUserRankings} className="w-full">
                <TrendingUp className="h-4 w-4 mr-2" />
                Actualizar Rankings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de rankings */}
      {rankings.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Sin datos de ranking</p>
              <p>
                No se encontraron encuestas de satisfacción para el período y filtros seleccionados.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rankings.map((ranking, index) => (
            <Card key={ranking.user_id} className={`${index < 3 ? 'border-primary' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      {getRankingBadge(ranking.rank_position)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{ranking.user_name}</h3>
                        <Badge variant="outline">{getRoleDisplay(ranking.user_role)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{ranking.user_email}</p>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          {getRankingStars(ranking.average_rating)}
                          <span className="text-sm font-medium ml-2">
                            {ranking.average_rating.toFixed(1)}
                          </span>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          {ranking.total_surveys} encuestas
                        </div>

                        {ranking.overall_recommendation && (
                          <div className="text-sm">
                            <Target className="h-3 w-3 inline mr-1" />
                            {ranking.overall_recommendation.toFixed(1)} rec.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {ranking.average_rating.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Promedio
                    </div>
                  </div>
                </div>

                {/* Detalles específicos por rol */}
                {(ranking.technician_rating || ranking.sales_rating) && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {ranking.technician_rating && (
                        <div>
                          <div className="font-medium text-muted-foreground mb-1">
                            Desempeño Técnico
                          </div>
                          <div className="flex items-center gap-2">
                            {getRankingStars(ranking.technician_rating)}
                            <span>{ranking.technician_rating.toFixed(1)}</span>
                            <span className="text-muted-foreground">
                              ({ranking.technician_surveys} evaluaciones)
                            </span>
                          </div>
                        </div>
                      )}

                      {ranking.sales_rating && (
                        <div>
                          <div className="font-medium text-muted-foreground mb-1">
                            Desempeño en Ventas
                          </div>
                          <div className="flex items-center gap-2">
                            {getRankingStars(ranking.sales_rating)}
                            <span>{ranking.sales_rating.toFixed(1)}</span>
                            <span className="text-muted-foreground">
                              ({ranking.sales_surveys} evaluaciones)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}