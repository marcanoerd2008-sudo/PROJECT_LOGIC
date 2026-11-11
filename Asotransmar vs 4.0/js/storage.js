/**
 * ============================================================
 * ASOTRANSMAR vs 4.0 — Módulo de Almacenamiento
 * ============================================================
 * Wrapper sobre localStorage para gestionar persistencia de
 * datos: configuración, usuarios, tickets, zarpes y sesión.
 * Todas las claves usan ASOTRANSMAR.Config.KEYS.
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.Storage = (function () {
  'use strict';

  var Config = ASOTRANSMAR.Config;

  // ──────────────────────────────────────────────
  // Primitivas de acceso a localStorage
  // ──────────────────────────────────────────────

  /**
   * Lee y parsea un valor JSON desde localStorage.
   * @param {string} key - Clave de localStorage.
   * @returns {*} Valor parseado o null si no existe.
   */
  function get(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('[Storage.get] Error al leer la clave "' + key + '":', e);
      return null;
    }
  }

  /**
   * Serializa y almacena un valor en localStorage.
   * @param {string} key   - Clave de localStorage.
   * @param {*}      value - Valor a almacenar (se convierte a JSON).
   */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('[Storage.set] Error al escribir la clave "' + key + '":', e);
    }
  }

  /**
   * Elimina una clave de localStorage.
   * @param {string} key - Clave a eliminar.
   */
  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('[Storage.remove] Error al eliminar la clave "' + key + '":', e);
    }
  }

  // ──────────────────────────────────────────────
  // Gestión de Configuración / Settings
  // ──────────────────────────────────────────────

  /**
   * Obtiene los ajustes de la aplicación.
   * Si no existen en localStorage, inicializa con los valores por defecto.
   * @returns {Object} Objeto de configuración.
   */
  function getSettings() {
    var settings = get(Config.KEYS.SETTINGS);
    if (!settings) {
      // Crear copia profunda de los defaults para evitar mutaciones
      settings = JSON.parse(JSON.stringify(Config.DEFAULTS));
      set(Config.KEYS.SETTINGS, settings);
    }
    return settings;
  }

  /**
   * Guarda los ajustes de la aplicación.
   * @param {Object} settings - Objeto de configuración a persistir.
   */
  function saveSettings(settings) {
    set(Config.KEYS.SETTINGS, settings);
  }

  // ──────────────────────────────────────────────
  // Gestión de Usuarios
  // ──────────────────────────────────────────────

  /**
   * Obtiene la lista de usuarios registrados.
   * Si no existen, inicializa con Config.USUARIOS_DEFAULT.
   * @returns {Array} Lista de usuarios.
   */
  function getUsers() {
    var users = get(Config.KEYS.USERS);
    if (!users || !Array.isArray(users) || users.length === 0) {
      users = JSON.parse(JSON.stringify(Config.USUARIOS_DEFAULT));
      set(Config.KEYS.USERS, users);
    }
    return users;
  }

  // ──────────────────────────────────────────────
  // Gestión de Tickets (Boletos)
  // ──────────────────────────────────────────────

  /**
   * Obtiene todos los tickets almacenados.
   * @returns {Array} Lista de tickets (vacía si no hay datos).
   */
  function getTickets() {
    var tickets = get(Config.KEYS.TICKETS);
    return Array.isArray(tickets) ? tickets : [];
  }

  /**
   * Agrega un nuevo ticket al arreglo existente y lo persiste.
   * @param {Object} ticket - Objeto ticket a guardar.
   */
  function saveTicket(ticket) {
    var tickets = getTickets();
    tickets.push(ticket);
    set(Config.KEYS.TICKETS, tickets);
  }

  /**
   * Filtra tickets por identificador de zarpe.
   * @param {string} zarpeId - ID del zarpe.
   * @returns {Array} Tickets que pertenecen al zarpe indicado.
   */
  function getTicketsByZarpe(zarpeId) {
    return getTickets().filter(function (t) {
      return t.zarpeId === zarpeId;
    });
  }

  /**
   * Filtra tickets por fecha (formato YYYY-MM-DD).
   * @param {string} fecha - Fecha en formato ISO.
   * @returns {Array} Tickets de esa fecha.
   */
  function getTicketsByFecha(fecha) {
    return getTickets().filter(function (t) {
      return t.fecha === fecha;
    });
  }

  /**
   * Filtra tickets por cédula del pasajero.
   * @param {string} cedula - Cédula del pasajero.
   * @returns {Array} Tickets con esa cédula.
   */
  function getTicketsByCedula(cedula) {
    return getTickets().filter(function (t) {
      return t.cedula === cedula;
    });
  }

  /**
   * Búsqueda parcial e insensible a mayúsculas en cédula, nombre y apellido.
   * @param {string} query - Texto de búsqueda.
   * @returns {Array} Tickets que coincidan con la búsqueda.
   */
  function searchTickets(query) {
    if (!query || typeof query !== 'string') return [];
    var q = query.toLowerCase().trim();
    if (q === '') return [];

    return getTickets().filter(function (t) {
      var cedula   = (t.cedula   || '').toLowerCase();
      var nombre   = (t.nombre   || '').toLowerCase();
      var apellido = (t.apellido || '').toLowerCase();
      return cedula.indexOf(q) !== -1 ||
             nombre.indexOf(q) !== -1 ||
             apellido.indexOf(q) !== -1;
    });
  }

  // ──────────────────────────────────────────────
  // Gestión de Zarpes
  // ──────────────────────────────────────────────

  /**
   * Obtiene todos los zarpes almacenados.
   * @returns {Array} Lista de zarpes (vacía si no hay datos).
   */
  function getZarpes() {
    var zarpes = get(Config.KEYS.ZARPES);
    return Array.isArray(zarpes) ? zarpes : [];
  }

  /**
   * Filtra zarpes por fecha (formato YYYY-MM-DD).
   * @param {string} fecha - Fecha en formato ISO.
   * @returns {Array} Zarpes de esa fecha.
   */
  function getZarpesByFecha(fecha) {
    return getZarpes().filter(function (z) {
      return z.fecha === fecha;
    });
  }

  /**
   * Busca un zarpe específico por su ID.
   * @param {string} zarpeId - Identificador único del zarpe.
   * @returns {Object|null} El zarpe encontrado o null.
   */
  function getZarpe(zarpeId) {
    var zarpes = getZarpes();
    for (var i = 0; i < zarpes.length; i++) {
      if (zarpes[i].id === zarpeId) return zarpes[i];
    }
    return null;
  }

  /**
   * Agrega un zarpe nuevo o actualiza uno existente (buscando por id).
   * @param {Object} zarpe - Objeto zarpe a guardar/actualizar.
   */
  function saveZarpe(zarpe) {
    var zarpes = getZarpes();
    var found = false;

    for (var i = 0; i < zarpes.length; i++) {
      if (zarpes[i].id === zarpe.id) {
        zarpes[i] = zarpe;
        found = true;
        break;
      }
    }

    if (!found) {
      zarpes.push(zarpe);
    }

    set(Config.KEYS.ZARPES, zarpes);
  }

  /**
   * Obtiene todas las fechas únicas de zarpes registradas en el sistema.
   * @returns {Array<string>} Fechas en formato ISO ordenadas descendentemente.
   */
  function getAllZarpeDates() {
    var zarpes = getZarpes();
    var dates = {};
    for (var i = 0; i < zarpes.length; i++) {
      if (zarpes[i].fecha) dates[zarpes[i].fecha] = true;
    }
    return Object.keys(dates).sort().reverse();
  }

  // ──────────────────────────────────────────────
  // Gestión de Sesión
  // ──────────────────────────────────────────────

  /**
   * Obtiene la información de sesión del usuario activo.
   * @returns {Object|null} Datos de sesión o null.
   */
  function getSession() {
    return get(Config.KEYS.SESSION);
  }

  /**
   * Guarda los datos de sesión del usuario autenticado.
   * @param {Object} user - Objeto con información del usuario.
   */
  function setSession(user) {
    set(Config.KEYS.SESSION, user);
  }

  /**
   * Elimina la sesión activa.
   */
  function clearSession() {
    remove(Config.KEYS.SESSION);
  }

  // ──────────────────────────────────────────────
  // API Pública
  // ──────────────────────────────────────────────

  return {
    // Primitivas
    get:    get,
    set:    set,
    remove: remove,

    // Settings
    getSettings:  getSettings,
    saveSettings: saveSettings,

    // Usuarios
    getUsers: getUsers,

    // Tickets
    getTickets:        getTickets,
    getAllTickets:     getTickets,
    saveTicket:        saveTicket,
    getTicketsByZarpe: getTicketsByZarpe,
    getTicketsByFecha: getTicketsByFecha,
    getTicketsByCedula: getTicketsByCedula,
    searchTickets:     searchTickets,

    // Zarpes
    getZarpes:        getZarpes,
    getZarpesByFecha: getZarpesByFecha,
    getZarpe:         getZarpe,
    getZarpeById:     getZarpe,
    getAllZarpeDates: getAllZarpeDates,
    saveZarpe:        saveZarpe,

    // Sesión
    getSession:   getSession,
    setSession:   setSession,
    clearSession: clearSession
  };

})();
