import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FleetGroupManager } from '@/components/fleets/FleetGroupManager';
import { FleetGroupList } from '@/components/fleets/FleetGroupList';
import { FleetAssignments } from '@/components/fleets/FleetAssignments';
import { Truck, Users, Settings, ClipboardList } from 'lucide-react';

/**
 * Página principal del módulo de Flotillas
 * Gestiona grupos de técnicos y vehículos con sus asignaciones
 */
export default function Fleets() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg text-white">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Flotillas</h1>
              <p className="text-muted-foreground">
                Gestiona grupos de técnicos y vehículos para optimizar las operaciones
              </p>
            </div>
          </div>

          <Tabs defaultValue="grupos" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="grupos" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Gestión de Grupos
              </TabsTrigger>
              <TabsTrigger value="lista" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Lista de Flotillas
              </TabsTrigger>
              <TabsTrigger value="asignaciones" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Asignaciones
              </TabsTrigger>
            </TabsList>

            <TabsContent value="grupos" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Gestión de Grupos de Flotilla
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FleetGroupManager onGroupSelect={setSelectedGroupId} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lista" className="space-y-6">
              <FleetGroupList onGroupSelect={setSelectedGroupId} />
            </TabsContent>

            <TabsContent value="asignaciones" className="space-y-6">
              {selectedGroupId ? (
                <FleetAssignments groupId={selectedGroupId} />
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Selecciona un grupo de flotilla para ver las asignaciones</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}