import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  User, 
  ShoppingCart 
} from 'lucide-react';
import { formatCOPCeilToTen } from '@/utils/currency';

interface FreeQuoteWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
}

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
  vat_rate: number;
}

export function FreeQuoteWizard({ onSuccess, onCancel }: FreeQuoteWizardProps) {
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState<'client' | 'items'>('client');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cliente
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [showNewClientForm, setShowNewClientForm] = useState(false);

  // Items
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    vat_rate: 16
  });

  // Cargar clientes
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const handleCreateClient = async () => {
    if (!newClientData.name || !newClientData.email || !newClientData.address) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa nombre, email y dirección",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          name: newClientData.name,
          email: newClientData.email,
          phone: newClientData.phone || '',
          address: newClientData.address,
          created_by: profile?.user_id
        }] as any)
        .select()
        .single();

      if (error) throw error;

      setSelectedClient(data);
      setShowNewClientForm(false);
      setNewClientData({ name: '', email: '', phone: '', address: '' });
      loadClients();
      
      toast({
        title: "Cliente creado",
        description: "El cliente ha sido creado exitosamente"
      });
    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el cliente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!currentItem.name || currentItem.unit_price <= 0) {
      toast({
        title: "Datos incompletos",
        description: "Por favor ingresa nombre y precio del item",
        variant: "destructive"
      });
      return;
    }

    const newItem: QuoteItem = {
      id: crypto.randomUUID(),
      ...currentItem
    };

    setQuoteItems([...quoteItems, newItem]);
    setCurrentItem({
      name: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      vat_rate: 16
    });

    toast({
      title: "Item agregado",
      description: "El item ha sido agregado a la cotización"
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setQuoteItems(quoteItems.filter(item => item.id !== itemId));
  };

  const calculateItemTotals = (item: QuoteItem) => {
    const subtotal = item.quantity * item.unit_price;
    const vatAmount = subtotal * (item.vat_rate / 100);
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  };

  const calculateQuoteTotals = () => {
    let totalSubtotal = 0;
    let totalVat = 0;
    let totalAmount = 0;

    quoteItems.forEach(item => {
      const { subtotal, vatAmount, total } = calculateItemTotals(item);
      totalSubtotal += subtotal;
      totalVat += vatAmount;
      totalAmount += total;
    });

    return { totalSubtotal, totalVat, totalAmount };
  };

  const handleSubmitQuote = async () => {
    if (!selectedClient) {
      toast({
        title: "Cliente requerido",
        description: "Por favor selecciona o crea un cliente",
        variant: "destructive"
      });
      return;
    }

    if (quoteItems.length === 0) {
      toast({
        title: "Items requeridos",
        description: "Agrega al menos un item a la cotización",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);
      const { totalAmount } = calculateQuoteTotals();

      // Crear cotización
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert([{
          client_name: selectedClient.name,
          client_email: selectedClient.email,
          client_phone: selectedClient.phone || '',
          service_description: 'Cotización libre - Items personalizados',
          estimated_amount: totalAmount,
          status: 'solicitud',
          created_by: profile?.user_id,
          assigned_to: profile?.user_id,
          marketing_channel: 'web',
          sale_type: 'servicio'
        }] as any)
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Insertar items
      const itemsToInsert = quoteItems.map(item => {
        const { subtotal, vatAmount, total } = calculateItemTotals(item);
        return {
          quote_id: quote.id,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal,
          vat_rate: item.vat_rate,
          vat_amount: vatAmount,
          total,
          is_custom: true
        };
      });

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({
        title: "Cotización creada",
        description: `Cotización ${quote.quote_number} creada exitosamente`
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating quote:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la cotización",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const { totalSubtotal, totalVat, totalAmount } = calculateQuoteTotals();

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={onCancel} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Cotización Libre</h1>
        <p className="text-muted-foreground mt-1">
          Crea una cotización agregando items personalizados manualmente
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-center mb-8 gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            currentStep === 'client' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}>
            <User className="h-4 w-4" />
          </div>
          <span className={currentStep === 'client' ? 'font-semibold' : 'text-muted-foreground'}>
            Cliente
          </span>
        </div>
        <div className="w-16 h-0.5 bg-muted" />
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            currentStep === 'items' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}>
            <ShoppingCart className="h-4 w-4" />
          </div>
          <span className={currentStep === 'items' ? 'font-semibold' : 'text-muted-foreground'}>
            Items
          </span>
        </div>
      </div>

      {/* Content */}
      {currentStep === 'client' && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-4">Seleccionar Cliente</h2>
            
            {!showNewClientForm ? (
              <>
                <div className="mb-4">
                  <Input
                    placeholder="Buscar cliente por nombre o email..."
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                  />
                </div>

                <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                  {filteredClients.map(client => (
                    <div
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedClient?.id === client.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-semibold">{client.name}</div>
                      <div className="text-sm text-muted-foreground">{client.email}</div>
                      {client.phone && (
                        <div className="text-sm text-muted-foreground">{client.phone}</div>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowNewClientForm(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear nuevo cliente
                </Button>

                {selectedClient && (
                  <Button
                    onClick={() => setCurrentStep('items')}
                    className="w-full mt-4"
                  >
                    Continuar a Items
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={newClientData.name}
                    onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                    placeholder="Teléfono de contacto"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Dirección *</Label>
                  <Textarea
                    id="address"
                    value={newClientData.address}
                    onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                    placeholder="Dirección completa"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowNewClientForm(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreateClient}
                    disabled={loading}
                    className="flex-1"
                  >
                    Crear Cliente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 'items' && (
        <div className="space-y-6">
          {/* Cliente seleccionado */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">Cliente</h3>
                  <p className="text-sm">{selectedClient?.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedClient?.email}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep('client')}
                >
                  Cambiar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Agregar item */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4">Agregar Item</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="itemName">Nombre *</Label>
                    <Input
                      id="itemName"
                      value={currentItem.name}
                      onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })}
                      placeholder="Nombre del item"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quantity">Cantidad *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={currentItem.quantity}
                      onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={currentItem.description}
                    onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                    placeholder="Descripción del item"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="unitPrice">Precio Unitario *</Label>
                    <Input
                      id="unitPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentItem.unit_price}
                      onChange={(e) => setCurrentItem({ ...currentItem, unit_price: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vatRate">IVA (%)</Label>
                    <Input
                      id="vatRate"
                      type="number"
                      min="0"
                      max="100"
                      value={currentItem.vat_rate}
                      onChange={(e) => setCurrentItem({ ...currentItem, vat_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Item
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de items */}
          {quoteItems.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4">
                  Items de la Cotización ({quoteItems.length})
                </h2>
                <div className="space-y-3">
                  {quoteItems.map(item => {
                    const { subtotal, vatAmount, total } = calculateItemTotals(item);
                    return (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold">{item.name}</h3>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Cantidad: {item.quantity}</div>
                          <div>Precio Unit: {formatCOPCeilToTen(item.unit_price)}</div>
                          <div>Subtotal: {formatCOPCeilToTen(subtotal)}</div>
                          <div>IVA ({item.vat_rate}%): {formatCOPCeilToTen(vatAmount)}</div>
                          <div className="col-span-2 font-semibold">
                            Total: {formatCOPCeilToTen(total)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totales */}
                <div className="mt-6 pt-6 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatCOPCeilToTen(totalSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>IVA Total:</span>
                    <span>{formatCOPCeilToTen(totalVat)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCOPCeilToTen(totalAmount)}</span>
                  </div>
                </div>

                <Button
                  onClick={handleSubmitQuote}
                  disabled={submitting}
                  className="w-full mt-6"
                  size="lg"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {submitting ? 'Creando...' : 'Crear Cotización'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
