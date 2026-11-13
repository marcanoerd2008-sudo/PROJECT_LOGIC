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

    // SQLite Controls
    var btnSqliteExport = document.getElementById('btn-sqlite-export');
    if (btnSqliteExport) {
      btnSqliteExport.onclick = () => {
        if (window.ASOTRANSMAR && ASOTRANSMAR.DB) {
          ASOTRANSMAR.DB.exportDatabaseFile();
        }
      };
    }

    var fileSqliteInput = document.getElementById('sqlite-file-input');
    if (fileSqliteInput) {
      fileSqliteInput.onchange = (e) => {
        var file = e.target.files[0];
        if (file && window.ASOTRANSMAR && ASOTRANSMAR.DB) {
          ASOTRANSMAR.DB.importDatabaseFile(file).then(() => {
            this.updateSqliteStats();
            this.populateLiquidacionDates();
          });
        }
      };
    }

    var btnSqliteSync = document.getElementById('btn-sqlite-sync');
    if (btnSqliteSync) {
      btnSqliteSync.onclick = () => {
        if (window.ASOTRANSMAR && ASOTRANSMAR.DB) {
          ASOTRANSMAR.DB.syncFromStorage();
          this.updateSqliteStats();
          ASOTRANSMAR.Utils.showToast('Sincronización con SQLite completada', 'success');
        }
      };
    }

    this.updateSqliteStats();
  },

  updateSqliteStats() {
    if (!window.ASOTRANSMAR || !ASOTRANSMAR.DB) return;
    var stats = ASOTRANSMAR.DB.getStats();
    var statTickets = document.getElementById('sqlite-stat-tickets');
    var statZarpes = document.getElementById('sqlite-stat-zarpes');
    var statSize = document.getElementById('sqlite-stat-size');
    var statusDisplay = document.getElementById('sqlite-status-display');

    if (statTickets) statTickets.textContent = stats.tickets;
    if (statZarpes) statZarpes.textContent = stats.zarpes;
    if (statSize) statSize.textContent = stats.sizeKb + ' KB';
    if (statusDisplay) {
      statusDisplay.textContent = stats.active
        ? '🟢 Motor SQLite 3 (WebAssembly) Activo y Persistente'
        : '🟡 SQLite Inicializando / Modo Almacenamiento Local';
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
    var elTarifaTur = document.getElementById('admin-tarifa-tur');
    var elTarifaExo = document.getElementById('admin-tarifa-exo');
    var elRetencion = document.getElementById('admin-retencion');
    var elArancel = document.getElementById('admin-arancel-inea');
    var elAforoMax = document.getElementById('admin-aforo-max');

    if (elTasa) elTasa.value = settings.tasa_bcv || 0;
    if (elTarifaReg) elTarifaReg.value = settings.tarifa_reg_usd || 0;

    // Calcular tarifas de medio pasaje, turista y exonerado basadas en la tarifa regular y factores
    var categorias = ASOTRANSMAR.Config.CATEGORIAS;
    var catMedio = categorias.find(function(c) { return c.codigo === 'medio'; });
    var catTur = categorias.find(function(c) { return c.codigo === 'turista'; });
    var catExo = categorias.find(function(c) { return c.codigo === 'exonerado'; });

    if (elTarifaMedio) {
      var tarifaMedio = settings.tarifa_medio_usd !== undefined ? settings.tarifa_medio_usd :
        (settings.tarifa_reg_usd || 0) * (catMedio ? catMedio.factor : 0.5);
      elTarifaMedio.value = tarifaMedio;
    }
    if (elTarifaTur) {
      var tarifaTur = settings.tarifa_tur_usd !== undefined ? settings.tarifa_tur_usd :
        (settings.tarifa_reg_usd || 0) * (catTur ? catTur.factor : 1.0);
      elTarifaTur.value = tarifaTur;
    }
    if (elTarifaExo) {
      var tarifaExo = settings.tarifa_exo_usd !== undefined ? settings.tarifa_exo_usd :
        (settings.tarifa_reg_usd || 0) * (catExo ? catExo.factor : 0);
      elTarifaExo.value = tarifaExo;
    }

    if (elRetencion) elRetencion.value = settings.retencion_asotransmar || 0;
    if (elArancel) elArancel.value = settings.arancel_inea || 0;
    if (elAforoMax) elAforoMax.value = settings.capacidad_max_inea || 160;
  },

  /* --------------------------------------------------------
   *  saveConfig()
   *  Guarda la configuración del formulario de administración
   * ------------------------------------------------------ */
  saveConfig() {
    var tasa = parseFloat((document.getElementById('admin-tasa-bcv') || {}).value);
    var tarifaReg = parseFloat((document.getElementById('admin-tarifa-reg') || {}).value);
    var tarifaMedio = parseFloat((document.getElementById('admin-tarifa-medio') || {}).value);
    var tarifaTur = parseFloat((document.getElementById('admin-tarifa-tur') || {}).value);
    var tarifaExo = parseFloat((document.getElementById('admin-tarifa-exo') || {}).value);
    var retencion = parseFloat((document.getElementById('admin-retencion') || {}).value);
    var arancel = parseFloat((document.getElementById('admin-arancel-inea') || {}).value);
    var aforoMax = parseInt((document.getElementById('admin-aforo-max') || {}).value, 10);

    // Validar que todos sean números >= 0
    var campos = [
      { nombre: 'Tasa BCV', valor: tasa },
      { nombre: 'Tarifa Regular', valor: tarifaReg },
      { nombre: 'Tarifa Medio Pasaje', valor: tarifaMedio },
      { nombre: 'Tarifa Visitante/Turista', valor: isNaN(tarifaTur) ? tarifaReg : tarifaTur },
      { nombre: 'Tarifa Exonerado', valor: tarifaExo },
      { nombre: 'Retención Asotransmar', valor: retencion },
      { nombre: 'Arancel INEA', valor: arancel },
      { nombre: 'Aforo Máximo INEA', valor: isNaN(aforoMax) ? 160 : aforoMax }
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
    settings.tarifa_tur_usd = isNaN(tarifaTur) ? tarifaReg : tarifaTur;
    settings.tarifa_exo_usd = tarifaExo;
    settings.retencion_asotransmar = retencion;
    settings.arancel_inea = arancel;
    settings.capacidad_max_inea = isNaN(aforoMax) ? 160 : aforoMax;
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

    // Guardar los datos calculados para exportación fiel a PDF
    this.lastCalculo = {
      fecha: fecha,
      fechaDisplay: fechaDisplay,
      zarpesSeleccionados: zarpesSeleccionados,
      totalPasajeros: totalPasajeros,
      embarcacionesStr: embarcacionesStr,
      horasStr: horasStr,
      tasaUsada: tasaUsada,
      recaudacionBrutaUSD: recaudacionBrutaUSD,
      recaudacionBrutaVES: recaudacionBrutaVES,
      retencionPorcentaje: retencionPorcentaje,
      retencionUSD: retencionUSD,
      retencionVES: retencionVES,
      arancelINEAporPasajero: arancelINEAporPasajero,
      arancelINEAusd: arancelINEAusd,
      arancelINEAves: arancelINEAves,
      netoArmadorUSD: netoArmadorUSD,
      netoArmadorVES: netoArmadorVES,
      detallesZarpes: zarpesSeleccionados.map(function(z) {
        var tz = allTickets.filter(function(t) { return t.zarpeId === z.id; });
        return {
          id: z.id,
          hora: z.hora,
          origen: z.origen,
          destino: z.destino,
          embarcacion: z.embarcacion,
          capitan: z.capitan || 'Capitán Asignado',
          pasajeros: tz.length,
          montoUSD: tz.reduce(function(acc, t) { return acc + (t.monto_usd || 0); }, 0),
          montoVES: tz.reduce(function(acc, t) { return acc + (t.monto_ves || 0); }, 0)
        };
      })
    };

    // ---- Renderizar tarjeta de liquidación en pantalla ----
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
   *  buildPrintableLiquidacionElement(data)
   *  Genera un elemento DOM oficial, independiente del tema
   *  y formateado exactamente para hoja Carta / A4.
   * ------------------------------------------------------ */
  buildPrintableLiquidacionElement(data) {
    var doc = document.createElement('div');
    doc.style.width = '100%';
    doc.style.maxWidth = '100%';
    doc.style.boxSizing = 'border-box';
    doc.style.margin = '0 auto';
    doc.style.padding = '14px 18px';
    doc.style.background = '#ffffff';
    doc.style.color = '#0f172a';
    doc.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    doc.style.lineHeight = '1.4';

    var zarpesRows = '';
    if (data.detallesZarpes && data.detallesZarpes.length > 0) {
      data.detallesZarpes.forEach(function(dz, idx) {
        var bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        zarpesRows += '' +
          '<tr style="background: ' + bg + '; border-bottom: 1px solid #cbd5e1; font-size: 10px;">' +
            '<td style="padding: 6px 8px; text-align: center; font-weight: bold; width: 28px; color: #0f172a; border-right: 1px solid #e2e8f0;">' + (idx + 1) + '</td>' +
            '<td style="padding: 6px 8px; font-weight: 600; color: #0f172a; width: 65px; text-align: center; border-right: 1px solid #e2e8f0;">' + dz.hora + ' hrs</td>' +
            '<td style="padding: 6px 8px; color: #334155; border-right: 1px solid #e2e8f0;">' + dz.origen + ' → ' + dz.destino + '</td>' +
            '<td style="padding: 6px 8px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0;">' + dz.embarcacion + '</td>' +
            '<td style="padding: 6px 8px; text-align: center; font-weight: 700; color: #2563eb; width: 75px; border-right: 1px solid #e2e8f0;">' + dz.pasajeros + ' pax</td>' +
            '<td style="padding: 6px 8px; text-align: right; color: #0f172a; font-weight: 600; width: 85px; border-right: 1px solid #e2e8f0;">' + ASOTRANSMAR.Utils.formatUSD(dz.montoUSD) + '</td>' +
            '<td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #0f172a; width: 115px;">' + ASOTRANSMAR.Utils.formatVES(dz.montoVES) + '</td>' +
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
            '<div style="display: inline-block; padding: 4px 10px; background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 800; border-radius: 4px; letter-spacing: 0.04em;">' +
              'COMPROBANTE OFICIAL DE LIQUIDACIÓN' +
            '</div>' +
            '<p style="margin: 3px 0 0 0; font-size: 8.5px; color: #475569; font-weight: 600;">Administración, Finanzas y Rendición a Armadores</p>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px;">' +
        '<table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">' +
          '<tr>' +
            '<td style="padding: 3px 6px; width: 25%;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Fecha de Liquidación:</span><strong style="color: #0f172a;">' + data.fechaDisplay + '</strong></td>' +
            '<td style="padding: 3px 6px; width: 25%;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Embarcación(es):</span><strong style="color: #0f172a;">' + data.embarcacionesStr + '</strong></td>' +
            '<td style="padding: 3px 6px; width: 25%;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Zarpes Liquidados:</span><strong style="color: #2563eb;">' + data.horasStr + '</strong></td>' +
            '<td style="padding: 3px 6px; width: 25%;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Tasa Oficial BCV:</span><strong style="color: #059669;">' + data.tasaUsada.toFixed(2) + ' VES/USD</strong></td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 4px 6px 2px 6px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Total Pasajeros:</span><strong style="color: #2563eb;">' + data.totalPasajeros + ' Pax Transportados</strong></td>' +
            '<td style="padding: 4px 6px 2px 6px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Retención Asotransmar:</span><strong style="color: #0f172a;">' + data.retencionPorcentaje.toFixed(1) + '% s/ Recaudación</strong></td>' +
            '<td style="padding: 4px 6px 2px 6px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Arancel Portuario INEA:</span><strong style="color: #0f172a;">' + ASOTRANSMAR.Utils.formatUSD(data.arancelINEAporPasajero) + ' / pax</strong></td>' +
            '<td style="padding: 4px 6px 2px 6px;"><span style="color: #64748b; font-size: 8.5px; text-transform: uppercase; font-weight: bold; display: block;">Estado de Conciliación:</span><strong style="color: #059669;">PROCESADO Y APROBADO</strong></td>' +
          '</tr>' +
        '</table>' +
      '</div>' +

      (zarpesRows ? '' +
        '<div style="margin-bottom: 14px;">' +
          '<div style="font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 0.03em;">Desglose de Zarpes Incluidos:</div>' +
          '<table style="width: 100%; border-collapse: collapse; border: 1.5px solid #cbd5e1;">' +
            '<thead>' +
              '<tr style="background: #0f172a; color: #ffffff; font-size: 9px; text-transform: uppercase;">' +
                '<th style="padding: 6px 8px; width: 28px; text-align: center; border-right: 1px solid #334155; color: #ffffff;">N°</th>' +
                '<th style="padding: 6px 8px; text-align: center; width: 65px; border-right: 1px solid #334155; color: #ffffff;">Hora</th>' +
                '<th style="padding: 6px 8px; text-align: left; border-right: 1px solid #334155; color: #ffffff;">Ruta</th>' +
                '<th style="padding: 6px 8px; text-align: left; border-right: 1px solid #334155; color: #ffffff;">Nave</th>' +
                '<th style="padding: 6px 8px; text-align: center; width: 75px; border-right: 1px solid #334155; color: #ffffff;">Pasajeros</th>' +
                '<th style="padding: 6px 8px; text-align: right; width: 85px; border-right: 1px solid #334155; color: #ffffff;">Total USD</th>' +
                '<th style="padding: 6px 8px; text-align: right; width: 115px; color: #ffffff;">Total VES</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              zarpesRows +
            '</tbody>' +
          '</table>' +
        '</div>' : '') +

      '<div style="margin-bottom: 16px;">' +
        '<div style="font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 0.03em;">Conciliación Contable y Deducciones Reglamentarias:</div>' +
        '<table style="width: 100%; border-collapse: collapse; border: 1.5px solid #cbd5e1; font-size: 10.5px;">' +
          '<thead>' +
            '<tr style="background: #334155; color: #ffffff; font-size: 9px; text-transform: uppercase;">' +
              '<th style="padding: 6px 10px; text-align: left;">CONCEPTO FINANCIERO</th>' +
              '<th style="padding: 6px 10px; text-align: left; width: 170px;">BASE DE CÁLCULO</th>' +
              '<th style="padding: 6px 10px; text-align: right; width: 110px;">MONTO (USD)</th>' +
              '<th style="padding: 6px 10px; text-align: right; width: 130px;">MONTO (VES)</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            '<tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0;">' +
              '<td style="padding: 7px 10px; font-weight: 700; color: #0f172a;">(+) Recaudación Bruta en Taquilla</td>' +
              '<td style="padding: 7px 10px; color: #475569;">100% Boletos Emitidos</td>' +
              '<td style="padding: 7px 10px; text-align: right; font-weight: 700; color: #0f172a;">' + ASOTRANSMAR.Utils.formatUSD(data.recaudacionBrutaUSD) + '</td>' +
              '<td style="padding: 7px 10px; text-align: right; font-weight: 700; color: #0f172a;">' + ASOTRANSMAR.Utils.formatVES(data.recaudacionBrutaVES) + '</td>' +
            '</tr>' +
            '<tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">' +
              '<td style="padding: 7px 10px; color: #dc2626;">(-) Retención Estatutaria ASOTRANSMAR</td>' +
              '<td style="padding: 7px 10px; color: #64748b;">' + data.retencionPorcentaje.toFixed(1) + '% de ingresos brutos</td>' +
              '<td style="padding: 7px 10px; text-align: right; color: #dc2626; font-weight: 600;">-' + ASOTRANSMAR.Utils.formatUSD(data.retencionUSD) + '</td>' +
              '<td style="padding: 7px 10px; text-align: right; color: #dc2626; font-weight: 600;">-' + ASOTRANSMAR.Utils.formatVES(data.retencionVES) + '</td>' +
            '</tr>' +
            '<tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0;">' +
              '<td style="padding: 7px 10px; color: #dc2626;">(-) Arancel Portuario INEA</td>' +
              '<td style="padding: 7px 10px; color: #64748b;">' + data.totalPasajeros + ' Pax × ' + ASOTRANSMAR.Utils.formatUSD(data.arancelINEAporPasajero) + '</td>' +
              '<td style="padding: 7px 10px; text-align: right; color: #dc2626; font-weight: 600;">-' + ASOTRANSMAR.Utils.formatUSD(data.arancelINEAusd) + '</td>' +
              '<td style="padding: 7px 10px; text-align: right; color: #dc2626; font-weight: 600;">-' + ASOTRANSMAR.Utils.formatVES(data.arancelINEAves) + '</td>' +
            '</tr>' +
            '<tr style="background: #f1f5f9; border-top: 1.5px solid #cbd5e1; font-size: 10px; font-weight: 600;">' +
              '<td colspan="2" style="padding: 6px 10px; color: #475569;">TOTAL DEDUCCIONES REGLAMENTARIAS:</td>' +
              '<td style="padding: 6px 10px; text-align: right; color: #dc2626;">-' + ASOTRANSMAR.Utils.formatUSD(data.retencionUSD + data.arancelINEAusd) + '</td>' +
              '<td style="padding: 6px 10px; text-align: right; color: #dc2626;">-' + ASOTRANSMAR.Utils.formatVES(data.retencionVES + data.arancelINEAves) + '</td>' +
            '</tr>' +
            '<tr style="background: #ecfdf5; border-top: 2px solid #059669; border-bottom: 2px solid #059669;">' +
              '<td colspan="2" style="padding: 9px 10px; font-size: 12px; font-weight: 900; color: #065f46;">' +
                'NETO A PAGAR AL ARMADOR / PROPIETARIO:' +
              '</td>' +
              '<td style="padding: 9px 10px; text-align: right; font-size: 13.5px; font-weight: 900; color: #059669;">' +
                ASOTRANSMAR.Utils.formatUSD(data.netoArmadorUSD) +
              '</td>' +
              '<td style="padding: 9px 10px; text-align: right; font-size: 13.5px; font-weight: 900; color: #059669;">' +
                ASOTRANSMAR.Utils.formatVES(data.netoArmadorVES) +
              '</td>' +
            '</tr>' +
          '</tbody>' +
        '</table>' +
      '</div>' +

      '<div style="margin-top: 22px; padding-top: 14px; border-top: 1.5px solid #cbd5e1; page-break-inside: avoid; break-inside: avoid;">' +
        '<p style="font-size: 8.5px; color: #64748b; margin: 0 0 20px 0; text-align: center; font-style: italic;">' +
          'Certifico que los cálculos y deducciones contenidos en la presente liquidación corresponden fielmente a los boletos despachados y a los acuerdos estatutarios de ASOTRANSMAR C.A., dándose formal descargo de pago a la entrega de los fondos.' +
        '</p>' +
        '<table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 9.5px;">' +
          '<tr>' +
            '<td style="width: 33%; padding: 0 12px; vertical-align: top;">' +
              '<div style="border-top: 1.5px solid #0f172a; padding-top: 4px;">' +
                '<strong style="display: block; font-size: 9.5px; color: #0f172a;">Armador / Propietario</strong>' +
                '<span style="font-size: 8.5px; color: #64748b;">Firma, C.I. y Huella</span>' +
              '</div>' +
            '</td>' +
            '<td style="width: 33%; padding: 0 12px; vertical-align: top;">' +
              '<div style="border-top: 1.5px solid #0f172a; padding-top: 4px;">' +
                '<strong style="display: block; font-size: 9.5px; color: #0f172a;">Gerencia de Administración</strong>' +
                '<span style="font-size: 8.5px; color: #64748b;">ASOTRANSMAR C.A.</span>' +
              '</div>' +
            '</td>' +
            '<td style="width: 33%; padding: 0 12px; vertical-align: top;">' +
              '<div style="border-top: 1.5px solid #0f172a; padding-top: 4px;">' +
                '<strong style="display: block; font-size: 9.5px; color: #0f172a;">Auditoría / Control Interno</strong>' +
                '<span style="font-size: 8.5px; color: #64748b;">Conforme y Registrado</span>' +
              '</div>' +
            '</td>' +
          '</tr>' +
        '</table>' +
        '<div style="margin-top: 14px; text-align: right; font-size: 8px; color: #94a3b8;">' +
          'Comprobante contable emitido por ASOTRANSMAR vs 4.0 • ' + new Date().toLocaleString('es-VE') +
        '</div>' +
      '</div>';

    return doc;
  },

  /* --------------------------------------------------------
   *  imprimirLiquidacion()
   *  Exporta la liquidación a PDF con html2pdf oficial
   * ------------------------------------------------------ */
  imprimirLiquidacion() {
    if (!this.lastCalculo) {
      this.calcularLiquidacion();
    }

    if (!this.lastCalculo) {
      ASOTRANSMAR.Utils.showToast('Primero debe calcular una liquidación', 'error');
      return;
    }

    ASOTRANSMAR.Utils.showToast('Generando PDF oficial de liquidación...', 'info');

    var printableDoc = this.buildPrintableLiquidacionElement(this.lastCalculo);

    var fechaFile = (this.lastCalculo.fecha || 'fecha').replace(/-/g, '');
    var embFile = (this.lastCalculo.embarcacionesStr || 'embarcacion').replace(/\s/g, '_').replace(/[,]/g, '');
    var filename = 'Liquidacion_' + embFile + '_' + fechaFile + '.pdf';

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
          ASOTRANSMAR.Utils.showToast('PDF de liquidación generado exitosamente', 'success');
        }).catch(function(err) {
          restoreScroll();
          console.error('Error generando PDF de liquidación:', err);
          window.print();
        });
      }, 60);
    } else {
      restoreScroll();
      window.print();
    }
  }
};
