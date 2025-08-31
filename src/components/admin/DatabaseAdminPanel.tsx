import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, Upload, Trash2, AlertTriangle, RotateCcw, Power, Shield } from 'lucide-react';

const DATABASE_MODULES = [
  { id: 'profiles', name: 'Perfiles de Usuario', description: 'Información de usuarios del sistema', critical: true },
  { id: 'clients', name: 'Clientes', description: 'Base de datos de clientes', critical: false },
  { id: 'orders', name: 'Órdenes', description: 'Órdenes de trabajo y servicios', critical: false },
  { id: 'order_items', name: 'Items de Órdenes', description: 'Detalles de servicios por orden', critical: false },
  { id: 'quotes', name: 'Cotizaciones', description: 'Cotizaciones enviadas a clientes', critical: false },
  { id: 'quote_items', name: 'Items de Cotizaciones', description: 'Detalles de servicios por cotización', critical: false },
  { id: 'service_types', name: 'Tipos de Servicio', description: 'Catálogo de servicios disponibles', critical: false },
  { id: 'incomes', name: 'Ingresos', description: 'Registro de ingresos', critical: false },
  { id: 'expenses', name: 'Egresos', description: 'Registro de gastos', critical: false },
  { id: 'order_payments', name: 'Pagos de Órdenes', description: 'Pagos realizados por órdenes', critical: false },
  { id: 'financial_history', name: 'Historial Financiero', description: 'Registro de operaciones financieras', critical: false },
  { id: 'fiscal_withdrawals', name: 'Retiros Fiscales', description: 'Retiros de montos fiscales', critical: false },
  { id: 'technician_skills', name: 'Habilidades Técnicas', description: 'Habilidades de técnicos', critical: false },
  { id: 'time_records', name: 'Registros de Tiempo', description: 'Control de tiempo de empleados', critical: false },
  { id: 'employee_payments', name: 'Pagos a Empleados', description: 'Comisiones y bonos pagados', critical: false },
  { id: 'client_rewards', name: 'Recompensas de Clientes', description: 'Sistema de recompensas', critical: false },
  { id: 'reward_transactions', name: 'Transacciones de Recompensas', description: 'Historial de recompensas', critical: false },
  { id: 'vehicles', name: 'Vehículos', description: 'Flota de vehículos', critical: false },
  { id: 'insurance_policies', name: 'Pólizas de Seguro', description: 'Pólizas de seguros', critical: false }
];

