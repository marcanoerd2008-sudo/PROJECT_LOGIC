/**
 * ============================================================
 * ASOTRANSMAR vs 4.0 — Módulo de Base de Datos SQLite
 * ============================================================
 * Implementa persistencia relacional con SQLite compilado a
 * WebAssembly (sql.js). Permite ejecutar sentencias SQL nativas
 * (CREATE TABLE, INSERT, SELECT, UPDATE), persistir el binario
 * en localStorage y exportar/importar archivos .sqlite reales.
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.DB = (function () {
  'use strict';

  var dbInstance = null;
  var isInitialized = false;
  var SQL = null;

  // ──────────────────────────────────────────────
  // Definición del esquema relacional SQLite
  // ──────────────────────────────────────────────
  var SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      usuario TEXT PRIMARY KEY,
      clave TEXT,
      rol TEXT,
      nombre TEXT
    );

    CREATE TABLE IF NOT EXISTS zarpes (
      id TEXT PRIMARY KEY,
      fecha TEXT,
      hora TEXT,
      origen TEXT,
      destino TEXT,
      embarcacion TEXT,
      capacidad_max INTEGER DEFAULT 160,
      estado TEXT DEFAULT 'abierto',
      capitan TEXT
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      cedula TEXT,
      nombre TEXT,
      apellido TEXT,
      categoria TEXT,
      zarpe_id TEXT,
      monto_usd REAL,
      monto_ves REAL,
      tasa_bcv REAL,
      fecha TEXT,
      hora_venta TEXT,
      taquillero TEXT,
      embarcacion TEXT,
      origen TEXT,
      destino TEXT,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_zarpe ON tickets(zarpe_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_fecha ON tickets(fecha);
    CREATE INDEX IF NOT EXISTS idx_tickets_cedula ON tickets(cedula);
  `;

  // ──────────────────────────────────────────────
  // Inicialización de SQLite WebAssembly
  // ──────────────────────────────────────────────
  async function init() {
    if (isInitialized) return true;

    try {
      if (typeof window.initSqlJs !== 'function') {
        console.warn('[SQLite] initSqlJs no encontrado en window. Usando modo de compatibilidad Storage.');
        return false;
      }

      SQL = await window.initSqlJs({
        locateFile: function (file) {
          return 'js/vendor/' + file;
        }
      });

      // Intentar cargar base de datos previamente guardada
      var savedDbBase64 = localStorage.getItem(ASOTRANSMAR.Config.KEYS.SQLITE_DB);
      if (savedDbBase64) {
        try {
          var binaryString = atob(savedDbBase64);
          var len = binaryString.length;
          var bytes = new Uint8Array(len);
          for (var i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          dbInstance = new SQL.Database(bytes);
          console.info('[SQLite] Base de datos SQLite restaurada desde almacenamiento local (' + (len / 1024).toFixed(1) + ' KB)');
        } catch (errLoad) {
          console.error('[SQLite] Error al restaurar binario SQLite, creando nueva:', errLoad);
          dbInstance = new SQL.Database();
        }
      } else {
        dbInstance = new SQL.Database();
        console.info('[SQLite] Nueva base de datos SQLite creada en memoria.');
      }

      // Crear tablas e índices
      dbInstance.run(SCHEMA_SQL);
      isInitialized = true;

      // Sincronizar datos iniciales desde Storage si SQLite está recién creada
      syncFromStorage();
      persist();

      console.info('✅ [SQLite 3] Motor de base de datos relacional inicializado correctamente.');
      return true;
    } catch (e) {
      console.error('[SQLite] Error durante la inicialización de SQLite WebAssembly:', e);
      return false;
    }
  }

  // ──────────────────────────────────────────────
  // Persistencia del binario SQLite a localStorage
  // ──────────────────────────────────────────────
  function persist() {
    if (!dbInstance || !isInitialized) return;
    try {
      var binary = dbInstance.export();
      var chunkSize = 0x8000;
      var binaryString = '';
      for (var i = 0; i < binary.length; i += chunkSize) {
        binaryString += String.fromCharCode.apply(null, binary.subarray(i, i + chunkSize));
      }
      var base64 = btoa(binaryString);
      localStorage.setItem(ASOTRANSMAR.Config.KEYS.SQLITE_DB, base64);
    } catch (e) {
      console.warn('[SQLite.persist] No se pudo persistir el binario en localStorage:', e);
    }
  }

  // ──────────────────────────────────────────────
  // Ejecución de consultas preparadas
  // ──────────────────────────────────────────────
  function run(sql, params) {
    if (!dbInstance) return;
    try {
      dbInstance.run(sql, params);
      persist();
    } catch (e) {
      console.error('[SQLite.run] Error ejecutando:', sql, params, e);
    }
  }

  function query(sql, params) {
    if (!dbInstance) return [];
    try {
      var stmt = dbInstance.prepare(sql);
      if (params) stmt.bind(params);
      var results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (e) {
      console.error('[SQLite.query] Error en consulta:', sql, params, e);
      return [];
    }
  }

  // ──────────────────────────────────────────────
  // Sincronización bidireccional con Storage
  // ──────────────────────────────────────────────
  function syncFromStorage() {
    if (!dbInstance) return;

    try {
      // 1. Sincronizar Usuarios
      var users = ASOTRANSMAR.Storage.getUsers();
      if (Array.isArray(users)) {
        users.forEach(function (u) {
          dbInstance.run(
            'INSERT OR REPLACE INTO users (usuario, clave, rol, nombre) VALUES (?, ?, ?, ?)',
            [u.usuario, u.clave, u.rol, u.nombre]
          );
        });
      }

      // 2. Sincronizar Settings
      var settings = ASOTRANSMAR.Storage.getSettings();
      if (settings) {
        Object.keys(settings).forEach(function (k) {
          dbInstance.run(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            [k, JSON.stringify(settings[k])]
          );
        });
      }

      // 3. Sincronizar Todos los Zarpes
      var zarpes = ASOTRANSMAR.Storage.getZarpes();
      if (Array.isArray(zarpes)) {
        zarpes.forEach(function (z) {
          dbInstance.run(
            'INSERT OR REPLACE INTO zarpes (id, fecha, hora, origen, destino, embarcacion, capacidad_max, estado, capitan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [z.id, z.fecha, z.hora, z.origen, z.destino, z.embarcacion, z.capacidad_max || 160, z.estado, z.capitan || '']
          );
        });
      }

      // 4. Sincronizar Tickets
      var tickets = ASOTRANSMAR.Storage.getTickets();
      if (Array.isArray(tickets)) {
        tickets.forEach(function (t) {
          dbInstance.run(
            'INSERT OR REPLACE INTO tickets (id, cedula, nombre, apellido, categoria, zarpe_id, monto_usd, monto_ves, tasa_bcv, fecha, hora_venta, taquillero, embarcacion, origen, destino, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              t.id, t.cedula, t.nombre, t.apellido, t.categoria,
              t.zarpeId || t.zarpe_id, t.monto_usd, t.monto_ves,
              t.tasa_bcv, t.fecha, t.hora_venta, t.taquillero,
              t.embarcacion, t.origen, t.destino, t.created_at || new Date().toISOString()
            ]
          );
        });
      }

      persist();
    } catch (e) {
      console.warn('[SQLite.syncFromStorage] Error durante sincronización:', e);
    }
  }

  function saveTicket(ticket) {
    if (!dbInstance) return;
    try {
      dbInstance.run(
        'INSERT OR REPLACE INTO tickets (id, cedula, nombre, apellido, categoria, zarpe_id, monto_usd, monto_ves, tasa_bcv, fecha, hora_venta, taquillero, embarcacion, origen, destino, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          ticket.id, ticket.cedula, ticket.nombre, ticket.apellido, ticket.categoria,
          ticket.zarpeId || ticket.zarpe_id, ticket.monto_usd, ticket.monto_ves,
          ticket.tasa_bcv, ticket.fecha, ticket.hora_venta, ticket.taquillero,
          ticket.embarcacion, ticket.origen, ticket.destino, ticket.created_at || new Date().toISOString()
        ]
      );
      persist();
    } catch (e) {
      console.error('[SQLite.saveTicket] Error guardando ticket:', e);
    }
  }

  function saveZarpe(zarpe) {
    if (!dbInstance) return;
    try {
      dbInstance.run(
        'INSERT OR REPLACE INTO zarpes (id, fecha, hora, origen, destino, embarcacion, capacidad_max, estado, capitan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [zarpe.id, zarpe.fecha, zarpe.hora, zarpe.origen, zarpe.destino, zarpe.embarcacion, zarpe.capacidad_max || 160, zarpe.estado, zarpe.capitan || '']
      );
      persist();
    } catch (e) {
      console.error('[SQLite.saveZarpe] Error guardando zarpe:', e);
    }
  }

  // ──────────────────────────────────────────────
  // Exportar e Importar archivos .sqlite
  // ──────────────────────────────────────────────
  function exportDatabaseFile() {
    if (!dbInstance) {
      ASOTRANSMAR.Utils.showToast('La base de datos SQLite no está disponible', 'error');
      return;
    }

    try {
      var binary = dbInstance.export();
      var blob = new Blob([binary], { type: 'application/x-sqlite3' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = 'asotransmar_db_' + now + '.sqlite';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      ASOTRANSMAR.Utils.showToast('Base de datos SQLite exportada exitosamente', 'success');
    } catch (e) {
      console.error('[SQLite.exportFile] Error exportando archivo:', e);
      ASOTRANSMAR.Utils.showToast('Error al exportar base de datos SQLite', 'error');
    }
  }

  function importDatabaseFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('Archivo no provisto'));
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var uInt8Array = new Uint8Array(this.result);
          if (dbInstance) {
            dbInstance.close();
          }
          dbInstance = new SQL.Database(uInt8Array);
          isInitialized = true;
          persist();

          // Restaurar a localStorage para compatibilidad
          var tickets = query('SELECT * FROM tickets');
          if (tickets.length > 0) {
            var formattedTickets = tickets.map(function (t) {
              return {
                id: t.id,
                cedula: t.cedula,
                nombre: t.nombre,
                apellido: t.apellido,
                categoria: t.categoria,
                zarpeId: t.zarpe_id,
                monto_usd: t.monto_usd,
                monto_ves: t.monto_ves,
                tasa_bcv: t.tasa_bcv,
                fecha: t.fecha,
                hora_venta: t.hora_venta,
                taquillero: t.taquillero,
                embarcacion: t.embarcacion,
                origen: t.origen,
                destino: t.destino
              };
            });
            localStorage.setItem(ASOTRANSMAR.Config.KEYS.TICKETS, JSON.stringify(formattedTickets));
          }

          var zarpes = query('SELECT * FROM zarpes');
          if (zarpes.length > 0) {
            localStorage.setItem(ASOTRANSMAR.Config.KEYS.ZARPES, JSON.stringify(zarpes));
          }

          ASOTRANSMAR.Utils.showToast('Base de datos SQLite importada correctamente', 'success');
          resolve(true);
        } catch (err) {
          console.error('[SQLite.importFile] Error parseando archivo:', err);
          ASOTRANSMAR.Utils.showToast('El archivo no es una base de datos SQLite válida', 'error');
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // ──────────────────────────────────────────────
  // Estadísticas de la base de datos
  // ──────────────────────────────────────────────
  function getStats() {
    if (!dbInstance) {
      return { active: false, tickets: 0, zarpes: 0, users: 0, sizeKb: 0 };
    }
    try {
      var tCount = query('SELECT COUNT(*) as c FROM tickets')[0].c;
      var zCount = query('SELECT COUNT(*) as c FROM zarpes')[0].c;
      var uCount = query('SELECT COUNT(*) as c FROM users')[0].c;
      var binary = dbInstance.export();
      return {
        active: true,
        tickets: tCount,
        zarpes: zCount,
        users: uCount,
        sizeKb: (binary.length / 1024).toFixed(1)
      };
    } catch (e) {
      return { active: true, tickets: 0, zarpes: 0, users: 0, sizeKb: 0 };
    }
  }

  // API Pública
  return {
    init: init,
    isReady: function () { return isInitialized && dbInstance !== null; },
    run: run,
    query: query,
    saveTicket: saveTicket,
    saveZarpe: saveZarpe,
    persist: persist,
    syncFromStorage: syncFromStorage,
    exportDatabaseFile: exportDatabaseFile,
    importDatabaseFile: importDatabaseFile,
    getStats: getStats
  };
})();

