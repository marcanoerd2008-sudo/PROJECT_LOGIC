/**
 * ============================================================
 * ASOTRANSMAR vs 4.0 — Módulo de Configuración
 * ============================================================
 * Define TODAS las constantes y configuración de la aplicación.
 * Incluye: datos de la empresa, flota, rotaciones, horarios,
 * categorías tarifarias, valores por defecto, usuarios y
 * claves de almacenamiento.
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.Config = {
  // Company Info
  EMPRESA: 'ASOTRANSMAR C.A.',
  RIF: 'J-315369986-9',
  RUTA: 'La Isleta - Coche',

  // Fleet
  EMBARCACIONES: {
    A: 'Madhery',
    B: 'Isabel María',
    C: 'Júbilo Azul'
  },

  // Detalles oficiales de la flota activa de ASOTRANSMAR (Ruta La Isleta ↔ Coche)
  EMBARCACIONES_DETALLES: {
    'Madhery': {
      matricula: 'ARSH-PE-0941',
      capitan_titular: 'Cap. José Marcano',
      armador: 'Consorcio Armadores Coche C.A.',
      capacidad_inea: 160
    },
    'Isabel María': {
      matricula: 'ARSH-PE-0824',
      capitan_titular: 'Cap. Luis Villazana',
      armador: 'Inversiones Navieras San Pedro',
      capacidad_inea: 160
    },
    'Júbilo Azul': {
      matricula: 'ARSH-PE-1102',
      capitan_titular: 'Cap. Rafael Salazar',
      armador: 'Lancheros Unidos de Coche',
      capacidad_inea: 160
    }
  },

  // Rotation order for Mon-Sat cycles
  ROTACION_SEMANAL: [
    ['A', 'B', 'C'],  // Ciclo 1
    ['B', 'C', 'A'],  // Ciclo 2
    ['C', 'A', 'B']   // Ciclo 3
  ],

  // Sunday exclusive guard rotation
  ROTACION_DOMINGO: ['A', 'B', 'C'],  // Domingo 1: Madhery, Domingo 2: Isabel María, Domingo 3: Júbilo Azul

  // Reference date for rotation calculation (Oct 12, 2026 = Monday, Cycle 1 Day 1)
  FECHA_REFERENCIA: '2026-10-12',

  // Schedules effective from 12/10/26
  // Format: { origen: 'Coche'|'Isleta', hora: 'HH:MM' }
  HORARIOS: {
    // 0=Sunday, 1=Monday... 6=Saturday
    LUNES_JUEVES: [
      { hora: '07:00', origen: 'Coche', destino: 'La Isleta' },
      { hora: '08:00', origen: 'Coche', destino: 'La Isleta' },
      { hora: '12:00', origen: 'La Isleta', destino: 'Coche' },
      { hora: '16:00', origen: 'La Isleta', destino: 'Coche' }
    ],
    VIERNES: [
      { hora: '07:00', origen: 'Coche', destino: 'La Isleta' },
      { hora: '08:00', origen: 'Coche', destino: 'La Isleta' },
      { hora: '09:00', origen: 'La Isleta', destino: 'Coche' },
      { hora: '13:00', origen: 'La Isleta', destino: 'Coche' },
      { hora: '14:00', origen: 'Coche', destino: 'La Isleta' },
      { hora: '16:00', origen: 'La Isleta', destino: 'Coche' }
    ],
    SABADO: [
      { hora: '07:00', origen: 'Coche', destino: 'La Isleta' },
      { hora: '08:00', origen: 'Coche', destino: 'La Isleta' },
      { hora: '09:00', origen: 'La Isleta', destino: 'Coche' },
      { hora: '13:00', origen: 'La Isleta', destino: 'Coche' },
      { hora: '15:00', origen: 'Coche', destino: 'La Isleta' },
      { hora: '16:00', origen: 'La Isleta', destino: 'Coche' }
    ],
    DOMINGO: [
      { hora: '08:00', origen: 'Coche', destino: 'La Isleta' },
      { hora: '09:00', origen: 'La Isleta', destino: 'Coche' },
      { hora: '15:00', origen: 'Coche', destino: 'La Isleta' },
      { hora: '16:00', origen: 'La Isleta', destino: 'Coche' }
    ]
  },

  // Tariff categories (híbrido: array y objeto con claves REG, MPR, MPV, TUR, EXO)
  CATEGORIAS: (function () {
    var cats = [
      { codigo: 'REG', nombre: 'Regular', factor: 1.0 },
      { codigo: 'MPR', nombre: 'Medio Pasaje Residencial / Estudiantil', factor: 0.5 },
      { codigo: 'MPV', nombre: 'Medio Pasaje Vejez', factor: 0.5 },
      { codigo: 'TUR', nombre: 'Visitante / Turista', factor: 1.0 },
      { codigo: 'EXO', nombre: 'Exonerado', factor: 0.0 }
    ];
    cats.REG = cats[0];
    cats.MPR = cats[1];
    cats.MPV = cats[2];
    cats.TUR = cats[3];
    cats.EXO = cats[4];
    cats.medio = cats[1];
    cats.turista = cats[3];
    cats.exonerado = cats[4];

    var nativeFind = cats.find.bind(cats);
    cats.find = function (predicate) {
      var found = nativeFind(predicate);
      if (!found && typeof predicate === 'function') {
        if (predicate({ codigo: 'medio' })) return cats.MPR;
        if (predicate({ codigo: 'turista' })) return cats.TUR;
        if (predicate({ codigo: 'exonerado' })) return cats.EXO;
      }
      return found;
    };
    return cats;
  })(),

  // Default settings
  DEFAULTS: {
    tasa_bcv: 52.50,
    tarifa_reg_usd: 5.00,
    tarifa_medio_usd: 2.50,
    tarifa_tur_usd: 5.00,
    tarifa_exo_usd: 0.00,
    retencion_asotransmar: 10,  // percentage
    arancel_inea: 0.50,  // USD per passenger
    capacidad_max_inea: 160  // Aforo máximo legal INEA
  },

  // Default users
  USUARIOS_DEFAULT: [
    { usuario: 'admin', clave: 'admin123', rol: 'administrador', nombre: 'Administrador General' },
    { usuario: 'taquilla1', clave: 'taq123', rol: 'taquillero', nombre: 'Taquillero 1' },
    { usuario: 'taquilla2', clave: 'taq456', rol: 'taquillero', nombre: 'Taquillero 2' }
  ],

  // Storage keys
  KEYS: {
    SETTINGS: 'asotransmar_settings',
    USERS: 'asotransmar_users',
    TICKETS: 'asotransmar_tickets',
    ZARPES: 'asotransmar_zarpes',
    SESSION: 'asotransmar_session',
    THEME: 'asotransmar_theme',
    SQLITE_DB: 'asotransmar_sqlite_db'
  }
};