export function DatabaseAdminPanel() {
  const { toast } = useToast();
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

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
      const data = JSON.parse(text);
      
      // Show confirmation dialog with modules to import
      const modulesToImport = Object.keys(data).filter(key => 
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

      setImportData(data);
      setImportDialogOpen(true);
      
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

  const performImport = async () => {
    if (!importData) return;

    setIsImporting(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const [moduleId, data] of Object.entries(importData)) {
        if (!DATABASE_MODULES.some(m => m.id === moduleId)) continue;
        
        try {
          // Skip profiles table to avoid auth conflicts
          if (moduleId === 'profiles') continue;

          const records = data as any[];
          if (!Array.isArray(records)) continue;

          // Insert records in batches
          for (let i = 0; i < records.length; i += 100) {
            const batch = records.slice(i, i + 100);
            const { error } = await supabase
              .from(moduleId as any)
              .upsert(batch, { onConflict: 'id' });
            
            if (error) {
              console.error(`Error importing batch for ${moduleId}:`, error);
              errorCount++;
            } else {
              successCount++;
            }
          }
        } catch (err) {
          console.error(`Error importing ${moduleId}:`, err);
          errorCount++;
        }
      }

      toast({
        title: "Importación Completada",
        description: `Módulos importados exitosamente: ${successCount}, Errores: ${errorCount}`,
        variant: errorCount > 0 ? "destructive" : "default"
      });
      
      setImportDialogOpen(false);
      setImportData(null);
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Error en Importación",
        description: "No se pudo completar la importación",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetSystem = async () => {
    if (confirmText !== 'REINICIAR SISTEMA') {
      toast({
        title: "Confirmación Incorrecta",
        description: "Debes escribir exactamente 'REINICIAR SISTEMA' para confirmar",
        variant: "destructive"
      });
      return;
    }

    setIsResetting(true);
    try {
      // Get current admin user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "No se pudo identificar el usuario administrador",
          variant: "destructive"
        });
        return;
      }

      // Delete all data except admin profile
      const tablesToReset = DATABASE_MODULES.filter(m => m.id !== 'profiles');
      
      for (const module of tablesToReset) {
        try {
          const { error } = await supabase
            .from(module.id as any)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          
          if (error) {
            console.error(`Error resetting ${module.id}:`, error);
          }
        } catch (err) {
          console.error(`Error resetting ${module.id}:`, err);
        }
      }

      // Keep only current admin profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .neq('user_id', user.id);

      if (profileError) {
        console.error('Error cleaning profiles:', profileError);
      }

      toast({
        title: "Sistema Reiniciado",
        description: "Todos los datos han sido eliminados. Solo se mantuvo tu perfil de administrador.",
      });
      
      setResetDialogOpen(false);
      setConfirmText('');
    } catch (error) {
      console.error('Reset error:', error);
      toast({
        title: "Error",
        description: "No se pudo reiniciar completamente el sistema",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
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
              <div key={module.id} className={`flex items-start space-x-2 p-3 border rounded-lg ${module.critical ? 'border-amber-200 bg-amber-50' : ''}`}>
                <Checkbox
                  id={module.id}
                  checked={selectedModules.includes(module.id)}
                  onCheckedChange={(checked) => handleModuleSelect(module.id, checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor={module.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1"
                  >
                    {module.name}
                    {module.critical && <Shield className="h-3 w-3 text-amber-600" />}
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
            Restaurar Datos
          </CardTitle>
          <CardDescription>
            Restaura datos desde un archivo de respaldo JSON
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Advertencia:</strong> La restauración sobrescribirá los datos existentes. 
              Se recomienda exportar antes de restaurar.
            </AlertDescription>
          </Alert>

          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="import-file">Archivo de Respaldo JSON</Label>
            <Input
              id="import-file"
              type="file"
              accept=".json"
              onChange={handleFileImport}
            />
          </div>

          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Confirmar Restauración
                </DialogTitle>
                <DialogDescription>
                  Se encontraron los siguientes módulos para restaurar:
                </DialogDescription>
              </DialogHeader>
              
              {importData && (
                <div className="space-y-4">
                  <ul className="list-disc list-inside space-y-1 max-h-40 overflow-y-auto">
                    {Object.keys(importData).filter(key => 
                      DATABASE_MODULES.some(m => m.id === key)
                    ).map(moduleId => {
                      const module = DATABASE_MODULES.find(m => m.id === moduleId);
                      const recordCount = Array.isArray(importData[moduleId]) ? importData[moduleId].length : 0;
                      return (
                        <li key={moduleId} className="text-sm">
                          <strong>{module?.name}</strong> - {recordCount} registros
                        </li>
                      );
                    })}
                  </ul>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Los datos existentes serán sobrescritos o fusionados con los datos del respaldo.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setImportDialogOpen(false);
                    setImportData(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={performImport}
                  disabled={isImporting}
                >
                  {isImporting ? 'Restaurando...' : 'Restaurar Datos'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

      {/* System Reset Section */}
      <Card className="border-red-500 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Power className="h-5 w-5" />
            Reinicio Total del Sistema
          </CardTitle>
          <CardDescription className="text-red-600">
            Elimina TODOS los datos del sistema excepto tu perfil de administrador
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <strong>MÁXIMO PELIGRO:</strong> Esta acción elimina permanentemente TODA la información 
              del sistema incluyendo clientes, órdenes, finanzas, etc. Solo se preservará tu cuenta de administrador.
              Esta acción es completamente irreversible.
            </AlertDescription>
          </Alert>

          <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full bg-red-600 hover:bg-red-700">
                <Power className="h-4 w-4 mr-2" />
                Reiniciar Sistema Completo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-red-700 flex items-center gap-2">
                  <Power className="h-5 w-5" />
                  Confirmar Reinicio Total
                </DialogTitle>
                <DialogDescription className="text-red-600">
                  Esta acción eliminará permanentemente TODOS los datos del sistema:
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h4 className="font-semibold text-red-800 mb-2">Se eliminarán:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                    <li>Todos los clientes y su información</li>
                    <li>Todas las órdenes y cotizaciones</li>
                    <li>Todo el historial financiero</li>
                    <li>Todos los registros de empleados</li>
                    <li>Toda la configuración del sistema</li>
                    <li>Todos los demás datos</li>
                  </ul>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">Se preservará:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                    <li>Tu cuenta de administrador actual</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-confirm-text" className="text-red-700">
                    Para confirmar el reinicio total, escribe: <strong>REINICIAR SISTEMA</strong>
                  </Label>
                  <Input
                    id="reset-confirm-text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="REINICIAR SISTEMA"
                    className="border-red-300 focus:border-red-500"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setResetDialogOpen(false);
                    setConfirmText('');
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={resetSystem}
                  disabled={confirmText !== 'REINICIAR SISTEMA' || isResetting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isResetting ? 'Reiniciando...' : 'Reiniciar Sistema'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}