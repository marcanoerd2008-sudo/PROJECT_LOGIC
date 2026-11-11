/**
 * ============================================================
 * ASOTRANSMAR vs 4.0 — Módulo de Utilidades
 * ============================================================
 * Funciones auxiliares: formateo de fechas (español), monedas,
 * generación de IDs, notificaciones toast y diálogos de
 * confirmación personalizados.
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.Utils = (function () {
  'use strict';

  // ──────────────────────────────────────────────
  // Constantes de localización
  // ──────────────────────────────────────────────

  /** Nombres de los días de la semana en español (índice 0 = Domingo). */
  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  /** Nombres de los meses en español (índice 0 = Enero). */
  var MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // ──────────────────────────────────────────────
  // Formateo de Fechas
  // ──────────────────────────────────────────────

  /**
   * Formatea un objeto Date como "DD/MM/YYYY".
   * @param {Date} date - Fecha a formatear.
   * @returns {string} Fecha en formato DD/MM/YYYY.
   */
  function formatDate(date) {
    var d  = date.getDate();
    var m  = date.getMonth() + 1;
    var y  = date.getFullYear();
    return _pad(d) + '/' + _pad(m) + '/' + y;
  }

  /**
   * Formatea un objeto Date como "YYYY-MM-DD" (ISO).
   * @param {Date} date - Fecha a formatear.
   * @returns {string} Fecha en formato ISO.
   */
  function formatDateISO(date) {
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var d = date.getDate();
    return y + '-' + _pad(m) + '-' + _pad(d);
  }

  /**
   * Convierte hora "HH:MM" (24h) a formato 12 horas con a.m./p.m.
   * @param {string} timeStr - Hora en formato "HH:MM".
   * @returns {string} Hora en formato "HH:MM a.m." o "HH:MM p.m."
   */
  function formatTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return timeStr;
    var parts  = timeStr.split(':');
    var hour   = parseInt(parts[0], 10);
    var minute = parts[1] || '00';
    var suffix = hour >= 12 ? 'p.m.' : 'a.m.';

    if (hour === 0) {
      hour = 12;
    } else if (hour > 12) {
      hour = hour - 12;
    }

    return _pad(hour) + ':' + minute + ' ' + suffix;
  }

  /**
   * Parsea una cadena "YYYY-MM-DD" a un objeto Date (hora local a medianoche).
   * @param {string} str - Fecha en formato ISO.
   * @returns {Date} Objeto Date correspondiente.
   */
  function parseDate(str) {
    if (!str) return new Date();
    var parts = str.split('-');
    // Usar constructor numérico para evitar problemas de zona horaria
    return new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    );
  }

  /**
   * Retorna la fecha de hoy como cadena "YYYY-MM-DD".
   * @returns {string} Fecha actual en formato ISO.
   */
  function today() {
    return formatDateISO(new Date());
  }

  /**
   * Retorna la fecha de hoy con formato largo en español.
   * Ejemplo: "Martes, 10 de Noviembre de 2026"
   * @returns {string} Fecha actual formateada.
   */
  function todayDisplay() {
    var now = new Date();
    var dia     = DIAS[now.getDay()];
    var numDia  = now.getDate();
    var mes     = MESES[now.getMonth()];
    var anio    = now.getFullYear();
    return dia + ', ' + numDia + ' de ' + mes + ' de ' + anio;
  }

  // ──────────────────────────────────────────────
  // Helpers de día / mes
  // ──────────────────────────────────────────────

  /**
   * Obtiene el índice del día de la semana (0 = Domingo, 6 = Sábado).
   * @param {Date} date - Fecha.
   * @returns {number} Índice del día.
   */
  function getDayOfWeek(date) {
    return date.getDay();
  }

  /**
   * Retorna el nombre del día en español.
   * @param {Date} date - Fecha.
   * @returns {string} Nombre del día.
   */
  function getDayName(date) {
    return DIAS[date.getDay()];
  }

  /**
   * Retorna el nombre del mes en español.
   * @param {number} month - Índice del mes (0–11).
   * @returns {string} Nombre del mes.
   */
  function getMonthName(month) {
    return MESES[month] || '';
  }

  // ──────────────────────────────────────────────
  // Formateo de Monedas
  // ──────────────────────────────────────────────

  /**
   * Formatea un monto como dólares: "$X.XX"
   * @param {number} amount - Monto en USD.
   * @returns {string} Monto formateado.
   */
  function formatUSD(amount) {
    var num = Number(amount) || 0;
    return '$' + num.toFixed(2);
  }

  /**
   * Formatea un monto en bolívares: "Bs. X.XX" con separador de miles.
   * @param {number} amount - Monto en VES.
   * @returns {string} Monto formateado.
   */
  function formatVES(amount) {
    var num = Number(amount) || 0;
    // Formatear con 2 decimales
    var fixed = num.toFixed(2);
    // Separar parte entera y decimal
    var parts   = fixed.split('.');
    var entero  = parts[0];
    var decimal = parts[1];

    // Agregar separador de miles (punto) al estilo venezolano
    var negative = '';
    if (entero.charAt(0) === '-') {
      negative = '-';
      entero = entero.substring(1);
    }
    var formatted = '';
    var count = 0;
    for (var i = entero.length - 1; i >= 0; i--) {
      formatted = entero.charAt(i) + formatted;
      count++;
      if (count % 3 === 0 && i > 0) {
        formatted = '.' + formatted;
      }
    }

    return 'Bs. ' + negative + formatted + ',' + decimal;
  }

  /**
   * Convierte un monto en USD a VES aplicando la tasa dada.
   * @param {number} usd  - Monto en dólares.
   * @param {number} tasa - Tasa BCV (VES por USD).
   * @returns {number} Monto en bolívares redondeado a 2 decimales.
   */
  function convertToVES(usd, tasa) {
    var result = (Number(usd) || 0) * (Number(tasa) || 0);
    return Math.round(result * 100) / 100;
  }

  // ──────────────────────────────────────────────
  // Generadores de ID
  // ──────────────────────────────────────────────

  /**
   * Genera un ID único para ticket: "TKT-{timestamp}{random4chars}"
   * @returns {string} ID de ticket.
   */
  function generateTicketId() {
    var timestamp = Date.now().toString(36);
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var random = '';
    for (var i = 0; i < 4; i++) {
      random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'TKT-' + timestamp + random;
  }

  /**
   * Genera un ID único para zarpe: "ZRP-{fecha}-{hora sin ':'}-{origen}"
   * Ejemplo: "ZRP-2026-11-10-0700-Coche"
   * @param {string} fecha  - Fecha en formato YYYY-MM-DD.
   * @param {string} hora   - Hora en formato HH:MM.
   * @param {string} origen - Puerto de origen.
   * @returns {string} ID de zarpe.
   */
  function generateZarpeId(fecha, hora, origen) {
    var horaClean = hora.replace(':', '');
    return 'ZRP-' + fecha + '-' + horaClean + '-' + origen;
  }

  // ──────────────────────────────────────────────
  // Notificación Toast
  // ──────────────────────────────────────────────

  /**
   * Muestra una notificación toast temporal en la esquina inferior derecha.
   * @param {string} message - Texto del mensaje.
   * @param {string} type    - Tipo: 'success', 'error', 'warning', 'info'.
   */
  function showToast(message, type) {
    type = type || 'info';

    // Crear contenedor de toasts si no existe
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText =
        'position:fixed;bottom:20px;right:20px;z-index:10000;' +
        'display:flex;flex-direction:column;gap:10px;pointer-events:none;';
      document.body.appendChild(container);
    }

    // Crear el toast
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.style.cssText =
      'padding:12px 20px;border-radius:8px;color:#fff;font-size:14px;' +
      'font-family:inherit;max-width:360px;box-shadow:0 4px 12px rgba(0,0,0,0.25);' +
      'pointer-events:auto;opacity:0;transform:translateX(100%);' +
      'transition:opacity 0.3s ease,transform 0.3s ease;';

    // Colores según tipo
    var colores = {
      success: '#27ae60',
      error:   '#e74c3c',
      warning: '#f39c12',
      info:    '#2980b9'
    };
    toast.style.backgroundColor = colores[type] || colores.info;

    // Iconos según tipo
    var iconos = {
      success: '✓',
      error:   '✗',
      warning: '⚠',
      info:    'ℹ'
    };
    var icono = iconos[type] || iconos.info;
    toast.textContent = icono + '  ' + message;

    container.appendChild(toast);

    // Animar entrada
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    // Auto-eliminar después de 3 segundos con animación de salida
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
        // Limpiar contenedor vacío
        if (container && container.children.length === 0) {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }
      }, 300);
    }, 3000);
  }

  // ──────────────────────────────────────────────
  // Diálogo de Confirmación Personalizado
  // ──────────────────────────────────────────────

  /**
   * Muestra un diálogo modal de confirmación con botones "Confirmar" y "Cancelar".
   * Compatible con Callback y Promise.
   * @param {string} message - Mensaje a mostrar.
   * @param {function} [callback] - Función opcional que recibe boolean.
   * @returns {Promise<boolean>} Resuelve true si confirma, false si cancela.
   */
  function showConfirm(message, callback) {
    return new Promise(function (resolve) {
      // Overlay
      var overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;' +
        'background:rgba(0,0,0,0.5);z-index:10001;' +
        'display:flex;align-items:center;justify-content:center;' +
        'opacity:0;transition:opacity 0.2s ease;';

      // Modal
      var modal = document.createElement('div');
      modal.className = 'confirm-modal';
      modal.style.cssText =
        'background:#fff;border-radius:12px;padding:30px;max-width:420px;width:90%;' +
        'box-shadow:0 8px 30px rgba(0,0,0,0.3);text-align:center;' +
        'transform:scale(0.9);transition:transform 0.2s ease;';

      // Icono de pregunta
      var icon = document.createElement('div');
      icon.style.cssText =
        'font-size:40px;margin-bottom:15px;color:#2c3e50;';
      icon.textContent = '❓';
      modal.appendChild(icon);

      // Mensaje
      var msgEl = document.createElement('p');
      msgEl.style.cssText =
        'font-size:16px;color:#2c3e50;margin:0 0 25px 0;line-height:1.5;';
      msgEl.textContent = message;
      modal.appendChild(msgEl);

      // Contenedor de botones
      var btnContainer = document.createElement('div');
      btnContainer.style.cssText =
        'display:flex;gap:12px;justify-content:center;';

      // Botón Cancelar
      var btnCancelar = document.createElement('button');
      btnCancelar.textContent = 'Cancelar';
      btnCancelar.style.cssText =
        'padding:10px 28px;border:2px solid #95a5a6;border-radius:8px;' +
        'background:#fff;color:#7f8c8d;font-size:14px;font-weight:600;' +
        'cursor:pointer;transition:all 0.2s ease;';
      btnCancelar.onmouseenter = function () {
        btnCancelar.style.background = '#ecf0f1';
      };
      btnCancelar.onmouseleave = function () {
        btnCancelar.style.background = '#fff';
      };

      // Botón Confirmar
      var btnConfirmar = document.createElement('button');
      btnConfirmar.textContent = 'Confirmar';
      btnConfirmar.style.cssText =
        'padding:10px 28px;border:none;border-radius:8px;' +
        'background:#2980b9;color:#fff;font-size:14px;font-weight:600;' +
        'cursor:pointer;transition:all 0.2s ease;';
      btnConfirmar.onmouseenter = function () {
        btnConfirmar.style.background = '#1a6fa0';
      };
      btnConfirmar.onmouseleave = function () {
        btnConfirmar.style.background = '#2980b9';
      };

      btnContainer.appendChild(btnCancelar);
      btnContainer.appendChild(btnConfirmar);
      modal.appendChild(btnContainer);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Animar entrada
      requestAnimationFrame(function () {
        overlay.style.opacity = '1';
        modal.style.transform = 'scale(1)';
      });

      /** Cierra el diálogo y resuelve la promesa / ejecuta callback. */
      function cerrar(resultado) {
        overlay.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        setTimeout(function () {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          if (typeof callback === 'function') {
            callback(resultado);
          }
          resolve(resultado);
        }, 200);
      }

      btnConfirmar.addEventListener('click', function () { cerrar(true); });
      btnCancelar.addEventListener('click', function () { cerrar(false); });

      // Cerrar con clic fuera del modal
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) cerrar(false);
      });

      // Cerrar con tecla Escape
      function onKey(e) {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', onKey);
          cerrar(false);
        }
      }
      document.addEventListener('keydown', onKey);
    });
  }

  // ──────────────────────────────────────────────
  // Helpers internos
  // ──────────────────────────────────────────────

  /**
   * Rellena un número con cero a la izquierda si es menor a 10.
   * @param {number} n - Número a rellenar.
   * @returns {string} Cadena de 2 dígitos.
   */
  function _pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  // ──────────────────────────────────────────────
  // API Pública
  // ──────────────────────────────────────────────

  return {
    // Fechas
    formatDate:    formatDate,
    formatDateISO: formatDateISO,
    formatTime:    formatTime,
    parseDate:     parseDate,
    today:         today,
    todayDisplay:  todayDisplay,

    // Día / Mes
    getDayOfWeek: getDayOfWeek,
    getDayName:   getDayName,
    getMonthName: getMonthName,

    // Monedas
    formatUSD:    formatUSD,
    formatVES:    formatVES,
    convertToVES: convertToVES,

    // IDs
    generateTicketId: generateTicketId,
    generateZarpeId:  generateZarpeId,

    // UI
    showToast:   showToast,
    showConfirm: showConfirm
  };

})();
