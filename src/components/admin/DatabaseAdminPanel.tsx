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

const DATABASE_MODULES_BY_CATEGORY = {
  usuarios: {
    name: 'Usuarios y Perfiles',
    icon: '👥',
    tables: ['profiles']
  },
  clientes: {
    name: 'Clientes',
    icon: '🧑‍💼',
    tables: ['clients']
  },
  ordenes: {
    name: 'Órdenes y Servicios',
    icon: '📋',
    tables: ['orders', 'order_items', 'order_diagnostics', 'order_status_logs']
  },
  cotizaciones: {
    name: 'Cotizaciones',
    icon: '💰',
    tables: ['quotes', 'quote_items']
  },
  catalogos: {
    name: 'Catálogos de Servicios',
    icon: '📚',
    tables: ['service_types', 'sales_categories', 'sales_products', 'main_service_categories', 'service_subcategories']
  },
  finanzas: {
    name: 'Finanzas',
    icon: '💵',
    tables: ['incomes', 'expenses', 'order_payments', 'financial_history', 'fiscal_withdrawals', 'purchases']
  },
  rrhh: {
    name: 'Recursos Humanos',
    icon: '⏰',
    tables: ['time_records', 'employee_payments', 'work_schedules', 'weekly_reports']
  },
  tecnicos: {
    name: 'Técnicos',
    icon: '🔧',
    tables: ['technician_skills', 'technician_workload']
  },
  flotilla: {
    name: 'Flotilla y Vehículos',
    icon: '🚗',
    tables: ['vehicles', 'fleet_groups', 'fleet_assignments', 'vehicle_routes']
  },
  polizas: {
    name: 'Pólizas de Seguro',
    icon: '🛡️',
    tables: ['insurance_policies', 'policy_clients', 'policy_equipment', 'policy_payments']
  },
  encuestas: {
    name: 'Encuestas',
    icon: '📊',
    tables: [
      'satisfaction_surveys',
      'survey_responses', 
      'order_satisfaction_surveys',
      'technician_satisfaction_surveys',
      'sales_satisfaction_surveys',
      'survey_configurations',
      'scheduled_surveys'
    ]
  }
};

const DATABASE_MODULES = Object.values(DATABASE_MODULES_BY_CATEGORY).flatMap(category => 
  category.tables.map(table => ({ id: table, name: table, description: '', critical: table === 'profiles' }))
);

