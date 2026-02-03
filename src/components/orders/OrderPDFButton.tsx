import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatMXNExact, ceilToTen } from '@/utils/currency';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import logoSyslag from '@/assets/logo-syslag.png';

interface Order {
  id: string;
  order_number: string;
  status: string;
  failure_description?: string;
  estimated_cost?: number;
  created_at: string;
  delivery_date?: string;
  estimated_delivery_date?: string | null;
  special_price_enabled?: boolean;
  special_price?: number | null;
  clients?: {
    name: string;
    client_number: string;
    email?: string;
    phone?: string;
    address: string;
  } | null;
  technician_profile?: {
    full_name: string;
  } | null;
}

interface OrderPDFButtonProps {
  order: Order;
  variant?: 'icon' | 'full';
}

export function OrderPDFButton({ order, variant = 'icon' }: OrderPDFButtonProps) {
  const [exporting, setExporting] = useState(false);

  const calculateItemDisplayPrice = (item: any): number => {
    const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
    if (hasStoredTotal) {
      return Number(item.total_amount);
    }

    const quantity = item.quantity || 1;
    const salesVatRate = item.vat_rate || 16;
    
    if (item.item_type === 'servicio') {
      const basePrice = (item.unit_base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      return ceilToTen(afterSalesVat);
    } else {
      const purchaseVatRate = 16;
      const baseCost = (item.unit_cost_price || 0) * quantity;
      const profitMargin = item.profit_margin_rate || 20;
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      return ceilToTen(afterSalesVat);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    
    try {
      // Fetch order items
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      const items = orderItems || [];

      // Calculate totals
      let calculatedTotal = items.reduce((sum, item) => {
        const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
        if (hasStoredTotal) return sum + Number(item.total_amount);
        return sum + calculateItemDisplayPrice(item);
      }, 0);

      if (calculatedTotal === 0 && order.estimated_cost) {
        calculatedTotal = order.estimated_cost;
      }

      const displayTotal = order.special_price_enabled && order.special_price 
        ? order.special_price 
        : calculatedTotal;

      // Fetch technician if assigned
      let technicianName = order.technician_profile?.full_name || null;

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

      const formattedDate = format(new Date(order.created_at), "d 'de' MMMM 'de' yyyy", { locale: es });
      const deliveryDateStr = order.estimated_delivery_date || order.delivery_date;
      const formattedDeliveryDate = deliveryDateStr 
        ? format(new Date(deliveryDateStr), "d 'de' MMMM 'de' yyyy", { locale: es })
        : 'Por definir';

      const getItemTypeLabel = (type?: string) => {
        switch (type) {
          case 'producto': return 'Producto';
          case 'servicio': return 'Servicio';
          case 'garantia': return 'Garantía';
          default: return 'Servicio';
        }
      };

      const getStatusLabel = (status: string) => {
        switch (status) {
          case 'en_espera': return 'En Espera';
          case 'pendiente_aprobacion': return 'Pendiente Aprobación';
          case 'pendiente_actualizacion': return 'Pendiente Actualización';
          case 'en_proceso': return 'En Proceso';
          case 'pendiente_entrega': return 'Pendiente Entrega';
          case 'finalizada': return 'Finalizada';
          case 'cancelada': return 'Cancelada';
          case 'rechazada': return 'Rechazada';
          default: return status;
        }
      };

      const itemsHtml = items.length > 0 
        ? items.map((item: any) => {
          const unitPriceDisplay = item.quantity > 0 
            ? (item.total_amount || calculateItemDisplayPrice(item)) / item.quantity 
            : item.unit_base_price || item.unit_cost_price || 0;
          const itemTotal = item.total_amount || calculateItemDisplayPrice(item);
          return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <div style="font-weight: 500;">${item.service_name}</div>
              ${item.service_description ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${item.service_description}</div>` : ''}
              <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">${getItemTypeLabel(item.item_type)}</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatMXNExact(unitPriceDisplay)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${formatMXNExact(itemTotal)}</td>
          </tr>
        `}).join('')
        : `
          <tr>
            <td colspan="4" style="padding: 20px; text-align: center; color: #6b7280;">
              ${order.failure_description || 'Sin descripción'}
            </td>
          </tr>
        `;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Orden ${order.order_number}</title>
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
            .order-container { max-width: 800px; margin: 0 auto; }
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
            .order-info { text-align: right; }
            .order-title { font-size: 28px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; }
            .order-number { font-size: 16px; font-weight: 600; margin-top: 4px; color: #374151; }
            .order-date { font-size: 13px; color: #6b7280; margin-top: 4px; }
            .order-status { 
              display: inline-block;
              padding: 4px 12px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              margin-top: 8px;
              background: #dbeafe;
              color: #1e40af;
            }
            .client-section { background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
            .section-title { font-size: 14px; font-weight: 600; color: #2563eb; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .client-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .client-label { font-size: 12px; color: #6b7280; }
            .client-value { font-size: 14px; font-weight: 500; color: #1f2937; }
            .description-section { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
            .description-title { font-size: 13px; font-weight: 600; color: #92400e; margin-bottom: 8px; }
            .description-text { font-size: 13px; color: #78350f; }
            .items-section { margin-bottom: 24px; }
            .items-table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
            .items-table th { background: #2563eb; color: white; padding: 12px; text-align: left; font-size: 13px; font-weight: 600; }
            .items-table th:nth-child(2), .items-table th:nth-child(3), .items-table th:nth-child(4) { text-align: center; }
            .items-table th:last-child { text-align: right; }
            .totals-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
            .totals-box { width: 280px; background: #f9fafb; border-radius: 8px; padding: 16px; }
            .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .totals-row.final { border-top: 2px solid #2563eb; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 700; color: #2563eb; }
            .footer { text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb; }
            .delivery-info { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
            .delivery-info strong { color: #1f2937; }
            .disclaimer { font-size: 12px; color: #9ca3af; font-style: italic; }
            .print-buttons { text-align: center; margin-bottom: 24px; padding: 16px; background: #f3f4f6; border-radius: 8px; }
            .print-btn { padding: 10px 24px; margin: 0 8px; font-size: 14px; font-weight: 500; border: none; border-radius: 6px; cursor: pointer; }
            .print-btn.primary { background: #2563eb; color: white; }
            .print-btn.secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
          </style>
        </head>
        <body>
          <div class="order-container">
            <div class="print-buttons no-print">
              <button class="print-btn primary" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
              <button class="print-btn secondary" onclick="window.close()">✕ Cerrar</button>
            </div>
            
            <div class="header">
              <div>
                <img src="${logoBase64}" alt="Logo" class="logo-img" />
                <div class="company-info">Servicios Profesionales<br/>www.syslag.com</div>
              </div>
              <div class="order-info">
                <div class="order-title">Orden de Servicio</div>
                <div class="order-number">${order.order_number}</div>
                <div class="order-date">${formattedDate}</div>
                <div class="order-status">${getStatusLabel(order.status)}</div>
              </div>
            </div>
            
            <div class="client-section">
              <div class="section-title">Datos del Cliente</div>
              <div class="client-grid">
                <div><div class="client-label">Nombre</div><div class="client-value">${order.clients?.name || 'No especificado'}</div></div>
                <div><div class="client-label">No. Cliente</div><div class="client-value">${order.clients?.client_number || '-'}</div></div>
                ${order.clients?.email ? `<div><div class="client-label">Email</div><div class="client-value">${order.clients.email}</div></div>` : ''}
                ${order.clients?.phone ? `<div><div class="client-label">Teléfono</div><div class="client-value">${order.clients.phone}</div></div>` : ''}
                ${order.clients?.address ? `<div style="grid-column: 1 / -1;"><div class="client-label">Dirección</div><div class="client-value">${order.clients.address}</div></div>` : ''}
                ${technicianName ? `<div><div class="client-label">Técnico Asignado</div><div class="client-value">${technicianName}</div></div>` : ''}
              </div>
            </div>

            ${order.failure_description ? `
            <div class="description-section">
              <div class="description-title">📋 Descripción del Problema</div>
              <div class="description-text">${order.failure_description}</div>
            </div>
            ` : ''}
            
            <div class="items-section">
              <div class="section-title">Detalle de Servicios</div>
              <table class="items-table">
                <thead><tr><th>Descripción</th><th>Cant.</th><th>P. Unit.</th><th>Total</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
              </table>
            </div>
            
            <div class="totals-section">
              <div class="totals-box">
                ${order.special_price_enabled && order.special_price ? `
                <div class="totals-row" style="text-decoration: line-through; color: #9ca3af;">
                  <span>Subtotal:</span>
                  <span>${formatMXNExact(calculatedTotal)}</span>
                </div>
                <div class="totals-row" style="color: #d97706;">
                  <span>Precio Especial:</span>
                  <span>${formatMXNExact(order.special_price)}</span>
                </div>
                ` : ''}
                <div class="totals-row final">
                  <span>Total:</span>
                  <span>${formatMXNExact(displayTotal)}</span>
                </div>
                <div style="font-size: 11px; color: #6b7280; text-align: right; margin-top: 4px;">
                  Precio final (IVA incluido)
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div class="delivery-info">
                Fecha estimada de entrega: <strong>${formattedDeliveryDate}</strong>
              </div>
              <div class="disclaimer">
                Precios y tiempos de entrega sujetos a cambios según diagnóstico final.
              </div>
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

  if (variant === 'full') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPDF}
        disabled={exporting}
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <FileText className="h-4 w-4 mr-2" />
        )}
        Exportar PDF
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation();
            handleExportPDF();
          }}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Exportar PDF</p>
      </TooltipContent>
    </Tooltip>
  );
}
