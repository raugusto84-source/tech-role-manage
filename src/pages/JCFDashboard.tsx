import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PersonalTimeClockPanel } from '@/components/timetracking/PersonalTimeClockPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PasswordChangeForm } from '@/components/auth/PasswordChangeForm';
import { ClipboardList, FileText, Clock, Settings, User } from 'lucide-react';

export default function JCFDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('timeclock');

  if (!profile || profile.role !== 'jcf') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Acceso Restringido</h1>
          <p className="text-muted-foreground">Esta sección es solo para personal JCF.</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Panel JCF</h1>
            <p className="text-muted-foreground mt-1">
              Bienvenido, {profile.full_name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => signOut()}>
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate('/orders')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Órdenes</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Ver y gestionar órdenes de servicio
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate('/quotes')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cotizaciones</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Ver cotizaciones disponibles
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setActiveTab('timeclock')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reloj de Tiempo</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Registrar entrada y salida
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="timeclock" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Reloj de Tiempo</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>Configuración</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeclock" className="mt-4">
            <PersonalTimeClockPanel />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Mi Cuenta
                </CardTitle>
                <CardDescription>
                  Configuración de tu cuenta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <p className="text-sm font-medium">Nombre:</p>
                  <p className="text-sm text-muted-foreground">{profile.full_name}</p>
                </div>
                <div className="grid gap-2">
                  <p className="text-sm font-medium">Usuario:</p>
                  <p className="text-sm text-muted-foreground">{profile.username}</p>
                </div>
                <div className="grid gap-2">
                  <p className="text-sm font-medium">Email:</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
                <div className="pt-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Cambiar Contraseña</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cambiar Contraseña</DialogTitle>
                      </DialogHeader>
                      <PasswordChangeForm />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
