/**
 * ============================================================
 *  ASOTRANSMAR vs 4.0 — Módulo de Venta de Boletos
 * ============================================================
 *  Gestiona la venta de pasajes: selección de zarpe, control
 *  de aforo normativo INEA (límite 160 pax), cálculo de tarifas
 *  multicategoría, emisión con Código QR y recibo térmico.
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.Sales = {

  /* --------------------------------------------------------
   *  init() — Inicializa el módulo de ventas
   * ------------------------------------------------------ */
  init() {
    this.populateZarpeSelector();

    // Listener: cambio de categoría → recalcular tarifa
    const categoriaSelect = document.getElementById('venta-categoria');
    if (categoriaSelect) {
      categoriaSelect.removeEventListener('change', this._onCategoriaChange);
      this._onCategoriaChange = () => this.updateTarifa();
      categoriaSelect.addEventListener('change', this._onCategoriaChange);
    }

    // Listener: cambio de zarpe → actualizar resumen
    const zarpeSelect = document.getElementById('venta-zarpe-select');
    if (zarpeSelect) {
      zarpeSelect.removeEventListener('change', this._onZarpeChange);
      this._onZarpeChange = () => this.updateZarpeSummary();
      zarpeSelect.addEventListener('change', this._onZarpeChange);
    }

    // Listener: método de pago (mostrar/ocultar referencia)
    const metodoSelect = document.getElementById('venta-metodo-pago');
    const refGroup = document.getElementById('group-venta-referencia');
    if (metodoSelect && refGroup) {
      metodoSelect.onchange = () => {
        const val = metodoSelect.value;
        if (val === 'pago_movil' || val === 'pos' || val === 'transferencia') {
          refGroup.style.display = 'block';
        } else {
          refGroup.style.display = 'none';
        }
      };
    }

    // Listener: botón vender
    const btnVender = document.getElementById('btn-vender');
    if (btnVender) {
      btnVender.removeEventListener('click', this._onVender);
      this._onVender = () => this.realizarVenta();
      btnVender.addEventListener('click', this._onVender);
    }

    this.updateTarifa();
    this.updateZarpeSummary();
  },

  /* --------------------------------------------------------
   *  populateZarpeSelector()
   * ------------------------------------------------------ */
  populateZarpeSelector() {
    const today = ASOTRANSMAR.Utils.today();
    ASOTRANSMAR.Schedules.ensureTodayZarpes(today);

    const zarpes = ASOTRANSMAR.Storage.getZarpesByFecha(today);
    const abiertos = zarpes.filter(z => z.estado !== 'cerrado');

    const select = document.getElementById('venta-zarpe-select');
    if (!select) return;

    select.innerHTML = '';

    if (abiertos.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— No hay zarpes abiertos disponibles —';
      select.appendChild(opt);
      return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let closestIdx = 0;
    let closestDiff = Infinity;

    abiertos.forEach((zarpe, idx) => {
      const opt = document.createElement('option');
      opt.value = zarpe.id;
      const paxCount = (zarpe.pasajeros || []).length;
      opt.textContent = zarpe.hora + ' - ' + zarpe.origen + ' → ' + zarpe.destino +
        ' (' + zarpe.embarcacion + ') [' + paxCount + '/160 pax]';
      select.appendChild(opt);

      const parts = zarpe.hora.split(':');
      const zarpeMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      const diff = zarpeMinutes - currentMinutes;
      if (diff >= 0 && diff < closestDiff) {
        closestDiff = diff;
        closestIdx = idx;
      }
    });

    select.selectedIndex = closestIdx;
  },

  /* --------------------------------------------------------
   *  updateTarifa()
   * ------------------------------------------------------ */
  updateTarifa() {
    const categoriaSelect = document.getElementById('venta-categoria');
    if (!categoriaSelect) return;

    const categoriaCode = categoriaSelect.value;
    const categorias = ASOTRANSMAR.Config.CATEGORIAS;
    const categoria = categorias.find(c => c.codigo === categoriaCode) || categorias[0];

    if (!categoria) return;

    const settings = ASOTRANSMAR.Storage.getSettings();
    const tarifaBaseUSD = settings.tarifa_reg_usd || 5;
    const tasaBCV = settings.tasa_bcv || 1;

    const montoUSD = tarifaBaseUSD * categoria.factor;
    const montoVES = montoUSD * tasaBCV;

    const elUSD = document.getElementById('venta-monto-usd');
    const elVES = document.getElementById('venta-monto-ves');

    if (elUSD) elUSD.textContent = ASOTRANSMAR.Utils.formatUSD(montoUSD);
    if (elVES) elVES.textContent = ASOTRANSMAR.Utils.formatVES(montoVES);
  },

  /* --------------------------------------------------------
   *  realizarVenta()
   * ------------------------------------------------------ */
  realizarVenta() {
    const cedulaRaw = (document.getElementById('venta-cedula') || {}).value || '';
    const nombreRaw = (document.getElementById('venta-nombre') || {}).value || '';
    const apellidoRaw = (document.getElementById('venta-apellido') || {}).value || '';
    const categoriaCode = (document.getElementById('venta-categoria') || {}).value || '';
    const zarpeId = (document.getElementById('venta-zarpe-select') || {}).value || '';
    const metodoPago = (document.getElementById('venta-metodo-pago') || {}).value || 'efectivo_ves';
    const referencia = ((document.getElementById('venta-referencia') || {}).value || '').trim();

    const cedula = cedulaRaw.replace(/[vV\-.\s]/g, '').trim();
    const nombre = this._capitalize(nombreRaw.trim());
    const apellido = this._capitalize(apellidoRaw.trim());

    if (!cedula) {
      ASOTRANSMAR.Utils.showToast('Debe ingresar la cédula del pasajero', 'error');
      return;
    }
    if (!nombre) {
      ASOTRANSMAR.Utils.showToast('Debe ingresar el nombre del pasajero', 'error');
      return;
    }
    if (!apellido) {
      ASOTRANSMAR.Utils.showToast('Debe ingresar el apellido del pasajero', 'error');
      return;
    }
    if (!zarpeId) {
      ASOTRANSMAR.Utils.showToast('Debe seleccionar un zarpe', 'error');
      return;
    }

    const zarpe = ASOTRANSMAR.Storage.getZarpeById(zarpeId);
    if (!zarpe) {
      ASOTRANSMAR.Utils.showToast('El zarpe seleccionado no existe', 'error');
      return;
    }
    if (zarpe.estado === 'cerrado') {
      ASOTRANSMAR.Utils.showToast('El zarpe seleccionado ya está cerrado', 'error');
      return;
    }

    // ── VALIDACIÓN ESTRICTA DE AFORO MÁXIMO INEA (160 PAX) ──
    const maxAforo = zarpe.capacidad_max || 160;
    const ocupacionActual = (zarpe.pasajeros || []).length;
    if (ocupacionActual >= maxAforo) {
      ASOTRANSMAR.Utils.showToast(
        '⛔ AFORO MÁXIMO INEA ALCANZADO: La embarcación ' + zarpe.embarcacion + ' ya tiene ' + ocupacionActual + ' de ' + maxAforo + ' pasajeros.',
        'error'
      );
      return;
    }

    const settings = ASOTRANSMAR.Storage.getSettings();
    const categorias = ASOTRANSMAR.Config.CATEGORIAS;
    const categoria = categorias.find(c => c.codigo === categoriaCode) || categorias[0];

    const tarifaBaseUSD = settings.tarifa_reg_usd || 5;
    const tasaBCV = settings.tasa_bcv || 1;
    const montoUSD = tarifaBaseUSD * categoria.factor;
    const montoVES = montoUSD * tasaBCV;

    const now = new Date();
    const horaVenta = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const currentUser = ASOTRANSMAR.Auth.getCurrentUser();

    const ticket = {
      id: ASOTRANSMAR.Utils.generateTicketId(),
      cedula: cedula,
      nombre: nombre,
      apellido: apellido,
      categoria: categoriaCode,
      zarpeId: zarpeId,
      monto_usd: parseFloat(montoUSD.toFixed(2)),
      monto_ves: parseFloat(montoVES.toFixed(2)),
      tasa_bcv: tasaBCV,
      metodo_pago: metodoPago,
      referencia: referencia,
      fecha: ASOTRANSMAR.Utils.today(),
      hora_venta: horaVenta,
      taquillero: currentUser ? currentUser.usuario : 'taquilla1',
      embarcacion: zarpe.embarcacion,
      origen: zarpe.origen,
      destino: zarpe.destino
    };

    ASOTRANSMAR.Storage.saveTicket(ticket);

    if (!zarpe.pasajeros) zarpe.pasajeros = [];
    zarpe.pasajeros.push(ticket.id);
    ASOTRANSMAR.Storage.saveZarpe(zarpe);

    this.showConfirmation(ticket);
    this.updateZarpeSummary();
    this.populateZarpeSelector();
    const select = document.getElementById('venta-zarpe-select');
    if (select) select.value = zarpe.id;

    // Limpiar campos
    const elCedula = document.getElementById('venta-cedula');
    const elNombre = document.getElementById('venta-nombre');
    const elApellido = document.getElementById('venta-apellido');
    const elRef = document.getElementById('venta-referencia');
    if (elCedula) elCedula.value = '';
    if (elNombre) elNombre.value = '';
    if (elApellido) elApellido.value = '';
    if (elRef) elRef.value = '';

    ASOTRANSMAR.Utils.showToast(
      'Boleto ' + ticket.id + ' emitido exitosamente (' + (ocupacionActual + 1) + '/' + maxAforo + ' pax)',
      'success'
    );
  },

  /* --------------------------------------------------------
   *  showConfirmation(ticket)
   * ------------------------------------------------------ */
  showConfirmation(ticket) {
    const container = document.getElementById('venta-confirmacion');
    if (!container) return;

    const categorias = ASOTRANSMAR.Config.CATEGORIAS;
    const cat = categorias.find(c => c.codigo === ticket.categoria);
    const catNombre = cat ? cat.nombre : ticket.categoria;

    const partesFecha = ticket.fecha.split('-');
    const fechaDisplay = partesFecha[2] + '/' + partesFecha[1] + '/' + partesFecha[0];
    const ruta = (ticket.origen || '—') + ' → ' + (ticket.destino || '—');

    const metodosMap = {
      efectivo_ves: 'Efectivo VES',
      divisas_usd: 'Divisas USD',
      pago_movil: 'Pago Móvil',
      pos: 'Punto de Venta POS',
      transferencia: 'Transferencia'
    };
    const metodoLabel = metodosMap[ticket.metodo_pago] || 'Efectivo';
    const refText = ticket.referencia ? ' (Ref: ' + ticket.referencia + ')' : '';

    container.innerHTML = '' +
      '<div class="recibo-card" id="ticket-recibo-card">' +
        '<div class="recibo-header">' +
          '<div class="recibo-logo">⚓</div>' +
          '<strong>ASOTRANSMAR C.A.</strong>' +
          '<div class="recibo-meta-small">RIF: J-315369986-9 | Muelle Coche</div>' +
        '</div>' +
        '<div class="recibo-separator">══════════════════════════</div>' +
        '<div class="recibo-id">BOLETO N° ' + ticket.id + '</div>' +
        '<div class="recibo-line"><span>Fecha:</span> <strong>' + fechaDisplay + ' ' + ticket.hora_venta + '</strong></div>' +
        '<div class="recibo-line"><span>Pasajero:</span> <strong>' + ticket.nombre + ' ' + ticket.apellido + '</strong></div>' +
        '<div class="recibo-line"><span>Cédula:</span> <strong>V-' + ticket.cedula + '</strong></div>' +
        '<div class="recibo-line"><span>Categoría:</span> <span class="badge badge-cat-' + ticket.categoria + '">' + catNombre + '</span></div>' +
        '<div class="recibo-line"><span>Ruta:</span> <strong>' + ruta + '</strong></div>' +
        '<div class="recibo-line"><span>Embarcación:</span> <strong>' + ticket.embarcacion + '</strong></div>' +
        '<div class="recibo-line"><span>Pago:</span> <strong>' + metodoLabel + refText + '</strong></div>' +
        '<div class="recibo-separator">──────────────────────────</div>' +
        '<div class="recibo-totales">' +
          '<div class="recibo-monto-usd">USD: ' + ASOTRANSMAR.Utils.formatUSD(ticket.monto_usd) + '</div>' +
          '<div class="recibo-monto-ves">VES: ' + ASOTRANSMAR.Utils.formatVES(ticket.monto_ves) + '</div>' +
          '<div class="recibo-tasa">Tasa BCV: ' + ticket.tasa_bcv.toFixed(2) + ' VES/USD</div>' +
        '</div>' +
        '<div class="recibo-qr-container">' +
          '<div id="ticket-qr-output"></div>' +
          '<small>Escanee para validar embarque</small>' +
        '</div>' +
        '<div class="recibo-footer">' +
          '<span>Taquillero: ' + ticket.taquillero + '</span>' +
          '<div class="recibo-actions" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px; width: 100%;">' +
            '<button id="btn-download-ticket-pdf" class="btn-print-ticket" style="background: #0284c7; color: #ffffff; border: none; padding: 10px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px;">' +
              '📥 Descargar Boleto Oficial en PDF' +
            '</button>' +
            '<button id="btn-print-ticket-single" class="btn-print-ticket" style="background: #334155; color: #ffffff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px;">' +
              '🖨️ Imprimir Ticket Térmico' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    container.style.display = 'block';

    // Guardar referencia al boleto actual
    this.currentTicket = ticket;

    // Vincular botones
    const btnPdf = document.getElementById('btn-download-ticket-pdf');
    if (btnPdf) {
      btnPdf.onclick = () => this.downloadTicketPDF(ticket);
    }
    const btnPrint = document.getElementById('btn-print-ticket-single');
    if (btnPrint) {
      btnPrint.onclick = () => this.printThermalTicket();
    }

    // Generar código QR nativo
    setTimeout(function() {
      const qrTarget = document.getElementById('ticket-qr-output');
      if (qrTarget && typeof QRCode !== 'undefined') {
        qrTarget.innerHTML = '';
        new QRCode(qrTarget, {
          text: 'ASOTRANSMAR:' + ticket.id + ':V' + ticket.cedula + ':' + ticket.monto_ves + 'VES',
          width: 88,
          height: 88,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }, 60);
  },

  /* --------------------------------------------------------
   *  downloadTicketPDF(ticket)
   * ------------------------------------------------------ */
  downloadTicketPDF(ticket) {
    if (!ticket) return;

    ASOTRANSMAR.Utils.showToast('Generando PDF del boleto...', 'info');

    const printableDoc = this.buildPrintableTicketElement(ticket);
    const filename = 'Boleto_' + ticket.id + '_V' + ticket.cedula + '.pdf';

    // Desactivar scroll suave temporalmente y posicionar en (0, 0) para captura exacta
    const htmlEl = document.documentElement;
    const prevBehavior = htmlEl.style.scrollBehavior;
    const prevX = window.pageXOffset || window.scrollX || 0;
    const prevY = window.pageYOffset || window.scrollY || 0;
    htmlEl.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);

    const restoreScroll = function() {
      window.scrollTo(prevX, prevY);
      htmlEl.style.scrollBehavior = prevBehavior;
    };

    if (typeof html2pdf !== 'undefined') {
      var opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
      };

      setTimeout(function() {
        html2pdf().set(opt).from(printableDoc).save().then(function() {
          restoreScroll();
          ASOTRANSMAR.Utils.showToast('Boleto en PDF descargado exitosamente', 'success');
        }).catch(function(err) {
          restoreScroll();
          console.error('Error generando PDF de boleto:', err);
          ASOTRANSMAR.Utils.showToast('Error al generar el PDF del boleto', 'error');
        });
      }, 60);
    } else {
      restoreScroll();
      this.printThermalTicket();
    }
  },

  /* --------------------------------------------------------
   *  buildPrintableTicketElement(ticket)
   * ------------------------------------------------------ */
  buildPrintableTicketElement(ticket) {
    const doc = document.createElement('div');
    doc.id = 'asotransmar-pdf-ticket-export';
    doc.style.width = '100%';
    doc.style.maxWidth = '100%';
    doc.style.boxSizing = 'border-box';
    doc.style.margin = '0 auto';
    doc.style.padding = '18px 22px';
    doc.style.background = '#ffffff';
    doc.style.color = '#0f172a';
    doc.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    doc.style.border = '2px solid #0f172a';
    doc.style.borderRadius = '8px';
    doc.style.lineHeight = '1.35';

    const categorias = ASOTRANSMAR.Config.CATEGORIAS;
    const cat = categorias.find(c => c.codigo === ticket.categoria);
    const catNombre = cat ? cat.nombre : ticket.categoria;

    const partesFecha = ticket.fecha.split('-');
    const fechaDisplay = partesFecha[2] + '/' + partesFecha[1] + '/' + partesFecha[0];
    const ruta = (ticket.origen || 'La Isleta') + ' → ' + (ticket.destino || 'San Pedro de Coche');

    const metodosMap = {
      efectivo_ves: 'Efectivo VES',
      divisas_usd: 'Divisas USD',
      pago_movil: 'Pago Móvil',
      pos: 'Punto de Venta POS',
      transferencia: 'Transferencia'
    };
    const metodoLabel = metodosMap[ticket.metodo_pago] || 'Efectivo';
    const refText = ticket.referencia ? ' (Ref: ' + ticket.referencia + ')' : '';

    // Renderizar QR en un contenedor temporal y extraer imagen dataURL
    let qrDataUrl = '';
    try {
      const qrDiv = document.createElement('div');
      new QRCode(qrDiv, {
        text: 'ASOTRANSMAR:BOLETO:' + ticket.id + ':V' + ticket.cedula + ':' + ticket.monto_ves + 'VES',
        width: 110,
        height: 110,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
      const qrCanvas = qrDiv.querySelector('canvas');
      if (qrCanvas) {
        qrDataUrl = qrCanvas.toDataURL('image/png');
      } else {
        const qrImg = qrDiv.querySelector('img');
        if (qrImg) qrDataUrl = qrImg.src;
      }
    } catch(e) {
      console.warn('QR dataURL generation fallback:', e);
    }

    const qrImgTag = qrDataUrl
      ? '<img src="' + qrDataUrl + '" style="width: 100px; height: 100px; display: block; margin: 0 auto; border: 1px solid #cbd5e1; padding: 4px; border-radius: 4px;" alt="QR Boleto" />'
      : '<div style="width: 100px; height: 100px; border: 1px dashed #64748b; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b;">QR CODE</div>';

    doc.innerHTML = '' +
      '<div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; text-align: center;">' +
        '<div style="font-size: 28px; line-height: 1; margin-bottom: 4px;">⚓</div>' +
        '<h1 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.01em; color: #0f172a;">ASOTRANSMAR C.A.</h1>' +
        '<p style="margin: 2px 0 0 0; font-size: 9px; font-weight: 700; color: #2563eb; letter-spacing: 0.05em;">ASOCIACIÓN DE TRANSPORTE MARÍTIMO DE COCHE</p>' +
        '<p style="margin: 1px 0 0 0; font-size: 8.5px; color: #64748b;">RIF: J-315369986-9 • NIT: 049582910 • Control Marítimo INEA</p>' +
        '<div style="margin-top: 8px; display: inline-block; padding: 3px 10px; background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 800; border-radius: 4px; letter-spacing: 0.05em;">' +
          'BOLETO OFICIAL DE EMBARQUE / FACTURA' +
        '</div>' +
      '</div>' +

      '<div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px;">' +
        '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">' +
          '<span style="font-size: 12px; font-weight: 800; color: #2563eb; font-family: monospace;">N° DE BOLETO: ' + ticket.id + '</span>' +
          '<span style="font-size: 10.5px; color: #475569; font-weight: 600;">' + fechaDisplay + ' • ' + ticket.hora_venta + ' hrs</span>' +
        '</div>' +
        '<table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">' +
          '<tr>' +
            '<td style="padding: 3px 6px; color: #64748b; width: 18%;">Pasajero:</td>' +
            '<td style="padding: 3px 6px; font-weight: 800; text-transform: uppercase; color: #0f172a; width: 32%;">' + ticket.nombre + ' ' + ticket.apellido + '</td>' +
            '<td style="padding: 3px 6px; color: #64748b; width: 18%;">Cédula:</td>' +
            '<td style="padding: 3px 6px; font-weight: 700; font-family: monospace; color: #0f172a; width: 32%;">V-' + ticket.cedula + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 3px 6px; color: #64748b;">Categoría:</td>' +
            '<td style="padding: 3px 6px; font-weight: 700; color: #0369a1;">' + catNombre + '</td>' +
            '<td style="padding: 3px 6px; color: #64748b;">Ruta / Travesía:</td>' +
            '<td style="padding: 3px 6px; font-weight: 800; color: #0f172a;">' + ruta + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 3px 6px; color: #64748b;">Embarcación:</td>' +
            '<td style="padding: 3px 6px; font-weight: 700; color: #0f172a;">' + ticket.embarcacion + '</td>' +
            '<td style="padding: 3px 6px; color: #64748b;">Forma de Pago:</td>' +
            '<td style="padding: 3px 6px; font-weight: 600; color: #334155;">' + metodoLabel + refText + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 3px 6px; color: #64748b;">Despacho Taquilla:</td>' +
            '<td style="padding: 3px 6px; color: #475569;">' + ticket.taquillero + '</td>' +
            '<td style="padding: 3px 6px; color: #64748b;">Aforo Máximo:</td>' +
            '<td style="padding: 3px 6px; font-weight: 600; color: #059669;">160 Pax (Normativa INEA)</td>' +
          '</tr>' +
        '</table>' +
      '</div>' +

      '<div style="background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px;">' +
        '<table style="width: 100%; border-collapse: collapse;">' +
          '<tr>' +
            '<td style="font-size: 10.5px; color: #64748b; padding: 3px 0; width: 33%;">' +
              '<span>Tarifa Oficial:</span> <strong style="color: #0f172a;">' + ASOTRANSMAR.Utils.formatUSD(ticket.monto_usd) + ' USD</strong>' +
            '</td>' +
            '<td style="font-size: 10.5px; color: #64748b; padding: 3px 0; text-align: center; width: 33%;">' +
              '<span>Tasa BCV:</span> <strong style="color: #475569;">' + ticket.tasa_bcv.toFixed(2) + ' VES/USD</strong>' +
            '</td>' +
            '<td style="text-align: right; font-size: 13.5px; font-weight: 900; color: #059669; padding: 3px 0; width: 34%;">' +
              'TOTAL: ' + ASOTRANSMAR.Utils.formatVES(ticket.monto_ves) +
            '</td>' +
          '</tr>' +
        '</table>' +
      '</div>' +

      '<div style="text-align: center; margin-bottom: 10px;">' +
        qrImgTag +
        '<p style="margin: 4px 0 0 0; font-size: 8.5px; color: #64748b; font-weight: 600;">CÓDIGO DE VALIDACIÓN ELECTRÓNICA DE EMBARQUE INEA</p>' +
      '</div>' +

      '<div style="border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center;">' +
        '<p style="margin: 0; font-size: 8px; color: #64748b; line-height: 1.35; font-style: italic;">' +
          'El presente boleto constituye contrato de transporte marítimo de pasajeros conforme a la Ley de Comercio Marítimo y regulaciones del Instituto Nacional de los Espacios Acuáticos (INEA). Todo pasajero debe presentar su documento de identidad original para el abordaje.' +
        '</p>' +
        '<p style="margin: 4px 0 0 0; font-size: 7.5px; color: #94a3b8;">' +
          'Emitido por ASOTRANSMAR vs 4.0 • ' + new Date().toLocaleString('es-VE') +
        '</p>' +
      '</div>';

    return doc;
  },

  /* --------------------------------------------------------
   *  printThermalTicket()
   * ------------------------------------------------------ */
  printThermalTicket() {
    document.body.classList.add('printing-ticket');
    window.print();
    setTimeout(function() {
      document.body.classList.remove('printing-ticket');
    }, 800);
  },

  /* --------------------------------------------------------
   *  updateZarpeSummary()
   * ------------------------------------------------------ */
  updateZarpeSummary() {
    const container = document.getElementById('venta-resumen-zarpe');
    if (!container) return;

    const zarpeId = (document.getElementById('venta-zarpe-select') || {}).value;
    if (!zarpeId) {
      container.innerHTML = '<p class="text-muted">Seleccione un zarpe para ver el resumen.</p>';
      return;
    }

    const zarpe = ASOTRANSMAR.Storage.getZarpeById(zarpeId);
    if (!zarpe) {
      container.innerHTML = '<p class="text-muted">Zarpe no encontrado</p>';
      return;
    }

    const today = ASOTRANSMAR.Utils.today();
    const allTickets = ASOTRANSMAR.Storage.getTicketsByFecha(today);
    const zarpeTickets = allTickets.filter(t => t.zarpeId === zarpeId);

    const totalPasajeros = zarpeTickets.length;
    const maxAforo = zarpe.capacidad_max || 160;
    const pct = Math.min(100, Math.round((totalPasajeros / maxAforo) * 100));

    const recaudacionVES = zarpeTickets.reduce((sum, t) => sum + (t.monto_ves || 0), 0);
    const recaudacionUSD = zarpeTickets.reduce((sum, t) => sum + (t.monto_usd || 0), 0);

    const aforoBadgeClass = pct >= 95 ? 'badge-danger' : (pct >= 75 ? 'badge-warning' : 'badge-success');
    const aforoFillClass = pct >= 95 ? 'fill-danger' : (pct >= 75 ? 'fill-warning' : 'fill-success');

    container.innerHTML = '' +
      '<div class="resumen-zarpe-card">' +
        '<h4>📋 Resumen Operativo del Zarpe</h4>' +
        '<div class="resumen-item"><span>Embarcación:</span> <strong>' + zarpe.embarcacion + '</strong></div>' +
        '<div class="resumen-item"><span>Horario:</span> <strong>' + zarpe.hora + ' (' + zarpe.origen + ' → ' + zarpe.destino + ')</strong></div>' +
        '<div class="aforo-metric-box">' +
          '<div class="aforo-metric-header">' +
            '<span>Aforo Legal INEA:</span>' +
            '<span class="badge ' + aforoBadgeClass + '">' + totalPasajeros + ' / ' + maxAforo + ' pax (' + pct + '%)</span>' +
          '</div>' +
          '<div class="aforo-progress-track">' +
            '<div class="aforo-progress-bar ' + aforoFillClass + '" style="width: ' + pct + '%;"></div>' +
          '</div>' +
        '</div>' +
        '<div class="resumen-item"><span>Recaudación Total:</span> <strong>' + ASOTRANSMAR.Utils.formatVES(recaudacionVES) + ' (' + ASOTRANSMAR.Utils.formatUSD(recaudacionUSD) + ')</strong></div>' +
      '</div>';
  },

  _capitalize(str) {
    if (!str) return '';
    return str.split(' ').map(function(word) {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  }
};
