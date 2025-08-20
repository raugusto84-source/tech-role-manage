import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { CategoryServiceSelection } from './CategoryServiceSelection';
import { SimpleDiagnosticFlow } from './SimpleDiagnosticFlow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Check, X, User, Package, CheckSquare } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address: string;
}

interface QuoteItem {
  id: string;
  service_type_id?: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  withholding_rate: number;
  withholding_amount: number;
  withholding_type: string;
  total: number;
  is_custom: boolean;
  taxes?: any[];
}

interface QuoteWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type WizardStep = 'client' | 'diagnostic' | 'items' | 'review';

/**
 * Wizard para crear cotizaciones paso a paso
 * Guía al usuario a través del proceso de creación de cotizaciones
 * Incluye selección de cliente, artículos, detalles y revisión final
 */
export function QuoteWizard({ onSuccess, onCancel }: QuoteWizardProps) {
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>('client');
  const [loading, setLoading] = useState(false);
  const [showServiceSelection, setShowServiceSelection] = useState(false);
  
  // Estado del formulario
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [diagnosticSolution, setDiagnosticSolution] = useState<any>(null);
  const [quoteDetails, setQuoteDetails] = useState({
    notes: '',
    marketing_channel: 'web' as const,
    sale_type: 'servicio' as const,
  });

  // Cargar clientes
  useEffect(() => {
    loadClients();
  }, []);

  // Auto-selección de cliente para usuarios con rol "cliente"
  useEffect(() => {
    const pickClient = async () => {
      if (profile?.role !== 'cliente' || !profile.email) return;
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('email', profile.email)
        .maybeSingle();
      if (!error && data) {
        setSelectedClient(data as any);
      }
    };
    pickClient();
  }, [profile?.role, profile?.email]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error loading clients:', error);
        return;
      }

      setClients(data || []);
      setFilteredClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  // Filtrar clientes por búsqueda
  useEffect(() => {
    const filtered = clients.filter(client =>
      (client.name?.toLowerCase() || '').includes(clientSearchTerm.toLowerCase()) ||
      (client.email?.toLowerCase() || '').includes(clientSearchTerm.toLowerCase())
    );
    setFilteredClients(filtered);
  }, [clients, clientSearchTerm]);

  // Calcular total
  const calculateTotal = () => {
    return quoteItems.reduce((sum, item) => sum + item.total, 0);
  };

  // Navegar entre pasos
  const nextStep = async () => {
    switch (currentStep) {
      case 'client': {
        if (!selectedClient) {
          toast({ title: 'Error', description: 'Por favor selecciona un cliente', variant: 'destructive' });
          return;
        }
        setCurrentStep('diagnostic');
        break;
      }
      case 'diagnostic': {
        setCurrentStep('items');
        break;
      }
      case 'items': {
        setCurrentStep('review');
        break;
      }
    }
  };

  const prevStep = () => {
    switch (currentStep) {
      case 'diagnostic':
        setCurrentStep('client');
        break;
      case 'items':
        setCurrentStep('diagnostic');
        break;
      case 'review':
        setCurrentStep('items');
        break;
    }
  };

  // Crear cotización
  const createQuote = async () => {
    if (!selectedClient || !profile) return;

    try {
      setLoading(true);

      console.log('Creating quote with items:', quoteItems);
      console.log('Total items count:', quoteItems.length);

      // Determinar el estado inicial basado en el rol del usuario
      const initialStatus = profile?.role === 'cliente' ? 'pendiente_aprobacion' : 'solicitud';
      
      const quoteData = {
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        client_phone: selectedClient.phone,
        service_description: quoteItems.length > 0 ? 
          `Cotización para ${quoteItems.map(item => item.name).join(', ')}` : 
          'Cotización personalizada',
        estimated_amount: calculateTotal(),
        notes: quoteDetails.notes,
        marketing_channel: quoteDetails.marketing_channel,
        sale_type: quoteDetails.sale_type,
        status: initialStatus,
        created_by: (profile as any).user_id || undefined,
        assigned_to: (profile as any).user_id || undefined,
      };

      console.log('Quote data:', quoteData);

      const { data: quoteResult, error: quoteError } = await supabase
        .from('quotes')
        .insert(quoteData as any)
        .select('id')
        .single();

      if (quoteError) {
        console.error('Quote creation error:', quoteError);
        toast({
          title: "Error",
          description: `Error al crear la cotización: ${quoteError.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Quote created successfully:', quoteResult);

      // Insert quote items
      if (quoteItems.length > 0 && quoteResult) {
        console.log('Preparing to insert quote items. Count:', quoteItems.length);
        
        const itemsData = quoteItems.map(item => ({
          quote_id: quoteResult.id,
          service_type_id: item.service_type_id || null,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal || item.unit_price * item.quantity,
          vat_rate: item.vat_rate || 16,
          vat_amount: item.vat_amount || 0,
          withholding_rate: item.withholding_rate || 0,
          withholding_amount: item.withholding_amount || 0,
          withholding_type: item.withholding_type || '',
          total: item.total,
          is_custom: item.is_custom
        }));

        console.log('Items data to insert:', itemsData);

        const { data: savedItems, error: itemsError } = await supabase
          .from('quote_items')
          .insert(itemsData)
          .select('id');

        if (itemsError) {
          console.error('Error creating quote items:', itemsError);
          toast({
            title: "Advertencia",
            description: "La cotización se creó pero hubo un error al guardar los artículos",
            variant: "destructive",
          });
          // Continue anyway as quote was created successfully
        } else {
          console.log('Quote items inserted successfully:', savedItems);
          
          if (savedItems && quoteItems.some(item => item.taxes && item.taxes.length > 0)) {
            // Save individual taxes for items that have them
            const taxesData: any[] = [];
            
            quoteItems.forEach((item, index) => {
              if (item.taxes && item.taxes.length > 0 && savedItems[index]) {
                item.taxes.forEach(tax => {
                  taxesData.push({
                    quote_item_id: savedItems[index].id,
                    tax_type: tax.tax_type,
                    tax_name: tax.tax_name,
                    tax_rate: tax.tax_rate,
                    tax_amount: tax.tax_amount
                  });
                });
              }
            });

            if (taxesData.length > 0) {
              const { error: taxesError } = await supabase
                .from('quote_item_taxes')
                .insert(taxesData);

              if (taxesError) {
                console.error('Error creating quote item taxes:', taxesError);
              }
            }
          }
        }
      }

      const successMessage = profile?.role === 'cliente' 
        ? "La cotización ha sido enviada y está pendiente de aprobación por nuestro equipo"
        : "La cotización ha sido creada exitosamente";
        
      toast({
        title: "Cotización creada",
        description: successMessage,
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating quote:', error);
      toast({
        title: "Error inesperado",
        description: "No se pudo crear la cotización",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const stepTitles = {
    client: 'Seleccionar Cliente',
    diagnostic: 'Diagnóstico',
    items: '¿Desea agregar servicios o productos?',
    review: 'Revisar y Confirmar',
  };

  const stepIcons = {
    client: User,
    diagnostic: CheckSquare,
    items: Package,
    review: Check,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nueva Cotización</h1>
          <p className="text-muted-foreground">Proceso guiado paso a paso</p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      </div>

      {/* Progress indicators */}
      <div className="flex items-center justify-center space-x-4">
        {Object.entries(stepTitles).map(([step, title], index) => {
          const Icon = stepIcons[step as WizardStep];
          const isActive = currentStep === step;
          const isCompleted = 
            (step === 'client' && selectedClient) ||
            (step === 'diagnostic' && !['client'].includes(currentStep)) ||
            (step === 'items' && !['client', 'diagnostic'].includes(currentStep)) ||
            (step === 'review' && currentStep === 'review');

          return (
            <div key={step} className="flex items-center">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2
                ${isActive 
                  ? 'border-primary bg-primary text-primary-foreground' 
                  : isCompleted
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-muted-foreground text-muted-foreground'
                }
              `}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={`ml-2 text-sm ${isActive ? 'font-medium' : ''}`}>
                {title}
              </span>
              {index < Object.keys(stepTitles).length - 1 && (
                <ArrowRight className="h-4 w-4 mx-4 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {React.createElement(stepIcons[currentStep], { className: "h-5 w-5" })}
            {stepTitles[currentStep]}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {currentStep === 'client' && (
            <div className="space-y-4">
              {profile?.role === 'cliente' && selectedClient ? (
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <h4 className="font-medium mb-2">Tu información</h4>
                    <div className="space-y-1 text-sm">
                      <p><strong>Nombre:</strong> {selectedClient.name}</p>
                      <p><strong>Email:</strong> {selectedClient.email}</p>
                      {selectedClient.phone && <p><strong>Teléfono:</strong> {selectedClient.phone}</p>}
                      <p><strong>Dirección:</strong> {selectedClient.address}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="client-search">Buscar Cliente</Label>
                    <Input
                      id="client-search"
                      placeholder="Buscar por nombre o email..."
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                      className="mb-4"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredClients.map((client) => (
                      <Button
                        key={client.id}
                        variant={selectedClient?.id === client.id ? "default" : "outline"}
                        className="h-auto p-4 text-left justify-start"
                        onClick={() => setSelectedClient(client)}
                      >
                        <div className="w-full">
                          <div className="font-medium">{client.name}</div>
                          <div className="text-sm opacity-70">{client.email}</div>
                          {client.address && (
                            <div className="text-xs opacity-60 mt-1">{client.address}</div>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 'diagnostic' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium mb-2">Diagnóstico del problema</h3>
                <p className="text-muted-foreground">
                  Responda algunas preguntas para que podamos recomendar los mejores servicios para su situación.
                </p>
              </div>
              <SimpleDiagnosticFlow
                onDiagnosisComplete={(result) => {
                  console.log('Diagnosis completed:', result);
                  
                  // Store the diagnostic solution
                  setDiagnosticSolution({
                    problem_title: result.problem_title,
                    recommended_solution: result.recommended_solution,
                    flow_id: result.flow_id,
                    answers: result.answers
                  });
                  
                  // Agregar los servicios recomendados a la cotización
                  if (result.recommended_services && result.recommended_services.length > 0) {
                    const newItems = result.recommended_services.map(service => ({
                      id: `rec-${service.id}-${Date.now()}`,
                      service_type_id: service.id,
                      name: service.name,
                      description: service.description || '',
                      quantity: 1,
                      unit_price: service.base_price || 0,
                      subtotal: service.base_price || 0,
                      vat_rate: service.vat_rate || 0,
                      vat_amount: ((service.base_price || 0) * (service.vat_rate || 0)) / 100,
                      withholding_rate: 0,
                      withholding_amount: 0,
                      withholding_type: '',
                      total: (service.base_price || 0) + (((service.base_price || 0) * (service.vat_rate || 0)) / 100),
                      is_custom: false
                    }));
                    setQuoteItems(prev => [...prev, ...newItems]);
                    toast({
                      title: "Servicios agregados",
                      description: `Se agregaron ${newItems.length} servicio(s) recomendado(s) basado en el diagnóstico.`,
                    });
                  }
                  nextStep();
                }}
              />
            </div>
          )}

          {currentStep === 'items' && (
            <div className="space-y-6">
              {!showServiceSelection ? (
                <div className="text-center space-y-4">
                  <h3 className="text-lg font-medium">¿Desea agregar servicios o productos a esta cotización?</h3>
                  <p className="text-muted-foreground">
                    Puede agregar servicios específicos o crear una cotización básica sin artículos detallados.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => setCurrentStep('review')} variant="outline">
                      No, crear cotización básica
                    </Button>
                    <Button onClick={() => setShowServiceSelection(true)}>
                      Sí, agregar servicios/productos
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Seleccionar servicios y productos</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowServiceSelection(false)}
                    >
                      Volver
                    </Button>
                  </div>
                  <CategoryServiceSelection 
                    selectedItems={quoteItems}
                    onItemsChange={(items) => {
                      console.log('Items changed in QuoteWizard:', items);
                      setQuoteItems(items);
                    }}
                    simplifiedView={true}
                  />
                </div>
              )}
            </div>
          )}
          {currentStep === 'review' && (
            <div className="space-y-6">
              {/* Información del cliente */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Cliente
                </h4>
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium">{selectedClient?.name}</p>
                        <p className="text-muted-foreground">{selectedClient?.email}</p>
                      </div>
                      <div>
                        {selectedClient?.phone && <p>Tel: {selectedClient.phone}</p>}
                        <p className="text-muted-foreground">{selectedClient?.address}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Diagnóstico realizado */}
              {diagnosticSolution && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Diagnóstico y Solución Recomendada
                  </h4>
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium">Problema identificado:</p>
                        <p className="text-sm">{diagnosticSolution.problem_title}</p>
                      </div>
                      {diagnosticSolution.recommended_solution && (
                        <div>
                          <p className="text-sm font-medium">Solución recomendada:</p>
                          <p className="text-sm">{diagnosticSolution.recommended_solution.title}</p>
                          {diagnosticSolution.recommended_solution.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {diagnosticSolution.recommended_solution.description}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Artículos y Servicios - solo si hay artículos */}
              {quoteItems.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Artículos y Servicios
                  </h4>
                  <div className="space-y-3">
                    {quoteItems.map((item) => (
                      <Card key={item.id} className="bg-muted/50">
                        <CardContent className="pt-4">
                          {/* Header del artículo */}
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h5 className="font-medium">{item.name}</h5>
                                {item.is_custom && (
                                  <Badge variant="secondary" className="text-xs">Personalizado</Badge>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{item.quantity} x {formatCurrency(item.unit_price)}</p>
                            </div>
                          </div>

                          {/* Desglose de precios */}
                          <div className="space-y-1 text-sm bg-background/50 p-3 rounded">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span>{formatCurrency(item.subtotal)}</span>
                            </div>
                            
                            {/* Mostrar impuestos */}
                            {item.taxes && item.taxes.length > 0 ? (
                              item.taxes.map((tax, index) => (
                                <div key={index} className="flex justify-between">
                                  <span className={tax.tax_type === 'iva' ? 'text-green-600' : 'text-red-600'}>
                                    {tax.tax_name} ({tax.tax_rate}%):
                                  </span>
                                  <span className={tax.tax_type === 'iva' ? 'text-green-600' : 'text-red-600'}>
                                    {tax.tax_type === 'iva' ? '+' : '-'}{formatCurrency(tax.tax_amount)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <>
                                {item.vat_amount > 0 && (
                                  <div className="flex justify-between text-green-600">
                                    <span>IVA ({item.vat_rate}%):</span>
                                    <span>+{formatCurrency(item.vat_amount)}</span>
                                  </div>
                                )}
                                {item.withholding_amount > 0 && (
                                  <div className="flex justify-between text-red-600">
                                    <span>{item.withholding_type} ({item.withholding_rate}%):</span>
                                    <span>-{formatCurrency(item.withholding_amount)}</span>
                                  </div>
                                )}
                              </>
                            )}
                            
                            <Separator className="my-2" />
                            <div className="flex justify-between font-medium">
                              <span>Total artículo:</span>
                              <span className="text-primary">{formatCurrency(item.total)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Totales generales */}
                  <div className="mt-4 p-4 bg-primary/10 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal General:</span>
                      <span>{formatCurrency(quoteItems.reduce((sum, item) => sum + item.subtotal, 0))}</span>
                    </div>
                    
                    <div className="flex justify-between text-green-600">
                      <span>Total IVAs:</span>
                      <span>+{formatCurrency(quoteItems.reduce((sum, item) => {
                        if (item.taxes && item.taxes.length > 0) {
                          return sum + item.taxes.filter(tax => tax.tax_type === 'iva').reduce((taxSum, tax) => taxSum + tax.tax_amount, 0);
                        }
                        return sum + item.vat_amount;
                      }, 0))}</span>
                    </div>
                    
                    <div className="flex justify-between text-red-600">
                      <span>Total Retenciones:</span>
                      <span>-{formatCurrency(quoteItems.reduce((sum, item) => {
                        if (item.taxes && item.taxes.length > 0) {
                          return sum + item.taxes.filter(tax => tax.tax_type === 'retencion').reduce((taxSum, tax) => taxSum + tax.tax_amount, 0);
                        }
                        return sum + item.withholding_amount;
                      }, 0))}</span>
                    </div>
                    
                    <Separator className="my-2" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">Total Final:</span>
                      <span className="text-xl font-bold text-primary">{formatCurrency(calculateTotal())}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mensaje cuando no hay artículos */}
              {quoteItems.length === 0 && (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h4 className="font-medium mb-2">Cotización básica</h4>
                  <p className="text-muted-foreground">
                    Esta cotización se creará sin artículos específicos. Puede agregar detalles posteriormente.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>

        {/* Navigation buttons */}
        <div className="flex justify-between p-6 border-t">
          <Button 
            variant="outline" 
            onClick={prevStep}
            disabled={currentStep === 'client'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          {currentStep === 'review' ? (
            <Button 
              onClick={createQuote}
              disabled={loading}
              className="bg-primary"
            >
              {loading ? 'Creando...' : 'Crear Cotización'}
              <Check className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={nextStep} disabled={currentStep === 'client' && profile?.role === 'cliente' && !selectedClient}>
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}