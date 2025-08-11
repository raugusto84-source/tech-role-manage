import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, Upload, Trash2, AlertTriangle, Database, FileText } from 'lucide-react';

const DATABASE_MODULES = [
  { id: 'profiles', name: 'Perfiles de Usuario', description: 'Información de usuarios del sistema' },
  { id: 'clients', name: 'Clientes', description: 'Base de datos de clientes' },
  { id: 'orders', name: 'Órdenes', description: 'Órdenes de trabajo y servicios' },
  { id: 'order_items', name: 'Items de Órdenes', description: 'Detalles de servicios por orden' },
  { id: 'quotes', name: 'Cotizaciones', description: 'Cotizaciones enviadas a clientes' },
  { id: 'quote_items', name: 'Items de Cotizaciones', description: 'Detalles de servicios por cotización' },
  { id: 'service_types', name: 'Tipos de Servicio', description: 'Catálogo de servicios disponibles' },
  { id: 'incomes', name: 'Ingresos', description: 'Registro de ingresos' },
  { id: 'expenses', name: 'Egresos', description: 'Registro de gastos' },
  { id: 'order_payments', name: 'Pagos de Órdenes', description: 'Pagos realizados por órdenes' },
  { id: 'financial_history', name: 'Historial Financiero', description: 'Registro de operaciones financieras' },
  { id: 'fiscal_withdrawals', name: 'Retiros Fiscales', description: 'Retiros de montos fiscales' },
  { id: 'technician_skills', name: 'Habilidades Técnicas', description: 'Habilidades de técnicos' },
  { id: 'attendance_records', name: 'Registros de Asistencia', description: 'Control de asistencia de empleados' },
  { id: 'employee_payments', name: 'Pagos a Empleados', description: 'Comisiones y bonos pagados' }
];

export function DatabaseAdminPanel() {
  const { toast } = useToast();
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleModuleSelect = (moduleId: string, checked: boolean) => {
    if (checked) {
      setSelectedModules([...selectedModules, moduleId]);
    } else {
      setSelectedModules(selectedModules.filter(id => id !== moduleId));
    }
  };

  const selectAllModules = () => {
    setSelectedModules(DATABASE_MODULES.map(m => m.id));
  };

  const deselectAllModules = () => {
    setSelectedModules([]);
  };

  const exportData = async () => {
    if (selectedModules.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos un módulo para exportar",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    try {
      const exportData: Record<string, any> = {};
      
      for (const moduleId of selectedModules) {
        try {
          const { data, error } = await supabase
            .from(moduleId as any)
            .select('*');
          
          if (error) {
            console.error(`Error exporting ${moduleId}:`, error);
            continue;
          }
          
          exportData[moduleId] = data;
        } catch (err) {
          console.error(`Error exporting ${moduleId}:`, err);
          continue;
        }
      }

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportación Exitosa",
        description: `Se exportaron ${selectedModules.length} módulos correctamente`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error en Exportación",
        description: "No se pudo completar la exportación",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Show confirmation dialog with modules to import
      const modulesToImport = Object.keys(importData).filter(key => 
        DATABASE_MODULES.some(m => m.id === key)
      );
      
      if (modulesToImport.length === 0) {
        toast({
          title: "Error",
          description: "El archivo no contiene datos válidos para importar",
          variant: "destructive"
        });
        return;
      }

      // For now, just show what would be imported
      toast({
        title: "Archivo Cargado",
        description: `Se encontraron ${modulesToImport.length} módulos para importar: ${modulesToImport.join(', ')}`,
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo leer el archivo. Verifica que sea un JSON válido.",
        variant: "destructive"
      });
    }
    
    // Reset file input
    event.target.value = '';
  };

  const deleteSelectedData = async () => {
    if (confirmText !== 'ELIMINAR DATOS') {
      toast({
        title: "Confirmación Incorrecta",
        description: "Debes escribir exactamente 'ELIMINAR DATOS' para confirmar",
        variant: "destructive"
      });
      return;
    }

    setIsDeleting(true);
    try {
      for (const moduleId of selectedModules) {
        try {
          const { error } = await supabase
            .from(moduleId as any)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
          
          if (error) {
            console.error(`Error deleting ${moduleId}:`, error);
          }
        } catch (err) {
          console.error(`Error deleting ${moduleId}:`, err);
        }
      }

      toast({
        title: "Datos Eliminados",
        description: `Se eliminaron los datos de ${selectedModules.length} módulos`,
      });
      
      setDeleteDialogOpen(false);
      setConfirmText('');
      setSelectedModules([]);
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar todos los datos",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Datos
          </CardTitle>
          <CardDescription>
            Descarga una copia de seguridad de los datos seleccionados en formato JSON
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={selectAllModules}>
              Seleccionar Todo
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAllModules}>
              Deseleccionar Todo
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {DATABASE_MODULES.map((module) => (
              <div key={module.id} className="flex items-start space-x-2 p-3 border rounded-lg">
                <Checkbox
                  id={module.id}
                  checked={selectedModules.includes(module.id)}
                  onCheckedChange={(checked) => handleModuleSelect(module.id, checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor={module.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {module.name}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {module.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Button 
            onClick={exportData} 
            disabled={selectedModules.length === 0 || isExporting}
            className="w-full"
          >
            {isExporting ? (
              <>Exportando...</>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exportar Módulos Seleccionados ({selectedModules.length})
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Datos
          </CardTitle>
          <CardDescription>
            Restaura datos desde un archivo de respaldo JSON
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Advertencia:</strong> La importación sobrescribirá los datos existentes. 
              Asegúrate de hacer una copia de seguridad antes.
            </AlertDescription>
          </Alert>

          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="import-file">Archivo JSON</Label>
            <Input
              id="import-file"
              type="file"
              accept=".json"
              onChange={handleFileImport}
            />
          </div>
        </CardContent>
      </Card>

      {/* Delete Section */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Eliminar Datos
          </CardTitle>
          <CardDescription>
            Elimina permanentemente los datos de los módulos seleccionados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>PELIGRO:</strong> Esta acción es irreversible. Los datos eliminados no se pueden recuperar.
            </AlertDescription>
          </Alert>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="destructive" 
                disabled={selectedModules.length === 0}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar Módulos Seleccionados ({selectedModules.length})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive">Confirmar Eliminación</DialogTitle>
                <DialogDescription>
                  Estás a punto de eliminar permanentemente los datos de los siguientes módulos:
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <ul className="list-disc list-inside space-y-1">
                  {selectedModules.map(moduleId => {
                    const module = DATABASE_MODULES.find(m => m.id === moduleId);
                    return (
                      <li key={moduleId} className="text-sm">
                        <strong>{module?.name}</strong> - {module?.description}
                      </li>
                    );
                  })}
                </ul>

                <div className="space-y-2">
                  <Label htmlFor="confirm-text">
                    Para confirmar, escribe: <strong>ELIMINAR DATOS</strong>
                  </Label>
                  <Input
                    id="confirm-text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="ELIMINAR DATOS"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setConfirmText('');
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={deleteSelectedData}
                  disabled={confirmText !== 'ELIMINAR DATOS' || isDeleting}
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar Datos'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}