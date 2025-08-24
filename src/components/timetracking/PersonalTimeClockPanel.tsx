import { TimeClockWidget } from './TimeClockWidget';
import { TimeRecordsHistory } from './TimeRecordsHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, History } from 'lucide-react';
export function PersonalTimeClockPanel() {
  return <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Control de Tiempo Personal</h1>
      </div>

      <Tabs defaultValue="clock" className="w-full">
        
        
        <TabsContent value="clock" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Registro de Entrada y Salida</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeClockWidget />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history" className="mt-6">
          <TimeRecordsHistory />
        </TabsContent>
      </Tabs>
    </div>;
}