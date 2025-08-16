import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatabaseAdminPanel } from '@/components/admin/DatabaseAdminPanel';
import { WarrantyManager } from '@/components/warranty/WarrantyManager';
import { Database, Settings as SettingsIcon, Shield, Users } from 'lucide-react';

export default function Settings() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Configuración del Sistema</h1>
            <p className="text-muted-foreground mt-2">
              Administra la configuración general del sistema y la base de datos
            </p>
          </div>

          <Tabs defaultValue="database" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="database" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Base de Datos
              </TabsTrigger>
              <TabsTrigger value="warranties" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Garantías
              </TabsTrigger>
              <TabsTrigger value="general" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Seguridad
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Usuarios
              </TabsTrigger>
            </TabsList>

            <TabsContent value="database" className="space-y-6">
              <DatabaseAdminPanel />
            </TabsContent>

            <TabsContent value="warranties" className="space-y-6">
              <WarrantyManager />
            </TabsContent>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración General</CardTitle>
                  <CardDescription>
                    Configuraciones básicas del sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Esta sección estará disponible pronto.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración de Seguridad</CardTitle>
                  <CardDescription>
                    Gestiona políticas de seguridad y permisos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Esta sección estará disponible pronto.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración de Usuarios</CardTitle>
                  <CardDescription>
                    Configuraciones relacionadas con usuarios y roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Esta sección estará disponible pronto.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}