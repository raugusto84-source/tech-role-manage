import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AccessDevelopment } from './AccessDevelopmentsManager';
import { FileText, Download, Mail, Eye, Send, Loader2, AlertCircle } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatMXNExact } from '@/utils/currency';
import logoAcceso from '@/assets/logo-acceso.png';

interface PendingPayment {
  id: string;
  development_id: string;
  payment_period: string;
  due_date: string;
  amount: number;
  investor_portion: number | null;
  company_portion: number | null;
  is_recovery_period: boolean | null;
  status: string;
}

interface Props {
  developments: AccessDevelopment[];
}

export function DevelopmentPaymentNotices({ developments }: Props) {
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevelopment, setSelectedDevelopment] = useState<string>('all');
  const [viewingNotice, setViewingNotice] = useState<PendingPayment | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  useEffect(() => {
    loadPendingPayments();
  }, []);

  const loadPendingPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('access_development_payments')
        .select('*')
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setPendingPayments(data || []);
    } catch (error) {
      console.error('Error loading pending payments:', error);
      toast.error('Error al cargar avisos de pago');
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

  const filteredPayments = pendingPayments.filter(p => {
    if (selectedDevelopment !== 'all' && p.development_id !== selectedDevelopment) return false;
    return true;
  });

  const generateNoticeNumber = (payment: PendingPayment) => {
    const date = new Date(payment.due_date);
    return `AVI-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${payment.id.slice(0, 6).toUpperCase()}`;
  };

  const isOverdue = (dueDate: string) => {
    return isBefore(new Date(dueDate), startOfDay(new Date()));
  };

  const handleExportPDF = async (payment: PendingPayment) => {
    const dev = getDevelopment(payment.development_id);
    const noticeNumber = generateNoticeNumber(payment);
    
    // Convert logo to base64 for PDF
    const logoBase64 = await fetch(logoAcceso)
      .then(res => res.blob())
      .then(blob => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      }));
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Por favor permite las ventanas emergentes');
      return;
    }

    const periodDate = new Date(payment.due_date);
    const overdue = isOverdue(payment.due_date);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Aviso de Pago ${noticeNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background: #fff; }
          .notice { max-width: 600px; margin: 0 auto; border: 2px solid #333; padding: 30px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .logo-img { max-height: 60px; margin-bottom: 10px; }
          .notice-title { font-size: 20px; margin-top: 10px; text-transform: uppercase; letter-spacing: 2px; }
          .notice-number { font-size: 14px; color: #666; margin-top: 5px; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; font-size: 14px; color: #666; margin-bottom: 8px; text-transform: uppercase; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #ccc; }
          .row:last-child { border-bottom: none; }
          .label { color: #666; }
          .value { font-weight: 600; }
          .amount-section { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #f59e0b; }
          .amount-section.overdue { background: #fee2e2; border-color: #ef4444; }
          .total-amount { font-size: 28px; font-weight: bold; color: #d97706; text-align: center; }
          .amount-section.overdue .total-amount { color: #dc2626; }
          .total-label { text-align: center; font-size: 12px; color: #666; margin-bottom: 5px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center; font-size: 12px; color: #666; }
          .stamp { margin-top: 20px; padding: 10px 20px; border: 2px solid #d97706; display: inline-block; color: #d97706; font-weight: bold; transform: rotate(-5deg); }
          .stamp.overdue { border-color: #dc2626; color: #dc2626; }
          .payment-info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 15px; }
          .payment-info-title { font-weight: bold; margin-bottom: 8px; }
          @media print { body { padding: 20px; } .notice { border: 1px solid #ccc; } }
        </style>
      </head>
      <body>
        <div class="notice">
          <div class="header">
            <img src="${logoBase64}" alt="Acceso by Syslag" class="logo-img" />
            <div class="notice-title">Aviso de Pago</div>
            <div class="notice-number">${noticeNumber}</div>
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
              <span class="label">Fecha de Vencimiento:</span>
              <span class="value" style="${overdue ? 'color: #dc2626;' : ''}">${format(periodDate, 'dd/MM/yyyy', { locale: es })}${overdue ? ' (VENCIDO)' : ''}</span>
            </div>
          </div>
          
          <div class="amount-section ${overdue ? 'overdue' : ''}">
            <div class="total-label">MONTO A PAGAR</div>
            <div class="total-amount">$${payment.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
          </div>
          
          <div style="text-align: center;">
            <div class="stamp ${overdue ? 'overdue' : ''}">${overdue ? '⚠ VENCIDO' : '⏳ PENDIENTE'}</div>
          </div>

          <div class="payment-info">
            <div class="payment-info-title">Información de Pago</div>
            <p style="font-size: 13px; color: #666;">
              Por favor realice su pago antes de la fecha de vencimiento para evitar cargos por mora.
              <br><br>
              Para cualquier duda o aclaración, contacte a nuestro equipo.
            </p>
          </div>
          
          <div class="footer">
            <p>Este documento es un aviso de pago, no es un recibo.</p>
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

  const handleSendEmail = async (payment: PendingPayment) => {
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
          email: dev.contact_email,
          isNotice: true // Flag to indicate this is a payment notice, not a receipt
        }
      });

      if (error) throw error;
      toast.success(`Aviso de pago enviado a ${dev.contact_email}`);
    } catch (error) {
      console.error('Error sending notice:', error);
      toast.error('Error al enviar el aviso por correo');
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
          <FileText className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-semibold">Avisos de Pago</h2>
        </div>
        <Badge variant="secondary">{filteredPayments.length} pendientes</Badge>
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

      {/* Payment Notices Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Aviso</TableHead>
                <TableHead>Fraccionamiento</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Fecha de Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    No hay pagos pendientes
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map(payment => {
                  const dev = getDevelopment(payment.development_id);
                  const overdue = isOverdue(payment.due_date);
                  return (
                    <TableRow key={payment.id} className={overdue ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="font-mono text-sm">
                        {generateNoticeNumber(payment)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {getDevelopmentName(payment.development_id)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(payment.payment_period), 'MMMM yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <span className={overdue ? 'text-red-600 font-medium' : ''}>
                          {format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: es })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {overdue ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Vencido
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-amber-600">
                        {formatMXNExact(payment.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingNotice(payment)}
                            title="Ver aviso"
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

      {/* Notice Preview Dialog */}
      <Dialog open={!!viewingNotice} onOpenChange={(open) => !open && setViewingNotice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Aviso de Pago
            </DialogTitle>
          </DialogHeader>
          {viewingNotice && (
            <NoticePreview 
              payment={viewingNotice} 
              development={getDevelopment(viewingNotice.development_id)}
              noticeNumber={generateNoticeNumber(viewingNotice)}
              isOverdue={isOverdue(viewingNotice.due_date)}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingNotice(null)}>
              Cerrar
            </Button>
            <Button onClick={() => viewingNotice && handleExportPDF(viewingNotice)}>
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
            <Button 
              onClick={() => viewingNotice && handleSendEmail(viewingNotice)}
              disabled={!getDevelopment(viewingNotice?.development_id || '')?.contact_email}
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

// Notice Preview Component
function NoticePreview({ 
  payment, 
  development, 
  noticeNumber,
  isOverdue
}: { 
  payment: PendingPayment; 
  development: AccessDevelopment | undefined;
  noticeNumber: string;
  isOverdue: boolean;
}) {
  const periodDate = new Date(payment.payment_period);
  const dueDate = new Date(payment.due_date);

  return (
    <div className="space-y-4">
      {/* Notice Header */}
      <div className="text-center pb-4 border-b">
        <img src={logoAcceso} alt="Acceso by Syslag" className="h-12 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Aviso de Pago</p>
        <p className="font-mono text-sm mt-1">{noticeNumber}</p>
      </div>

      {/* Development Info */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm text-muted-foreground">FRACCIONAMIENTO</h4>
        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
          <p className="font-medium">{development?.name || 'N/A'}</p>
          <p className="text-sm text-muted-foreground">{development?.address || 'Sin dirección'}</p>
          <p className="text-sm text-muted-foreground">{development?.contact_name} - {development?.contact_phone}</p>
        </div>
      </div>

      {/* Payment Details */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm text-muted-foreground">DETALLES</h4>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Período:</span>
            <span className="font-medium capitalize">{format(periodDate, 'MMMM yyyy', { locale: es })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fecha de Vencimiento:</span>
            <span className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
              {format(dueDate, 'dd/MM/yyyy', { locale: es })}
            </span>
          </div>
        </div>
      </div>

      {/* Amount */}
      <div className={`rounded-lg p-4 text-center ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
        <p className="text-xs text-muted-foreground mb-1">MONTO A PAGAR</p>
        <p className={`text-2xl font-bold ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
          {formatMXNExact(payment.amount)}
        </p>
      </div>

      {/* Status Badge */}
      <div className="flex justify-center">
        {isOverdue ? (
          <Badge variant="destructive" className="text-sm px-4 py-1 gap-1">
            <AlertCircle className="h-4 w-4" />
            VENCIDO
          </Badge>
        ) : (
          <Badge variant="outline" className="text-sm px-4 py-1 text-amber-600 border-amber-300 bg-amber-50">
            ⏳ PENDIENTE
          </Badge>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pt-4 border-t text-xs text-muted-foreground">
        <p>Este documento es un aviso de pago, no es un recibo.</p>
        <p>Generado el {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
      </div>
    </div>
  );
}
