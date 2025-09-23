import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePolicyAutomation } from "@/hooks/usePolicyAutomation";
import { 
  Play, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Zap,
  CreditCard,
  Calendar,
  MessageSquare,
  TrendingUp,
  AlertCircle
} from "lucide-react";

export const AutomationEngine = () => {
  const {
    isLoading,
    lastResult,
    runDailyAutomation,
    runWeeklyAutomation,
    runMonthlyAutomation,
    triggerPayments,
    triggerServices,
    triggerFollowUps,
    triggerOverdue,
    triggerProjections,
    getHealthStatus,
    getLastExecutionTime
  } = usePolicyAutomation();

  const [expandedResults, setExpandedResults] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'issues_detected':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'critical_error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'issues_detected':
        return 'secondary';
      case 'critical_error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const lastExecution = getLastExecutionTime();
  const healthStatus = getHealthStatus();

  return (
    <div className="space-y-6">
      {/* Engine Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>Motor de Automatización</CardTitle>
              {getStatusIcon(healthStatus)}
            </div>
            <Badge variant={getStatusColor(healthStatus) as any}>
              {healthStatus === 'healthy' ? 'Saludable' : 
               healthStatus === 'issues_detected' ? 'Con Problemas' : 
               healthStatus === 'critical_error' ? 'Error Crítico' : 'Desconocido'}
            </Badge>
          </div>
          <CardDescription>
            Sistema de automatización integral para contratos de servicios
            {lastExecution && (
              <span className="block text-xs text-muted-foreground mt-1">
                Última ejecución: {lastExecution.toLocaleString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <RefreshCw className="h-4 w-4 mr-2" />
              Automatización Diaria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Pagos, servicios programados y seguimientos
            </p>
            <Button 
              onClick={runDailyAutomation}
              disabled={isLoading}
              className="w-full"
              size="sm"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Ejecutar Diaria
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Automatización Semanal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Proyecciones financieras y reportes
            </p>
            <Button 
              onClick={runWeeklyAutomation}
              disabled={isLoading}
              variant="outline"
              className="w-full"
              size="sm"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Ejecutar Semanal
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Automatización Mensual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Generación masiva de pagos mensuales
            </p>
            <Button 
              onClick={runMonthlyAutomation}
              disabled={isLoading}
              variant="secondary"
              className="w-full"
              size="sm"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Ejecutar Mensual
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Individual Process Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Procesos Individuales</CardTitle>
          <CardDescription>
            Ejecutar procesos específicos de automatización
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Button
              onClick={triggerPayments}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex flex-col h-16 space-y-1"
            >
              <CreditCard className="h-4 w-4" />
              <span className="text-xs">Pagos</span>
            </Button>
            
            <Button
              onClick={triggerServices}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex flex-col h-16 space-y-1"
            >
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Servicios</span>
            </Button>
            
            <Button
              onClick={triggerFollowUps}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex flex-col h-16 space-y-1"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs">Seguimientos</span>
            </Button>
            
            <Button
              onClick={triggerOverdue}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex flex-col h-16 space-y-1"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs">Vencidos</span>
            </Button>
            
            <Button
              onClick={triggerProjections}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex flex-col h-16 space-y-1"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Proyecciones</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Execution Results */}
      {lastResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Resultado de Ejecución</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedResults(!expandedResults)}
              >
                {expandedResults ? 'Contraer' : 'Expandir'}
              </Button>
            </div>
            <CardDescription>
              Última ejecución: {new Date(lastResult.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {lastResult.summary.processes_successful}
                </div>
                <div className="text-xs text-muted-foreground">Exitosos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">
                  {lastResult.summary.total_items_processed}
                </div>
                <div className="text-xs text-muted-foreground">Procesados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">
                  {lastResult.summary.total_errors}
                </div>
                <div className="text-xs text-muted-foreground">Errores</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">
                  {formatExecutionTime(lastResult.execution_time_ms)}
                </div>
                <div className="text-xs text-muted-foreground">Tiempo</div>
              </div>
            </div>

            {/* Expanded Results */}
            {expandedResults && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium">Detalles por Proceso</h4>
                  {lastResult.results.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {result.success ? 
                          <CheckCircle className="h-4 w-4 text-success" /> : 
                          <XCircle className="h-4 w-4 text-destructive" />
                        }
                        <span className="font-medium text-sm">{result.process}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-success">
                          {result.processed} procesados
                        </span>
                        {result.errors.length > 0 && (
                          <span className="text-destructive">
                            {result.errors.length} errores
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {formatExecutionTime(result.execution_time)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Health Check Alert */}
            {lastResult.health_check.automation_status !== 'healthy' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {lastResult.health_check.automation_status === 'issues_detected' 
                    ? 'Se detectaron algunos problemas durante la ejecución. Revise los detalles arriba.'
                    : 'Error crítico en el sistema de automatización. Contacte al administrador.'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};