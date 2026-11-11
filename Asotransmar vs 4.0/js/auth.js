/**
 * ============================================================
 * ASOTRANSMAR vs 4.0 — Módulo de Autenticación
 * ============================================================
 * Gestiona inicio de sesión, cierre de sesión, verificación
 * de roles y restauración de sesión persistente.
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.Auth = (function () {
  'use strict';

  var Storage = ASOTRANSMAR.Storage;

  /** Usuario actualmente autenticado (null si no hay sesión). */
  var currentUser = null;

  // ──────────────────────────────────────────────
  // Inicialización
  // ──────────────────────────────────────────────

  /**
   * Verifica si existe una sesión previa en localStorage.
   * Si la encuentra, restaura currentUser.
   * @returns {Object|null} Datos del usuario restaurado o null.
   */
  function init() {
    var session = Storage.getSession();
    if (session && session.usuario) {
      // Verificar que el usuario todavía exista en la lista de usuarios
      var users = Storage.getUsers();
      var found = null;
      for (var i = 0; i < users.length; i++) {
        if (users[i].usuario === session.usuario) {
          found = users[i];
          break;
        }
      }

      if (found) {
        // Restaurar sesión (sin incluir la clave en currentUser)
        currentUser = {
          usuario: found.usuario,
          nombre:  found.nombre,
          rol:     found.rol
        };
        return currentUser;
      } else {
        // El usuario de la sesión ya no existe; limpiar
        Storage.clearSession();
        currentUser = null;
        return null;
      }
    }

    currentUser = null;
    return null;
  }

  // ──────────────────────────────────────────────
  // Inicio de sesión
  // ──────────────────────────────────────────────

  /**
   * Valida credenciales contra la lista de usuarios almacenada.
   * @param {string} usuario - Nombre de usuario.
   * @param {string} clave   - Contraseña.
   * @returns {Object} Resultado: { success: boolean, user?: Object, message?: string }
   */
  function login(usuario, clave) {
    if (!usuario || !clave) {
      return { success: false, message: 'Debe ingresar usuario y contraseña' };
    }

    var users = Storage.getUsers();
    var found = null;

    for (var i = 0; i < users.length; i++) {
      if (users[i].usuario === usuario && users[i].clave === clave) {
        found = users[i];
        break;
      }
    }

    if (!found) {
      return { success: false, message: 'Credenciales incorrectas' };
    }

    // Establecer sesión (sin exponer la clave)
    currentUser = {
      usuario: found.usuario,
      nombre:  found.nombre,
      rol:     found.rol
    };

    Storage.setSession(currentUser);

    return { success: true, user: currentUser };
  }

  // ──────────────────────────────────────────────
  // Cierre de sesión
  // ──────────────────────────────────────────────

  /**
   * Cierra la sesión actual: limpia usuario en memoria y en localStorage.
   */
  function logout() {
    currentUser = null;
    Storage.clearSession();
  }

  // ──────────────────────────────────────────────
  // Verificación de roles
  // ──────────────────────────────────────────────

  /**
   * Verifica si el usuario actual tiene rol de administrador.
   * @returns {boolean}
   */
  function isAdmin() {
    return currentUser !== null && currentUser.rol === 'administrador';
  }

  /**
   * Verifica si el usuario actual tiene rol de taquillero.
   * @returns {boolean}
   */
  function isTaquillero() {
    return currentUser !== null && currentUser.rol === 'taquillero';
  }

  /**
   * Verifica si hay un usuario autenticado.
   * @returns {boolean}
   */
  function isLoggedIn() {
    return currentUser !== null;
  }

  // ──────────────────────────────────────────────
  // Acceso al usuario actual
  // ──────────────────────────────────────────────

  /**
   * Retorna el objeto del usuario actualmente autenticado.
   * @returns {Object|null} Datos del usuario o null.
   */
  function getCurrentUser() {
    return currentUser;
  }

  // ──────────────────────────────────────────────
  // API Pública
  // ──────────────────────────────────────────────

  return {
    currentUser:    currentUser,  // Expuesto como propiedad (lectura inicial)
    init:           init,
    login:          login,
    logout:         logout,
    isAdmin:        isAdmin,
    isTaquillero:   isTaquillero,
    isLoggedIn:     isLoggedIn,
    getCurrentUser: getCurrentUser
  };

})();
