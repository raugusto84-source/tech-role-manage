import React, { useState } from 'react';
import { Search, Plus, ArrowLeft, ArrowRight, Check, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useOrderMinimal, type Client, type Problem, type Solution } from '@/hooks/useOrderMinimal';
import { useNavigate } from 'react-router-dom';
import { UserCreateDialog } from '@/components/shared/UserCreateDialog';
import { supabase } from '@/integrations/supabase/client';
interface OrderFormMinimalProps {
  onClose?: () => void;
}

export function OrderFormMinimal({ onClose }: OrderFormMinimalProps) {
  const navigate = useNavigate();
  const {
    step,
    formData,
    clients,
    problems,
    solutions,
    diagnosticQuestions,
    isLoading,
    goToStep,
    nextStep,
    prevStep,
    updateFormData,
    selectClient,
    selectProblem,
    selectSolution,
    createClient,
    createOrder,
    calculateTotal
  } = useOrderMinimal();

  const [searchTerm, setSearchTerm] = useState('');
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [showPriceEdit, setShowPriceEdit] = useState(false);

  // Filter clients by search term
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone?.includes(searchTerm)
  );

  // Filter solutions by selected problem
  const filteredSolutions = formData.problem
    ? solutions.filter(s => 
        s.service_category.toLowerCase().includes(formData.problem!.name.toLowerCase()) ||
        s.name.toLowerCase().includes(formData.problem!.name.toLowerCase())
      )
    : solutions;

  const handleClientCreated = async () => {
    // Reload clients list by refetching
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    
    // Note: The hook doesn't expose a way to update clients, 
    // so we close the dialog and rely on the user to search again
    setShowNewClientDialog(false);
    setSearchTerm(''); // Clear search to show new client
  };

  const handleDiagnosticAnswer = (questionId: string, value: boolean) => {
    updateFormData({
      diagnosticAnswers: {
        ...formData.diagnosticAnswers,
        [questionId]: value
      }
    });
  };

  const handleCreateOrder = async () => {
    const order = await createOrder();
    if (order && onClose) {
      onClose();
      navigate('/orders');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Nueva Orden</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={step === 1 ? "default" : step > 1 ? "secondary" : "outline"}>1</Badge>
            <Badge variant={step === 2 ? "default" : step > 2 ? "secondary" : "outline"}>2</Badge>
            <Badge variant={step === 3 ? "default" : "outline"}>3</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Step 1: Client Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Busca por nombre, email o teléfono"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredClients.length === 1) {
                      selectClient(filteredClients[0]);
                    }
                  }}
                />
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setShowNewClientDialog(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              
              <UserCreateDialog
                open={showNewClientDialog}
                onOpenChange={setShowNewClientDialog}
                onSuccess={handleClientCreated}
                defaultRole="cliente"
                showRoleSelector={false}
                title="Crear Nuevo Cliente"
              />
            </div>

            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {filteredClients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {searchTerm ? 'No se encontraron clientes' : 'Cargando clientes...'}
                </p>
              ) : (
                filteredClients.map((client) => (
                  <Card
                    key={client.id}
                    className="p-3 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => selectClient(client)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.email || client.phone}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">Seleccionar</Badge>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: Problem → Solution */}
        {step === 2 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Selecciona el Problema</h3>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {problems.map((problem) => (
                  <Card
                    key={problem.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      formData.problem?.id === problem.id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => selectProblem(problem)}
                  >
                    <p className="text-sm font-medium">{problem.name}</p>
                  </Card>
                ))}
              </div>
            </div>

            {formData.problem && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Solución Sugerida</h3>
                  {diagnosticQuestions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDiagnostic(!showDiagnostic)}
                    >
                      Checklist
                    </Button>
                  )}
                </div>

                {filteredSolutions.length === 0 ? (
                  <Card className="p-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Sin soluciones activas para este problema
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {filteredSolutions.slice(0, 3).map((solution) => (
                      <Card
                        key={solution.id}
                        className={`p-3 cursor-pointer transition-colors ${
                          formData.solution?.id === solution.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => selectSolution(solution)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{solution.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {solution.description}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            ${solution.base_price || 0}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {showDiagnostic && diagnosticQuestions.length > 0 && (
                  <Card className="p-3">
                    <h4 className="font-medium text-sm mb-2">Checklist Diagnóstico</h4>
                    <div className="space-y-2">
                      {diagnosticQuestions.map((question) => (
                        <div key={question.id} className="flex items-center justify-between">
                          <p className="text-xs flex-1">{question.question_text}</p>
                          <Switch
                            checked={formData.diagnosticAnswers[question.id] || false}
                            onCheckedChange={(checked) => handleDiagnosticAnswer(question.id, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {formData.solution && (
                  <Button onClick={nextStep} className="w-full">
                    Continuar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Summary → Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Cliente</p>
                  <p className="text-sm text-muted-foreground">{formData.client?.name}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium">Problema</p>
                  <p className="text-sm text-muted-foreground">{formData.problem?.name}</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium">Solución</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{formData.solution?.name}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPriceEdit(!showPriceEdit)}
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                      <Badge variant="secondary" className="text-sm">
                        ${formData.customPrice || formData.solution?.base_price || 0}
                      </Badge>
                    </div>
                  </div>
                  
                  {showPriceEdit && (
                    <div className="mt-2">
                      <Label className="text-xs">Precio personalizado</Label>
                      <Input
                        type="number"
                        placeholder="Ingresa precio"
                        value={formData.customPrice || ''}
                        onChange={(e) => updateFormData({ customPrice: e.target.value ? Number(e.target.value) : null })}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <div>
              <Label className="text-sm">Notas (opcional)</Label>
              <Textarea
                placeholder="Notas adicionales sobre la orden..."
                value={formData.notes}
                onChange={(e) => updateFormData({ notes: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Total</p>
              <p className="text-lg font-bold">${calculateTotal().toFixed(2)}</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={prevStep} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
              </Button>
              <Button 
                onClick={handleCreateOrder} 
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Creando...' : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Confirmar Orden
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Navigation for steps 1 and 2 */}
        {step > 1 && step < 3 && (
          <div className="flex justify-between">
            <Button variant="outline" onClick={prevStep}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
            </Button>
            {formData.client && (
              <div className="text-sm text-muted-foreground">
                Cliente: {formData.client.name}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}