/**
 * ============================================================
 *  ASOTRANSMAR vs 4.0 — Módulo de Listín de Zarpe (Manifiesto)
 * ============================================================
 *  Genera el listín digital de pasajeros por zarpe, permite
 *  imprimir/exportar a PDF y cerrar zarpes completados.
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

    // Cargar el primer zarpe si existe
    if (zarpeSelect && zarpeSelect.value) {
      this.loadManifest(zarpeSelect.value);
    }
  },

  /* --------------------------------------------------------
   *  populateZarpeSelector()
   *  Llena #listin-zarpe-select con TODOS los zarpes del día
   *  (abiertos y cerrados)
   * ------------------------------------------------------ */
  populateZarpeSelector() {
    const today = ASOTRANSMAR.Utils.today();
    ASOTRANSMAR.Schedules.ensureTodayZarpes(today);

    const zarpes = ASOTRANSMAR.Storage.getZarpesByFecha(today);
    const select = document.getElementById('listin-zarpe-select');
    if (!select) return;

    // Guardar selección previa para restaurarla si es posible
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
      opt.textContent = zarpe.hora + ' - ' + zarpe.origen + ' → ' + zarpe.destino +
        ' (' + zarpe.embarcacion + ') [' + estadoLabel + ']';
      select.appendChild(opt);
    });

    // Restaurar selección previa si existe
    if (prevValue) {
      const exists = Array.from(select.options).some(function(o) { return o.value === prevValue; });
      if (exists) {
        select.value = prevValue;
      }
    }
  },

  /* --------------------------------------------------------
   *  loadManifest(zarpeId)
   *  Carga y renderiza el listín de pasajeros de un zarpe
   * ------------------------------------------------------ */
  loadManifest(zarpeId) {
    this.currentZarpeId = zarpeId;

    const zarpe = ASOTRANSMAR.Storage.getZarpeById(zarpeId);
    if (!zarpe) {
      ASOTRANSMAR.Utils.showToast('No se encontró el zarpe seleccionado', 'error');
      return;
    }

    // ---- Obtener todos los boletos del zarpe ----
    const today = ASOTRANSMAR.Utils.today();
    const allTickets = ASOTRANSMAR.Storage.getTicketsByFecha(today);
    const tickets = allTickets.filter(function(t) { return t.zarpeId === zarpeId; });

    // ---- Formatear fecha ----
    const partesFecha = zarpe.fecha.split('-');
    const fechaDisplay = partesFecha[2] + '/' + partesFecha[1] + '/' + partesFecha[0];

    // ---- Actualizar campos de encabezado ----
    const elFecha = document.getElementById('listin-fecha');
    const elHora = document.getElementById('listin-hora');
    const elOrigen = document.getElementById('listin-origen');
    const elDestino = document.getElementById('listin-destino');
    const elEmbarcacion = document.getElementById('listin-embarcacion');
    const elTaquillero = document.getElementById('listin-taquillero');
    const elEstado = document.getElementById('listin-estado');

    if (elFecha) elFecha.textContent = fechaDisplay;
    if (elHora) elHora.textContent = zarpe.hora;
    if (elOrigen) elOrigen.textContent = zarpe.origen;
    if (elDestino) elDestino.textContent = zarpe.destino;
    if (elEmbarcacion) elEmbarcacion.textContent = zarpe.embarcacion;
    if (elEstado) {
      elEstado.textContent = zarpe.estado === 'cerrado' ? '🔒 Cerrado' : '🟢 Abierto';
      elEstado.className = zarpe.estado === 'cerrado' ? 'badge badge-cerrado' : 'badge badge-abierto';
    }

    // Taquillero: usar el del primer boleto si existe, o el usuario actual
    if (elTaquillero) {
      if (tickets.length > 0) {
        elTaquillero.textContent = tickets[0].taquillero || '—';
      } else {
        const currentUser = ASOTRANSMAR.Auth.getCurrentUser();
        elTaquillero.textContent = currentUser ? currentUser.usuario : '—';
      }
    }

    // ---- Poblar tabla de pasajeros ----
    const tbody = document.getElementById('listin-tabla-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const categorias = ASOTRANSMAR.Config.CATEGORIAS;

    if (tickets.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" class="text-center text-muted">No hay pasajeros registrados en este zarpe</td>';
      tbody.appendChild(tr);
    } else {
      tickets.forEach(function(ticket, idx) {
        const tr = document.createElement('tr');
        const cat = categorias.find(function(c) { return c.codigo === ticket.categoria; });
        const catNombre = cat ? cat.nombre : ticket.categoria;

        tr.innerHTML = '' +
          '<td>' + (idx + 1) + '</td>' +
          '<td>V-' + ticket.cedula + '</td>' +
          '<td>' + ticket.nombre + '</td>' +
          '<td>' + ticket.apellido + '</td>' +
          '<td><span class="badge badge-cat-' + ticket.categoria + '">' + catNombre + '</span></td>' +
          '<td class="text-right">' + ASOTRANSMAR.Utils.formatVES(ticket.monto_ves) + '</td>';
        tbody.appendChild(tr);
      });
    }

    // ---- Actualizar totales ----
    const elTotalPasajeros = document.getElementById('listin-total-pasajeros');
    const elTotalMonto = document.getElementById('listin-total-monto');

    if (elTotalPasajeros) elTotalPasajeros.textContent = tickets.length;

    const totalMonto = tickets.reduce(function(sum, t) { return sum + (t.monto_ves || 0); }, 0);
    if (elTotalMonto) elTotalMonto.textContent = ASOTRANSMAR.Utils.formatVES(totalMonto);

    // ---- Habilitar/deshabilitar botón cerrar según estado ----
    const btnCerrar = document.getElementById('btn-cerrar-zarpe');
    if (btnCerrar) {
      btnCerrar.disabled = zarpe.estado === 'cerrado';
      btnCerrar.textContent = zarpe.estado === 'cerrado' ? '🔒 Zarpe Cerrado' : '🔒 Cerrar Zarpe';
    }
  },

  /* --------------------------------------------------------
   *  printManifest()
   *  Exporta el listín a PDF con html2pdf.js o usa print()
   * ------------------------------------------------------ */
  printManifest() {
    const container = document.getElementById('listin-container');
    if (!container) {
      ASOTRANSMAR.Utils.showToast('No se encontró el contenedor del listín', 'error');
      return;
    }

    if (!this.currentZarpeId) {
      ASOTRANSMAR.Utils.showToast('Seleccione un zarpe primero', 'error');
      return;
    }

    const zarpe = ASOTRANSMAR.Storage.getZarpeById(this.currentZarpeId);
    const fechaFile = zarpe ? zarpe.fecha.replace(/-/g, '') : 'fecha';
    const horaFile = zarpe ? zarpe.hora.replace(/:/g, '') : 'hora';
    const origenFile = zarpe ? zarpe.origen.replace(/\s/g, '_') : 'origen';
    const filename = 'Listin_Zarpe_' + fechaFile + '_' + horaFile + '_' + origenFile + '.pdf';

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
        ASOTRANSMAR.Utils.showToast('PDF del listín generado exitosamente', 'success');
      }).catch(function(err) {
        console.error('Error generando PDF del listín:', err);
        ASOTRANSMAR.Utils.showToast('Error al generar el PDF', 'error');
      });
    } else {
      // Fallback: imprimir con el navegador
      ASOTRANSMAR.Utils.showToast('Abriendo ventana de impresión...', 'info');
      window.print();
    }
  },

  /* --------------------------------------------------------
   *  cerrarZarpe()
   *  Cierra el zarpe actual (cambia estado a 'cerrado')
   * ------------------------------------------------------ */
  cerrarZarpe() {
    if (!this.currentZarpeId) {
      ASOTRANSMAR.Utils.showToast('Seleccione un zarpe primero', 'error');
      return;
    }

    const zarpe = ASOTRANSMAR.Storage.getZarpeById(this.currentZarpeId);
    if (!zarpe) {
      ASOTRANSMAR.Utils.showToast('Zarpe no encontrado', 'error');
      return;
    }

    if (zarpe.estado === 'cerrado') {
      ASOTRANSMAR.Utils.showToast('Este zarpe ya está cerrado', 'warning');
      return;
    }

    // Mostrar diálogo de confirmación
    var self = this;
    var mensaje = '¿Está seguro de cerrar el zarpe de las ' + zarpe.hora +
      ' (' + zarpe.origen + ' → ' + zarpe.destino + ')?\n\nUna vez cerrado, no se podrán vender más boletos para este zarpe.';

    // Usar Utils.showConfirm si existe, sino usar confirm nativo
    if (ASOTRANSMAR.Utils.showConfirm) {
      ASOTRANSMAR.Utils.showConfirm(mensaje, function(confirmed) {
        if (confirmed) {
          self._ejecutarCierreZarpe(zarpe);
        }
      });
    } else {
      if (confirm(mensaje)) {
        self._ejecutarCierreZarpe(zarpe);
      }
    }
  },

  /* --------------------------------------------------------
   *  _ejecutarCierreZarpe(zarpe)
   *  Lógica interna de cierre de zarpe
   * ------------------------------------------------------ */
  _ejecutarCierreZarpe(zarpe) {
    zarpe.estado = 'cerrado';
    ASOTRANSMAR.Storage.saveZarpe(zarpe);

    // Recargar el listín
    this.loadManifest(this.currentZarpeId);

    // Refrescar selector para mostrar estado actualizado
    this.populateZarpeSelector();

    // Restaurar la selección al zarpe actual
    var select = document.getElementById('listin-zarpe-select');
    if (select) {
      select.value = this.currentZarpeId;
    }

    ASOTRANSMAR.Utils.showToast('Zarpe de las ' + zarpe.hora + ' cerrado exitosamente', 'success');
  }
};
