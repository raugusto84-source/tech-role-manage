# Manual de Usuario - SYSLAG

## Sistema de Gestión de Servicios Técnicos

---

## 📋 Índice

1. [Roles y Permisos](#roles-y-permisos)
2. [Flujo de Cotizaciones](#flujo-de-cotizaciones)
3. [Flujo de Órdenes de Servicio](#flujo-de-órdenes-de-servicio)
4. [Gestión de Clientes](#gestión-de-clientes)
5. [Gestión de Pólizas](#gestión-de-pólizas)
6. [Finanzas](#finanzas)
7. [Gestión de Empleados](#gestión-de-empleados)
8. [Fraccionamientos (Access)](#fraccionamientos-access)
9. [Sistema de Recompensas](#sistema-de-recompensas)
10. [Garantías](#garantías)

---

## 🔐 Roles y Permisos

### Administrador
- Acceso completo a todos los módulos
- Gestión de usuarios y permisos
- Configuración del sistema
- Reportes ejecutivos

### Vendedor
- Crear y gestionar cotizaciones
- Ver clientes asignados
- Seguimiento de ventas
- Chat con clientes

### Técnico
- Ver órdenes asignadas
- Registrar avances de trabajo
- Tomar fotos de evidencia
- Registrar entrada/salida

### Cliente
- Ver sus cotizaciones
- Aprobar/rechazar cotizaciones
- Seguimiento de órdenes
- Solicitar servicios (pólizas)

---

## 📝 Flujo de Cotizaciones

### Estados de Cotización

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   NUEVA     │ ──► │   ENVIADA   │ ──► │  ACEPTADA   │
│ (solicitud) │     │             │     │             │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │NO ACEPTADA  │     │   ORDEN     │
                    │ (rechazada) │     │ GENERADA    │
                    └─────────────┘     └─────────────┘
```

### Paso a Paso

#### 1. Crear Cotización (Vendedor/Admin)
1. Ir a **Cotizaciones** → **Nueva Cotización**
2. Seleccionar o crear cliente
3. Agregar servicios/productos:
   - Buscar en catálogo de servicios
   - Agregar materiales si aplica
   - Ajustar cantidades y precios
4. Revisar totales (subtotal, IVA, total)
5. Guardar cotización (estado: **Nueva**)

#### 2. Enviar Cotización al Cliente
1. Desde la lista de cotizaciones, localizar la cotización
2. Clic en **"Enviar"** o **"Enviar por Email"**
3. El cliente recibe un correo con instrucciones para ingresar al portal
4. Estado cambia a: **Enviada**

#### 3. Aprobación por Cliente
**Opción A - Portal del Cliente:**
1. Cliente ingresa a `www.login.syslag.com`
2. Usa sus credenciales (usuario y contraseña)
3. Ve la cotización pendiente
4. Clic en **"Aprobar"** o **"Rechazar"**

**Resultado de Aprobación:**
- Estado cambia a: **Aceptada**
- Se genera automáticamente una **Orden de Servicio**
- La orden inicia en estado **En Proceso**

**Resultado de Rechazo:**
- Estado cambia a: **No Aceptada**
- Se registra el motivo (si lo proporciona)

### Tareas Automáticas (Alertas)

| Condición | Tarea Generada | Nivel |
|-----------|----------------|-------|
| Nueva > 4 horas | Revisar y Enviar | ⚠️ Atrasado |
| Enviada > 24 horas | Hablar con cliente | ⚠️ Atrasado |
| Enviada > 7 días | Marcar como No Aceptada | 🔴 Vencida |

---

## 🔧 Flujo de Órdenes de Servicio

### Estados de Orden

```
┌───────────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ PEND. APROBACIÓN  │ ──► │  AGENDADO   │ ──► │ EN PROCESO  │ ──► │  TERMINADA  │
│ (manual)          │     │ (en_espera) │     │             │     │(pend_entrega)│
└───────────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                         │
                                                                         ▼
                                                                  ┌─────────────┐
                                                                  │  ENTREGADA  │
                                                                  │ (finalizada)│
                                                                  └─────────────┘
```

### Paso a Paso

#### 1. Origen de Órdenes
Las órdenes se crean de 3 formas:

**A) Desde Cotización Aprobada (Automático)**
- Cliente aprueba cotización → Orden se crea automáticamente
- Estado inicial: **En Proceso**
- No requiere aprobación adicional

**B) Creación Manual (Admin/Vendedor)**
- Ir a **Órdenes** → **Nueva Orden**
- Completar datos del servicio
- Estado inicial: **Pendiente Aprobación**

**C) Desde Póliza de Servicio**
- Cliente solicita servicio desde su portal
- Se agenda en la próxima visita programada

#### 2. Aprobación de Órdenes Manuales
1. Las órdenes pendientes aparecen en sección especial arriba del calendario
2. Admin revisa los detalles
3. Clic en ✓ para **Aprobar** o ✗ para **Rechazar**
4. Si aprueba → Estado cambia a **En Proceso**

#### 3. Asignación de Técnico
1. Abrir detalle de la orden
2. Seleccionar técnico principal
3. (Opcional) Agregar técnicos de apoyo
4. Sistema sugiere técnicos basado en:
   - Disponibilidad
   - Habilidades requeridas
   - Carga de trabajo actual

#### 4. Ejecución del Servicio (Técnico)
1. Técnico ve orden en su dashboard
2. Registra inicio de trabajo
3. Completa checklist de servicios
4. Toma fotos de evidencia
5. Registra materiales utilizados
6. Marca servicios como completados

#### 5. Finalización
1. Todos los servicios completados → **Terminada**
2. Se envía notificación al cliente
3. Programar entrega o recolección
4. Cliente firma recepción → **Entregada**

#### 6. Cobro
1. Verificar montos pendientes
2. Registrar pago (efectivo, transferencia, tarjeta)
3. Generar recibo/factura

---

## 👥 Gestión de Clientes

### Crear Nuevo Cliente
1. Ir a **Clientes** → **Nuevo Cliente**
2. Completar información:
   - Nombre completo
   - Teléfono / WhatsApp
   - Email
   - Dirección
3. Guardar

### Crear Usuario para Cliente (Acceso al Portal)
1. Desde el detalle del cliente
2. Clic en **"Crear Acceso al Portal"**
3. Se genera usuario y contraseña
4. Enviar credenciales al cliente

### Historial del Cliente
- **Cotizaciones**: Todas las cotizaciones enviadas
- **Órdenes**: Historial de servicios realizados
- **Pagos**: Registro de transacciones
- **Equipos**: Equipos registrados del cliente

---

## 📋 Gestión de Pólizas

### Crear Nueva Póliza
1. Ir a **Pólizas** → **Nueva Póliza**
2. Seleccionar cliente
3. Configurar:
   - Tipo de póliza
   - Duración (meses)
   - Precio mensual
   - Frecuencia de visitas
   - Servicios incluidos
4. Registrar equipos cubiertos
5. Activar póliza

### Flujo de Visitas Programadas

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ PROGRAMADA  │ ──► │  AGENDADA   │ ──► │  REALIZADA  │
└─────────────┘     └─────────────┘     └─────────────┘
```

1. Sistema genera visitas automáticamente según frecuencia
2. Admin/Vendedor agenda fecha específica
3. Técnico realiza la visita
4. Registra servicios realizados
5. Cliente puede solicitar servicios adicionales

### Pagos de Póliza
- Sistema genera pagos mensuales automáticamente
- Fechas de vencimiento según configuración
- Alertas de pagos vencidos
- Registro de pagos parciales

---

## 💰 Finanzas

### Panel de Finanzas

#### Cobranza Pendiente
Vista consolidada de:
- Órdenes sin pagar
- Pagos de pólizas vencidos
- Pagos de fraccionamientos

#### Registrar Cobro
1. Localizar el pendiente en la lista
2. Clic en **"Cobrar"**
3. Seleccionar método de pago
4. Ingresar monto (permite pagos parciales)
5. Confirmar

#### Egresos
- **Nómina**: Pagos a empleados
- **Gastos Fijos**: Renta, servicios, etc.
- **Compras**: Materiales e insumos

#### Retiros Fiscales
1. Ir a **Retiros Fiscales**
2. Seleccionar cuenta origen
3. Ingresar monto y concepto
4. Registrar

---

## 👷 Gestión de Empleados

### Panel de Empleados (Admin)

#### Presencia en Tiempo Real
- Ver quién está trabajando
- Hora de entrada/salida
- Ubicación de check-in

#### Control de Asistencia
1. Empleado registra entrada (con foto y ubicación)
2. Registra inicio/fin de descanso
3. Registra salida
4. Sistema calcula horas trabajadas

#### Historial de Asistencia
- Filtrar por empleado y fechas
- Ver fotos de registro
- Exportar reportes

#### Nómina Semanal
1. Sistema calcula automáticamente:
   - Horas trabajadas
   - Horas extra
   - Bonos por logros
2. Revisar y aprobar
3. Registrar pago

### Registro de Tiempo (Empleado)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   ENTRADA   │ ──► │  DESCANSO   │ ──► │   REGRESO   │ ──► │   SALIDA    │
│  (check-in) │     │   (break)   │     │  (de break) │     │ (check-out) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. Abrir **Reloj de Tiempo**
2. Permitir acceso a cámara y ubicación
3. Tomar foto y confirmar entrada
4. Repetir para descanso y salida

---

## 🏘️ Fraccionamientos (Access)

### Crear Fraccionamiento
1. Ir a **Fraccionamientos** → **Nuevo**
2. Completar información:
   - Nombre del fraccionamiento
   - Dirección
   - Contacto principal
   - Día de servicio (1-31)
   - Día de cobro (1-31)
   - Pago mensual
   - Duración del contrato
3. (Opcional) Configurar inversionista:
   - Nombre del inversionista
   - Monto invertido
   - Porcentaje de ganancia
   - Meses para recuperación

### Flujo Mensual

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   SERVICIO  │ ──► │   COBRO     │ ──► │  DIST. DE   │
│  (día X)    │     │  (día Y)    │     │  GANANCIAS  │
└─────────────┘     └─────────────┘     └─────────────┘
```

1. **Día de Servicio**: Se genera orden automática
2. **Día de Cobro**: Se genera pago pendiente
3. **Al cobrar**: 
   - Si hay inversionista en recuperación → 100% para inversionista
   - Si ya recuperó → % para inversionista, resto para empresa

### Vista de Inversionistas
- Total invertido
- Capital recuperado
- Ganancias pagadas
- Progreso de recuperación

---

## 🎁 Sistema de Recompensas

### Para Clientes

#### Acumulación de Puntos
- Por cada servicio completado
- Por referir nuevos clientes
- Por pagos puntuales

#### Beneficios
- Descuento de cliente nuevo (primera orden)
- Cashback acumulable
- Descuentos por puntos

### Configuración (Admin)
1. Ir a **Recompensas** → **Configuración**
2. Definir:
   - Porcentaje de cashback
   - Puntos por servicio
   - Descuento por referido

---

## 🛡️ Garantías

### Configurar Garantía por Servicio
1. Ir a **Ventas** → **Servicios**
2. Editar servicio
3. Configurar garantía:
   - Duración (días)
   - Condiciones
   - Exclusiones

### Flujo de Reclamo de Garantía

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  RECLAMO    │ ──► │  REVISIÓN   │ ──► │  APROBADO   │ ──► │  RESUELTO   │
│ (cliente)   │     │  (técnico)  │     │ (servicio)  │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  RECHAZADO  │
                                        │ (no aplica) │
                                        └─────────────┘
```

1. Cliente reporta problema
2. Se verifica si está en período de garantía
3. Técnico evalúa si aplica garantía
4. Si aplica → Se crea orden de servicio sin costo
5. Si no aplica → Se notifica al cliente con explicación

---

## 📱 Acceso al Sistema

### Portal Web Principal
- **URL**: `www.login.syslag.com`
- Usuarios: Admin, Vendedor, Técnico

### Portal de Clientes
- **URL**: `www.login.syslag.com`
- Solo clientes con acceso habilitado
- Funciones limitadas a su información

### Credenciales de Prueba
| Rol | Usuario | Contraseña |
|-----|---------|------------|
| Admin | admin@syslag.com | 123456 |

---

## ❓ Preguntas Frecuentes

### ¿Cómo recupero una cotización rechazada?
No se puede recuperar directamente. Crea una nueva cotización basada en la anterior.

### ¿Puedo editar una orden en proceso?
Sí, pero los cambios quedan registrados en el historial y pueden requerir aprobación.

### ¿Cómo cancelo una orden?
Solo Admin puede cancelar órdenes. Se debe registrar motivo de cancelación.

### ¿Qué pasa si un técnico no registra su entrada?
El sistema no contabilizará esas horas para nómina. Admin puede hacer ajustes manuales.

### ¿Cómo agrego un nuevo servicio al catálogo?
Ir a **Ventas** → **Servicios** → **Nuevo Servicio**

---

## 📞 Soporte

Para dudas o problemas técnicos, contactar al administrador del sistema.

---

*Última actualización: Febrero 2026*
