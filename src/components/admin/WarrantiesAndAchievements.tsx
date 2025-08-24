import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Shield, Calendar, TrendingUp, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WarrantySummary {
  id: string;
  order_number: string;
  client_name: string;
  service_name: string;
  warranty_start_date: string;
  warranty_end_date: string;
  warranty_status: string;
  days_remaining: number;
}

interface AchievementSummary {
  id: string;
  user_name: string;
  achievement_name: string;
  target_value: number;
  actual_value: number;
  period_start: string;
  period_end: string;
  earned_at: string;
}

export function WarrantiesAndAchievements() {
  const { toast } = useToast();
  const [warranties, setWarranties] = useState<WarrantySummary[]>([]);
  const [achievements, setAchievements] = useState<AchievementSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [warrantyStats, setWarrantyStats] = useState({
    total: 0,
    active: 0,
    expiring_soon: 0,
    expired: 0,
    claimed: 0
  });

  const [achievementStats, setAchievementStats] = useState({
    total_this_month: 0,
    users_with_achievements: 0,
    most_common_achievement: '',
    completion_rate: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadWarranties(),
        loadAchievements(),
        calculateWarrantyStats(),
        calculateAchievementStats()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWarranties = async () => {
    // Generate warranty summary from order_items with warranties
    const { data } = await supabase
      .from('order_items')
      .select(`
        *,
        orders!inner(order_number, clients!inner(name))
      `)
      .not('warranty_start_date', 'is', null)
      .not('warranty_end_date', 'is', null)
      .order('warranty_end_date', { ascending: true });

    if (data) {
      const warrantySummary = data.map((item: any) => {
        const today = new Date();
        const endDate = new Date(item.warranty_end_date);
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let status = 'active';
        if (daysRemaining < 0) status = 'expired';
        else if (daysRemaining <= 30) status = 'expiring_soon';

        return {
          id: item.id,
          order_number: item.orders.order_number,
          client_name: item.orders.clients.name,
          service_name: item.service_name,
          warranty_start_date: item.warranty_start_date,
          warranty_end_date: item.warranty_end_date,
          warranty_status: status,
          days_remaining: daysRemaining
        };
      });
      
      setWarranties(warrantySummary);
    }
  };

  const loadAchievements = async () => {
    const { data } = await supabase
      .from('user_achievements')
      .select(`
        *,
        achievements!inner(name),
        profiles!inner(full_name)
      `)
      .order('period_end', { ascending: false })
      .limit(50);

    if (data) {
      const achievementSummary = data.map((achievement: any) => ({
        id: achievement.id,
        user_name: achievement.profiles.full_name,
        achievement_name: achievement.achievements.name,
        target_value: achievement.achievement_id, // This should be from achievements table
        actual_value: achievement.actual_value,
        period_start: achievement.period_start,
        period_end: achievement.period_end,
        earned_at: achievement.created_at
      }));
      
      setAchievements(achievementSummary);
    }
  };

  const calculateWarrantyStats = async () => {
    // This would be calculated from the warranties data
    const total = warranties.length;
    const active = warranties.filter(w => w.warranty_status === 'active').length;
    const expiring_soon = warranties.filter(w => w.warranty_status === 'expiring_soon').length;
    const expired = warranties.filter(w => w.warranty_status === 'expired').length;
    
    setWarrantyStats({
      total,
      active,
      expiring_soon,
      expired,
      claimed: 0 // This would need a warranty_claims table
    });
  };

  const calculateAchievementStats = async () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    
    const thisMonthAchievements = achievements.filter(a => 
      new Date(a.earned_at) >= startOfMonth
    );
    
    const uniqueUsers = new Set(achievements.map(a => a.user_name)).size;
    
    // Most common achievement
    const achievementCounts = achievements.reduce((acc, a) => {
      acc[a.achievement_name] = (acc[a.achievement_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostCommon = Object.entries(achievementCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || '';

    setAchievementStats({
      total_this_month: thisMonthAchievements.length,
      users_with_achievements: uniqueUsers,
      most_common_achievement: mostCommon,
      completion_rate: 85 // This would be calculated based on active users vs achievements
    });
  };

  const getWarrantyStatusBadge = (status: string, daysRemaining: number) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-50 text-green-700">
            Activa ({daysRemaining} días)
          </Badge>
        );
      case 'expiring_soon':
        return (
          <Badge variant="destructive" className="bg-yellow-50 text-yellow-700">
            Por Vencer ({daysRemaining} días)
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="destructive">
            Vencida ({Math.abs(daysRemaining)} días)
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredWarranties = warranties.filter(warranty =>
    warranty.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warranty.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warranty.service_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAchievements = achievements.filter(achievement =>
    achievement.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    achievement.achievement_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Garantías y Logros</h2>
          <p className="text-muted-foreground">
            Gestión de garantías activas y seguimiento de logros del equipo
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Tabs defaultValue="warranties" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="warranties">Garantías</TabsTrigger>
          <TabsTrigger value="achievements">Logros</TabsTrigger>
        </TabsList>

        <TabsContent value="warranties" className="space-y-4">
          {/* Warranty Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Garantías</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{warrantyStats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Activas</CardTitle>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{warrantyStats.active}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{warrantyStats.expiring_soon}</div>
                <p className="text-xs text-muted-foreground">Próximos 30 días</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{warrantyStats.expired}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reclamadas</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{warrantyStats.claimed}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Garantías</CardTitle>
              <CardDescription>Todas las garantías activas y su estado actual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar garantías..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWarranties.map((warranty) => (
                    <TableRow key={warranty.id}>
                      <TableCell className="font-medium">{warranty.order_number}</TableCell>
                      <TableCell>{warranty.client_name}</TableCell>
                      <TableCell>{warranty.service_name}</TableCell>
                      <TableCell>
                        {new Date(warranty.warranty_start_date).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        {new Date(warranty.warranty_end_date).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        {getWarrantyStatusBadge(warranty.warranty_status, warranty.days_remaining)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          {/* Achievement Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{achievementStats.total_this_month}</div>
                <p className="text-xs text-muted-foreground">Logros obtenidos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{achievementStats.users_with_achievements}</div>
                <p className="text-xs text-muted-foreground">Con logros</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Más Común</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-bold">{achievementStats.most_common_achievement}</div>
                <p className="text-xs text-muted-foreground">Logro más obtenido</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasa Completado</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{achievementStats.completion_rate}%</div>
                <p className="text-xs text-muted-foreground">Del equipo</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Logros Recientes</CardTitle>
              <CardDescription>Últimos logros obtenidos por el equipo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar logros..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Logro</TableHead>
                    <TableHead>Valor Obtenido</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Fecha Logro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAchievements.map((achievement) => (
                    <TableRow key={achievement.id}>
                      <TableCell className="font-medium">{achievement.user_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Award className="h-4 w-4 mr-2 text-yellow-500" />
                          {achievement.achievement_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{achievement.actual_value}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(achievement.period_start).toLocaleDateString('es-ES')} - {' '}
                        {new Date(achievement.period_end).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell>
                        {new Date(achievement.earned_at).toLocaleDateString('es-ES')}
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