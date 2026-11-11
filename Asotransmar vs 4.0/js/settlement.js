/**
 * ============================================================
 *  ASOTRANSMAR vs 4.0 — Módulo de Liquidación y Administración
 * ============================================================
 *  Gestiona la configuración de tarifas, tasa BCV, y genera
 *  la liquidación financiera para los armadores por zarpe
 *  o por fecha completa.
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.Settlement = {

  /* --------------------------------------------------------
   *  init() — Inicializa el módulo de administración
   *  Llamado por App.navigateTo('admin')
   * ------------------------------------------------------ */
  init() {
    // Cargar configuración actual en el formulario
    this.loadConfig();

    // Poblar selector de fechas para liquidación
    this.populateLiquidacionDates();

    // Listener: guardar configuración
    var btnGuardar = document.getElementById('btn-guardar-config');
    if (btnGuardar) {
      btnGuardar.removeEventListener('click', this._onGuardarConfig);
      this._onGuardarConfig = () => this.saveConfig();
      btnGuardar.addEventListener('click', this._onGuardarConfig);
    }

    // Listener: cambio de fecha de liquidación
    var selectFecha = document.getElementById('admin-liquidacion-fecha');
    if (selectFecha) {
      selectFecha.removeEventListener('change', this._onFechaChange);
      this._onFechaChange = () => {
        var fecha = selectFecha.value;
        if (fecha) {
          this.populateLiquidacionZarpes(fecha);
        }
      };
      selectFecha.addEventListener('change', this._onFechaChange);
    }

    // Listener: calcular liquidación
    var btnCalcular = document.getElementById('btn-calcular-liquidacion');
    if (btnCalcular) {
      btnCalcular.removeEventListener('click', this._onCalcular);
      this._onCalcular = () => this.calcularLiquidacion();
      btnCalcular.addEventListener('click', this._onCalcular);
    }

    // Listener: imprimir liquidación
    var btnImprimir = document.getElementById('btn-imprimir-liquidacion');
    if (btnImprimir) {
      btnImprimir.removeEventListener('click', this._onImprimir);
      this._onImprimir = () => this.imprimirLiquidacion();
      btnImprimir.addEventListener('click', this._onImprimir);
    }
  },

  /* --------------------------------------------------------
   *  loadConfig()
   *  Carga la configuración actual desde storage y llena
   *  los campos del formulario de administración
   * ------------------------------------------------------ */
  loadConfig() {
    var settings = ASOTRANSMAR.Storage.getSettings();

    var elTasa = document.getElementById('admin-tasa-bcv');
    var elTarifaReg = document.getElementById('admin-tarifa-reg');
    var elTarifaMedio = document.getElementById('admin-tarifa-medio');
    var elTarifaExo = document.getElementById('admin-tarifa-exo');
    var elRetencion = document.getElementById('admin-retencion');
    var elArancel = document.getElementById('admin-arancel-inea');

    if (elTasa) elTasa.value = settings.tasa_bcv || 0;
    if (elTarifaReg) elTarifaReg.value = settings.tarifa_reg_usd || 0;

    // Calcular tarifas de medio pasaje y exonerado basadas en la tarifa regular y factores
    var categorias = ASOTRANSMAR.Config.CATEGORIAS;
    var catMedio = categorias.find(function(c) { return c.codigo === 'medio'; });
    var catExo = categorias.find(function(c) { return c.codigo === 'exonerado'; });

    if (elTarifaMedio) {
      var tarifaMedio = settings.tarifa_medio_usd !== undefined ? settings.tarifa_medio_usd :
        (settings.tarifa_reg_usd || 0) * (catMedio ? catMedio.factor : 0.5);
      elTarifaMedio.value = tarifaMedio;
    }
    if (elTarifaExo) {
      var tarifaExo = settings.tarifa_exo_usd !== undefined ? settings.tarifa_exo_usd :
        (settings.tarifa_reg_usd || 0) * (catExo ? catExo.factor : 0);
      elTarifaExo.value = tarifaExo;
    }

    if (elRetencion) elRetencion.value = settings.retencion_asotransmar || 0;
    if (elArancel) elArancel.value = settings.arancel_inea || 0;
  },

  /* --------------------------------------------------------
   *  saveConfig()
   *  Guarda la configuración del formulario de administración
   * ------------------------------------------------------ */
  saveConfig() {
    var tasa = parseFloat((document.getElementById('admin-tasa-bcv') || {}).value);
    var tarifaReg = parseFloat((document.getElementById('admin-tarifa-reg') || {}).value);
    var tarifaMedio = parseFloat((document.getElementById('admin-tarifa-medio') || {}).value);
    var tarifaExo = parseFloat((document.getElementById('admin-tarifa-exo') || {}).value);
    var retencion = parseFloat((document.getElementById('admin-retencion') || {}).value);
    var arancel = parseFloat((document.getElementById('admin-arancel-inea') || {}).value);

    // Validar que todos sean números >= 0
    var campos = [
      { nombre: 'Tasa BCV', valor: tasa },
      { nombre: 'Tarifa Regular', valor: tarifaReg },
      { nombre: 'Tarifa Medio Pasaje', valor: tarifaMedio },
      { nombre: 'Tarifa Exonerado', valor: tarifaExo },
      { nombre: 'Retención Asotransmar', valor: retencion },
      { nombre: 'Arancel INEA', valor: arancel }
    ];

    for (var i = 0; i < campos.length; i++) {
      if (isNaN(campos[i].valor) || campos[i].valor < 0) {
        ASOTRANSMAR.Utils.showToast(campos[i].nombre + ' debe ser un número mayor o igual a cero', 'error');
        return;
      }
    }

    // Guardar en storage
    var settings = ASOTRANSMAR.Storage.getSettings();
    settings.tasa_bcv = tasa;
    settings.tarifa_reg_usd = tarifaReg;
    settings.tarifa_medio_usd = tarifaMedio;
    settings.tarifa_exo_usd = tarifaExo;
    settings.retencion_asotransmar = retencion;
    settings.arancel_inea = arancel;
    settings.fecha_tasa = ASOTRANSMAR.Utils.today();
    ASOTRANSMAR.Storage.saveSettings(settings);

    // Actualizar display de tasa BCV en el header
    var displayTasa = document.getElementById('tasa-bcv-display');
    if (displayTasa) displayTasa.textContent = tasa.toFixed(2);

    ASOTRANSMAR.Utils.showToast('Configuración guardada exitosamente', 'success');
  },

  /* --------------------------------------------------------
   *  populateLiquidacionDates()
   *  Obtiene las fechas únicas de zarpes existentes y llena
   *  el selector de fechas para liquidación
   * ------------------------------------------------------ */
  populateLiquidacionDates() {
    var select = document.getElementById('admin-liquidacion-fecha');
    if (!select) return;

    select.innerHTML = '';

    // Opción vacía
    var optVacio = document.createElement('option');
    optVacio.value = '';
    optVacio.textContent = '— Seleccione una fecha —';
    select.appendChild(optVacio);

    // Obtener todas las fechas únicas de zarpes
    var fechas = ASOTRANSMAR.Storage.getAllZarpeDates ? ASOTRANSMAR.Storage.getAllZarpeDates() : [];

    // Si no existe getAllZarpeDates, buscar manualmente
    if (fechas.length === 0) {
      var allKeys = Object.keys(localStorage);
      var fechaSet = {};
      allKeys.forEach(function(key) {
        if (key.startsWith('asotransmar_zarpes_')) {
          var fecha = key.replace('asotransmar_zarpes_', '');
          fechaSet[fecha] = true;
        }
      });
      fechas = Object.keys(fechaSet);
    }

    // Ordenar fechas descendente (más reciente primero)
    fechas.sort(function(a, b) { return b.localeCompare(a); });

    fechas.forEach(function(fecha) {
      var opt = document.createElement('option');
      opt.value = fecha;
      // Formatear como DD/MM/YYYY
      var partes = fecha.split('-');
      opt.textContent = partes[2] + '/' + partes[1] + '/' + partes[0];
      select.appendChild(opt);
    });

    // Si hay fechas, poblar los zarpes de la primera
    if (fechas.length > 0) {
      select.value = fechas[0];
      this.populateLiquidacionZarpes(fechas[0]);
    }
  },

  /* --------------------------------------------------------
   *  populateLiquidacionZarpes(fecha)
   *  Llena el selector de zarpes para la fecha seleccionada
   * ------------------------------------------------------ */
  populateLiquidacionZarpes(fecha) {
    var select = document.getElementById('admin-liquidacion-zarpe');
    if (!select) return;

    select.innerHTML = '';

    // Opción "Todos los zarpes del día"
    var optTodos = document.createElement('option');
    optTodos.value = 'all';
    optTodos.textContent = '📊 Todos los zarpes del día';
    select.appendChild(optTodos);

    // Obtener zarpes de la fecha
    var zarpes = ASOTRANSMAR.Storage.getZarpesByFecha(fecha);

    zarpes.forEach(function(zarpe) {
      var opt = document.createElement('option');
      opt.value = zarpe.id;
      var estadoLabel = zarpe.estado === 'cerrado' ? '🔒' : '🟢';
      opt.textContent = estadoLabel + ' ' + zarpe.hora + ' - ' + zarpe.origen + ' → ' + zarpe.destino + ' (' + zarpe.embarcacion + ')';
      select.appendChild(opt);
    });
  },

  /* --------------------------------------------------------
   *  calcularLiquidacion()
   *  Calcula la liquidación financiera para el zarpe o
   *  zarpes seleccionados
   * ------------------------------------------------------ */
  calcularLiquidacion() {
    var fecha = ((document.getElementById('admin-liquidacion-fecha') || {}).value || '').trim();
    var zarpeSeleccion = ((document.getElementById('admin-liquidacion-zarpe') || {}).value || '').trim();
    var container = document.getElementById('admin-liquidacion-result');

    if (!fecha) {
      ASOTRANSMAR.Utils.showToast('Seleccione una fecha', 'error');
      return;
    }

    if (!container) return;

    var settings = ASOTRANSMAR.Storage.getSettings();
    var zarpes = ASOTRANSMAR.Storage.getZarpesByFecha(fecha);
    var allTickets = ASOTRANSMAR.Storage.getTicketsByFecha(fecha);

    // Determinar qué zarpes incluir
    var zarpesSeleccionados = [];
    if (zarpeSeleccion === 'all') {
      zarpesSeleccionados = zarpes;
    } else {
      var zarpeUnico = zarpes.find(function(z) { return z.id === zarpeSeleccion; });
      if (zarpeUnico) {
        zarpesSeleccionados = [zarpeUnico];
      }
    }

    if (zarpesSeleccionados.length === 0) {
      container.innerHTML = '<div class="liquidacion-empty"><p>No se encontraron zarpes para calcular</p></div>';
      return;
    }

    // ---- Agregar datos de todos los zarpes seleccionados ----
    var totalPasajeros = 0;
    var recaudacionBrutaUSD = 0;
    var recaudacionBrutaVES = 0;
    var embarcaciones = {};
    var horasZarpe = [];
    var tasaBCVPromedio = 0;
    var contadorTasas = 0;

    zarpesSeleccionados.forEach(function(zarpe) {
      // Obtener boletos de este zarpe
      var ticketsZarpe = allTickets.filter(function(t) { return t.zarpeId === zarpe.id; });

      totalPasajeros += ticketsZarpe.length;
      embarcaciones[zarpe.embarcacion] = true;
      horasZarpe.push(zarpe.hora);

      ticketsZarpe.forEach(function(ticket) {
        recaudacionBrutaUSD += ticket.monto_usd || 0;
        recaudacionBrutaVES += ticket.monto_ves || 0;
        if (ticket.tasa_bcv) {
          tasaBCVPromedio += ticket.tasa_bcv;
          contadorTasas++;
        }
      });
    });

    // Tasa BCV: usar promedio de las tasas de los boletos, o la actual si no hay boletos
    var tasaUsada = contadorTasas > 0 ? (tasaBCVPromedio / contadorTasas) : settings.tasa_bcv;

    // ---- Calcular deducciones ----
    var retencionPorcentaje = settings.retencion_asotransmar || 0;
    var arancelINEAporPasajero = settings.arancel_inea || 0;

    var retencionUSD = recaudacionBrutaUSD * (retencionPorcentaje / 100);
    var retencionVES = retencionUSD * tasaUsada;

    var arancelINEAusd = totalPasajeros * arancelINEAporPasajero;
    var arancelINEAves = arancelINEAusd * tasaUsada;

    var netoArmadorUSD = recaudacionBrutaUSD - retencionUSD - arancelINEAusd;
    var netoArmadorVES = recaudacionBrutaVES - retencionVES - arancelINEAves;

    // Asegurar que no sea negativo
    if (netoArmadorUSD < 0) netoArmadorUSD = 0;
    if (netoArmadorVES < 0) netoArmadorVES = 0;

    // ---- Formatear fecha ----
    var partesFecha = fecha.split('-');
    var fechaDisplay = partesFecha[2] + '/' + partesFecha[1] + '/' + partesFecha[0];

    // Nombre de embarcación(es)
    var embarcacionesStr = Object.keys(embarcaciones).join(', ') || '—';
    var horasStr = horasZarpe.join(', ') || '—';

    // ---- Renderizar tarjeta de liquidación ----
    container.innerHTML = '' +
      '<div class="liquidacion-card">' +
        '<div class="liquidacion-header">' +
          '<h3>╔══ LIQUIDACIÓN DE ARMADOR ══╗</h3>' +
        '</div>' +
        '<div class="liquidacion-body">' +
          '<div class="liquidacion-section">' +
            '<div class="liquidacion-row"><span class="label">Embarcación:</span> <span class="value">' + embarcacionesStr + '</span></div>' +
            '<div class="liquidacion-row"><span class="label">Fecha:</span> <span class="value">' + fechaDisplay + '</span></div>' +
            '<div class="liquidacion-row"><span class="label">Zarpe(s):</span> <span class="value">' + horasStr + '</span></div>' +
            '<div class="liquidacion-row"><span class="label">Total Pasajeros:</span> <span class="value">' + totalPasajeros + '</span></div>' +
            '<div class="liquidacion-row"><span class="label">Tasa BCV usada:</span> <span class="value">' + tasaUsada.toFixed(2) + '</span></div>' +
          '</div>' +

          '<div class="liquidacion-divider"></div>' +

          '<div class="liquidacion-section">' +
            '<h4>Recaudación Bruta</h4>' +
            '<div class="liquidacion-row monto"><span class="label">USD:</span> <span class="value">' + ASOTRANSMAR.Utils.formatUSD(recaudacionBrutaUSD) + '</span></div>' +
            '<div class="liquidacion-row monto"><span class="label">VES:</span> <span class="value">' + ASOTRANSMAR.Utils.formatVES(recaudacionBrutaVES) + '</span></div>' +
          '</div>' +

          '<div class="liquidacion-divider"></div>' +

          '<div class="liquidacion-section deducciones">' +
            '<h4>Deducciones</h4>' +
            '<div class="liquidacion-deduccion">' +
              '<div class="liquidacion-row"><span class="label">(-) Retención Asotransmar (' + retencionPorcentaje.toFixed(1) + '%):</span></div>' +
              '<div class="liquidacion-row sub-row"><span class="label">USD:</span> <span class="value">' + ASOTRANSMAR.Utils.formatUSD(retencionUSD) + '</span> <span class="sep">|</span> <span class="label">VES:</span> <span class="value">' + ASOTRANSMAR.Utils.formatVES(retencionVES) + '</span></div>' +
            '</div>' +
            '<div class="liquidacion-deduccion">' +
              '<div class="liquidacion-row"><span class="label">(-) Arancel INEA (' + totalPasajeros + ' × ' + ASOTRANSMAR.Utils.formatUSD(arancelINEAporPasajero) + '):</span></div>' +
              '<div class="liquidacion-row sub-row"><span class="label">USD:</span> <span class="value">' + ASOTRANSMAR.Utils.formatUSD(arancelINEAusd) + '</span> <span class="sep">|</span> <span class="label">VES:</span> <span class="value">' + ASOTRANSMAR.Utils.formatVES(arancelINEAves) + '</span></div>' +
            '</div>' +
          '</div>' +

          '<div class="liquidacion-divider grueso"></div>' +

          '<div class="liquidacion-section neto">' +
            '<h4>NETO A LIQUIDAR AL ARMADOR</h4>' +
            '<div class="liquidacion-row monto neto-valor"><span class="label">USD:</span> <span class="value">' + ASOTRANSMAR.Utils.formatUSD(netoArmadorUSD) + '</span></div>' +
            '<div class="liquidacion-row monto neto-valor"><span class="label">VES:</span> <span class="value">' + ASOTRANSMAR.Utils.formatVES(netoArmadorVES) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="liquidacion-footer">' +
          '<p>╚══════════════════════════════╝</p>' +
          '<p class="text-small text-muted">Generado el ' + new Date().toLocaleString('es-VE') + '</p>' +
        '</div>' +
      '</div>';

    // Mostrar botón de impresión de liquidación
    var btnImprimir = document.getElementById('btn-imprimir-liquidacion');
    if (btnImprimir) {
      btnImprimir.style.display = 'inline-block';
      btnImprimir.classList.remove('hidden');
    }
  },

  /* --------------------------------------------------------
   *  imprimirLiquidacion()
   *  Exporta la liquidación a PDF o usa window.print()
   * ------------------------------------------------------ */
  imprimirLiquidacion() {
    var container = document.getElementById('admin-liquidacion-result');
    if (!container || !container.innerHTML.trim()) {
      ASOTRANSMAR.Utils.showToast('Primero debe calcular una liquidación', 'error');
      return;
    }

    // Obtener datos para el nombre del archivo
    var fecha = ((document.getElementById('admin-liquidacion-fecha') || {}).value || 'fecha').replace(/-/g, '');
    var embarcacionText = container.querySelector('.liquidacion-row .value');
    var embarcacion = embarcacionText ? embarcacionText.textContent.replace(/\s/g, '_').replace(/[,]/g, '') : 'embarcacion';
    var filename = 'Liquidacion_' + embarcacion + '_' + fecha + '.pdf';

    // Intentar usar html2pdf.js si está disponible
    if (typeof html2pdf !== 'undefined') {
      var opt = {
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(container).save().then(function() {
        ASOTRANSMAR.Utils.showToast('PDF de liquidación generado exitosamente', 'success');
      }).catch(function(err) {
        console.error('Error generando PDF de liquidación:', err);
        ASOTRANSMAR.Utils.showToast('Error al generar el PDF', 'error');
      });
    } else {
      // Fallback: imprimir con el navegador
      ASOTRANSMAR.Utils.showToast('Abriendo ventana de impresión...', 'info');
      window.print();
    }
  }
};
