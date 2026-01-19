import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
// Removed useRewardSettings import - cashback system eliminated
import { CategoryServiceSelection } from './CategoryServiceSelection';
import { SimpleDiagnosticFlow } from './SimpleDiagnosticFlow';
import { QuoteTotalsSummary } from './QuoteTotalsSummary';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Check, X, User, Package, CheckSquare, Search, Plus, CheckCircle } from 'lucide-react';
import { ClientUserForm } from './ClientUserForm';
import { formatCOPCeilToTen } from '@/utils/currency';
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
  image_url?: string | null;
  taxes?: any[];
}
interface QuoteWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
}
type WizardStep = 'approach' | 'client' | 'diagnostic' | 'items' | 'free_text';
export function QuoteWizard({
  onSuccess,
  onCancel
}: QuoteWizardProps) {
  const {
    profile
  } = useAuth();
  // Removed useRewardSettings - cashback system eliminated
  const [currentStep, setCurrentStep] = useState<WizardStep>('approach');
  const [loading, setLoading] = useState(false);
  const [showServiceSelection, setShowServiceSelection] = useState(false);
  const [selectedApproach, setSelectedApproach] = useState<'problem' | 'catalog' | 'free' | null>(null);

  // Estado del formulario
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [diagnosticSolution, setDiagnosticSolution] = useState<any>(null);
  const [freeTextDescription, setFreeTextDescription] = useState('');
  const [quoteDetails, setQuoteDetails] = useState({
    notes: '',
    marketing_channel: 'web' as const,
    sale_type: 'servicio' as const
  });
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);

  // Cargar clientes
  useEffect(() => {
    loadClients();
    
    // Set up real-time subscription for clients
    const channel = supabase
      .channel('clients-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients'
        },
        () => {
          console.log('Clients changed, reloading...');
          loadClients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-selección de cliente para usuarios con rol "cliente"
  useEffect(() => {
    const pickClient = async () => {
      if (profile?.role !== 'cliente' || !profile.email) return;
      const {
        data,
        error
      } = await supabase.from('clients').select('*').eq('email', profile.email).maybeSingle();
      if (!error && data) {
        setSelectedClient(data as any);
        setCurrentStep('approach');
      }
    };
    pickClient();
  }, [profile?.role, profile?.email]);
  const loadClients = async () => {
    try {
      console.log('Loading clients...');

      // 1) Tabla clients
      const { data: clientsTable, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, email, phone, address, user_id')
        .order('name')
        .limit(1000);

      if (clientsError) throw clientsError;

      // 2) Usuarios con rol cliente en profiles
      const { data: profileClients, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .eq('role', 'cliente');

      if (profilesError) throw profilesError;

      // 3) Unificar por email (preferir registro de clients si existe)
      const map = new Map<string, Client>();

      for (const c of clientsTable || []) {
        const key = (c.email || `client-${c.id}`)?.toLowerCase();
        map.set(key, {
          id: c.id, // id real de clients
          name: c.name || c.email || 'Sin nombre',
          email: c.email || '',
          phone: c.phone || undefined,
          address: c.address || ''
        });
      }

      for (const p of profileClients || []) {
        const key = (p.email || `profile-${p.user_id}`)?.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: p.user_id, // usar user_id como id estable
            name: p.full_name || p.email || 'Sin nombre',
            email: p.email || '',
            phone: p.phone || undefined,
            address: ''
          });
        }
      }

      // 4) Ordenar por nombre
      const unified = Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      console.log('Clients loaded (unified):', unified.length, 'items');
      setClients(unified);
      setFilteredClients(unified);
    } catch (error: any) {
      console.error('Error loading clients:', error);
      toast({
        title: 'Error',
        description: `No se pudieron cargar los clientes: ${error.message || 'Error inesperado'}`,
        variant: 'destructive',
      });
    }
  };

  // Filtrar clientes por búsqueda
  useEffect(() => {
    const filtered = clients.filter(client => (client.name?.toLowerCase() || '').includes(clientSearchTerm.toLowerCase()) || (client.email?.toLowerCase() || '').includes(clientSearchTerm.toLowerCase()));
    setFilteredClients(filtered);
  }, [clients, clientSearchTerm]);

  // Calcular total
  const calculateTotal = () => {
    return quoteItems.reduce((sum, item) => sum + item.total, 0);
  };

  // Navegar entre pasos
  const nextStep = async () => {
    switch (currentStep) {
      case 'approach':
        {
          if (!selectedApproach) {
            toast({
              title: 'Error',
              description: 'Por favor selecciona cómo quieres crear tu cotización',
              variant: 'destructive'
            });
            return;
          }
          // Skip client selection for clients role
          if (profile?.role === 'cliente') {
            if (selectedApproach === 'problem') {
              setCurrentStep('diagnostic');
            } else if (selectedApproach === 'free') {
              setCurrentStep('free_text');
            } else {
              setCurrentStep('items');
              setShowServiceSelection(true);
            }
          } else {
            setCurrentStep('client');
          }
          break;
        }
      case 'client':
        {
          if (!selectedClient) {
            toast({
              title: 'Error',
              description: 'Por favor selecciona un cliente',
              variant: 'destructive'
            });
            return;
          }
          if (selectedApproach === 'problem') {
            setCurrentStep('diagnostic');
          } else if (selectedApproach === 'free') {
            setCurrentStep('free_text');
          } else {
            setCurrentStep('items');
            setShowServiceSelection(true);
          }
          break;
        }
      case 'diagnostic':
        {
          setCurrentStep('items');
          setShowServiceSelection(true);
          break;
        }
      case 'free_text':
        {
          if (!freeTextDescription.trim()) {
            toast({
              title: 'Error',
              description: 'Por favor describe lo que necesitas',
              variant: 'destructive'
            });
            return;
          }
          createFreeQuote();
          break;
        }
      case 'items':
        {
          // Direct creation instead of review step
          createQuote();
          break;
        }
    }
  };
  const prevStep = () => {
    switch (currentStep) {
      case 'client':
        setCurrentStep('approach');
        break;
      case 'diagnostic':
        // Go back to approach for clients, client selection for staff
        if (profile?.role === 'cliente') {
          setCurrentStep('approach');
        } else {
          setCurrentStep('client');
        }
        break;
      case 'items':
        if (selectedApproach === 'problem') {
          setCurrentStep('diagnostic');
        } else {
          // Go back to approach for clients, client selection for staff
          if (profile?.role === 'cliente') {
            setCurrentStep('approach');
          } else {
            setCurrentStep('client');
          }
        }
        break;
    }
  };

  // Crear cotización
  const createQuote = async () => {
    if (!selectedClient || !profile) return;
    try {
      setLoading(true);
      const initialStatus = 'pendiente_aprobacion';
      const quoteData = {
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        client_phone: selectedClient.phone,
        service_description: quoteItems.length > 0 ? `Cotización para ${quoteItems.map(item => item.name).join(', ')}` : 'Cotización personalizada',
        estimated_amount: calculateTotal(),
        notes: quoteDetails.notes,
        marketing_channel: quoteDetails.marketing_channel,
        sale_type: quoteDetails.sale_type,
        status: initialStatus,
        created_by: (profile as any).user_id || undefined,
        assigned_to: (profile as any).user_id || undefined
      };
      const {
        data: quoteResult,
        error: quoteError
      } = await supabase.from('quotes').insert(quoteData as any).select('id').single();
      if (quoteError) {
        console.error('Quote creation error:', quoteError);
        toast({
          title: "Error",
          description: `Error al crear la cotización: ${quoteError.message}`,
          variant: "destructive"
        });
        return;
      }

      // Insert quote items
      if (quoteItems.length > 0 && quoteResult) {
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
        const {
          data: savedItems,
          error: itemsError
        } = await supabase.from('quote_items').insert(itemsData).select('id');
        if (itemsError) {
          console.error('Error creating quote items:', itemsError);
          toast({
            title: "Advertencia",
            description: "La cotización se creó pero hubo un error al guardar los artículos",
            variant: "destructive"
          });
        }
      }

      
      const successMessage = profile?.role === 'cliente' ? "Cotización enviada y pendiente de aprobación" : "Cotización creada exitosamente";
      toast({
        title: "Éxito",
        description: successMessage
      });
      onSuccess();
    } catch (error) {
      console.error('Error creating quote:', error);
      toast({
        title: "Error inesperado",
        description: "No se pudo crear la cotización",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Crear cotización libre (solo texto)
  const createFreeQuote = async () => {
    if (!selectedClient || !profile) return;
    try {
      setLoading(true);
      const initialStatus = 'solicitud';
      const quoteData = {
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        client_phone: selectedClient.phone,
        service_description: freeTextDescription,
        estimated_amount: 0,
        notes: 'Cotización libre - Requiere revisión y estimación',
        marketing_channel: 'web',
        sale_type: 'servicio',
        status: initialStatus,
        created_by: (profile as any).user_id || undefined,
        assigned_to: (profile as any).user_id || undefined
      };
      
      const {
        data: quoteResult,
        error: quoteError
      } = await supabase.from('quotes').insert(quoteData as any).select('id').single();
      
      if (quoteError) {
        console.error('Quote creation error:', quoteError);
        toast({
          title: "Error",
          description: `Error al crear la cotización: ${quoteError.message}`,
          variant: "destructive"
        });
        return;
      }

      const successMessage = profile?.role === 'cliente' 
        ? "Solicitud de cotización enviada. Pronto recibirás una respuesta con la cotización detallada." 
        : "Cotización libre creada exitosamente";
      toast({
        title: "Éxito",
        description: successMessage
      });
      onSuccess();
    } catch (error) {
      console.error('Error creating free quote:', error);
      toast({
        title: "Error inesperado",
        description: "No se pudo crear la cotización",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (amount: number) => formatCOPCeilToTen(amount);
  const stepTitles = {
    approach: 'Tipo de Cotización',
    client: 'Cliente',
    diagnostic: 'Diagnóstico',
    items: 'Servicios',
    free_text: 'Descripción'
  };
  const stepIcons = {
    approach: CheckSquare,
    client: User,
    diagnostic: CheckSquare,
    items: Package
  };
  return <div className="min-h-screen bg-background p-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={onCancel} className="p-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="text-center flex-1">
          <h1 className="text-lg font-semibold">Nueva Cotización</h1>
          <p className="text-xs text-muted-foreground">{stepTitles[currentStep]}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} className="p-2">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile Progress Bar */}
      <div className="flex justify-center mb-4">
        <div className="flex space-x-1">
          {Object.keys(stepTitles).map((step, index) => {
          // Skip client step for clients
          if (step === 'client' && profile?.role === 'cliente') return null;
          
          const isActive = currentStep === step;
          const isCompleted = step === 'approach' && selectedApproach || 
                              step === 'client' && selectedClient || 
                              step === 'diagnostic' && !['approach', 'client'].includes(currentStep) || 
                              step === 'items' && !['approach', 'client', 'diagnostic'].includes(currentStep);
          return <div key={step} className={`h-2 w-8 rounded-full ${isActive ? 'bg-primary' : isCompleted ? 'bg-green-500' : 'bg-muted'}`} />;
        })}
        </div>
      </div>

      {/* Step Content */}
      <div className="space-y-4">
        {/* Step 0: Approach Selection */}
        {currentStep === 'approach' && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold mb-2">¿Cómo prefieres crear tu cotización?</h2>
                <p className="text-sm text-muted-foreground">Selecciona la opción que mejor se adapte a tus necesidades</p>
              </div>
              
              <div className="space-y-4">
                {/* Problem-based approach */}
                <div 
                  onClick={() => setSelectedApproach('problem')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedApproach === 'problem' 
                      ? 'border-primary bg-primary/5 shadow-md' 
                      : 'border-muted hover:border-muted-foreground/20 hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-lg flex-shrink-0 ${selectedApproach === 'problem' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <CheckSquare className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-1 break-words">Tengo un problema específico</h3>
                      <p className="text-sm text-muted-foreground mb-2 break-words leading-relaxed">
                        Te ayudaremos a diagnosticar tu problema y te recomendaremos la solución más adecuada
                      </p>
                      <div className="flex items-center text-xs text-primary font-medium flex-wrap">
                        <Check className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="break-words">Recomendado para problemas técnicos</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Catalog-based approach */}
                <div 
                  onClick={() => setSelectedApproach('catalog')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedApproach === 'catalog' 
                      ? 'border-primary bg-primary/5 shadow-md' 
                      : 'border-muted hover:border-muted-foreground/20 hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-lg flex-shrink-0 ${selectedApproach === 'catalog' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <Package className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-1 break-words">Ver catálogo de servicios</h3>
                      <p className="text-sm text-muted-foreground mb-2 break-words leading-relaxed">
                        Explora todos nuestros productos y servicios disponibles para crear tu cotización personalizada
                      </p>
                      <div className="flex items-center text-xs text-primary font-medium flex-wrap">
                        <Check className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="break-words">Ideal para cotizaciones personalizadas</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Free text approach */}
                <div 
                  onClick={() => setSelectedApproach('free')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedApproach === 'free' 
                      ? 'border-primary bg-primary/5 shadow-md' 
                      : 'border-muted hover:border-muted-foreground/20 hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-lg flex-shrink-0 ${selectedApproach === 'free' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <Plus className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-1 break-words">Cotización libre</h3>
                      <p className="text-sm text-muted-foreground mb-2 break-words leading-relaxed">
                        Describe en tus propias palabras lo que necesitas y te enviaremos una cotización personalizada
                      </p>
                      <div className="flex items-center text-xs text-primary font-medium flex-wrap">
                        <Check className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="break-words">Rápido y sencillo</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Client Selection */}
        {currentStep === 'client' && <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar cliente..." value={clientSearchTerm} onChange={e => setClientSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowNewClientDialog(true)} className="px-3">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={loadClients} className="px-3">
                  ↻
                </Button>
              </div>
              
              <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Clientes disponibles:</span> {filteredClients.length}
                  {filteredClients.length < clients.length && (
                    <span className="ml-2 text-xs text-muted-foreground">(mostrando {filteredClients.length} de {clients.length}; usa la barra para buscar)</span>
                  )}
                  {filteredClients.length === 0 && clients.length === 0 && (
                    <span className="text-destructive ml-2">
                      ⚠️ No se encontraron clientes. Verifique que haya clientes registrados o haga clic en refrescar.
                    </span>
                  )}
                </p>
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredClients.length === 0 && clients.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay clientes disponibles</p>
                    <Button 
                      variant="outline" 
                      onClick={loadClients} 
                      className="mt-4"
                    >
                      Refrescar clientes
                    </Button>
                  </div>
                ) : (
                  filteredClients.map(client => <div key={client.id} onClick={() => setSelectedClient(client)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedClient?.id === client.id ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/20'}`}>
                      <div className="font-medium text-sm">{client.name}</div>
                      <div className="text-xs text-muted-foreground">{client.email}</div>
                    </div>)
                )}
              </div>

              {selectedClient && <div className="p-3 bg-green-50 rounded-lg border-green-200 border">
                  <div className="text-sm font-medium text-green-800">Cliente seleccionado</div>
                  <div className="text-xs text-green-600">{selectedClient.name}</div>
                </div>}
            </CardContent>
          </Card>}

        {/* Step 2: Diagnostic */}
        {currentStep === 'diagnostic' && <Card>
            <CardContent className="p-4">
              <SimpleDiagnosticFlow onDiagnosisComplete={result => {
            setDiagnosticSolution(result);
            // Auto-add recommended services if any
            if (result.recommended_services?.length > 0) {
              const newItems = result.recommended_services.map((service: any) => {
                // Helper functions for price calculation
                const isProduct = (srv: any) => {
                  const hasTiers = Array.isArray(srv.profit_margin_tiers) && srv.profit_margin_tiers.length > 0;
                  return hasTiers || srv.item_type === 'articulo';
                };

                const marginFromTiers = (srv: any): number => srv.profit_margin_tiers?.[0]?.margin ?? 30;

                const calculatePrices = (srv: any) => {
                  let basePrice = 0;
                  
                  if (!isProduct(srv)) {
                    // Service: use base_price
                    basePrice = srv.base_price || 0;
                  } else {
                    // Product: calculate with profit margin
                    const profitMargin = marginFromTiers(srv);
                    const costPrice = srv.cost_price || 0;
                    if (costPrice > 0) {
                      basePrice = costPrice * (1 + profitMargin / 100);
                    } else {
                      basePrice = srv.base_price || 0;
                    }
                  }
                  
                  // Calculate VAT on base price
                  const vatAmount = basePrice * (srv.vat_rate || 16) / 100;
                  const baseTotal = basePrice + vatAmount;
                  
                  // Add cashback for services (matching CategoryServiceSelection logic)
                  // Removed cashback calculation - cashback system eliminated
                  
                  const finalPrice = baseTotal;
                  
                  return { unitPrice: finalPrice, subtotal: basePrice, vatAmount, total: finalPrice };
                };

                const { unitPrice, subtotal, vatAmount, total } = calculatePrices(service);
                
                return {
                  id: crypto.randomUUID(),
                  service_type_id: service.id,
                  name: service.name,
                  description: service.description || '',
                  quantity: 1,
                  unit_price: unitPrice,
                  subtotal: subtotal,
                  vat_rate: service.vat_rate || 16,
                  vat_amount: vatAmount,
                  withholding_rate: 0,
                  withholding_amount: 0,
                  withholding_type: '',
                  total: total,
                  is_custom: false
                };
              });
              
              setQuoteItems(prev => [...prev, ...newItems]);
            }
          }} />
            </CardContent>
          </Card>}

        {/* Step 3: Free Text Description */}
        {currentStep === 'free_text' && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold mb-2">Describe lo que necesitas</h2>
                <p className="text-sm text-muted-foreground">
                  Escribe con tus propias palabras lo que necesitas cotizar. Nuestro equipo revisará tu solicitud y te enviará una cotización detallada.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="freeDescription">Descripción de tu solicitud *</Label>
                <Textarea
                  id="freeDescription"
                  value={freeTextDescription}
                  onChange={(e) => setFreeTextDescription(e.target.value)}
                  placeholder="Ejemplo: Necesito formatear mi computadora y cambiar la pasta térmica del procesador. También quisiera que revisen porque se calienta mucho..."
                  rows={8}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Incluye todos los detalles que consideres importantes: problema, equipo, marca, modelo, etc.
                </p>
              </div>

              {selectedClient && (
                <div className="p-3 bg-primary/5 rounded-lg border">
                  <div className="text-sm font-medium">Cliente seleccionado</div>
                  <div className="text-xs text-muted-foreground">{selectedClient.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedClient.email}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Items Selection */}
        {currentStep === 'items' && <div className="space-y-4">
            {/* Quote Ready Status */}
            {quoteItems.length > 0 && (
              <Card className="border-2 border-green-200 bg-green-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-800 font-semibold text-sm">¡Tu cotización está lista!</span>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 border border-green-200 mb-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700 mb-1">
                        {formatCurrency(calculateTotal())}
                      </div>
                      <div className="text-xs text-green-600">
                        {quoteItems.length} servicio{quoteItems.length !== 1 ? 's' : ''} incluido{quoteItems.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-green-700 text-center">
                    Puedes enviar esta cotización ahora o agregar más servicios opcionales
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Items Summary */}
            {quoteItems.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Servicios seleccionados ({quoteItems.length})
                  </h3>
                  
                  <div className="space-y-3">
                    {quoteItems.map((item, index) => (
                      <div key={item.id || index} className="border rounded-lg p-3 bg-card/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm mb-1">{item.name}</h4>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {item.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>Cantidad: {item.quantity}</span>
                              <span>•</span>
                              <span>Precio unitario: {formatCurrency(item.unit_price)}</span>
                            </div>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <div className="font-semibold text-sm">
                              {formatCurrency(item.total)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quote Totals Summary with Cashback Options */}
            {quoteItems.length > 0 && selectedClient && (
              <Card>
                <CardContent className="p-4">
                  <QuoteTotalsSummary
                    selectedItems={quoteItems}
                    clientId={selectedClient.id}
                    clientEmail={selectedClient.email}
                  />
                </CardContent>
              </Card>
            )}

            {/* Additional Services Section */}
            <Card className="border-dashed border-2 border-muted">
              <CardContent className="p-4">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">
                    {quoteItems.length > 0 ? '¿Necesitas algo más?' : 'Selecciona tus servicios'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {quoteItems.length > 0 
                      ? 'Agrega servicios adicionales a tu cotización' 
                      : 'Explora nuestro catálogo de productos y servicios'
                    }
                  </p>
                </div>
                
                <CategoryServiceSelection 
                  selectedItems={quoteItems} 
                  onItemsChange={setQuoteItems}
                  simplifiedView={true} 
                  clientId={selectedClient?.id} 
                  clientEmail={selectedClient?.email} 
                />
              </CardContent>
            </Card>

            {/* Empty State */}
            {quoteItems.length === 0 && (
              <Card className="border-dashed border-2 border-muted">
                <CardContent className="p-6 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Crea tu cotización personalizada</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Selecciona los productos y servicios que necesitas desde nuestro catálogo
                  </p>
                  <div className="w-full h-px bg-muted my-4"></div>
                </CardContent>
              </Card>
            )}
          </div>}

      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-3 z-50">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 'client'} size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Atrás
          </Button>

          <div className="text-xs text-muted-foreground">
            {Object.keys(stepTitles).indexOf(currentStep) + 1} de {Object.keys(stepTitles).length}
          </div>

          {currentStep === 'items' ? <Button onClick={createQuote} disabled={loading} size="sm">
              {loading ? 'Creando...' : 'Crear Cotización'}
            </Button> : currentStep === 'free_text' ? <Button onClick={nextStep} disabled={!freeTextDescription.trim() || loading} size="sm">
              {loading ? 'Creando...' : 'Enviar Solicitud'}
            </Button> : <Button onClick={nextStep} size="sm">
              Siguiente
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>}
        </div>
      </div>

      {/* Bottom spacing for fixed navigation */}
      <div className="h-20"></div>

      {/* New Client Dialog - Uses full user creation with auth */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Crea un nuevo cliente con su cuenta de acceso al sistema
            </DialogDescription>
          </DialogHeader>
          <ClientUserForm
            onSuccess={(newClient) => {
              setShowNewClientDialog(false);
              loadClients();
              setSelectedClient(newClient);
            }}
            onCancel={() => setShowNewClientDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>;
}