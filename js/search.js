/**
 * ============================================================
 *  ASOTRANSMAR vs 4.0 — Módulo de Búsqueda de Pasajeros
 * ============================================================
 *  Búsqueda por cédula, nombre o apellido en el historial
 *  de boletos. Incluye búsqueda global (barra superior)
 *  y búsqueda dedicada con filtros de fecha.
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.Search = {

  /* --------------------------------------------------------
   *  init() — Inicializa el módulo de búsqueda
   *  Llamado por App.navigateTo('busqueda')
   * ------------------------------------------------------ */
  init() {
    // Listener: búsqueda por texto con debounce
    const inputBusqueda = document.getElementById('busqueda-input');
    if (inputBusqueda) {
      inputBusqueda.removeEventListener('keyup', this._debouncedSearch);
      this._debouncedSearch = this.debounce(() => this.search(), 300);
      inputBusqueda.addEventListener('keyup', this._debouncedSearch);
    }

    // Listener: filtro por rango de fechas
    const fechaDesde = document.getElementById('busqueda-fecha-desde');
    const fechaHasta = document.getElementById('busqueda-fecha-hasta');

    if (fechaDesde) {
      fechaDesde.removeEventListener('change', this._onFechaChange);
      this._onFechaChange = () => this.search();
      fechaDesde.addEventListener('change', this._onFechaChange);
    }
    if (fechaHasta) {
      fechaHasta.removeEventListener('change', this._onFechaChangeHasta);
      this._onFechaChangeHasta = () => this.search();
      fechaHasta.addEventListener('change', this._onFechaChangeHasta);
    }

    // Listener: botón de búsqueda (si existe)
    const btnBuscar = document.getElementById('btn-buscar');
    if (btnBuscar) {
      btnBuscar.removeEventListener('click', this._onBtnBuscar);
      this._onBtnBuscar = () => this.search();
      btnBuscar.addEventListener('click', this._onBtnBuscar);
    }

    // Ejecutar búsqueda si ya hay texto en el campo
    if (inputBusqueda && inputBusqueda.value.trim()) {
      this.search();
    }
  },

  /* --------------------------------------------------------
   *  search() — Búsqueda dedicada en la sección de búsqueda
   *  Filtra boletos por texto y rango de fechas
   * ------------------------------------------------------ */
  search() {
    const query = ((document.getElementById('busqueda-input') || {}).value || '').trim();
    const fechaDesde = ((document.getElementById('busqueda-fecha-desde') || {}).value || '').trim();
    const fechaHasta = ((document.getElementById('busqueda-fecha-hasta') || {}).value || '').trim();

    // ---- Obtener resultados de búsqueda ----
    var results = [];
    if (query) {
      results = ASOTRANSMAR.Storage.searchTickets(query);
    } else {
      // Sin query, traer todos los boletos (para filtrar por fecha)
      results = ASOTRANSMAR.Storage.getAllTickets ? ASOTRANSMAR.Storage.getAllTickets() : [];
    }

    // ---- Filtrar por rango de fechas si se proporcionó ----
    if (fechaDesde) {
      results = results.filter(function(t) {
        return t.fecha >= fechaDesde;
      });
    }
    if (fechaHasta) {
      results = results.filter(function(t) {
        return t.fecha <= fechaHasta;
      });
    }

    // ---- Ordenar por fecha desc, luego hora desc ----
    results.sort(function(a, b) {
      if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
      return (b.hora_venta || '').localeCompare(a.hora_venta || '');
    });

    // ---- Renderizar resultados ----
    this._renderResults(results);
  },

  /* --------------------------------------------------------
   *  _renderResults(results)
   *  Pinta los resultados en la tabla de búsqueda
   * ------------------------------------------------------ */
  _renderResults(results) {
    const tbody = document.getElementById('busqueda-tabla-body');
    const statsEl = document.getElementById('busqueda-stats');

    if (!tbody) return;
    tbody.innerHTML = '';

    // ---- Estadísticas ----
    if (statsEl) {
      if (results.length === 0) {
        statsEl.textContent = 'No se encontraron registros';
      } else {
        statsEl.textContent = results.length + ' resultado' + (results.length !== 1 ? 's' : '') + ' encontrado' + (results.length !== 1 ? 's' : '');
      }
    }

    // ---- Sin resultados ----
    if (results.length === 0) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="9" class="text-center text-muted">' +
        '<div class="no-results">' +
          '<span class="no-results-icon">🔍</span>' +
          '<p>No se encontraron registros</p>' +
          '<p class="text-small">Intente con otro término de búsqueda o ajuste el rango de fechas</p>' +
        '</div>' +
      '</td>';
      tbody.appendChild(tr);
      return;
    }

    // ---- Categorías para mostrar el nombre ----
    var categorias = ASOTRANSMAR.Config.CATEGORIAS;

    // ---- Renderizar cada fila ----
    results.forEach(function(ticket) {
      var tr = document.createElement('tr');

      // Formatear fecha
      var partesFecha = ticket.fecha.split('-');
      var fechaDisplay = partesFecha[2] + '/' + partesFecha[1] + '/' + partesFecha[0];

      // Nombre de categoría
      var cat = categorias.find(function(c) { return c.codigo === ticket.categoria; });
      var catNombre = cat ? cat.nombre : ticket.categoria;

      // Ruta: obtener del zarpe si es posible
      var ruta = '—';
      if (ticket.origen && ticket.destino) {
        ruta = ticket.origen + ' → ' + ticket.destino;
      } else if (ticket.zarpeId) {
        var zarpe = ASOTRANSMAR.Storage.getZarpeById(ticket.zarpeId);
        if (zarpe) {
          ruta = zarpe.origen + ' → ' + zarpe.destino;
        }
      }

      tr.innerHTML = '' +
        '<td>' + fechaDisplay + '</td>' +
        '<td>' + (ticket.hora_venta || '—') + '</td>' +
        '<td>V-' + ticket.cedula + '</td>' +
        '<td>' + ticket.nombre + '</td>' +
        '<td>' + ticket.apellido + '</td>' +
        '<td><span class="badge badge-cat-' + ticket.categoria + '">' + catNombre + '</span></td>' +
        '<td>' + (ticket.embarcacion || '—') + '</td>' +
        '<td>' + ruta + '</td>' +
        '<td class="text-right">' + ASOTRANSMAR.Utils.formatVES(ticket.monto_ves || 0) + '</td>';

      tbody.appendChild(tr);
    });
  },

  /* --------------------------------------------------------
   *  globalSearch(query) — Búsqueda rápida desde la barra
   *  superior (header). Muestra un dropdown con los 10
   *  primeros resultados.
   * ------------------------------------------------------ */
  globalSearch(query) {
    var dropdown = document.getElementById('search-global-results');
    if (!dropdown) return;

    // Si no hay consulta, ocultar el dropdown
    if (!query || query.length < 2) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    // Buscar boletos
    var results = ASOTRANSMAR.Storage.searchTickets(query);

    // Ordenar por fecha descendente
    results.sort(function(a, b) {
      if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
      return (b.hora_venta || '').localeCompare(a.hora_venta || '');
    });

    // Tomar los primeros 10
    var top10 = results.slice(0, 10);

    dropdown.innerHTML = '';

    if (top10.length === 0) {
      dropdown.innerHTML = '<div class="global-search-item no-results-item">Sin resultados para "' +
        this._escapeHtml(query) + '"</div>';
      dropdown.style.display = 'block';
      return;
    }

    var self = this;
    top10.forEach(function(ticket) {
      var partesFecha = ticket.fecha.split('-');
      var fechaDisplay = partesFecha[2] + '/' + partesFecha[1] + '/' + partesFecha[0];

      var item = document.createElement('div');
      item.className = 'global-search-item';
      item.textContent = 'V-' + ticket.cedula + ' — ' + ticket.nombre + ' ' + ticket.apellido +
        ' — ' + fechaDisplay + ' — ' + (ticket.embarcacion || '—');

      // Click: navegar a la sección de búsqueda con el pasajero prefiltrado
      item.addEventListener('click', function() {
        dropdown.style.display = 'none';
        // Limpiar input global
        var globalInput = document.getElementById('search-global-input');
        if (globalInput) globalInput.value = '';

        // Navegar a búsqueda
        ASOTRANSMAR.App.navigateTo('busqueda');

        // Pre-llenar campo de búsqueda con la cédula
        var busquedaInput = document.getElementById('busqueda-input');
        if (busquedaInput) {
          busquedaInput.value = ticket.cedula;
          self.search();
        }
      });

      dropdown.appendChild(item);
    });

    // Enlace "Ver todos los resultados"
    if (results.length > 10) {
      var verTodos = document.createElement('div');
      verTodos.className = 'global-search-item global-search-more';
      verTodos.textContent = 'Ver los ' + results.length + ' resultados →';
      verTodos.addEventListener('click', function() {
        dropdown.style.display = 'none';
        var globalInput = document.getElementById('search-global-input');
        if (globalInput) globalInput.value = '';
        ASOTRANSMAR.App.navigateTo('busqueda');
        var busquedaInput = document.getElementById('busqueda-input');
        if (busquedaInput) {
          busquedaInput.value = query;
          self.search();
        }
      });
      dropdown.appendChild(verTodos);
    }

    dropdown.style.display = 'block';
  },

  /* --------------------------------------------------------
   *  debounce(fn, delay)
   *  Utilidad para limitar la frecuencia de ejecución
   * ------------------------------------------------------ */
  debounce(fn, delay) {
    var timer;
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(context, args);
      }, delay);
    };
  },

  /* --------------------------------------------------------
   *  _escapeHtml(str) — Escapa HTML para prevenir XSS
   * ------------------------------------------------------ */
  _escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
};
