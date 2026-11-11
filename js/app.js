/**
 * ============================================================
 *  ASOTRANSMAR vs 4.0 — Controlador Principal de la Aplicación
 * ============================================================
 *  Punto de entrada que conecta todos los módulos:
 *  Auth, Sales, Manifest, Search, Settlement, Schedules.
 *  Maneja login, navegación, dashboard y ciclo de vida de la SPA.
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.App = {

  /** Sección actualmente visible */
  currentSection: 'dashboard',

  /** Referencia al intervalo de auto-refresco */
  _refreshInterval: null,

  /* --------------------------------------------------------
   *  init() — Bootstrap de la aplicación
   *  Ejecutado al cargar el DOM (DOMContentLoaded)
   * ------------------------------------------------------ */
  init() {
    // Verificar si hay una sesión activa
    var user = ASOTRANSMAR.Auth.init();
    if (user) {
      this.showApp(user);
    } else {
      this.showLogin();
    }

    // Configurar formulario de login
    var btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      btnLogin.addEventListener('click', () => this.handleLogin());
    }

    var loginPass = document.getElementById('login-pass');
    if (loginPass) {
      loginPass.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleLogin();
      });
    }

    // También permitir Enter en el campo de usuario
    var loginUser = document.getElementById('login-user');
    if (loginUser) {
      loginUser.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleLogin();
      });
    }
  },

  /* --------------------------------------------------------
   *  handleLogin()
   *  Procesa el intento de inicio de sesión
   * ------------------------------------------------------ */
  handleLogin() {
    var usuario = (document.getElementById('login-user').value || '').trim();
    var clave = document.getElementById('login-pass').value || '';
    var errorEl = document.getElementById('login-error');

    // Validación básica
    if (!usuario) {
      if (errorEl) {
        errorEl.textContent = 'Ingrese su nombre de usuario';
        errorEl.style.display = 'block';
      }
      return;
    }
    if (!clave) {
      if (errorEl) {
        errorEl.textContent = 'Ingrese su contraseña';
        errorEl.style.display = 'block';
      }
      return;
    }

    var result = ASOTRANSMAR.Auth.login(usuario, clave);
    if (result.success) {
      if (errorEl) errorEl.style.display = 'none';
      this.showApp(result.user);
    } else {
      if (errorEl) {
        errorEl.textContent = result.message;
        errorEl.style.display = 'block';
      }
      // Limpiar campo de contraseña por seguridad
      document.getElementById('login-pass').value = '';
    }
  },

  /* --------------------------------------------------------
   *  showLogin()
   *  Muestra la pantalla de login y oculta la app principal
   * ------------------------------------------------------ */
  showLogin() {
    var loginScreen = document.getElementById('login-screen');
    var mainApp = document.getElementById('main-app');
    var errorEl = document.getElementById('login-error');

    if (loginScreen) {
      loginScreen.style.display = 'flex';
      loginScreen.classList.remove('hidden');
    }
    if (mainApp) {
      mainApp.style.display = 'none';
      mainApp.classList.add('hidden');
    }

    // Limpiar campos
    var userInput = document.getElementById('login-user');
    var passInput = document.getElementById('login-pass');
    if (userInput) userInput.value = '';
    if (passInput) passInput.value = '';
    if (errorEl) errorEl.style.display = 'none';

    // Detener auto-refresco
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }

    // Enfocar campo de usuario
    if (userInput && typeof userInput.focus === 'function') {
      setTimeout(function() { userInput.focus(); }, 100);
    }
  },

  /* --------------------------------------------------------
   *  showApp(user)
   *  Muestra la aplicación principal tras un login exitoso
   * ------------------------------------------------------ */
  showApp(user) {
    var loginScreen = document.getElementById('login-screen');
    var mainApp = document.getElementById('main-app');

    if (loginScreen) {
      loginScreen.style.display = 'none';
      loginScreen.classList.add('hidden');
    }
    if (mainApp) {
      mainApp.style.display = 'block';
      mainApp.classList.remove('hidden');
    }

    // Actualizar header con información del usuario
    this.updateHeader(user);

    // Configurar navegación
    this.setupNavigation();

    // Configurar botón de cerrar sesión
    var btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      // Clonar para remover listeners previos
      var nuevoBtn = btnLogout.cloneNode(true);
      btnLogout.parentNode.replaceChild(nuevoBtn, btnLogout);
      nuevoBtn.addEventListener('click', () => {
        ASOTRANSMAR.Auth.logout();
        this.showLogin();
        ASOTRANSMAR.Utils.showToast('Sesión cerrada correctamente', 'info');
      });
    }

    // Configurar control de tasa BCV (solo admin)
    this.setupBCVControl(user);

    // Configurar búsqueda global
    this.setupGlobalSearch();

    // Inicializar zarpes del día
    var today = ASOTRANSMAR.Utils.today();
    ASOTRANSMAR.Schedules.ensureTodayZarpes(today);

    // Aplicar visibilidad según rol
    this.applyRoleVisibility(user);

    // Navegar al dashboard
    this.navigateTo('dashboard');

    // Iniciar auto-refresco cada 60 segundos
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
    }
    var self = this;
    this._refreshInterval = setInterval(function() {
      self.refreshActiveInfo();
    }, 60000);
  },

  /* --------------------------------------------------------
   *  updateHeader(user)
   *  Actualiza los elementos informativos del header
   * ------------------------------------------------------ */
  updateHeader(user) {
    var today = ASOTRANSMAR.Utils.today();

    // Fecha actual formateada
    var elFecha = document.getElementById('header-fecha');
    if (elFecha) elFecha.textContent = ASOTRANSMAR.Utils.todayDisplay();

    // Buque activo del turno
    var elBuque = document.getElementById('buque-activo');
    if (elBuque) {
      var activeBoat = ASOTRANSMAR.Schedules.getActiveBoat(today);
      elBuque.textContent = activeBoat || '—';
    }

    // Próximo zarpe
    var elProximo = document.getElementById('proximo-zarpe');
    if (elProximo) {
      var nextDep = ASOTRANSMAR.Schedules.getNextDeparture(today);
      if (nextDep) {
        elProximo.textContent = nextDep.hora + ' ' + nextDep.origen + ' → ' + nextDep.destino;
      } else {
        elProximo.textContent = 'No hay zarpes pendientes';
      }
    }

    // Tasa BCV
    var settings = ASOTRANSMAR.Storage.getSettings();
    var elTasa = document.getElementById('tasa-bcv-display');
    if (elTasa) elTasa.textContent = (settings.tasa_bcv || 0).toFixed(2);

    // Info del usuario
    var elUserInfo = document.getElementById('user-info');
    var elUserRol = document.getElementById('user-rol');

    if (elUserInfo) elUserInfo.textContent = user.nombre || user.usuario;
    if (elUserRol) {
      elUserRol.textContent = user.rol === 'administrador' ? 'Admin' : 'Taquillero';
    }
  },

  /* --------------------------------------------------------
   *  setupNavigation()
   *  Configura los botones de navegación lateral/superior
   * ------------------------------------------------------ */
  setupNavigation() {
    var self = this;
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      // Clonar para evitar duplicación de listeners
      var nuevoBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(nuevoBtn, btn);
      nuevoBtn.addEventListener('click', function() {
        var section = nuevoBtn.dataset.section;
        if (section) {
          self.navigateTo(section);
        }
      });
    });
  },

  /* --------------------------------------------------------
   *  navigateTo(section)
   *  Navega a una sección de la SPA
   * ------------------------------------------------------ */
  navigateTo(section) {
    // Ocultar todas las secciones
    document.querySelectorAll('#content > section').forEach(function(s) {
      s.style.display = 'none';
      s.classList.add('hidden');
      s.classList.remove('fade-in');
    });

    // Mostrar la sección destino
    var target = document.getElementById('sec-' + section);
    if (target) {
      target.style.display = 'block';
      target.classList.remove('hidden');
      // Forzar reflow para que la animación se aplique
      void target.offsetWidth;
      target.classList.add('fade-in');
    }

    // Actualizar botón de navegación activo
    document.querySelectorAll('.nav-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    var activeBtn = document.querySelector('.nav-btn[data-section="' + section + '"]');
    if (activeBtn) activeBtn.classList.add('active');

    this.currentSection = section;

    // Inicializar módulo específico de la sección
    switch (section) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'venta':
        ASOTRANSMAR.Sales.init();
        break;
      case 'listin':
        ASOTRANSMAR.Manifest.init();
        break;
      case 'busqueda':
        ASOTRANSMAR.Search.init();
        break;
      case 'admin':
        ASOTRANSMAR.Settlement.init();
        break;
    }
  },

  /* --------------------------------------------------------
   *  loadDashboard()
   *  Carga el panel principal con horarios y estadísticas
   * ------------------------------------------------------ */
  loadDashboard() {
    var today = ASOTRANSMAR.Utils.today();
    var schedule = ASOTRANSMAR.Schedules.getTodaySchedule(today);

    // ---- Poblar tabla de horarios del día ----
    var tbody = document.getElementById('horarios-hoy-body');
    if (tbody) {
      tbody.innerHTML = '';

      if (schedule && schedule.length > 0) {
        schedule.forEach(function(dep) {
          var tr = document.createElement('tr');

          // Determinar clase y texto del estado
          var statusClass, statusText;
          if (dep.estado === 'cerrado') {
            statusClass = 'badge-cerrado';
            statusText = 'Cerrado';
          } else if (dep.estado === 'proximo') {
            statusClass = 'badge-proximo';
            statusText = 'Próximo';
          } else {
            statusClass = 'badge-abierto';
            statusText = 'Abierto';
          }

          tr.innerHTML = '' +
            '<td>' + dep.hora + '</td>' +
            '<td>' + dep.origen + '</td>' +
            '<td>' + dep.destino + '</td>' +
            '<td><strong>' + dep.embarcacion + '</strong></td>' +
            '<td><span class="badge ' + statusClass + '">' + statusText + '</span></td>';
          tbody.appendChild(tr);
        });
      } else {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="5" class="text-center text-muted">No hay zarpes programados para hoy</td>';
        tbody.appendChild(tr);
      }
    }

    // ---- Actualizar tarjetas de resumen ----
    var tickets = ASOTRANSMAR.Storage.getTicketsByFecha(today);
    var zarpes = ASOTRANSMAR.Storage.getZarpesByFecha(today);

    // Tarjeta: Zarpes del día
    var cardZarpes = document.getElementById('card-zarpes-hoy');
    if (cardZarpes) {
      var valEl = cardZarpes.querySelector('.card-value');
      if (valEl) valEl.textContent = zarpes.length;
    }

    // Tarjeta: Pasajeros del día
    var cardPasajeros = document.getElementById('card-pasajeros-hoy');
    if (cardPasajeros) {
      var valEl = cardPasajeros.querySelector('.card-value');
      if (valEl) valEl.textContent = tickets.length;
    }

    // Tarjeta: Recaudación del día
    var recaudacion = tickets.reduce(function(sum, t) { return sum + (t.monto_ves || 0); }, 0);
    var cardRecaudacion = document.getElementById('card-recaudacion-hoy');
    if (cardRecaudacion) {
      var valEl = cardRecaudacion.querySelector('.card-value');
      if (valEl) valEl.textContent = ASOTRANSMAR.Utils.formatVES(recaudacion);
    }

    // Tarjeta: Buque de turno
    var activeBoat = ASOTRANSMAR.Schedules.getActiveBoat(today);
    var cardBuque = document.getElementById('card-buque-turno');
    if (cardBuque) {
      var valEl = cardBuque.querySelector('.card-value');
      if (valEl) valEl.textContent = activeBoat || '—';
    }
  },

  /* --------------------------------------------------------
   *  setupBCVControl(user)
   *  Configura el control rápido de tasa BCV (solo admin)
   * ------------------------------------------------------ */
  setupBCVControl(user) {
    var input = document.getElementById('tasa-bcv-input');
    var btn = document.getElementById('btn-guardar-tasa');

    if (!input || !btn) return;

    if (user.rol === 'administrador') {
      var settings = ASOTRANSMAR.Storage.getSettings();
      input.value = settings.tasa_bcv || 0;
      input.disabled = false;
      btn.style.display = '';

      // Clonar botón para remover listeners previos
      var nuevoBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(nuevoBtn, btn);

      nuevoBtn.addEventListener('click', function() {
        var newRate = parseFloat(input.value);
        if (isNaN(newRate) || newRate <= 0) {
          ASOTRANSMAR.Utils.showToast('Tasa BCV inválida. Debe ser un número mayor que cero.', 'error');
          return;
        }
        var settings = ASOTRANSMAR.Storage.getSettings();
        settings.tasa_bcv = newRate;
        settings.fecha_tasa = ASOTRANSMAR.Utils.today();
        ASOTRANSMAR.Storage.saveSettings(settings);

        var displayEl = document.getElementById('tasa-bcv-display');
        if (displayEl) displayEl.textContent = newRate.toFixed(2);

        ASOTRANSMAR.Utils.showToast('Tasa BCV actualizada: ' + newRate.toFixed(2), 'success');
      });
    } else {
      // Taquillero: deshabilitar edición
      input.disabled = true;
      btn.style.display = 'none';
    }
  },

  /* --------------------------------------------------------
   *  applyRoleVisibility(user)
   *  Muestra/oculta elementos según el rol del usuario
   * ------------------------------------------------------ */
  applyRoleVisibility(user) {
    var isAdmin = user && user.rol === 'administrador';
    if (isAdmin) {
      document.body.classList.add('is-admin');
    } else {
      document.body.classList.remove('is-admin');
    }

    var adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(function(el) {
      if (isAdmin) {
        el.style.display = '';
        el.classList.remove('hidden');
      } else {
        el.style.display = 'none';
        el.classList.add('hidden');
      }
    });
  },

  /* --------------------------------------------------------
   *  setupGlobalSearch()
   *  Configura la barra de búsqueda global del header
   * ------------------------------------------------------ */
  setupGlobalSearch() {
    var input = document.getElementById('search-global-input');
    if (!input) return;

    // Listener con debounce para búsqueda global
    var debouncedGlobal = ASOTRANSMAR.Search.debounce(function(e) {
      var query = (e.target.value || '').trim();
      ASOTRANSMAR.Search.globalSearch(query);
    }, 300);

    // Clonar input para remover listeners previos
    var nuevoInput = input.cloneNode(true);
    input.parentNode.replaceChild(nuevoInput, input);

    nuevoInput.addEventListener('input', debouncedGlobal);

    // Ocultar dropdown al hacer click fuera
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#search-bar-global')) {
        var dropdown = document.getElementById('search-global-results');
        if (dropdown) dropdown.style.display = 'none';
      }
    });

    // Tecla Escape cierra el dropdown
    nuevoInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var dropdown = document.getElementById('search-global-results');
        if (dropdown) dropdown.style.display = 'none';
        nuevoInput.value = '';
      }
    });
  },

  /* --------------------------------------------------------
   *  refreshActiveInfo()
   *  Actualiza información en tiempo real (llamada periódica)
   * ------------------------------------------------------ */
  refreshActiveInfo() {
    var today = ASOTRANSMAR.Utils.today();

    // Actualizar buque activo
    var elBuque = document.getElementById('buque-activo');
    if (elBuque) {
      var activeBoat = ASOTRANSMAR.Schedules.getActiveBoat(today);
      elBuque.textContent = activeBoat || '—';
    }

    // Actualizar próximo zarpe
    var elProximo = document.getElementById('proximo-zarpe');
    if (elProximo) {
      var nextDep = ASOTRANSMAR.Schedules.getNextDeparture(today);
      if (nextDep) {
        elProximo.textContent = nextDep.hora + ' ' + nextDep.origen + ' → ' + nextDep.destino;
      } else {
        elProximo.textContent = 'No hay zarpes pendientes';
      }
    }

    // Actualizar fecha (por si cambia de día sin recargar)
    var elFecha = document.getElementById('header-fecha');
    if (elFecha) elFecha.textContent = ASOTRANSMAR.Utils.todayDisplay();

    // Si estamos en el dashboard, refrescarlo también
    if (this.currentSection === 'dashboard') {
      this.loadDashboard();
    }
  }
};

/* ==============================================================
 *  Bootstrap — Inicializar la aplicación cuando el DOM esté listo
 * ============================================================== */
document.addEventListener('DOMContentLoaded', function() {
  ASOTRANSMAR.App.init();
});