export function DatabaseAdminPanel() {
  const { toast } = useToast();
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isCleaningWorkflow, setIsCleaningWorkflow] = useState(false);
  const [cleanWorkflowDialogOpen, setCleanWorkflowDialogOpen] = useState(false);
  const [selectedImportModules, setSelectedImportModules] = useState<string[]>([]);

  const handleCategorySelect = (categoryKey: string, checked: boolean) => {
    const category = DATABASE_MODULES_BY_CATEGORY[categoryKey as keyof typeof DATABASE_MODULES_BY_CATEGORY];
    if (checked) {
      setSelectedCategories([...selectedCategories, categoryKey]);
      setSelectedModules([...new Set([...selectedModules, ...category.tables])]);
    } else {
      setSelectedCategories(selectedCategories.filter(k => k !== categoryKey));
      setSelectedModules(selectedModules.filter(id => !category.tables.includes(id)));
    }
  };

  const handleTableSelect = (table: string, categoryKey: string, checked: boolean) => {
    const category = DATABASE_MODULES_BY_CATEGORY[categoryKey as keyof typeof DATABASE_MODULES_BY_CATEGORY];
    
    if (checked) {
      const newSelectedModules = [...new Set([...selectedModules, table])];
      setSelectedModules(newSelectedModules);
      
      // Check if all tables in category are selected
      if (category.tables.every(t => newSelectedModules.includes(t))) {
        if (!selectedCategories.includes(categoryKey)) {
          setSelectedCategories([...selectedCategories, categoryKey]);
        }
      }
    } else {
      setSelectedModules(selectedModules.filter(id => id !== table));
      
      // Remove category if it was selected
      if (selectedCategories.includes(categoryKey)) {
        setSelectedCategories(selectedCategories.filter(k => k !== categoryKey));
      }
    }
  };

  const selectAllModules = () => {
    const allCategories = Object.keys(DATABASE_MODULES_BY_CATEGORY);
    const allTables = Object.values(DATABASE_MODULES_BY_CATEGORY).flatMap(c => c.tables);
    setSelectedCategories(allCategories);
    setSelectedModules(allTables);
  };

  const deselectAllModules = () => {
    setSelectedCategories([]);
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
      // Auto-select all available modules for import
      setSelectedImportModules(modulesToImport);
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

    if (selectedImportModules.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos un módulo para importar",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const [moduleId, data] of Object.entries(importData)) {
        // Only import selected modules
        if (!selectedImportModules.includes(moduleId)) continue;
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
      setSelectedImportModules([]);
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

  const cleanWorkflowData = async () => {
    if (confirmText !== 'LIMPIAR FLUJO DE TRABAJO') {
      toast({
        title: "Confirmación Incorrecta",
        description: "Debes escribir exactamente 'LIMPIAR FLUJO DE TRABAJO' para confirmar",
        variant: "destructive"
      });
      return;
    }

    setIsCleaningWorkflow(true);
    try {
      const { data, error } = await supabase.rpc('clean_workflow_data');
      
      if (error) {
        console.error('Clean workflow error:', error);
        toast({
          title: "Error",
          description: "No se pudo limpiar el flujo de trabajo: " + error.message,
          variant: "destructive"
        });
        return;
      }

      const result = data as { error?: string; message?: string; success?: boolean };

      if (result?.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Flujo de Trabajo Limpiado",
        description: result?.message || "Se eliminaron todas las órdenes, cotizaciones y finanzas. Se preservaron artículos, servicios y clientes.",
      });
      
      setCleanWorkflowDialogOpen(false);
      setConfirmText('');
    } catch (error) {
      console.error('Clean workflow error:', error);
      toast({
        title: "Error",
        description: "No se pudo limpiar el flujo de trabajo",
        variant: "destructive"
      });
    } finally {
      setIsCleaningWorkflow(false);
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
          
          <div className="space-y-3">
            {Object.entries(DATABASE_MODULES_BY_CATEGORY).map(([key, category]) => {
              const isCategorySelected = selectedCategories.includes(key);
              const tablesInCategory = category.tables.filter(t => selectedModules.includes(t)).length;
              const totalTables = category.tables.length;
              
              return (
                <div key={key} className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={key}
                      checked={isCategorySelected}
                      onCheckedChange={(checked) => handleCategorySelect(key, checked as boolean)}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={key}
                        className="text-base font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <span className="text-xl">{category.icon}</span>
                        {category.name}
                        {key === 'usuarios' && <Shield className="h-4 w-4 text-amber-600" />}
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tablesInCategory} de {totalTables} tablas seleccionadas
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {category.tables.map(table => (
                          <div key={table} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5">
                            <Checkbox
                              id={`${key}-${table}`}
                              checked={selectedModules.includes(table)}
                              onCheckedChange={(checked) => handleTableSelect(table, key, checked as boolean)}
                            />
                            <label
                              htmlFor={`${key}-${table}`}
                              className="text-xs font-medium cursor-pointer"
                            >
                              {table}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3">
              Total: {selectedModules.length} tablas seleccionadas
            </p>
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
                  Exportar Datos Seleccionados
                </>
              )}
            </Button>
          </div>
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
                  <div className="flex gap-2 mb-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        const allModules = Object.keys(importData).filter(key => 
                          DATABASE_MODULES.some(m => m.id === key)
                        );
                        setSelectedImportModules(allModules);
                      }}
                    >
                      Seleccionar Todo
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSelectedImportModules([])}
                    >
                      Deseleccionar Todo
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                    {Object.keys(importData).filter(key => 
                      DATABASE_MODULES.some(m => m.id === key)
                    ).map(moduleId => {
                      const module = DATABASE_MODULES.find(m => m.id === moduleId);
                      const recordCount = Array.isArray(importData[moduleId]) ? importData[moduleId].length : 0;
                      const isSelected = selectedImportModules.includes(moduleId);
                      
                      return (
                        <div key={moduleId} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded">
                          <Checkbox
                            id={`import-${moduleId}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedImportModules([...selectedImportModules, moduleId]);
                              } else {
                                setSelectedImportModules(selectedImportModules.filter(id => id !== moduleId));
                              }
                            }}
                          />
                          <label
                            htmlFor={`import-${moduleId}`}
                            className="text-sm flex-1 cursor-pointer"
                          >
                            <strong>{module?.name || moduleId}</strong>
                            <span className="text-muted-foreground ml-2">
                              ({recordCount} registros)
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {selectedImportModules.length} tablas seleccionadas. Los datos existentes serán sobrescritos o fusionados.
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
                    setSelectedImportModules([]);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={performImport}
                  disabled={isImporting || selectedImportModules.length === 0}
                >
                  {isImporting ? 'Restaurando...' : `Restaurar ${selectedImportModules.length} Tablas`}
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

      {/* Clean Workflow Section */}
      <Card className="border-orange-500 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <RotateCcw className="h-5 w-5" />
            Limpiar Flujo de Trabajo
          </CardTitle>
          <CardDescription className="text-orange-600">
            Elimina órdenes, cotizaciones y finanzas preservando artículos, servicios y clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700">
              <strong>ADVERTENCIA:</strong> Esta acción elimina permanentemente todas las órdenes, 
              cotizaciones, pagos y datos financieros. Se preservan los clientes, servicios, 
              artículos y configuraciones del sistema.
            </AlertDescription>
          </Alert>

          <Dialog open={cleanWorkflowDialogOpen} onOpenChange={setCleanWorkflowDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full bg-orange-600 hover:bg-orange-700">
                <RotateCcw className="h-4 w-4 mr-2" />
                Limpiar Flujo de Trabajo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-orange-700 flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Confirmar Limpieza del Flujo de Trabajo
                </DialogTitle>
                <DialogDescription className="text-orange-600">
                  Esta acción eliminará permanentemente los datos del flujo operativo:
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <h4 className="font-semibold text-orange-800 mb-2">Se eliminarán:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-orange-700">
                    <li>Todas las órdenes y sus items</li>
                    <li>Todas las cotizaciones y sus items</li>
                    <li>Todo el historial financiero (ingresos, egresos, pagos)</li>
                    <li>Todas las encuestas de satisfacción</li>
                    <li>Todos los seguimientos y notificaciones</li>
                    <li>Transacciones de recompensas</li>
                  </ul>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">Se preservarán:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                    <li>Todos los clientes y su información</li>
                    <li>Catálogo de servicios y artículos</li>
                    <li>Perfiles de usuarios y empleados</li>
                    <li>Configuraciones del sistema</li>
                    <li>Habilidades de técnicos</li>
                    <li>Flota de vehículos</li>
                    <li>Pólizas de seguros</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workflow-confirm-text" className="text-orange-700">
                    Para confirmar la limpieza, escribe: <strong>LIMPIAR FLUJO DE TRABAJO</strong>
                  </Label>
                  <Input
                    id="workflow-confirm-text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="LIMPIAR FLUJO DE TRABAJO"
                    className="border-orange-300 focus:border-orange-500"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCleanWorkflowDialogOpen(false);
                    setConfirmText('');
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={cleanWorkflowData}
                  disabled={confirmText !== 'LIMPIAR FLUJO DE TRABAJO' || isCleaningWorkflow}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isCleaningWorkflow ? 'Limpiando...' : 'Limpiar Flujo de Trabajo'}
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