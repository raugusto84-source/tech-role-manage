import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AccessDevelopment } from './AccessDevelopmentsManager';
import { Receipt, Download, Mail, Eye, FileText, Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatMXNExact } from '@/utils/currency';
import logoAcceso from '@/assets/logo-acceso.png';

interface PaidPayment {
  id: string;
  development_id: string;
  payment_period: string;
  due_date: string;
  amount: number;
  investor_portion: number;
  company_portion: number;
  is_recovery_period: boolean;
  status: string;
  paid_at: string;
  payment_method: string | null;
  payment_reference: string | null;
}

interface Props {
  developments: AccessDevelopment[];
}

export function DevelopmentReceipts({ developments }: Props) {
  const [paidPayments, setPaidPayments] = useState<PaidPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevelopment, setSelectedDevelopment] = useState<string>('all');
  const [viewingReceipt, setViewingReceipt] = useState<PaidPayment | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPaidPayments();
  }, []);

  const loadPaidPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('access_development_payments')
        .select('*')
        .eq('status', 'paid')
        .order('paid_at', { ascending: false });

      if (error) throw error;
      setPaidPayments(data || []);
    } catch (error) {
      console.error('Error loading paid payments:', error);
      toast.error('Error al cargar recibos');
    } finally {
      setLoading(false);
    }
  };

  const getDevelopment = (id: string) => {
    return developments.find(d => d.id === id);
  };

  const getDevelopmentName = (id: string) => {
    return getDevelopment(id)?.name || 'Desconocido';
  };

  const getPaymentMethodLabel = (method: string | null) => {
    const methods: Record<string, string> = {
      'efectivo': 'Efectivo',
      'transferencia': 'Transferencia',
      'tarjeta': 'Tarjeta',
      'tarjeta_debito': 'Tarjeta de Débito',
      'tarjeta_credito': 'Tarjeta de Crédito',
      'cheque': 'Cheque'
    };
    return methods[method || ''] || method || 'No especificado';
  };

  const filteredPayments = paidPayments.filter(p => {
    if (selectedDevelopment !== 'all' && p.development_id !== selectedDevelopment) return false;
    return true;
  });

  const generateReceiptNumber = (payment: PaidPayment) => {
    const date = new Date(payment.paid_at);
    return `REC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${payment.id.slice(0, 6).toUpperCase()}`;
  };

  const handleExportPDF = async (payment: PaidPayment) => {
    const dev = getDevelopment(payment.development_id);
    const receiptNumber = generateReceiptNumber(payment);
    
    // Convert logo to base64 for PDF
    const logoBase64 = await fetch(logoAcceso)
      .then(res => res.blob())
      .then(blob => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      }));
    
    // Create a printable HTML document
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Por favor permite las ventanas emergentes');
      return;
    }

    const periodDate = new Date(payment.payment_period);
    const paidDate = new Date(payment.paid_at);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo ${receiptNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background: #fff; }
          .receipt { max-width: 600px; margin: 0 auto; border: 2px solid #333; padding: 30px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .logo-img { max-height: 60px; margin-bottom: 10px; }
          .receipt-title { font-size: 20px; margin-top: 10px; text-transform: uppercase; letter-spacing: 2px; }
          .receipt-number { font-size: 14px; color: #666; margin-top: 5px; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; font-size: 14px; color: #666; margin-bottom: 8px; text-transform: uppercase; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #ccc; }
          .row:last-child { border-bottom: none; }
          .label { color: #666; }
          .value { font-weight: 600; }
          .amount-section { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .total-amount { font-size: 28px; font-weight: bold; color: #059669; text-align: center; }
          .total-label { text-align: center; font-size: 12px; color: #666; margin-bottom: 5px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center; font-size: 12px; color: #666; }
          .stamp { margin-top: 20px; padding: 10px; border: 2px solid #059669; display: inline-block; color: #059669; font-weight: bold; transform: rotate(-5deg); }
          @media print { body { padding: 20px; } .receipt { border: 1px solid #ccc; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <img src="${logoBase64}" alt="Acceso by Syslag" class="logo-img" />
            <div class="receipt-title">Recibo de Pago</div>
            <div class="receipt-number">${receiptNumber}</div>
          </div>
          
          <div class="section">
            <div class="section-title">Datos del Fraccionamiento</div>
            <div class="row">
              <span class="label">Nombre:</span>
              <span class="value">${dev?.name || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Dirección:</span>
              <span class="value">${dev?.address || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Contacto:</span>
              <span class="value">${dev?.contact_name || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Teléfono:</span>
              <span class="value">${dev?.contact_phone || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Email:</span>
              <span class="value">${dev?.contact_email || 'N/A'}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Detalles del Pago</div>
            <div class="row">
              <span class="label">Período:</span>
              <span class="value">${format(periodDate, 'MMMM yyyy', { locale: es })}</span>
            </div>
            <div class="row">
              <span class="label">Fecha de Pago:</span>
              <span class="value">${format(paidDate, 'dd/MM/yyyy HH:mm', { locale: es })}</span>
            </div>
            <div class="row">
              <span class="label">Método de Pago:</span>
              <span class="value">${getPaymentMethodLabel(payment.payment_method)}</span>
            </div>
            ${payment.payment_reference ? `
            <div class="row">
              <span class="label">Referencia:</span>
              <span class="value">${payment.payment_reference}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="amount-section">
            <div class="total-label">MONTO TOTAL PAGADO</div>
            <div class="total-amount">$${payment.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
          </div>
          
          <div style="text-align: center;">
            <div class="stamp">✓ PAGADO</div>
          </div>
          
          <div class="footer">
            <p>Este recibo es un comprobante de pago válido.</p>
            <p>Syslag - Sistema de Gestión de Accesos</p>
            <p>Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSendEmail = async (payment: PaidPayment) => {
    const dev = getDevelopment(payment.development_id);
    
    if (!dev?.contact_email) {
      toast.error('El fraccionamiento no tiene email de contacto');
      return;
    }

    setSendingEmail(payment.id);
    try {
      const { error } = await supabase.functions.invoke('send-development-receipt', {
        body: {
          paymentId: payment.id,
          developmentId: payment.development_id,
          email: dev.contact_email
        }
      });

      if (error) throw error;
      toast.success(`Recibo enviado a ${dev.contact_email}`);
    } catch (error) {
      console.error('Error sending receipt:', error);
      toast.error('Error al enviar el recibo por correo');
    } finally {
      setSendingEmail(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Recibos de Pago</h2>
        </div>
        <Badge variant="secondary">{filteredPayments.length} recibos</Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={selectedDevelopment} onValueChange={setSelectedDevelopment}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Todos los fraccionamientos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los fraccionamientos</SelectItem>
            {developments.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Receipts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Recibo</TableHead>
                <TableHead>Fraccionamiento</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Fecha de Pago</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    No hay recibos para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map(payment => {
                  const dev = getDevelopment(payment.development_id);
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">
                        {generateReceiptNumber(payment)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {getDevelopmentName(payment.development_id)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(payment.payment_period), 'MMMM yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(payment.paid_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getPaymentMethodLabel(payment.payment_method)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatMXNExact(payment.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingReceipt(payment)}
                            title="Ver recibo"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExportPDF(payment)}
                            title="Exportar PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSendEmail(payment)}
                            disabled={!dev?.contact_email || sendingEmail === payment.id}
                            title={dev?.contact_email ? 'Enviar por correo' : 'Sin email de contacto'}
                          >
                            {sendingEmail === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Receipt Preview Dialog */}
      <Dialog open={!!viewingReceipt} onOpenChange={(open) => !open && setViewingReceipt(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Recibo de Pago
            </DialogTitle>
          </DialogHeader>
          {viewingReceipt && (
            <ReceiptPreview 
              payment={viewingReceipt} 
              development={getDevelopment(viewingReceipt.development_id)}
              receiptNumber={generateReceiptNumber(viewingReceipt)}
              getPaymentMethodLabel={getPaymentMethodLabel}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingReceipt(null)}>
              Cerrar
            </Button>
            <Button onClick={() => viewingReceipt && handleExportPDF(viewingReceipt)}>
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
            <Button 
              onClick={() => viewingReceipt && handleSendEmail(viewingReceipt)}
              disabled={!getDevelopment(viewingReceipt?.development_id || '')?.contact_email}
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar por Correo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Receipt Preview Component
function ReceiptPreview({ 
  payment, 
  development, 
  receiptNumber,
  getPaymentMethodLabel
}: { 
  payment: PaidPayment; 
  development: AccessDevelopment | undefined;
  receiptNumber: string;
  getPaymentMethodLabel: (method: string | null) => string;
}) {
  const periodDate = new Date(payment.payment_period);
  const paidDate = new Date(payment.paid_at);

  return (
    <div className="space-y-4">
      {/* Receipt Header */}
      <div className="text-center pb-4 border-b">
        <img src={logoAcceso} alt="Acceso by Syslag" className="h-12 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Recibo de Pago</p>
        <p className="font-mono text-sm mt-1">{receiptNumber}</p>
      </div>

      {/* Development Info */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm text-muted-foreground">FRACCIONAMIENTO</h4>
        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
          <p className="font-medium">{development?.name || 'N/A'}</p>
          <p className="text-sm text-muted-foreground">{development?.address || 'Sin dirección'}</p>
          <p className="text-sm">{development?.contact_name} • {development?.contact_phone}</p>
          <p className="text-sm text-muted-foreground">{development?.contact_email}</p>
        </div>
      </div>

      {/* Payment Details */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm text-muted-foreground">DETALLES DEL PAGO</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Período:</span>
            <p className="font-medium">{format(periodDate, 'MMMM yyyy', { locale: es })}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Fecha de Pago:</span>
            <p className="font-medium">{format(paidDate, 'dd/MM/yyyy HH:mm', { locale: es })}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Método:</span>
            <p className="font-medium">{getPaymentMethodLabel(payment.payment_method)}</p>
          </div>
          {payment.payment_reference && (
            <div>
              <span className="text-muted-foreground">Referencia:</span>
              <p className="font-medium">{payment.payment_reference}</p>
            </div>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground">MONTO TOTAL PAGADO</p>
        <p className="text-3xl font-bold text-green-600">{formatMXNExact(payment.amount)}</p>
      </div>

      {/* Stamp */}
      <div className="flex justify-center">
        <Badge variant="default" className="text-lg px-4 py-1 bg-green-600">
          ✓ PAGADO
        </Badge>
      </div>
    </div>
  );
}
