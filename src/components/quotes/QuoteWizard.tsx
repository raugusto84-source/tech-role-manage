import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Check, Plus, X, User, FileText, Package, DollarSign } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address: string;
}

interface QuoteItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface QuoteWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type WizardStep = 'client' | 'items' | 'details' | 'review';

/**
 * Wizard para crear cotizaciones paso a paso
 * Guía al usuario a través del proceso de creación de cotizaciones
 * Incluye selección de cliente, artículos, detalles y revisión final
 */
export function QuoteWizard({ onSuccess, onCancel }: QuoteWizardProps) {
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>('client');
  const [loading, setLoading] = useState(false);
  
  // Estado del formulario
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteDetails, setQuoteDetails] = useState({
    service_description: '',
    notes: '',
    marketing_channel: 'web' as const,
    account_type: 'no_fiscal' as const,
    sale_type: 'servicio' as const,
  });

  // Nuevo artículo
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
  });

  // Cargar clientes
  useEffect(() => {
    loadClients();
  }, []);

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
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  // Agregar artículo
  const addItem = () => {
    if (!newItem.name || newItem.quantity <= 0 || newItem.unit_price < 0) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos del artículo",
        variant: "destructive",
      });
      return;
    }

    const item: QuoteItem = {
      id: Date.now().toString(),
      name: newItem.name,
      description: newItem.description,
      quantity: newItem.quantity,
      unit_price: newItem.unit_price,
      total: newItem.quantity * newItem.unit_price,
    };

    setQuoteItems([...quoteItems, item]);
    setNewItem({ name: '', description: '', quantity: 1, unit_price: 0 });
  };

  // Eliminar artículo
  const removeItem = (id: string) => {
    setQuoteItems(quoteItems.filter(item => item.id !== id));
  };

  // Calcular total
  const calculateTotal = () => {
    return quoteItems.reduce((sum, item) => sum + item.total, 0);
  };

  // Navegar entre pasos
  const nextStep = () => {
    switch (currentStep) {
      case 'client':
        if (!selectedClient) {
          toast({
            title: "Error",
            description: "Por favor selecciona un cliente",
            variant: "destructive",
          });
          return;
        }
        setCurrentStep('items');
        break;
      case 'items':
        if (quoteItems.length === 0) {
          toast({
            title: "Error",
            description: "Por favor agrega al menos un artículo",
            variant: "destructive",
          });
          return;
        }
        setCurrentStep('details');
        break;
      case 'details':
        if (!quoteDetails.service_description) {
          toast({
            title: "Error",
            description: "Por favor ingresa una descripción del servicio",
            variant: "destructive",
          });
          return;
        }
        setCurrentStep('review');
        break;
    }
  };

  const prevStep = () => {
    switch (currentStep) {
      case 'items':
        setCurrentStep('client');
        break;
      case 'details':
        setCurrentStep('items');
        break;
      case 'review':
        setCurrentStep('details');
        break;
    }
  };

  // Crear cotización
  const createQuote = async () => {
    if (!selectedClient || !profile) return;

    try {
      setLoading(true);

      const quoteData = {
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        client_phone: selectedClient.phone,
        service_description: quoteDetails.service_description,
        estimated_amount: calculateTotal(),
        notes: quoteDetails.notes,
        marketing_channel: quoteDetails.marketing_channel,
        account_type: quoteDetails.account_type,
        sale_type: quoteDetails.sale_type,
        created_by: profile.user_id,
        assigned_to: profile.user_id,
      };

      const { error } = await supabase
        .from('quotes')
        .insert(quoteData as any);

      if (error) {
        toast({
          title: "Error",
          description: `Error al crear la cotización: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Cotización creada",
        description: "La cotización ha sido creada exitosamente",
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
    items: 'Artículos y Servicios',
    details: 'Detalles de la Cotización',
    review: 'Revisar y Confirmar',
  };

  const stepIcons = {
    client: User,
    items: Package,
    details: FileText,
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
            (step === 'items' && quoteItems.length > 0 && currentStep !== 'client') ||
            (step === 'details' && quoteDetails.service_description && 
             ['review'].includes(currentStep)) ||
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
          {/* Paso 1: Seleccionar Cliente */}
          {currentStep === 'client' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="client-select">Cliente</Label>
                <Select 
                  value={selectedClient?.id || ''} 
                  onValueChange={(value) => {
                    const client = clients.find(c => c.id === value);
                    setSelectedClient(client || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div>
                          <div className="font-medium">{client.name}</div>
                          <div className="text-sm text-muted-foreground">{client.email}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClient && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <h4 className="font-medium mb-2">Cliente Seleccionado</h4>
                    <div className="space-y-1 text-sm">
                      <p><strong>Nombre:</strong> {selectedClient.name}</p>
                      <p><strong>Email:</strong> {selectedClient.email}</p>
                      {selectedClient.phone && <p><strong>Teléfono:</strong> {selectedClient.phone}</p>}
                      <p><strong>Dirección:</strong> {selectedClient.address}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Paso 2: Artículos */}
          {currentStep === 'items' && (
            <div className="space-y-6">
              {/* Formulario para nuevo artículo */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Agregar Artículo/Servicio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="item-name">Nombre *</Label>
                      <Input
                        id="item-name"
                        value={newItem.name}
                        onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                        placeholder="Ej: Formateo de PC"
                      />
                    </div>
                    <div>
                      <Label htmlFor="item-quantity">Cantidad *</Label>
                      <Input
                        id="item-quantity"
                        type="number"
                        min="1"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="item-description">Descripción</Label>
                    <Textarea
                      id="item-description"
                      value={newItem.description}
                      onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                      placeholder="Descripción detallada del artículo o servicio"
                      rows={2}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="item-price">Precio Unitario *</Label>
                      <Input
                        id="item-price"
                        type="number"
                        min="0"
                        value={newItem.unit_price}
                        onChange={(e) => setNewItem({...newItem, unit_price: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <Label>Total</Label>
                      <div className="bg-muted p-2 rounded-md text-right font-medium">
                        {formatCurrency(newItem.quantity * newItem.unit_price)}
                      </div>
                    </div>
                  </div>
                  
                  <Button onClick={addItem} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Artículo
                  </Button>
                </CardContent>
              </Card>

              {/* Lista de artículos agregados */}
              {quoteItems.length > 0 && (
                <div>
                  <h4 className="font-medium mb-4">Artículos Agregados</h4>
                  <div className="space-y-2">
                    {quoteItems.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h5 className="font-medium">{item.name}</h5>
                              {item.description && (
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              )}
                              <div className="flex gap-4 mt-2 text-sm">
                                <span>Cantidad: {item.quantity}</span>
                                <span>Precio: {formatCurrency(item.unit_price)}</span>
                                <span className="font-medium">Total: {formatCurrency(item.total)}</span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">Total General:</span>
                      <span className="text-xl font-bold">{formatCurrency(calculateTotal())}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Paso 3: Detalles */}
          {currentStep === 'details' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="service-description">Descripción del Servicio *</Label>
                <Textarea
                  id="service-description"
                  value={quoteDetails.service_description}
                  onChange={(e) => setQuoteDetails({...quoteDetails, service_description: e.target.value})}
                  placeholder="Describe el servicio que se cotiza..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="marketing-channel">Canal de Marketing</Label>
                  <Select 
                    value={quoteDetails.marketing_channel} 
                    onValueChange={(value: any) => setQuoteDetails({...quoteDetails, marketing_channel: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web">Web</SelectItem>
                      <SelectItem value="social">Redes Sociales</SelectItem>
                      <SelectItem value="referral">Referido</SelectItem>
                      <SelectItem value="direct">Directo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="account-type">Tipo de Cuenta</Label>
                  <Select 
                    value={quoteDetails.account_type} 
                    onValueChange={(value: any) => setQuoteDetails({...quoteDetails, account_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_fiscal">No Fiscal</SelectItem>
                      <SelectItem value="fiscal">Fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notas Adicionales</Label>
                <Textarea
                  id="notes"
                  value={quoteDetails.notes}
                  onChange={(e) => setQuoteDetails({...quoteDetails, notes: e.target.value})}
                  placeholder="Notas adicionales, términos y condiciones..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Paso 4: Revisión */}
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

              {/* Artículos */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Artículos y Servicios
                </h4>
                <div className="space-y-2">
                  {quoteItems.map((item) => (
                    <Card key={item.id} className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{item.quantity} x {formatCurrency(item.unit_price)}</p>
                            <p className="font-medium">{formatCurrency(item.total)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total:</span>
                    <span className="text-xl font-bold text-primary">{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </div>

              {/* Detalles */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Detalles
                </h4>
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 space-y-2">
                    <div>
                      <p className="text-sm font-medium">Descripción del Servicio:</p>
                      <p className="text-sm">{quoteDetails.service_description}</p>
                    </div>
                    {quoteDetails.notes && (
                      <div>
                        <p className="text-sm font-medium">Notas:</p>
                        <p className="text-sm">{quoteDetails.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
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
            <Button onClick={nextStep}>
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}