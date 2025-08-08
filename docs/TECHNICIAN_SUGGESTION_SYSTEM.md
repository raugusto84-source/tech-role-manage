# SISTEMA DE SUGERENCIAS AUTOMÁTICAS DE TÉCNICOS

## RESUMEN EJECUTIVO

Este documento detalla la implementación del sistema de sugerencias automáticas de técnicos para asignación de órdenes de servicio. El sistema optimiza la asignación basándose en disponibilidad y habilidades técnicas.

## ARQUITECTURA DEL SISTEMA

### 1. BASE DE DATOS

#### Tabla: `technician_skills`
```sql
CREATE TABLE public.technician_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES auth.users(id),
  service_type_id UUID NOT NULL REFERENCES service_types(id),
  skill_level INTEGER NOT NULL DEFAULT 1 CHECK (skill_level >= 1 AND skill_level <= 5),
  years_experience INTEGER DEFAULT 0,
  certifications TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(technician_id, service_type_id)
);
```

**Propósito**: Almacenar las habilidades técnicas específicas de cada técnico para cada tipo de servicio.

**Campos clave**:
- `skill_level`: Nivel de competencia del 1 al 5
- `years_experience`: Años de experiencia en ese tipo de servicio
- `certifications`: Array de certificaciones relevantes

#### Función: `suggest_optimal_technician()`
```sql
CREATE OR REPLACE FUNCTION public.suggest_optimal_technician(
  p_service_type_id UUID,
  p_delivery_date DATE DEFAULT NULL
)
RETURNS TABLE(
  technician_id UUID,
  full_name TEXT,
  current_workload INTEGER,
  skill_level INTEGER,
  years_experience INTEGER,
  score NUMERIC,
  suggestion_reason TEXT
)
```

**Algoritmo de Puntuación**:
1. **Carga de trabajo (40% del peso)**:
   - 0 órdenes activas = 10 puntos
   - 1-2 órdenes = 8 puntos
   - 3-4 órdenes = 6 puntos
   - 5-6 órdenes = 4 puntos
   - 7+ órdenes = 2 puntos

2. **Nivel de habilidad (60% del peso)**:
   - Escala directa: Nivel 1-5 → 2-10 puntos

3. **Puntuación final**: `(workload_score * 0.4) + (skill_score * 0.6)`

### 2. COMPONENTES FRONTEND

#### TechnicianSuggestion.tsx
**Ubicación**: `src/components/orders/TechnicianSuggestion.tsx`

**Funcionalidades**:
- Consulta automática de sugerencias al seleccionar tipo de servicio
- Visualización ordenada por puntuación (mejor técnico primero)
- Explicación clara de por qué cada técnico es sugerido
- Interfaz visual con estrellas para niveles de habilidad
- Badges de color para indicar carga de trabajo

**Props principales**:
```typescript
interface TechnicianSuggestionProps {
  serviceTypeId: string;
  onTechnicianSelect: (technicianId: string, reason: string) => void;
  selectedTechnicianId?: string;
  deliveryDate?: string;
  className?: string;
}
```

#### SkillsManager.tsx
**Ubicación**: `src/components/technicians/SkillsManager.tsx`

**Funcionalidades**:
- Gestión CRUD de habilidades técnicas
- Asignación de niveles de competencia (1-5)
- Gestión de certificaciones
- Registro de años de experiencia
- Modo de solo lectura para consultas

## FLUJO DE TRABAJO

### 1. Creación de Orden
1. Usuario selecciona tipo de servicio
2. Sistema consulta automáticamente `suggest_optimal_technician()`
3. Se muestran técnicos ordenados por puntuación
4. Usuario puede seleccionar sugerencia o elegir manualmente
5. Se guarda la razón de la sugerencia para referencia

### 2. Algoritmo de Sugerencia
```
Para cada técnico:
  1. Obtener nivel de habilidad en el tipo de servicio
  2. Contar órdenes activas (pendiente, en_proceso, en_camino)
  3. Calcular puntuación ponderada
  4. Generar explicación legible de la sugerencia
  5. Ordenar por puntuación descendente
```

### 3. Gestión de Habilidades
1. Administradores pueden gestionar habilidades de todos los técnicos
2. Técnicos pueden actualizar sus propias habilidades
3. Sistema valida niveles (1-5) y años de experiencia
4. Certificaciones se almacenan como array de strings

