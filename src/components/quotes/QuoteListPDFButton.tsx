import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCOPCeilToTen } from '@/utils/currency';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import logoSyslag from '@/assets/logo-acceso.png';

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  service_description: string;
  estimated_amount: number;
  status: string;
  request_date: string;
}

interface QuoteListPDFButtonProps {
  quote: Quote;
}

export function QuoteListPDFButton({ quote }: QuoteListPDFButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    
    try {
      // Fetch quote items
      const { data: quoteItems } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quote.id);

      const items = quoteItems || [];

      // Calculate totals
      let subtotal = 0;
      let totalVat = 0;
      let totalWithholdings = 0;
      let total = 0;

      items.forEach(item => {
        subtotal += item.subtotal || 0;
        totalVat += item.vat_amount || 0;
        totalWithholdings += item.withholding_amount || 0;
        total += item.total || 0;
      });

      const displayTotal = total > 0 ? total : quote.estimated_amount;

      // Convert logo to base64
      const logoBase64 = await fetch(logoSyslag)
        .then(res => res.blob())
        .then(blob => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        }));

      // Create printable HTML
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const formattedDate = format(new Date(quote.request_date), "d 'de' MMMM 'de' yyyy", { locale: es });
      const validUntil = format(new Date(new Date(quote.request_date).getTime() + 7 * 24 * 60 * 60 * 1000), "d 'de' MMMM 'de' yyyy", { locale: es });

      const itemsHtml = items.length > 0 
        ? items.map((item: any) => {
          // Precio unitario = total / cantidad (precio final con IVA por unidad)
          const unitPriceDisplay = item.quantity > 0 ? item.total / item.quantity : item.unit_price;
          return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <div style="font-weight: 500;">${item.name}</div>
              ${item.description ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${item.description}</div>` : ''}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCOPCeilToTen(unitPriceDisplay)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${formatCOPCeilToTen(item.total)}</td>
          </tr>
        `}).join('')
        : `
          <tr>
            <td colspan="4" style="padding: 20px; text-align: center; color: #6b7280;">
              ${quote.service_description}
            </td>
          </tr>
        `;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Cotización ${quote.quote_number}</title>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none; }
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              padding: 40px; 
              background: #fff;
              color: #1f2937;
              line-height: 1.5;
            }
            .quote-container { max-width: 800px; margin: 0 auto; }
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start;
              padding-bottom: 24px; 
              border-bottom: 2px solid #2563eb;
              margin-bottom: 24px;
            }
            .logo-img { max-height: 60px; }
            .company-info { font-size: 12px; color: #6b7280; margin-top: 8px; }
            .quote-info { text-align: right; }
            .quote-title { font-size: 28px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; }
            .quote-number { font-size: 16px; font-weight: 600; margin-top: 4px; color: #374151; }
            .quote-date { font-size: 13px; color: #6b7280; margin-top: 4px; }
            .client-section { background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
            .section-title { font-size: 14px; font-weight: 600; color: #2563eb; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .client-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .client-label { font-size: 12px; color: #6b7280; }
            .client-value { font-size: 14px; font-weight: 500; color: #1f2937; }
            .items-section { margin-bottom: 24px; }
            .items-table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
            .items-table th { background: #2563eb; color: white; padding: 12px; text-align: left; font-size: 13px; font-weight: 600; }
            .items-table th:nth-child(2), .items-table th:nth-child(3), .items-table th:nth-child(4) { text-align: center; }
            .items-table th:last-child { text-align: right; }
            .totals-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
            .totals-box { width: 280px; background: #f9fafb; border-radius: 8px; padding: 16px; }
            .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .totals-row.final { border-top: 2px solid #2563eb; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 700; color: #2563eb; }
            .totals-row.withholding { color: #dc2626; }
            .footer { text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb; }
            .validity { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
            .validity strong { color: #1f2937; }
            .disclaimer { font-size: 12px; color: #9ca3af; font-style: italic; }
            .print-buttons { text-align: center; margin-bottom: 24px; padding: 16px; background: #f3f4f6; border-radius: 8px; }
            .print-btn { padding: 10px 24px; margin: 0 8px; font-size: 14px; font-weight: 500; border: none; border-radius: 6px; cursor: pointer; }
            .print-btn.primary { background: #2563eb; color: white; }
            .print-btn.secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
          </style>
        </head>
        <body>
          <div class="quote-container">
            <div class="print-buttons no-print">
              <button class="print-btn primary" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
              <button class="print-btn secondary" onclick="window.close()">✕ Cerrar</button>
            </div>
            
            <div class="header">
              <div>
                <img src="${logoBase64}" alt="Logo" class="logo-img" />
                <div class="company-info">Servicios Profesionales<br/>www.syslag.com</div>
              </div>
              <div class="quote-info">
                <div class="quote-title">Cotización</div>
                <div class="quote-number">${quote.quote_number}</div>
                <div class="quote-date">${formattedDate}</div>
              </div>
            </div>
            
            <div class="client-section">
              <div class="section-title">Datos del Cliente</div>
              <div class="client-grid">
                <div><div class="client-label">Nombre</div><div class="client-value">${quote.client_name}</div></div>
                <div><div class="client-label">Email</div><div class="client-value">${quote.client_email}</div></div>
                ${quote.client_phone ? `<div><div class="client-label">Teléfono</div><div class="client-value">${quote.client_phone}</div></div>` : ''}
              </div>
            </div>
            
            <div class="items-section">
              <div class="section-title">Detalle de la Cotización</div>
              <table class="items-table">
                <thead><tr><th>Descripción</th><th>Cant.</th><th>P. Unit.</th><th>Total</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
              </table>
            </div>
            
            <div class="totals-section">
              <div class="totals-box">
                ${totalWithholdings > 0 ? `<div class="totals-row withholding"><span>Retenciones:</span><span>-${formatCOPCeilToTen(totalWithholdings)}</span></div>` : ''}
                <div class="totals-row final"><span>Total:</span><span>${formatCOPCeilToTen(displayTotal)}</span></div>
                <div style="font-size: 11px; color: #6b7280; text-align: right; margin-top: 4px;">Precio final (IVA incluido)</div>
              </div>
            </div>
            
            <div class="footer">
              <div class="validity">Cotización válida hasta: <strong>${validUntil}</strong></div>
              <div class="disclaimer">Precios y disponibilidad sujetos a cambios sin previo aviso.</div>
            </div>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleExportPDF}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Exportar PDF</p>
      </TooltipContent>
    </Tooltip>
  );
}
