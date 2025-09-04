import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { X, Plus } from "lucide-react";

interface PurchaseItem {
  id: string;
  item_name: string;
  brand: string;
  model: string;
  serial_number: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  warranty_months: number;
  notes: string;
}

interface PurchaseItemsDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PurchaseItemsDialog({ open, onClose, onSuccess }: PurchaseItemsDialogProps) {
  const { toast } = useToast();
  
  // Purchase form states
  const [supplierValue, setSupplierValue] = useState("");
  const [concept, setConcept] = useState("");
  const [accountType, setAccountType] = useState<"fiscal" | "no_fiscal">("no_fiscal");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().substring(0, 10));
  const [hasInvoice, setHasInvoice] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  
  // Item form states
  const [itemName, setItemName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [warrantyMonths, setWarrantyMonths] = useState("12");
  const [notes, setNotes] = useState("");
  
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("status", "active")
        .order("supplier_name");
      
      if (error) throw error;
      return data || [];
    }
  });

  const addItem = () => {
    if (!itemName || !serialNumber || !unitPrice || !quantity) {
      toast({
        title: "Error",
        description: "Complete todos los campos obligatorios del artículo",
        variant: "destructive"
      });
      return;
    }

    // Check for duplicate serial number
    if (items.some(item => item.serial_number === serialNumber)) {
      toast({
        title: "Error", 
        description: "Ya existe un artículo con este número de serie",
        variant: "destructive"
      });
      return;
    }

    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      item_name: itemName,
      brand: brand || "",
      model: model || "",
      serial_number: serialNumber,
      unit_price: parseFloat(unitPrice),
      quantity: parseInt(quantity),
      total_price: parseFloat(unitPrice) * parseInt(quantity),
      warranty_months: parseInt(warrantyMonths),
      notes: notes || ""
    };

    setItems([...items, newItem]);
    
    // Clear form
    setItemName("");
    setBrand("");
    setModel("");
    setSerialNumber("");
    setUnitPrice("");
    setQuantity("1");
    setWarrantyMonths("12");
    setNotes("");
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleSubmit = async () => {
    if (!concept || items.length === 0) {
      toast({
        title: "Error",
        description: "Complete el concepto de compra y agregue al menos un artículo",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const totalAmount = getTotalAmount();
      
      // Create expense record
      const { data: expenseData, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          description: concept,
          amount: totalAmount,
          expense_date: purchaseDate,
          account_type: accountType,
          payment_method: paymentMethod || null,
          category: "compra",
          supplier_id: supplierValue || null,
          has_invoice: hasInvoice,
          invoice_number: hasInvoice ? invoiceNumber : null,
          expense_number: `EXP-${Date.now()}`
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Create purchase items
      const itemsToInsert = items.map(item => ({
        expense_id: expenseData.id,
        item_name: item.item_name,
        brand: item.brand,
        model: item.model,
        serial_number: item.serial_number,
        unit_price: item.unit_price,
        quantity: item.quantity,
        total_price: item.total_price,
        warranty_months: item.warranty_months,
        notes: item.notes
      }));

      const { error: itemsError } = await supabase
        .from("purchase_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({
        title: "Éxito",
        description: `Compra registrada con ${items.length} artículo(s)`
      });

      // Reset form
      setSupplierValue("");
      setConcept("");
      setAccountType("no_fiscal");
      setPaymentMethod("");
      setPurchaseDate(new Date().toISOString().substring(0, 10));
      setHasInvoice(false);
      setInvoiceNumber("");
      setItems([]);
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error registering purchase:", error);
      toast({
        title: "Error",
        description: error.message || "Error al registrar la compra",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Compra con Artículos</DialogTitle>
          <DialogDescription>
            Registre una compra y los artículos con números de serie incluidos
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Purchase Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información de Compra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="supplier">Proveedor</Label>
                <Select value={supplierValue} onValueChange={setSupplierValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier: any) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="concept">Concepto de Compra*</Label>
                <Input
                  id="concept"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej: Compra de equipos de cómputo"
                />
              </div>

              <div>
                <Label htmlFor="purchaseDate">Fecha de Compra</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="accountType">Tipo de Cuenta</Label>
                <Select value={accountType} onValueChange={(value: "fiscal" | "no_fiscal") => setAccountType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fiscal">Fiscal</SelectItem>
                    <SelectItem value="no_fiscal">No Fiscal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="paymentMethod">Método de Pago</Label>
                <Input
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  placeholder="Efectivo, Transferencia, etc."
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasInvoice"
                  checked={hasInvoice}
                  onChange={(e) => setHasInvoice(e.target.checked)}
                />
                <Label htmlFor="hasInvoice">Tiene factura</Label>
              </div>

              {hasInvoice && (
                <div>
                  <Label htmlFor="invoiceNumber">Número de Factura</Label>
                  <Input
                    id="invoiceNumber"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="ABC-001"
                  />
                </div>
              )}

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Total de artículos:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Monto total:</span>
                  <span>${getTotalAmount().toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Item Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Agregar Artículo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="itemName">Nombre del Artículo*</Label>
                <Input
                  id="itemName"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Ej: Laptop Dell Inspiron"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="brand">Marca</Label>
                  <Input
                    id="brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Dell, HP, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="model">Modelo</Label>
                  <Input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Inspiron 15"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="serialNumber">Número de Serie*</Label>
                <Input
                  id="serialNumber"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                  placeholder="ABC123XYZ"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="unitPrice">Precio Unitario*</Label>
                  <Input
                    id="unitPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="quantity">Cantidad*</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="warrantyMonths">Garantía (meses)</Label>
                <Input
                  id="warrantyMonths"
                  type="number"
                  min="0"
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                />
              </div>

              <Button onClick={addItem} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Artículo
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Items List */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Artículos Agregados ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artículo</TableHead>
                      <TableHead>Marca/Modelo</TableHead>
                      <TableHead>No. Serie</TableHead>
                      <TableHead>Precio Unit.</TableHead>
                      <TableHead>Cant.</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Garantía</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell>
                          {item.brand && item.model ? `${item.brand} ${item.model}` : item.brand || item.model || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.serial_number}</TableCell>
                        <TableCell>${item.unit_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="font-medium">${item.total_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{item.warranty_months} meses</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || items.length === 0}>
            {loading ? "Registrando..." : `Registrar Compra (${items.length} artículos)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}