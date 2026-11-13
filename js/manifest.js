/**
 * ============================================================
 *  ASOTRANSMAR vs 4.0 — Módulo de Listín de Zarpe (Manifiesto)
 * ============================================================
 *  Genera el listín digital de pasajeros por zarpe, permite
 *  imprimir/exportar a PDF, cerrar zarpes y generar listines
 *  aleatorios de prueba con aforo normativo de hasta 160 pax.
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.Manifest = {

  /** ID del zarpe actualmente seleccionado */
  currentZarpeId: null,

  /* --------------------------------------------------------
   *  init() — Inicializa el módulo de listín
   *  Llamado por App.navigateTo('listin')
   * ------------------------------------------------------ */
  init() {
    this.populateZarpeSelector();

    // Listener: cambio de zarpe seleccionado
    const zarpeSelect = document.getElementById('listin-zarpe-select');
    if (zarpeSelect) {
      zarpeSelect.removeEventListener('change', this._onZarpeChange);
      this._onZarpeChange = () => {
        const val = zarpeSelect.value;
        if (val) {
          this.loadManifest(val);
        }
      };
      zarpeSelect.addEventListener('change', this._onZarpeChange);
    }

    // Listener: botón imprimir
    const btnImprimir = document.getElementById('btn-imprimir-listin');
    if (btnImprimir) {
      btnImprimir.removeEventListener('click', this._onImprimir);
      this._onImprimir = () => this.printManifest();
      btnImprimir.addEventListener('click', this._onImprimir);
    }

    // Listener: botón cerrar zarpe
    const btnCerrar = document.getElementById('btn-cerrar-zarpe');
    if (btnCerrar) {
      btnCerrar.removeEventListener('click', this._onCerrar);
      this._onCerrar = () => this.cerrarZarpe();
      btnCerrar.addEventListener('click', this._onCerrar);
    }

    // Listener: capitán editable en tiempo real
    const inputCapitan = document.getElementById('listin-capitan');
    if (inputCapitan) {
      inputCapitan.removeEventListener('input', this._onCapitanInput);
      this._onCapitanInput = (e) => {
        if (this.currentZarpeId) {
          const zarpe = ASOTRANSMAR.Storage.getZarpeById(this.currentZarpeId);
          if (zarpe) {
            zarpe.capitan = e.target.value;
            ASOTRANSMAR.Storage.saveZarpe(zarpe);
          }
        }
      };
      inputCapitan.addEventListener('input', this._onCapitanInput);
    }

    // Cargar el primer zarpe si existe
    if (zarpeSelect && zarpeSelect.value) {
      this.loadManifest(zarpeSelect.value);
    }
  },

  /* --------------------------------------------------------
   *  populateZarpeSelector()
   * ------------------------------------------------------ */
  populateZarpeSelector() {
    const today = ASOTRANSMAR.Utils.today();
    ASOTRANSMAR.Schedules.ensureTodayZarpes(today);

    const zarpes = ASOTRANSMAR.Storage.getZarpesByFecha(today);
    const select = document.getElementById('listin-zarpe-select');
    if (!select) return;

    const prevValue = select.value;
    select.innerHTML = '';

    if (zarpes.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— No hay zarpes para hoy —';
      select.appendChild(opt);
      return;
    }

    zarpes.forEach(function(zarpe) {
      const opt = document.createElement('option');
      opt.value = zarpe.id;
      const estadoLabel = zarpe.estado === 'cerrado' ? '🔒 Cerrado' : '🟢 Abierto';
      const paxCount = (zarpe.pasajeros || []).length;
      opt.textContent = zarpe.hora + ' - ' + zarpe.origen + ' → ' + zarpe.destino +
        ' (' + zarpe.embarcacion + ') [' + paxCount + '/160 pax] [' + estadoLabel + ']';
      select.appendChild(opt);
    });

    if (prevValue) {
      const exists = Array.from(select.options).some(function(o) { return o.value === prevValue; });
      if (exists) {
        select.value = prevValue;
      }
    }
  },

  /* --------------------------------------------------------
   *  loadManifest(zarpeId)
   * ------------------------------------------------------ */
  loadManifest(zarpeId) {
    this.currentZarpeId = zarpeId;

    const zarpe = ASOTRANSMAR.Storage.getZarpeById(zarpeId);
    if (!zarpe) {
      ASOTRANSMAR.Utils.showToast('No se encontró el zarpe seleccionado', 'error');
      return;
    }

    const today = ASOTRANSMAR.Utils.today();
    const allTickets = ASOTRANSMAR.Storage.getTicketsByFecha(today);
    const tickets = allTickets.filter(function(t) { return t.zarpeId === zarpeId; });

    const partesFecha = zarpe.fecha.split('-');
    const fechaDisplay = partesFecha[2] + '/' + partesFecha[1] + '/' + partesFecha[0];

    const elFecha = document.getElementById('listin-fecha');
    const elHora = document.getElementById('listin-hora');
    const elOrigen = document.getElementById('listin-origen');
    const elDestino = document.getElementById('listin-destino');
    const elEmbarcacion = document.getElementById('listin-embarcacion');
    const elTaquillero = document.getElementById('listin-taquillero');
    const elEstado = document.getElementById('listin-estado');
    const inputCapitan = document.getElementById('listin-capitan');

    if (elFecha) elFecha.textContent = fechaDisplay;
    if (elHora) elHora.textContent = zarpe.hora;
    if (elOrigen) elOrigen.textContent = zarpe.origen;
    if (elDestino) elDestino.textContent = zarpe.destino;
    if (elEmbarcacion) elEmbarcacion.textContent = zarpe.embarcacion;
    if (inputCapitan) inputCapitan.value = zarpe.capitan || '';
    if (elEstado) {
      elEstado.textContent = zarpe.estado === 'cerrado' ? '🔒 Cerrado' : '🟢 Abierto';
      elEstado.className = zarpe.estado === 'cerrado' ? 'badge badge-cerrado' : 'badge badge-abierto';
    }

    if (elTaquillero) {
      if (tickets.length > 0) {
        elTaquillero.textContent = tickets[0].taquillero || '—';
      } else {
        const currentUser = ASOTRANSMAR.Auth.getCurrentUser();
        elTaquillero.textContent = currentUser ? currentUser.usuario : '—';
      }
    }

    // Barra de aforo INEA (Límite 160 pasajeros)
    const capacidadMax = zarpe.capacidad_max || 160;
    const aforoCountEl = document.getElementById('listin-aforo-count');
    const aforoMaxEl = document.getElementById('listin-aforo-max');
    const aforoPctEl = document.getElementById('listin-aforo-pct');
    const aforoFillEl = document.getElementById('listin-aforo-fill');

    const pct = Math.min(100, Math.round((tickets.length / capacidadMax) * 100));

    if (aforoCountEl) aforoCountEl.textContent = tickets.length;
    if (aforoMaxEl) aforoMaxEl.textContent = capacidadMax;
    if (aforoPctEl) {
      aforoPctEl.textContent = pct + '% Aforo';
      aforoPctEl.className = 'badge ' + (pct >= 95 ? 'badge-danger' : (pct >= 75 ? 'badge-warning' : 'badge-success'));
    }
    if (aforoFillEl) {
      aforoFillEl.style.width = pct + '%';
      aforoFillEl.className = 'aforo-fill ' + (pct >= 95 ? 'fill-danger' : (pct >= 75 ? 'fill-warning' : 'fill-success'));
    }

    // Poblar tabla de pasajeros
    const tbody = document.getElementById('listin-tabla-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const categorias = ASOTRANSMAR.Config.CATEGORIAS;

    if (tickets.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" class="text-center text-muted empty-listin-msg">No hay pasajeros registrados en este zarpe oficial. Registre ventas desde la Taquilla.</td>';
      tbody.appendChild(tr);
    } else {
      tickets.forEach(function(ticket, idx) {
        const tr = document.createElement('tr');
        const cat = categorias.find(function(c) { return c.codigo === ticket.categoria; });
        const catNombre = cat ? cat.nombre : ticket.categoria;

        tr.innerHTML = '' +
          '<td><strong>' + (idx + 1) + '</strong></td>' +
          '<td><code>V-' + ticket.cedula + '</code></td>' +
          '<td>' + ticket.nombre + '</td>' +
          '<td>' + ticket.apellido + '</td>' +
          '<td><span class="badge badge-cat-' + ticket.categoria + '">' + catNombre + '</span></td>' +
          '<td class="text-right"><strong>' + ASOTRANSMAR.Utils.formatVES(ticket.monto_ves) + '</strong></td>';
        tbody.appendChild(tr);
      });
    }

    // Totales
    const elTotalPasajeros = document.getElementById('listin-total-pasajeros');
    const elTotalMonto = document.getElementById('listin-total-monto');

    if (elTotalPasajeros) elTotalPasajeros.textContent = tickets.length;

    const totalMonto = tickets.reduce(function(sum, t) { return sum + (t.monto_ves || 0); }, 0);
    if (elTotalMonto) elTotalMonto.textContent = ASOTRANSMAR.Utils.formatVES(totalMonto);

    // Habilitar / deshabilitar botones
    const btnCerrar = document.getElementById('btn-cerrar-zarpe');
    if (btnCerrar) {
      btnCerrar.disabled = zarpe.estado === 'cerrado';
      btnCerrar.textContent = zarpe.estado === 'cerrado' ? '🔒 Zarpe Cerrado' : '🔒 Cerrar Zarpe';
    }

    const aforoCard = document.getElementById('listin-aforo-card');
    if (aforoCard) {
      if (zarpe.estado === 'cerrado') {
        aforoCard.classList.add('disabled-panel');
      } else {
        aforoCard.classList.remove('disabled-panel');
      }
    }
  },

  /* --------------------------------------------------------
   *  generarPasajerosAleatorios(cantidad)
   *  Genera pasajeros aleatorios con nombres venezolanos
   *  respetando ESTRICTAMENTE el límite máximo de 160 pasajeros
   * ------------------------------------------------------ */
  generarPasajerosAleatorios(cantidad) {
    if (!this.currentZarpeId) {
      ASOTRANSMAR.Utils.showToast('Debe seleccionar un zarpe primero', 'warning');
      return;
    }

    const zarpe = ASOTRANSMAR.Storage.getZarpeById(this.currentZarpeId);
    if (!zarpe) {
      ASOTRANSMAR.Utils.showToast('Zarpe no encontrado', 'error');
      return;
    }

    if (zarpe.estado === 'cerrado') {
      ASOTRANSMAR.Utils.showToast('El zarpe está cerrado. No se pueden agregar pasajeros.', 'error');
      return;
    }

    const maxCapacidad = zarpe.capacidad_max || 160;
    const currentTickets = ASOTRANSMAR.Storage.getTicketsByFecha(zarpe.fecha).filter(t => t.zarpeId === zarpe.id);
    const actualPax = currentTickets.length;
    const cuposDisponibles = maxCapacidad - actualPax;

    if (cuposDisponibles <= 0) {
      ASOTRANSMAR.Utils.showToast('⚠️ Aforo máximo de ' + maxCapacidad + ' pasajeros alcanzado en este zarpe', 'warning');
      return;
    }

    let cantAGenerar = (cantidad === 'max') ? cuposDisponibles : Math.min(cantidad, cuposDisponibles);

    // Repositorio de nombres y apellidos venezolanos
    const nombresMasc = [
      'Carlos', 'José', 'Luis', 'Pedro', 'Jesús', 'Rafael', 'Miguel', 'Juan', 'Eliecer', 'Andrés',
      'Fernando', 'Héctor', 'Ricardo', 'Manuel', 'Gabriel', 'Alejandro', 'Víctor', 'Eduardo', 'Jorge', 'Javier'
    ];
    const nombresFem = [
      'María', 'Ana', 'Carmen', 'Yelitza', 'Génesis', 'Valentina', 'Gabriela', 'Daniela', 'Alejandra', 'Deyanira',
      'Patricia', 'Mariangel', 'Adriana', 'Carolina', 'Isabella', 'Rosa', 'Elena', 'Sofía', 'Beatriz', 'Lucía'
    ];
    const apellidos = [
      'Marcano', 'Villazana', 'González', 'Rodríguez', 'Salazar', 'Hernández', 'Gómez', 'Pérez', 'Ramos', 'Marval',
      'López', 'Díaz', 'Martínez', 'Sánchez', 'Romero', 'Torres', 'Álvarez', 'Navarro', 'Castillo', 'Vargas',
      'Reyes', 'Gutiérrez', 'Mendoza', 'Aguilar', 'Medina', 'Brito', 'Acosta', 'Silva', 'Cedeño', 'Guerra'
    ];

    // Distribución ponderada de categorías
    const categoriasPool = [
      'REG', 'REG', 'REG',
      'MPR', 'MPR', 'MPR',
      'TUR', 'TUR',
      'MPV',
      'EXO'
    ];

    const settings = ASOTRANSMAR.Storage.getSettings();
    const categorias = ASOTRANSMAR.Config.CATEGORIAS;
    const tarifaBaseUSD = settings.tarifa_reg_usd || 5;
    const tasaBCV = settings.tasa_bcv || 1;
    const currentUser = ASOTRANSMAR.Auth.getCurrentUser();

    if (!zarpe.pasajeros) zarpe.pasajeros = [];

    // Generar correlativamente
    for (let i = 0; i < cantAGenerar; i++) {
      const esFem = Math.random() < 0.5;
      const nombre = esFem
        ? nombresFem[Math.floor(Math.random() * nombresFem.length)]
        : nombresMasc[Math.floor(Math.random() * nombresMasc.length)];
      const apellido = apellidos[Math.floor(Math.random() * apellidos.length)];
      const cedulaNum = Math.floor(Math.random() * 21000000) + 11000000; // V-11.000.000 a V-32.000.000

      const catCode = categoriasPool[Math.floor(Math.random() * categoriasPool.length)];
      const categoriaObj = categorias.find(c => c.codigo === catCode) || categorias[0];

      const montoUSD = tarifaBaseUSD * categoriaObj.factor;
      const montoVES = montoUSD * tasaBCV;

      const randomMins = String(Math.floor(Math.random() * 59)).padStart(2, '0');
      const randomHora = zarpe.hora.split(':')[0] + ':' + randomMins;

      const ticket = {
        id: ASOTRANSMAR.Utils.generateTicketId(),
        cedula: String(cedulaNum),
        nombre: nombre,
        apellido: apellido,
        categoria: catCode,
        zarpeId: zarpe.id,
        monto_usd: parseFloat(montoUSD.toFixed(2)),
        monto_ves: parseFloat(montoVES.toFixed(2)),
        tasa_bcv: tasaBCV,
        fecha: zarpe.fecha,
        hora_venta: randomHora,
        taquillero: currentUser ? currentUser.usuario : 'taquilla1',
        embarcacion: zarpe.embarcacion,
        origen: zarpe.origen,
        destino: zarpe.destino
      };

      ASOTRANSMAR.Storage.saveTicket(ticket);
      zarpe.pasajeros.push(ticket.id);
    }

    ASOTRANSMAR.Storage.saveZarpe(zarpe);

    // Refrescar selector y recargar listín
    this.populateZarpeSelector();
    const select = document.getElementById('listin-zarpe-select');
    if (select) select.value = zarpe.id;

    this.loadManifest(zarpe.id);

    ASOTRANSMAR.Utils.showToast(
      '✅ Se agregaron ' + cantAGenerar + ' pasajeros aleatorios al zarpe (' + (actualPax + cantAGenerar) + '/' + maxCapacidad + ' pax)',
      'success'
    );
  },

  /* --------------------------------------------------------
   *  vaciarPasajerosZarpe()
   *  Permite limpiar los boletos de un zarpe abierto
   * ------------------------------------------------------ */
  vaciarPasajerosZarpe() {
    if (!this.currentZarpeId) {
      ASOTRANSMAR.Utils.showToast('Seleccione un zarpe primero', 'warning');
      return;
    }

    const zarpe = ASOTRANSMAR.Storage.getZarpeById(this.currentZarpeId);
    if (!zarpe) return;

    if (zarpe.estado === 'cerrado') {
      ASOTRANSMAR.Utils.showToast('No se puede vaciar un zarpe cerrado', 'error');
      return;
    }

    const tickets = ASOTRANSMAR.Storage.getTicketsByFecha(zarpe.fecha).filter(t => t.zarpeId === zarpe.id);
    if (tickets.length === 0) {
      ASOTRANSMAR.Utils.showToast('El zarpe ya está vacío', 'info');
      return;
    }

    if (!confirm('¿Desea eliminar los ' + tickets.length + ' pasajeros de este zarpe? Esta acción permitirá re-generar nuevos listines de prueba.')) {
      return;
    }

    // Filtrar boletos globales retirando los de este zarpe
    const allTickets = ASOTRANSMAR.Storage.getTickets().filter(t => t.zarpeId !== zarpe.id);
    localStorage.setItem(ASOTRANSMAR.Config.KEYS.TICKETS, JSON.stringify(allTickets));

    zarpe.pasajeros = [];
    ASOTRANSMAR.Storage.saveZarpe(zarpe);

    this.populateZarpeSelector();
    const select = document.getElementById('listin-zarpe-select');
    if (select) select.value = zarpe.id;

    this.loadManifest(zarpe.id);
    ASOTRANSMAR.Utils.showToast('Zarpe vaciado correctamente', 'info');
  },

  /* --------------------------------------------------------
   *  buildPrintableManifestElement(zarpe, tickets)
   *  Genera un nodo DOM exclusivamente optimizado para PDF e impresión,
   *  con fondo blanco (#ffffff), tipografía nítida (#0f172a),
   *  ancho carta (794px), saltos de página protegidos y firmas INEA.
   * ------------------------------------------------------ */
  buildPrintableManifestElement(zarpe, tickets) {
    const categorias = ASOTRANSMAR.Config.CATEGORIAS;
    const flotaDetalles = ASOTRANSMAR.Config.EMBARCACIONES_DETALLES || {};
    const buqueInfo = flotaDetalles[zarpe.embarcacion] || {};
    const matricula = buqueInfo.matricula || 'ARSH-PE-XXXX';
    const armador = buqueInfo.armador || 'Asociación de Armadores de Coche C.A.';

    const inputCapitan = document.getElementById('listin-capitan');
    const capitanNombre = (inputCapitan && inputCapitan.value.trim()) || zarpe.capitan || buqueInfo.capitan_titular || 'Cap. José Marcano';

    const partesFecha = zarpe.fecha.split('-');
    const fechaDisplay = partesFecha[2] + '/' + partesFecha[1] + '/' + partesFecha[0];

    const totalMontoVES = tickets.reduce(function(acc, t) { return acc + (t.monto_ves || 0); }, 0);

    const doc = document.createElement('div');
    doc.id = 'asotransmar-pdf-manifest-export';
    doc.style.width = '100%';
    doc.style.maxWidth = '100%';
    doc.style.boxSizing = 'border-box';
    doc.style.margin = '0 auto';
    doc.style.padding = '12px 14px';
    doc.style.background = '#ffffff';
    doc.style.color = '#0f172a';
    doc.style.fontFamily = "'Segoe UI', Arial, Helvetica, sans-serif";
    doc.style.lineHeight = '1.3';

    let filasHTML = '';
    if (tickets.length === 0) {
      filasHTML = '<tr><td colspan="6" style="padding: 16px; text-align: center; color: #64748b;">No hay pasajeros registrados en este zarpe oficial.</td></tr>';
    } else {
      tickets.forEach(function(t, i) {
        const cat = categorias.find(function(c) { return c.codigo === t.categoria; });
        const catNombre = cat ? cat.nombre : t.categoria;
        const bgRow = (i % 2 === 0) ? '#ffffff' : '#f8fafc';
        const metodoTexto = (t.metodo_pago || 'efectivo_ves').toUpperCase().replace('_', ' ');
        const refTexto = t.referencia ? ' (' + t.referencia + ')' : '';

        filasHTML += '' +
          '<tr style="background: ' + bgRow + '; border-bottom: 1px solid #cbd5e1; page-break-inside: avoid; break-inside: avoid;">' +
            '<td style="padding: 5px 6px; text-align: center; font-weight: bold; font-size: 10px; width: 32px; border-right: 1px solid #e2e8f0; color: #0f172a;">' + (i + 1) + '</td>' +
            '<td style="padding: 5px 6px; font-family: monospace; font-size: 10.5px; font-weight: 600; width: 85px; border-right: 1px solid #e2e8f0; color: #0f172a;">V-' + t.cedula + '</td>' +
            '<td style="padding: 5px 8px; font-size: 10.5px; text-transform: uppercase; font-weight: 600; border-right: 1px solid #e2e8f0; color: #0f172a;">' + t.apellido + ', ' + t.nombre + '</td>' +
            '<td style="padding: 5px 6px; font-size: 9.5px; width: 140px; border-right: 1px solid #e2e8f0;"><span style="display: inline-block; padding: 1px 6px; background: #e0f2fe; color: #0369a1; border-radius: 3px; font-weight: 600;">' + catNombre + '</span></td>' +
            '<td style="padding: 5px 6px; font-size: 9.5px; color: #475569; width: 105px; border-right: 1px solid #e2e8f0;">' + metodoTexto + refTexto + '</td>' +
            '<td style="padding: 5px 8px; text-align: right; font-weight: bold; font-size: 10.5px; width: 95px; color: #0f172a;">' + ASOTRANSMAR.Utils.formatVES(t.monto_ves) + '</td>' +
          '</tr>';
      });
    }

    doc.innerHTML = '' +
      '<div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px;">' +
        '<div style="display: flex; justify-content: space-between; align-items: center;">' +
          '<div style="display: flex; align-items: center; gap: 12px;">' +
            '<div style="font-size: 34px; line-height: 1;">⚓</div>' +
            '<div>' +
              '<h1 style="margin: 0; font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: #0f172a;">ASOTRANSMAR C.A.</h1>' +
              '<p style="margin: 2px 0 0 0; font-size: 9.5px; font-weight: 700; color: #2563eb; letter-spacing: 0.04em;">ASOCIACIÓN DE TRANSPORTE MARÍTIMO DE COCHE • RIF: J-315369986-9</p>' +
              '<p style="margin: 1px 0 0 0; font-size: 8.5px; color: #64748b;">Ruta: Muelle La Isleta (Margarita) ↔ San Pedro de Coche • Edo. Nueva Esparta</p>' +
            '</div>' +
          '</div>' +
          '<div style="text-align: right; border-left: 2px solid #e2e8f0; padding-left: 14px;">' +
            '<div style="display: inline-block; padding: 3px 8px; background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 800; border-radius: 4px; letter-spacing: 0.05em;">MANIFIESTO OFICIAL DE EMBARQUE</div>' +
            '<p style="margin: 3px 0 0 0; font-size: 8.5px; color: #475569; font-weight: 600;">Control Reglamentario INEA — Capitanía de Puerto</p>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px;">' +
        '<table style="width: 100%; border-collapse: collapse; font-size: 10px;">' +
          '<tr>' +
            '<td style="padding: 2px 4px; width: 25%;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Fecha de Zarpe:</span><strong style="color: #0f172a;">' + fechaDisplay + '</strong></td>' +
            '<td style="padding: 2px 4px; width: 25%;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Hora Oficial:</span><strong style="color: #0f172a;">' + zarpe.hora + ' hrs</strong></td>' +
            '<td style="padding: 2px 4px; width: 25%;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Travesía:</span><strong style="color: #2563eb;">' + zarpe.origen + ' → ' + zarpe.destino + '</strong></td>' +
            '<td style="padding: 2px 4px; width: 25%;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Estado:</span><strong style="color: #059669;">' + (zarpe.estado === 'cerrado' ? '🔒 CERRADO' : '🟢 EN PROCESO') + '</strong></td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 4px 4px 2px 4px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Embarcación:</span><strong style="color: #0f172a;">' + zarpe.embarcacion + '</strong></td>' +
            '<td style="padding: 4px 4px 2px 4px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Matrícula:</span><strong style="font-family: monospace; color: #0f172a;">' + matricula + '</strong></td>' +
            '<td style="padding: 4px 4px 2px 4px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Capitán Titular:</span><strong style="color: #0f172a;">' + capitanNombre + '</strong></td>' +
            '<td style="padding: 4px 4px 2px 4px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Taquillero de Guardia:</span><strong style="color: #0f172a;">' + (tickets.length > 0 ? tickets[0].taquillero : 'taquilla1') + '</strong></td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 4px 4px 2px 4px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Aforo Máximo Legal:</span><strong style="color: #0f172a;">160 Pax (Normativa INEA)</strong></td>' +
            '<td style="padding: 4px 4px 2px 4px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Total Pasajeros:</span><strong style="color: #2563eb;">' + tickets.length + ' Pasajeros</strong></td>' +
            '<td style="padding: 4px 4px 2px 4px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">% Aforo Ocupado:</span><strong style="color: #059669;">' + Math.round((tickets.length / 160) * 100) + '%</strong></td>' +
            '<td style="padding: 4px 4px 2px 4px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Armador / Empresa:</span><strong style="font-size: 9px; color: #475569;">' + armador + '</strong></td>' +
          '</tr>' +
        '</table>' +
      '</div>' +

      '<table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1.5px solid #cbd5e1;">' +
        '<thead>' +
          '<tr style="background: #0f172a; color: #ffffff;">' +
            '<th style="padding: 6px 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; text-align: center; width: 32px; border-right: 1px solid #334155;">N°</th>' +
            '<th style="padding: 6px 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; text-align: left; width: 85px; border-right: 1px solid #334155;">CÉDULA</th>' +
            '<th style="padding: 6px 8px; font-size: 9px; font-weight: 800; text-transform: uppercase; text-align: left; border-right: 1px solid #334155;">APELLIDOS Y NOMBRES</th>' +
            '<th style="padding: 6px 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; text-align: left; width: 140px; border-right: 1px solid #334155;">CATEGORÍA TARIFARIA</th>' +
            '<th style="padding: 6px 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; text-align: left; width: 105px; border-right: 1px solid #334155;">MÉTODO PAGO</th>' +
            '<th style="padding: 6px 8px; font-size: 9px; font-weight: 800; text-transform: uppercase; text-align: right; width: 95px;">MONTO (VES)</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          filasHTML +
        '</tbody>' +
        '<tfoot>' +
          '<tr style="background: #e2e8f0; border-top: 2px solid #0f172a; font-weight: bold;">' +
            '<td colspan="3" style="padding: 7px 8px; font-size: 10px; color: #0f172a;">TOTALES OFICIALES DE EMBARQUE:</td>' +
            '<td colspan="2" style="padding: 7px 8px; font-size: 10px; color: #2563eb;"><strong>' + tickets.length + ' Pasajeros a Bordo</strong> (Aforo legal: 160)</td>' +
            '<td style="padding: 7px 8px; font-size: 10.5px; text-align: right; color: #0f172a;"><strong>' + ASOTRANSMAR.Utils.formatVES(totalMontoVES) + '</strong></td>' +
          '</tr>' +
        '</tfoot>' +
      '</table>' +

      '<div style="margin-top: 20px; padding-top: 12px; border-top: 1.5px solid #cbd5e1; page-break-inside: avoid; break-inside: avoid;">' +
        '<p style="font-size: 8.5px; color: #64748b; margin: 0 0 18px 0; text-align: center; font-style: italic;">Certifico que la lista que antecede contiene la nómina exacta de las personas que viajan a bordo de la presente embarcación, conforme al aforo normativo y requisitos de seguridad de navegación exigidos por la autoridad marítima.</p>' +
        '<table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 9.5px;">' +
          '<tr>' +
            '<td style="width: 33%; padding: 0 12px; vertical-align: top;">' +
              '<div style="border-top: 1.5px solid #0f172a; padding-top: 4px;">' +
                '<strong style="display: block; font-size: 9.5px; color: #0f172a;">' + capitanNombre + '</strong>' +
                '<span style="font-size: 8.5px; color: #64748b;">Capitán al Mando / Patente Marina</span>' +
              '</div>' +
            '</td>' +
            '<td style="width: 33%; padding: 0 12px; vertical-align: top;">' +
              '<div style="border-top: 1.5px solid #0f172a; padding-top: 4px;">' +
                '<strong style="display: block; font-size: 9.5px; color: #0f172a;">Despacho de Taquilla</strong>' +
                '<span style="font-size: 8.5px; color: #64748b;">ASOTRANSMAR C.A.</span>' +
              '</div>' +
            '</td>' +
            '<td style="width: 33%; padding: 0 12px; vertical-align: top;">' +
              '<div style="border-top: 1.5px solid #0f172a; padding-top: 4px;">' +
                '<strong style="display: block; font-size: 9.5px; color: #0f172a;">Capitanía de Puerto / INEA</strong>' +
                '<span style="font-size: 8.5px; color: #64748b;">Sello y Visto Bueno de Zarpe</span>' +
              '</div>' +
            '</td>' +
          '</tr>' +
        '</table>' +
        '<div style="margin-top: 12px; text-align: right; font-size: 8px; color: #94a3b8;">' +
          'Documento emitido por ASOTRANSMAR vs 4.0 • ' + new Date().toLocaleString('es-VE') +
        '</div>' +
      '</div>';

    return doc;
  },

  /* --------------------------------------------------------
   *  printManifest()
   * ------------------------------------------------------ */
  printManifest() {
    if (!this.currentZarpeId) {
      ASOTRANSMAR.Utils.showToast('Seleccione un zarpe primero', 'error');
      return;
    }

    const zarpe = ASOTRANSMAR.Storage.getZarpeById(this.currentZarpeId);
    if (!zarpe) {
      ASOTRANSMAR.Utils.showToast('No se encontró el zarpe seleccionado', 'error');
      return;
    }

    const today = ASOTRANSMAR.Utils.today();
    const allTickets = ASOTRANSMAR.Storage.getTicketsByFecha(today);
    const tickets = allTickets.filter(function(t) { return t.zarpeId === zarpe.id; });

    const fechaFile = zarpe.fecha.replace(/-/g, '');
    const horaFile = zarpe.hora.replace(/:/g, '');
    const origenFile = zarpe.origen.replace(/\s/g, '_');
    const filename = 'Listin_Zarpe_' + fechaFile + '_' + horaFile + '_' + origenFile + '.pdf';

    const printableDoc = this.buildPrintableManifestElement(zarpe, tickets);

    ASOTRANSMAR.Utils.showToast('Generando PDF oficial del listín...', 'info');

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
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      setTimeout(function() {
        html2pdf().set(opt).from(printableDoc).save().then(function() {
          restoreScroll();
          ASOTRANSMAR.Utils.showToast('PDF del listín descargado exitosamente', 'success');
        }).catch(function(err) {
          restoreScroll();
          console.error('Error generando PDF del listín:', err);
          window.print();
        });
      }, 60);
    } else {
      restoreScroll();
      window.print();
    }
  },

  /* --------------------------------------------------------
   *  cerrarZarpe()
   * ------------------------------------------------------ */
  cerrarZarpe() {
    if (!this.currentZarpeId) {
      ASOTRANSMAR.Utils.showToast('Seleccione un zarpe primero', 'error');
      return;
    }

    const zarpe = ASOTRANSMAR.Storage.getZarpeById(this.currentZarpeId);
    if (!zarpe) return;

    if (zarpe.estado === 'cerrado') {
      ASOTRANSMAR.Utils.showToast('Este zarpe ya está cerrado', 'warning');
      return;
    }

    var self = this;
    var mensaje = '¿Está seguro de cerrar el zarpe de las ' + zarpe.hora +
      ' (' + zarpe.origen + ' → ' + zarpe.destino + ')?\n\nUna vez cerrado, no se podrán vender ni agregar más boletos para este zarpe.';

    if (confirm(mensaje)) {
      zarpe.estado = 'cerrado';
      ASOTRANSMAR.Storage.saveZarpe(zarpe);
      self.loadManifest(self.currentZarpeId);
      self.populateZarpeSelector();
      var select = document.getElementById('listin-zarpe-select');
      if (select) select.value = self.currentZarpeId;
      ASOTRANSMAR.Utils.showToast('Zarpe de las ' + zarpe.hora + ' cerrado exitosamente', 'success');
    }
  }
};
