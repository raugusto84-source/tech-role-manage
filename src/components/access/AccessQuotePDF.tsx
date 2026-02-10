import type { QuoteInputs, QuoteBreakdown } from './AccessQuoteCalculator';
import logoAcceso from '@/assets/logo-acceso.png';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);

const toBase64 = (url: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = url;
  });
};

export async function generateAccessQuotePDF(inputs: QuoteInputs, breakdown: QuoteBreakdown) {
  const logoBase64 = await toBase64(logoAcceso);
  const today = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  const totalGates = inputs.vehicularGatesSingle + inputs.vehicularGatesDouble;
  const gateDescription = [];
  if (inputs.vehicularGatesSingle > 0) gateDescription.push(`${inputs.vehicularGatesSingle} de una hoja`);
  if (inputs.vehicularGatesDouble > 0) gateDescription.push(`${inputs.vehicularGatesDouble} de dos hojas`);
  const gateText = gateDescription.join(' y ');

  const exitType = inputs.controlledExit ? 'Controlada' : 'Libre';

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Cotización - ${inputs.name}</title>
<style>
  @page { size: letter; margin: 15mm 15mm 15mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; font-size: 11pt; line-height: 1.5; }
  
  .page { page-break-after: always; min-height: 100%; position: relative; }
  .page:last-child { page-break-after: avoid; }
  
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #1a1a2e; }
  .logo { height: 60px; }
  .date { font-size: 14pt; font-weight: bold; color: #1a1a2e; }
  
  .hero-title { font-size: 22pt; font-weight: bold; color: #1a1a2e; text-align: center; margin: 25px 0 15px; }
  
  .client-info { background: #f0f4ff; border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 11pt; }
  
  .intro-text { font-size: 10.5pt; line-height: 1.6; margin-bottom: 20px; text-align: justify; }
  
  .section-title { font-size: 14pt; font-weight: bold; color: #1a1a2e; margin: 20px 0 10px; border-bottom: 2px solid #e0e0e0; padding-bottom: 5px; }
  
  .service-description { font-size: 10pt; line-height: 1.6; margin-bottom: 8px; }
  
  .features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
  .feature-box { background: #f8f9fa; border-radius: 8px; padding: 12px; border-left: 4px solid #1a1a2e; }
  .feature-box h4 { font-size: 11pt; margin-bottom: 5px; color: #1a1a2e; }
  .feature-box ul { list-style: none; padding: 0; }
  .feature-box ul li { font-size: 9.5pt; padding: 2px 0; padding-left: 15px; position: relative; }
  .feature-box ul li:before { content: "•"; position: absolute; left: 0; color: #1a1a2e; font-weight: bold; }
  
  .pricing-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  .pricing-table th { background: #1a1a2e; color: white; padding: 10px 15px; text-align: center; font-size: 11pt; }
  .pricing-table td { padding: 10px 15px; text-align: center; border-bottom: 1px solid #e0e0e0; font-size: 11pt; }
  .pricing-table tr:nth-child(even) { background: #f8f9fa; }
  .pricing-table .amount { font-weight: bold; font-size: 12pt; }
  
  .implementation-note { background: #fff8e1; border-radius: 8px; padding: 12px 15px; margin: 15px 0; font-size: 10pt; border-left: 4px solid #ffc107; }
  
  .includes-list { margin: 10px 0; }
  .includes-list li { font-size: 10pt; padding: 3px 0; }
  
  .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8.5pt; color: #666; padding: 8px 15mm; border-top: 1px solid #e0e0e0; background: white; }
  
  .specs-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px 0; }
  .spec-item { text-align: center; background: #f0f4ff; border-radius: 8px; padding: 10px; }
  .spec-item .number { font-size: 20pt; font-weight: bold; color: #1a1a2e; }
  .spec-item .label { font-size: 8.5pt; color: #666; }
  
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- PAGE 1: Cover & Intro -->
<div class="page">
  <div class="header">
    ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="Acceso by Syslag" />` : '<div style="font-size:18pt;font-weight:bold;">Acceso by SYSLAG</div>'}
    <div class="date">${today}</div>
  </div>
  
  <div class="hero-title">Mejora el control de accesos<br>en tu fraccionamiento</div>
  
  <div class="client-info">
    <strong>${inputs.name}</strong>${inputs.contactName ? ` (${inputs.contactName})` : ''} — ${inputs.numHouses} casas
    ${inputs.address ? `<br>${inputs.address}` : ''}
  </div>
  
  <p class="intro-text">
    Gracias por su interés en nuestra solución de control de acceso para su fraccionamiento, 
    podrán gestionar accesos de manera rápida y segura, autorizando visitas desde su celular 
    y manteniendo un registro detallado de entradas y salidas.
  </p>
  
  <p class="intro-text">
    <strong>Acceso by SYSLAG</strong> es un sistema diseñado para controlar los accesos y administrar un fraccionamiento de forma segura, 
    ordenada y eficiente. Permite gestionar entradas y salidas vehiculares y peatonales mediante QR, tags, Pin o guardia, 
    manteniendo un registro completo de cada acceso.
  </p>
  
  <p class="intro-text">
    El sistema facilita la administración de cuotas, el control de pagos y morosidad, la gestión de incidencias, 
    administración de áreas comunes y el control de acceso, todo desde una sola plataforma, 
    brindando mayor seguridad y tranquilidad a la administración y a los residentes.
  </p>
  
  <div class="section-title">Configuración del Sistema</div>
  <p class="service-description">
    Se considera el control de <strong>${totalGates} acceso(s) vehicular(es)</strong> (${gateText}), 
    <strong>${inputs.pedestrianDoors} puerta(s) peatonal(es)</strong> y 
    <strong>Salida ${exitType}</strong>, por medio de QR, Código # y tags/tarjeta.
  </p>
  
  <div class="specs-summary">
    <div class="spec-item">
      <div class="number">${totalGates}</div>
      <div class="label">Accesos Vehiculares</div>
    </div>
    <div class="spec-item">
      <div class="number">${inputs.pedestrianDoors}</div>
      <div class="label">Puertas Peatonales</div>
    </div>
    <div class="spec-item">
      <div class="number">${inputs.numHouses}</div>
      <div class="label">Casas</div>
    </div>
    <div class="spec-item">
      <div class="number">${exitType}</div>
      <div class="label">Tipo de Salida</div>
    </div>
  </div>
</div>

<!-- PAGE 2: Features -->
<div class="page">
  <div class="header">
    ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="Acceso by Syslag" />` : '<div style="font-size:18pt;font-weight:bold;">Acceso by SYSLAG</div>'}
    <div style="font-size:10pt;color:#666;">Control de Acceso</div>
  </div>
  
  <div class="features-grid">
    <div class="feature-box">
      <h4>🏠 Colonos</h4>
      <ul>
        <li>Entrada y Salida por Tags/tarjeta</li>
        <li>Generación de Códigos QR/# para Visitantes</li>
        <li>Puerta peatonal apertura por código # Fijo</li>
        <li>5 cuentas (app) por casa</li>
        <li>Apertura de puertas remotamente desde la App</li>
        <li>Uso de la Plataforma (Saldos, eventos, reportes, incidencias)</li>
      </ul>
    </div>
    <div class="feature-box">
      <h4>👤 Visitantes</h4>
      <ul>
        <li>Entrada QR/# programables por el colono</li>
        <li>Salida ${exitType}</li>
      </ul>
    </div>
    <div class="feature-box">
      <h4>⚠️ Morosos</h4>
      <ul>
        <li>Se desactiva acceso vehicular</li>
        <li>Entrada por peatonal + botón de apertura</li>
        <li>Casa nueva: cargo equitativo mensual</li>
      </ul>
    </div>
    <div class="feature-box">
      <h4>🚛 Servicios</h4>
      <ul>
        <li>Basura, CFE, SIMAS: código con horario</li>
        <li>Rappi, Didi, etc: código temporal del colono</li>
      </ul>
    </div>
    <div class="feature-box">
      <h4>🔒 Seguridad</h4>
      <ul>
        <li>Modo comunitario para flujo continuo</li>
        <li>Respeto del área de recorrido de portones</li>
        <li>Semáforo de control</li>
      </ul>
    </div>
    <div class="feature-box">
      <h4>📊 Comité / Colonos</h4>
      <ul>
        <li>Control de Incidencias</li>
        <li>Control de Áreas Comunitarias</li>
        <li>Control de pagos y gastos</li>
        <li>Encuestas y Reportes financieros</li>
      </ul>
    </div>
  </div>
</div>

<!-- PAGE 3: Pricing -->
<div class="page">
  <div class="header">
    ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="Acceso by Syslag" />` : '<div style="font-size:18pt;font-weight:bold;">Acceso by SYSLAG</div>'}
    <div style="font-size:10pt;color:#666;">Su Inversión</div>
  </div>
  
  <div class="section-title">Su Inversión Incluye:</div>
  <ul class="includes-list">
    <li>✅ Asesoría, Soporte y Servicios Ilimitados</li>
    <li>✅ Una Visita Fija cada mes</li>
    <li>✅ Prioridad de Atención a fallas Máximo 24h hábiles</li>
    <li>✅ Cobros Automáticos</li>
  </ul>
  
  <div class="section-title">Plazo</div>
  <table class="pricing-table">
    <thead>
      <tr>
        <th>Plazo</th>
        <th>Pago Por Casa</th>
        <th>Pago Mensual</th>
      </tr>
    </thead>
    <tbody>
      ${breakdown.plans.map(p => `
        <tr>
          <td>${p.label}</td>
          <td class="amount">${fmt(p.perHouse)}</td>
          <td class="amount">${fmt(p.monthly)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="implementation-note">
    <strong>Nota:</strong> Se requiere un primer pago de implementación equivalente a una mensualidad 
    para iniciar con la preparación de los equipos y el sistema.
  </div>
  
  <p class="service-description" style="margin-top: 15px;">
    Cada casa pagaría por transferencia a una cuenta CLABE ÚNICA y todo lo depositado en esa cuenta 
    se reflejará en su saldo en la misma app, ese saldo podrá ser usado para pago de cuotas futuras, 
    pago de renta de áreas comunes o para lo acordado con el comité.
  </p>
  
  <p class="service-description">
    El día establecido se regresaría el total de lo recaudado a una cuenta proporcionada por el comité 
    menos el pago correspondiente por la renta y uso del sistema.
  </p>
  
  <p class="service-description">
    Firmando el Contrato contamos de 2 a 4 semanas para concluir con la instalación de los equipos 
    y la configuración del sistema.
  </p>
  
  <div style="margin-top: 30px; text-align: center; padding: 15px; background: #1a1a2e; color: white; border-radius: 8px;">
    <strong style="font-size: 12pt;">SOMOS EXPERTOS EN SEGURIDAD</strong><br>
    <span style="font-size: 10pt;">ALARMAS • CÁMARAS • CONTROL DE ACCESOS • CERCAS ELÉCTRICAS</span><br>
    <span style="font-size: 9pt; opacity: 0.8;">WWW.SYSLAG.COM &nbsp;|&nbsp; (871) 297 8545 &nbsp;|&nbsp; (871) 218 6134 &nbsp;|&nbsp; rafael.mercado@syslag.com</span>
  </div>
</div>

</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}
