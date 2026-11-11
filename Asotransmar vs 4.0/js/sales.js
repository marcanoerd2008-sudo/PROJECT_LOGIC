/**
 * ============================================================
 *  ASOTRANSMAR vs 4.0 — Módulo de Venta de Boletos
 * ============================================================
 *  Gestiona la venta de pasajes: selección de zarpe, cálculo
 *  de tarifas por categoría, emisión de boletos y resumen
 *  de recaudación por zarpe.
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.Sales = {

  /* --------------------------------------------------------
   *  init() — Inicializa el módulo de ventas
   *  Llamado por App.navigateTo('venta')
   * ------------------------------------------------------ */
  init() {
    // Poblar selector de zarpes con los zarpes abiertos de hoy
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

    // Listener: botón vender
    const btnVender = document.getElementById('btn-vender');
    if (btnVender) {
      btnVender.removeEventListener('click', this._onVender);
      this._onVender = () => this.realizarVenta();
      btnVender.addEventListener('click', this._onVender);
    }

    // Calcular tarifa inicial
    this.updateTarifa();
    // Mostrar resumen del zarpe seleccionado
    this.updateZarpeSummary();
  },

  /* --------------------------------------------------------
   *  populateZarpeSelector()
   *  Llena #venta-zarpe-select con los zarpes abiertos de hoy
   * ------------------------------------------------------ */
  populateZarpeSelector() {
    const today = ASOTRANSMAR.Utils.today();
    // Asegurar que existan los zarpes del día
    ASOTRANSMAR.Schedules.ensureTodayZarpes(today);

    const zarpes = ASOTRANSMAR.Storage.getZarpesByFecha(today);
    const abiertos = zarpes.filter(z => z.estado !== 'cerrado');

    const select = document.getElementById('venta-zarpe-select');
    if (!select) return;

    select.innerHTML = '';

    if (abiertos.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— No hay zarpes abiertos —';
      select.appendChild(opt);
      return;
    }

    // Determinar la hora actual para auto-seleccionar el próximo zarpe
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let closestIdx = 0;
    let closestDiff = Infinity;

    abiertos.forEach((zarpe, idx) => {
      const opt = document.createElement('option');
      opt.value = zarpe.id;
      opt.textContent = zarpe.hora + ' - ' + zarpe.origen + ' → ' + zarpe.destino + ' (' + zarpe.embarcacion + ')';
      select.appendChild(opt);

      // Calcular diferencia con la hora actual para auto-selección
      const parts = zarpe.hora.split(':');
      const zarpeMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      const diff = zarpeMinutes - currentMinutes;
      if (diff >= 0 && diff < closestDiff) {
        closestDiff = diff;
        closestIdx = idx;
      }
    });

    // Auto-seleccionar el próximo zarpe
    select.selectedIndex = closestIdx;
  },

  /* --------------------------------------------------------
   *  updateTarifa()
   *  Recalcula el monto según la categoría seleccionada
   * ------------------------------------------------------ */
  updateTarifa() {
    const categoriaSelect = document.getElementById('venta-categoria');
    if (!categoriaSelect) return;

    const categoriaCode = categoriaSelect.value;
    const categorias = ASOTRANSMAR.Config.CATEGORIAS;
    const categoria = categorias.find(c => c.codigo === categoriaCode);

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
   *  Valida campos, crea el boleto, lo almacena y muestra
   *  la confirmación tipo recibo
   * ------------------------------------------------------ */
  realizarVenta() {
    // ---- Obtener valores del formulario ----
    const cedulaRaw = (document.getElementById('venta-cedula') || {}).value || '';
    const nombreRaw = (document.getElementById('venta-nombre') || {}).value || '';
    const apellidoRaw = (document.getElementById('venta-apellido') || {}).value || '';
    const categoriaCode = (document.getElementById('venta-categoria') || {}).value || '';
    const zarpeId = (document.getElementById('venta-zarpe-select') || {}).value || '';

    // ---- Limpiar cédula (quitar V-, v-, espacios, puntos) ----
    const cedula = cedulaRaw.replace(/[vV\-.\s]/g, '').trim();

    // ---- Capitalizar nombre y apellido ----
    const nombre = this._capitalize(nombreRaw.trim());
    const apellido = this._capitalize(apellidoRaw.trim());

    // ---- Validaciones ----
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

    // ---- Verificar que el zarpe exista y esté abierto ----
    const zarpe = ASOTRANSMAR.Storage.getZarpeById(zarpeId);
    if (!zarpe) {
      ASOTRANSMAR.Utils.showToast('El zarpe seleccionado no existe', 'error');
      return;
    }
    if (zarpe.estado === 'cerrado') {
      ASOTRANSMAR.Utils.showToast('El zarpe seleccionado ya está cerrado', 'error');
      return;
    }

    // ---- Calcular montos ----
    const settings = ASOTRANSMAR.Storage.getSettings();
    const categorias = ASOTRANSMAR.Config.CATEGORIAS;
    const categoria = categorias.find(c => c.codigo === categoriaCode);
    if (!categoria) {
      ASOTRANSMAR.Utils.showToast('Categoría no válida', 'error');
      return;
    }

    const tarifaBaseUSD = settings.tarifa_reg_usd || 5;
    const tasaBCV = settings.tasa_bcv || 1;
    const montoUSD = tarifaBaseUSD * categoria.factor;
    const montoVES = montoUSD * tasaBCV;

    // ---- Obtener hora actual ----
    const now = new Date();
    const horaVenta = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    // ---- Obtener usuario actual ----
    const currentUser = ASOTRANSMAR.Auth.getCurrentUser();

    // ---- Crear objeto boleto ----
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
      fecha: ASOTRANSMAR.Utils.today(),
      hora_venta: horaVenta,
      taquillero: currentUser ? currentUser.usuario : 'sistema',
      embarcacion: zarpe.embarcacion,
      origen: zarpe.origen,
      destino: zarpe.destino
    };

    // ---- Guardar boleto ----
    ASOTRANSMAR.Storage.saveTicket(ticket);

    // ---- Agregar pasajero al zarpe ----
    if (!zarpe.pasajeros) {
      zarpe.pasajeros = [];
    }
    zarpe.pasajeros.push(ticket.id);
    ASOTRANSMAR.Storage.saveZarpe(zarpe);

    // ---- Mostrar confirmación (recibo) ----
    this.showConfirmation(ticket);

    // ---- Actualizar resumen del zarpe ----
    this.updateZarpeSummary();

    // ---- Limpiar campos del formulario (excepto zarpe) ----
    const elCedula = document.getElementById('venta-cedula');
    const elNombre = document.getElementById('venta-nombre');
    const elApellido = document.getElementById('venta-apellido');
    if (elCedula) elCedula.value = '';
    if (elNombre) elNombre.value = '';
    if (elApellido) elApellido.value = '';

    // Restablecer categoría a la primera opción
    const elCategoria = document.getElementById('venta-categoria');
    if (elCategoria) {
      elCategoria.selectedIndex = 0;
      this.updateTarifa();
    }

    // ---- Toast de éxito ----
    ASOTRANSMAR.Utils.showToast('Boleto ' + ticket.id + ' emitido exitosamente', 'success');
  },

  /* --------------------------------------------------------
   *  showConfirmation(ticket)
   *  Renderiza un mini recibo en #venta-confirmacion
   * ------------------------------------------------------ */
  showConfirmation(ticket) {
    const container = document.getElementById('venta-confirmacion');
    if (!container) return;

    const categorias = ASOTRANSMAR.Config.CATEGORIAS;
    const cat = categorias.find(c => c.codigo === ticket.categoria);
    const catNombre = cat ? cat.nombre : ticket.categoria;

    // Formatear fecha como DD/MM/YYYY
    const partesFecha = ticket.fecha.split('-');
    const fechaDisplay = partesFecha[2] + '/' + partesFecha[1] + '/' + partesFecha[0];

    const ruta = (ticket.origen || '—') + ' → ' + (ticket.destino || '—');

    container.innerHTML = '' +
      '<div class="recibo-card">' +
        '<div class="recibo-header">━━━ BOLETO DE EMBARQUE ━━━</div>' +
        '<div class="recibo-id">N° ' + ticket.id + '</div>' +
        '<div class="recibo-line">Fecha: ' + fechaDisplay + '  Hora: ' + ticket.hora_venta + '</div>' +
        '<div class="recibo-line">Pasajero: <strong>' + ticket.nombre + ' ' + ticket.apellido + '</strong></div>' +
        '<div class="recibo-line">C.I.: V-' + ticket.cedula + '</div>' +
        '<div class="recibo-line">Categoría: ' + catNombre + '</div>' +
        '<div class="recibo-line">Embarcación: ' + ticket.embarcacion + '</div>' +
        '<div class="recibo-line">Ruta: ' + ruta + '</div>' +
        '<div class="recibo-separator">──────────────────────────</div>' +
        '<div class="recibo-monto">USD: ' + ASOTRANSMAR.Utils.formatUSD(ticket.monto_usd) + '</div>' +
        '<div class="recibo-monto">VES: ' + ASOTRANSMAR.Utils.formatVES(ticket.monto_ves) + ' (Tasa: ' + ticket.tasa_bcv.toFixed(2) + ')</div>' +
        '<div class="recibo-footer">━━━━━━━━━━━━━━━━━━━━━━━━</div>' +
      '</div>';

    container.style.display = 'block';
  },

  /* --------------------------------------------------------
   *  updateZarpeSummary()
   *  Muestra en #venta-resumen-zarpe el conteo de pasajeros
   *  y la recaudación del zarpe actualmente seleccionado
   * ------------------------------------------------------ */
  updateZarpeSummary() {
    const container = document.getElementById('venta-resumen-zarpe');
    if (!container) return;

    const zarpeId = (document.getElementById('venta-zarpe-select') || {}).value;
    if (!zarpeId) {
      container.innerHTML = '<p class="text-muted">Seleccione un zarpe para ver el resumen</p>';
      return;
    }

    const zarpe = ASOTRANSMAR.Storage.getZarpeById(zarpeId);
    if (!zarpe) {
      container.innerHTML = '<p class="text-muted">Zarpe no encontrado</p>';
      return;
    }

    // Obtener boletos de este zarpe
    const today = ASOTRANSMAR.Utils.today();
    const allTickets = ASOTRANSMAR.Storage.getTicketsByFecha(today);
    const zarpeTickets = allTickets.filter(t => t.zarpeId === zarpeId);

    const totalPasajeros = zarpeTickets.length;
    const recaudacionVES = zarpeTickets.reduce(function(sum, t) { return sum + (t.monto_ves || 0); }, 0);
    const recaudacionUSD = zarpeTickets.reduce(function(sum, t) { return sum + (t.monto_usd || 0); }, 0);

    container.innerHTML = '' +
      '<div class="resumen-zarpe">' +
        '<h4>📋 Resumen del Zarpe</h4>' +
        '<p><strong>Embarcación:</strong> ' + zarpe.embarcacion + '</p>' +
        '<p><strong>Horario:</strong> ' + zarpe.hora + ' - ' + zarpe.origen + ' → ' + zarpe.destino + '</p>' +
        '<p><strong>Pasajeros registrados:</strong> ' + totalPasajeros + '</p>' +
        '<p><strong>Recaudación zarpe:</strong> ' + ASOTRANSMAR.Utils.formatVES(recaudacionVES) + ' / ' + ASOTRANSMAR.Utils.formatUSD(recaudacionUSD) + '</p>' +
      '</div>';
  },

  /* --------------------------------------------------------
   *  _capitalize(str)  — Utilidad interna para capitalizar
   * ------------------------------------------------------ */
  _capitalize(str) {
    if (!str) return '';
    return str.split(' ').map(function(word) {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  }
};
