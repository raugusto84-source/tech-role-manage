import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, Users, FileText, ClipboardList, UserCheck, Shield, 
  Banknote, Clock, Building2, Gift, ShieldCheck, ArrowRight,
  CheckCircle, AlertCircle, XCircle
} from 'lucide-react';

export default function Manual() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Manual de Usuario
          </h1>
          <p className="text-muted-foreground mt-2">
            Guía completa de uso del sistema SYSLAG
          </p>
        </div>

        <Tabs defaultValue="roles" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="roles" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Cotizaciones
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-1">
              <ClipboardList className="h-4 w-4" />
              Órdenes
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-1">
              <UserCheck className="h-4 w-4" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              Pólizas
            </TabsTrigger>
            <TabsTrigger value="finance" className="flex items-center gap-1">
              <Banknote className="h-4 w-4" />
              Finanzas
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Empleados
            </TabsTrigger>
            <TabsTrigger value="access" className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              Fraccionamientos
            </TabsTrigger>
          </TabsList>

          {/* Roles y Permisos */}
          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Roles y Permisos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Administrador</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>• Acceso completo a todos los módulos</p>
                      <p>• Gestión de usuarios y permisos</p>
                      <p>• Configuración del sistema</p>
                      <p>• Reportes ejecutivos</p>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Vendedor</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>• Crear y gestionar cotizaciones</p>
                      <p>• Ver clientes asignados</p>
                      <p>• Seguimiento de ventas</p>
                      <p>• Chat con clientes</p>
                    </CardContent>
                  </Card>

                  <Card className="border-green-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Técnico</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>• Ver órdenes asignadas</p>
                      <p>• Registrar avances de trabajo</p>
                      <p>• Tomar fotos de evidencia</p>
                      <p>• Registrar entrada/salida</p>
                    </CardContent>
                  </Card>

                  <Card className="border-purple-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Cliente</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>• Ver sus cotizaciones</p>
                      <p>• Aprobar/rechazar cotizaciones</p>
                      <p>• Seguimiento de órdenes</p>
                      <p>• Solicitar servicios (pólizas)</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cotizaciones */}
          <TabsContent value="quotes">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Flujo de Cotizaciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Diagrama de flujo visual */}
                  <div className="flex flex-wrap items-center justify-center gap-2 mb-6 p-4 bg-muted/50 rounded-lg">
                    <Badge variant="secondary" className="text-sm py-1">Nueva</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="text-sm py-1">Enviada</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col gap-1 items-center">
                      <Badge className="bg-green-600 text-sm py-1">Aceptada</Badge>
                      <span className="text-xs text-muted-foreground">o</span>
                      <Badge variant="destructive" className="text-sm py-1">No Aceptada</Badge>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">1. Crear Cotización (Vendedor/Admin)</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li>• Ir a <strong>Cotizaciones</strong> → <strong>Nueva Cotización</strong></li>
                        <li>• Seleccionar o crear cliente</li>
                        <li>• Agregar servicios/productos del catálogo</li>
                        <li>• Agregar materiales si aplica</li>
                        <li>• Revisar totales y guardar</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">2. Enviar Cotización</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li>• Localizar la cotización en la lista</li>
                        <li>• Clic en <strong>"Enviar"</strong> o <strong>"Enviar por Email"</strong></li>
                        <li>• El cliente recibe instrucciones para ingresar al portal</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">3. Aprobación por Cliente</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li>• Cliente ingresa a <strong>www.login.syslag.com</strong></li>
                        <li>• Usa sus credenciales (usuario y contraseña)</li>
                        <li>• Ve la cotización pendiente</li>
                        <li>• Clic en <strong>"Aprobar"</strong> o <strong>"Rechazar"</strong></li>
                      </ul>
                    </div>

                    <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                      <p className="text-sm flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <strong>Al aprobar:</strong> Se genera automáticamente una Orden de Servicio
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tareas Automáticas (Alertas)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm"><strong>Nueva &gt; 4 horas:</strong> Revisar y Enviar</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm"><strong>Enviada &gt; 24 horas:</strong> Hablar con cliente</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-950/20 rounded">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm"><strong>Enviada &gt; 7 días:</strong> Marcar como No Aceptada</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Órdenes */}
          <TabsContent value="orders">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Flujo de Órdenes de Servicio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Diagrama de flujo */}
                  <div className="flex flex-wrap items-center justify-center gap-2 mb-6 p-4 bg-muted/50 rounded-lg">
                    <Badge variant="outline" className="text-sm py-1">Pend. Aprob.</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary" className="text-sm py-1">Agendada</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge className="bg-blue-600 text-sm py-1">En Proceso</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge className="bg-purple-600 text-sm py-1">Terminada</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge className="bg-green-600 text-sm py-1">Entregada</Badge>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Origen de Órdenes</h4>
                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="font-medium text-sm">Desde Cotización</p>
                          <p className="text-xs text-muted-foreground">Automático al aprobar cotización</p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="font-medium text-sm">Creación Manual</p>
                          <p className="text-xs text-muted-foreground">Admin crea directamente</p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="font-medium text-sm">Desde Póliza</p>
                          <p className="text-xs text-muted-foreground">Visitas programadas</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Flujo de Trabajo</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li><strong>1.</strong> Orden creada → Pendiente Aprobación (si es manual)</li>
                        <li><strong>2.</strong> Admin aprueba → Asignar técnico</li>
                        <li><strong>3.</strong> Técnico ejecuta → Registra avances y fotos</li>
                        <li><strong>4.</strong> Trabajo completado → Terminada</li>
                        <li><strong>5.</strong> Cliente recibe → Entregada</li>
                        <li><strong>6.</strong> Cobro → Finalizada</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Clientes */}
          <TabsContent value="clients">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Gestión de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Crear Nuevo Cliente</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Ir a <strong>Clientes</strong> → <strong>Nuevo Cliente</strong></li>
                    <li>• Completar: Nombre, Teléfono/WhatsApp, Email, Dirección</li>
                    <li>• Guardar</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Crear Acceso al Portal</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Desde el detalle del cliente</li>
                    <li>• Clic en <strong>"Crear Acceso al Portal"</strong></li>
                    <li>• Se genera usuario y contraseña automáticamente</li>
                    <li>• Enviar credenciales al cliente</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Historial del Cliente</h4>
                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="p-2 bg-muted/50 rounded text-center text-sm">Cotizaciones</div>
                    <div className="p-2 bg-muted/50 rounded text-center text-sm">Órdenes</div>
                    <div className="p-2 bg-muted/50 rounded text-center text-sm">Pagos</div>
                    <div className="p-2 bg-muted/50 rounded text-center text-sm">Equipos</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pólizas */}
          <TabsContent value="policies">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Gestión de Pólizas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Crear Nueva Póliza</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Ir a <strong>Pólizas</strong> → <strong>Nueva Póliza</strong></li>
                    <li>• Seleccionar cliente</li>
                    <li>• Configurar: Tipo, Duración, Precio mensual, Frecuencia de visitas</li>
                    <li>• Definir servicios incluidos</li>
                    <li>• Registrar equipos cubiertos</li>
                    <li>• Activar póliza</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Flujo de Visitas</h4>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg justify-center">
                    <Badge variant="secondary">Programada</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="outline">Agendada</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge className="bg-green-600">Realizada</Badge>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Pagos de Póliza</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Sistema genera pagos mensuales automáticamente</li>
                    <li>• Alertas de pagos vencidos</li>
                    <li>• Soporta pagos parciales</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finanzas */}
          <TabsContent value="finance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  Módulo de Finanzas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Cobranza Pendiente</h4>
                  <p className="text-sm text-muted-foreground mb-2">Vista consolidada de:</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="p-2 bg-muted/50 rounded text-center text-sm">Órdenes sin pagar</div>
                    <div className="p-2 bg-muted/50 rounded text-center text-sm">Pagos de pólizas</div>
                    <div className="p-2 bg-muted/50 rounded text-center text-sm">Fraccionamientos</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Registrar Cobro</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li><strong>1.</strong> Localizar el pendiente en la lista</li>
                    <li><strong>2.</strong> Clic en <strong>"Cobrar"</strong></li>
                    <li><strong>3.</strong> Seleccionar método de pago</li>
                    <li><strong>4.</strong> Ingresar monto (permite pagos parciales)</li>
                    <li><strong>5.</strong> Confirmar</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Egresos</h4>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="p-2 bg-muted/50 rounded text-center text-sm">
                      <p className="font-medium">Nómina</p>
                      <p className="text-xs text-muted-foreground">Pagos a empleados</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded text-center text-sm">
                      <p className="font-medium">Gastos Fijos</p>
                      <p className="text-xs text-muted-foreground">Renta, servicios</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded text-center text-sm">
                      <p className="font-medium">Compras</p>
                      <p className="text-xs text-muted-foreground">Materiales</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Empleados */}
          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Gestión de Empleados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Control de Asistencia</h4>
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg justify-center mb-2">
                    <Badge variant="secondary">Entrada</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="outline">Descanso</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="outline">Regreso</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge className="bg-green-600">Salida</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Cada registro incluye foto y ubicación GPS
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Panel de Empleados (Admin)</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• <strong>Presencia:</strong> Ver quién está trabajando en tiempo real</li>
                    <li>• <strong>Historial:</strong> Registros con fotos de entrada/salida</li>
                    <li>• <strong>Reportes:</strong> Horas trabajadas por período</li>
                    <li>• <strong>Nómina:</strong> Cálculo automático semanal</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Nómina Semanal</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Sistema calcula horas trabajadas automáticamente</li>
                    <li>• Incluye horas extra y bonos</li>
                    <li>• Revisar, aprobar y registrar pago</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fraccionamientos */}
          <TabsContent value="access">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Fraccionamientos (Access by Syslag)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Crear Fraccionamiento</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Ir a <strong>Acceso by Syslag</strong> → <strong>Nuevo</strong></li>
                    <li>• Nombre, Dirección, Contacto</li>
                    <li>• Día de servicio (1-31)</li>
                    <li>• Día de cobro (1-31)</li>
                    <li>• Pago mensual y duración del contrato</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Configurar Inversionista (Opcional)</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Nombre del inversionista</li>
                    <li>• Monto invertido</li>
                    <li>• Porcentaje de ganancia post-recuperación</li>
                    <li>• Meses para recuperar inversión</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Flujo Mensual</h4>
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg justify-center mb-2">
                    <Badge variant="secondary">Servicio (día X)</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="outline">Cobro (día Y)</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge className="bg-green-600">Distribución</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Si hay inversionista: primero recupera capital, luego recibe % de ganancias
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