## VENTAJAS DEL SISTEMA

### 1. Optimización de Recursos
- **Distribución equitativa**: Evita sobrecarga de técnicos específicos
- **Aprovechamiento de expertise**: Prioriza técnicos con mayor habilidad
- **Transparencia**: Explica claramente por qué se sugiere cada técnico

### 2. Flexibilidad
- **Sugerencias opcionales**: Los usuarios pueden elegir manualmente
- **Múltiples opciones**: Muestra varios técnicos con sus razones
- **Actualización en tiempo real**: Refleja cambios en carga de trabajo

### 3. Escalabilidad
- **Fácil expansión**: Nuevos tipos de servicio se integran automáticamente
- **Configuración flexible**: Pesos del algoritmo pueden ajustarse
- **Histórico de decisiones**: Se mantiene registro de razones de asignación

## MÉTRICAS Y RAZONES DE SUGERENCIA

### Tipos de Explicaciones Generadas:
1. **"Alto nivel de habilidad (5/5) con baja carga de trabajo (1 órdenes)"**
2. **"Completamente disponible (sin órdenes activas)"**
3. **"Baja carga de trabajo (2 órdenes activas), 3 años de experiencia"**
4. **"Nivel de habilidad 4/5, 1 órdenes activas"**

### Indicadores Visuales:
- **Estrellas**: Nivel de habilidad (1-5)
- **Badges de color**: Carga de trabajo (verde=disponible, rojo=ocupado)
- **Puntuación numérica**: Score calculado para transparencia

## COMPONENTES REUTILIZABLES

### 1. TechnicianSuggestion
**Reutilizable en**:
- Formulario de creación de órdenes ✓
- Reasignación de órdenes existentes
- Módulo de planificación de recursos
- Dashboard de administración

### 2. SkillsManager
**Reutilizable en**:
- Panel de administración ✓
- Perfil del técnico
- Módulo de recursos humanos
- Reportes de capacidades técnicas

### 3. suggest_optimal_technician()
**Reutilizable para**:
- API endpoints externos
- Reportes de utilización
- Algoritmos de balanceamiento de carga
- Análisis predictivo

## FUTURAS MEJORAS

### 1. Consideraciones Adicionales
- **Distancia geográfica**: Priorizar técnicos cercanos al cliente
- **Disponibilidad por fecha**: Considerar horarios y calendarios
- **Especialización por cliente**: Técnicos preferidos por clientes específicos
- **Historial de satisfacción**: Incorporar ratings de clientes

### 2. Machine Learning
- **Predicción de duración**: Estimar tiempo real basado en historial
- **Optimización de rutas**: Agrupar órdenes por proximidad
- **Análisis de patrones**: Identificar mejores combinaciones técnico-servicio

### 3. Integración Avanzada
- **Notificaciones push**: Alertar a técnicos sobre nuevas asignaciones
- **Calendario integrado**: Sincronizar con herramientas de calendario
- **Métricas en tiempo real**: Dashboard de utilización de técnicos

## CÓDIGO DE EJEMPLO

### Uso Básico del Componente
```tsx
<TechnicianSuggestion
  serviceTypeId="uuid-del-servicio"
  onTechnicianSelect={(id, reason) => {
    setSelectedTechnician(id);
    setSuggestionReason(reason);
  }}
  selectedTechnicianId={formData.assigned_technician}
  deliveryDate={formData.delivery_date}
/>
```

### Consulta Directa a la Función
```typescript
const { data: suggestions } = await supabase
  .rpc('suggest_optimal_technician', {
    p_service_type_id: serviceTypeId,
    p_delivery_date: deliveryDate
  });
```

## SEGURIDAD Y PERMISOS

### Row Level Security (RLS)
- **technician_skills**: Solo administradores y el propio técnico pueden modificar
- **suggest_optimal_technician()**: Función SECURITY DEFINER accesible por staff
- **Validaciones**: Restricciones en base de datos para niveles de habilidad

### Roles de Usuario
- **Administrador**: Acceso completo a gestión de habilidades
- **Vendedor**: Puede ver sugerencias y asignar técnicos
- **Técnico**: Puede actualizar sus propias habilidades
- **Cliente**: Sin acceso a sistema de sugerencias

---

**Fecha de implementación**: Enero 2025  
**Versión**: 1.0  
**Estado**: Implementado y funcional  
**Próxima revisión**: Marzo 2025