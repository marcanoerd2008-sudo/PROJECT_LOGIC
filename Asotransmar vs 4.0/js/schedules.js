/**
 * ============================================================
 * ASOTRANSMAR vs 4.0 — Motor de Horarios y Rotación de Flota
 * ============================================================
 * Módulo CRÍTICO que calcula:
 *   1. Qué horario aplica según el día de la semana.
 *   2. Qué ciclo de rotación de embarcaciones corresponde a cada fecha.
 *   3. Qué embarcación cubre cada zarpe del día.
 *   4. Estado de cada zarpe (cerrado / próximo / abierto).
 *
 * ─── LÓGICA DE ROTACIÓN ────────────────────────────────────
 *
 * Fecha de referencia: Lunes 12 de Octubre de 2026
 *   → Día 0 del Ciclo 0 (Ciclo 1 en términos humanos).
 *
 * LUNES A SÁBADO (días laborales):
 *   Se cuentan los días Lun-Sáb transcurridos desde la referencia
 *   (excluyendo domingos). El índice de ciclo es:
 *       cycle_index = díasLaborales % 3
 *   Se usa ROTACION_SEMANAL[cycle_index] para obtener el orden
 *   de embarcaciones del día.
 *
 * DOMINGOS:
 *   Se ubica el primer domingo ≥ fecha de referencia (18/10/2026).
 *   Se cuentan los domingos desde ese punto hasta el domingo dado.
 *       sunday_cycle = contadorDomingos % 3
 *   Se usa ROTACION_DOMINGO[sunday_cycle] para obtener la ÚNICA
 *   embarcación que opera ese domingo (guardia exclusiva).
 *
 * Dentro de un día, los zarpes se asignan cíclicamente con el
 * arreglo de rotación (3 embarcaciones para Lun-Sáb, 1 para Dom).
 * ============================================================
 */
window.ASOTRANSMAR = window.ASOTRANSMAR || {};

ASOTRANSMAR.Schedules = (function () {
  'use strict';

  var Config = ASOTRANSMAR.Config;
  var Utils  = ASOTRANSMAR.Utils;

  // ──────────────────────────────────────────────
  // Constantes internas
  // ──────────────────────────────────────────────

  /** Fecha de referencia como objeto Date (Lunes 12/10/2026). */
  var REFERENCIA = Utils.parseDate(Config.FECHA_REFERENCIA);

  /**
   * Primer domingo ≥ fecha de referencia.
   * Oct 12, 2026 es Lunes → primer domingo = Oct 18, 2026.
   */
  var PRIMER_DOMINGO = (function () {
    var d = new Date(REFERENCIA.getTime());
    // Avanzar hasta el próximo domingo
    while (d.getDay() !== 0) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  })();

  // ──────────────────────────────────────────────
  // Obtener horario del día
  // ──────────────────────────────────────────────

  /**
   * Retorna el bloque de horarios (array de salidas) correspondiente
   * al día de la semana de la fecha dada.
   *
   * @param {string} fecha - Fecha en formato "YYYY-MM-DD".
   * @returns {Array<Object>} Arreglo de { hora, origen, destino }.
   */
  function getScheduleForDate(fecha) {
    var date = Utils.parseDate(fecha);
    var dow  = date.getDay(); // 0=Domingo … 6=Sábado

    switch (dow) {
      case 0: return Config.HORARIOS.DOMINGO;
      case 5: return Config.HORARIOS.VIERNES;
      case 6: return Config.HORARIOS.SABADO;
      default:
        // Lunes (1) a Jueves (4)
        return Config.HORARIOS.LUNES_JUEVES;
    }
  }

  // ──────────────────────────────────────────────
  // Cálculo de rotación
  // ──────────────────────────────────────────────

  /**
   * Calcula el arreglo de rotación de embarcaciones para una fecha dada.
   *
   * Para Lunes-Sábado:
   *   Retorna un arreglo de 3 letras de embarcación en el orden del ciclo.
   *   Ejemplo Ciclo 1: ['A', 'B', 'C'] → [Madhery, Isabel María, Júbilo Azul]
   *
   * Para Domingo:
   *   Retorna un arreglo con UNA sola letra (la embarcación de guardia).
   *   Ejemplo Domingo ciclo 0: ['A'] → solo Madhery.
   *
   * @param {string} fecha - Fecha en formato "YYYY-MM-DD".
   * @returns {Array<string>} Letras de embarcación en orden de rotación.
   */
  function getRotationForDate(fecha) {
    var date = Utils.parseDate(fecha);
    var dow  = date.getDay();

    if (dow === 0) {
      // ── DOMINGO ──
      // Contar domingos desde PRIMER_DOMINGO hasta este domingo.
      // PRIMER_DOMINGO = Oct 18, 2026 (domingo 0).
      var sundayCount = countSundays(PRIMER_DOMINGO, date);
      var sundayCycle = sundayCount % 3;
      // Retornar como arreglo de un solo elemento
      return [Config.ROTACION_DOMINGO[sundayCycle]];
    }

    // ── LUNES A SÁBADO ──
    // Contar días laborales (Lun-Sáb) desde la fecha de referencia
    // hasta la fecha dada (inclusive). La referencia es día 0.
    var workingDays = countWorkingDays(REFERENCIA, date);
    var cycleIndex  = workingDays % 3;
    // Retornar copia del arreglo de rotación para evitar mutaciones
    return Config.ROTACION_SEMANAL[cycleIndex].slice();
  }

  // ──────────────────────────────────────────────
  // Asignación de embarcación por zarpe
  // ──────────────────────────────────────────────

  /**
   * Obtiene el nombre de la embarcación asignada a un zarpe específico.
   *
   * @param {string} fecha           - Fecha en formato "YYYY-MM-DD".
   * @param {number} departureIndex  - Índice del zarpe dentro del horario del día.
   * @returns {string} Nombre de la embarcación (e.g., "Madhery").
   */
  function getBoatForDeparture(fecha, departureIndex) {
    var rotation = getRotationForDate(fecha);

    if (rotation.length === 1) {
      // Domingo: una sola embarcación para todos los zarpes
      return Config.EMBARCACIONES[rotation[0]];
    }

    // Lunes-Sábado: asignar cíclicamente
    var boatKey = rotation[departureIndex % rotation.length];
    return Config.EMBARCACIONES[boatKey];
  }

  // ──────────────────────────────────────────────
  // Horario completo del día con asignaciones
  // ──────────────────────────────────────────────

  /**
   * Construye el horario completo del día con embarcaciones asignadas
   * y estado de cada zarpe según la hora actual.
   *
   * Estados posibles:
   *   - 'cerrado'  → la hora del zarpe ya pasó.
   *   - 'proximo'  → es el siguiente zarpe por salir.
   *   - 'abierto'  → zarpe futuro (posterior al próximo).
   *
   * @param {string} fecha - Fecha en formato "YYYY-MM-DD".
   * @returns {Array<Object>} Arreglo de objetos de zarpe:
   *   { hora, origen, destino, embarcacion, zarpeId, estado }
   */
  function getTodaySchedule(fecha) {
    var schedule = getScheduleForDate(fecha);
    var rotation = getRotationForDate(fecha);
    var now      = new Date();
    var esHoy    = (Utils.formatDateISO(now) === fecha);

    // Hora actual en minutos para comparación
    var currentMinutes = esHoy ? (now.getHours() * 60 + now.getMinutes()) : -1;

    var result       = [];
    var proximoFound = false;

    for (var i = 0; i < schedule.length; i++) {
      var dep = schedule[i];

      // Calcular embarcación asignada
      var embarcacion;
      if (rotation.length === 1) {
        // Domingo: misma embarcación para todos
        embarcacion = Config.EMBARCACIONES[rotation[0]];
      } else {
        // Lun-Sáb: rotación cíclica
        var boatKey = rotation[i % rotation.length];
        embarcacion = Config.EMBARCACIONES[boatKey];
      }

      // Generar ID de zarpe
      var zarpeId = Utils.generateZarpeId(fecha, dep.hora, dep.origen);

      // Determinar estado
      var estado = 'abierto';
      if (esHoy) {
        var parts      = dep.hora.split(':');
        var depMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

        if (depMinutes <= currentMinutes) {
          estado = 'cerrado';
        } else if (!proximoFound) {
          estado = 'proximo';
          proximoFound = true;
        } else {
          estado = 'abierto';
        }
      }
      // Si no es hoy, todos quedan como 'abierto' (fecha futura)
      // o todos como 'cerrado' (fecha pasada)
      if (!esHoy) {
        var targetDate = Utils.parseDate(fecha);
        var todayDate  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (targetDate < todayDate) {
          estado = 'cerrado';
        } else {
          estado = 'abierto';
        }
      }

      result.push({
        hora:         dep.hora,
        origen:       dep.origen,
        destino:      dep.destino,
        embarcacion:  embarcacion,
        zarpeId:      zarpeId,
        estado:       estado
      });
    }

    return result;
  }

  // ──────────────────────────────────────────────
  // Próximo zarpe
  // ──────────────────────────────────────────────

  /**
   * Busca el próximo zarpe por salir (estado 'proximo' o primer 'abierto').
   *
   * @param {string} fecha - Fecha en formato "YYYY-MM-DD".
   * @returns {Object|null} Objeto de zarpe o null si todos ya pasaron.
   */
  function getNextDeparture(fecha) {
    var schedule = getTodaySchedule(fecha);
    for (var i = 0; i < schedule.length; i++) {
      if (schedule[i].estado === 'proximo' || schedule[i].estado === 'abierto') {
        return schedule[i];
      }
    }
    return null;
  }

  // ──────────────────────────────────────────────
  // Embarcación activa
  // ──────────────────────────────────────────────

  /**
   * Retorna el nombre de la embarcación del próximo zarpe.
   *
   * @param {string} fecha - Fecha en formato "YYYY-MM-DD".
   * @returns {string} Nombre de la embarcación o 'Sin zarpes pendientes'.
   */
  function getActiveBoat(fecha) {
    var next = getNextDeparture(fecha);
    return next ? next.embarcacion : 'Sin zarpes pendientes';
  }

  // ──────────────────────────────────────────────
  // Inicialización de zarpes en almacenamiento
  // ──────────────────────────────────────────────

  /**
   * Asegura que existan registros de zarpe en Storage para cada
   * salida programada del día. Se ejecuta al iniciar la app y
   * cuando cambia la fecha.
   *
   * Cada zarpe se crea con:
   *   { id, fecha, hora, origen, destino, embarcacion,
   *     pasajeros: [], estado: 'abierto', taquillero: '' }
   *
   * @param {string} fecha - Fecha en formato "YYYY-MM-DD".
   */
  function ensureTodayZarpes(fecha) {
    var Storage  = ASOTRANSMAR.Storage;
    var schedule = getTodaySchedule(fecha);

    for (var i = 0; i < schedule.length; i++) {
      var dep    = schedule[i];
      var zarpeId = dep.zarpeId;

      // Solo crear si no existe
      var existing = Storage.getZarpe(zarpeId);
      if (!existing) {
        var zarpe = {
          id:          zarpeId,
          fecha:       fecha,
          hora:        dep.hora,
          origen:      dep.origen,
          destino:     dep.destino,
          embarcacion: dep.embarcacion,
          pasajeros:   [],
          estado:      'abierto',
          taquillero:  ''
        };
        Storage.saveZarpe(zarpe);
      }
    }
  }

  // ──────────────────────────────────────────────
  // Conteo de días laborales (Lun-Sáb)
  // ──────────────────────────────────────────────

  /**
   * Cuenta los días laborales (Lunes a Sábado, excluyendo Domingos)
   * desde fromDate hasta toDate.
   *
   * fromDate se considera día 0 (no se cuenta). Se cuentan los días
   * posteriores a fromDate hasta toDate inclusive.
   *
   * Si toDate < fromDate, retorna un valor negativo.
   *
   * @param {Date} fromDate - Fecha de inicio (día 0).
   * @param {Date} toDate   - Fecha final.
   * @returns {number} Cantidad de días laborales entre ambas fechas.
   */
  function countWorkingDays(fromDate, toDate) {
    // Normalizar a medianoche para comparación limpia
    var from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    var to   = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

    // Calcular diferencia en días calendario
    var diffMs   = to.getTime() - from.getTime();
    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 0;

    var direction = diffDays > 0 ? 1 : -1;
    var count     = 0;
    var current   = new Date(from.getTime());

    // Avanzar día a día desde from+1 hasta to (inclusive)
    // contando solo días que no sean domingo.
    // Para eficiencia con rangos grandes, usamos cálculo matemático:
    //
    // En cada semana completa (7 días) hay 6 días laborales.
    // Calculamos semanas completas y el residuo.

    if (direction > 0) {
      // Calcular semanas completas y días restantes
      var totalDays     = diffDays;
      var fullWeeks     = Math.floor(totalDays / 7);
      var workInWeeks   = fullWeeks * 6;  // 6 días laborales por semana
      var remainingDays = totalDays % 7;

      // Contar días laborales en el residuo
      var residuoLaboral = 0;
      var checkDate = new Date(from.getTime());
      // Avanzar al inicio del residuo
      checkDate.setDate(checkDate.getDate() + (fullWeeks * 7));
      for (var r = 0; r < remainingDays; r++) {
        checkDate.setDate(checkDate.getDate() + 1);
        if (checkDate.getDay() !== 0) {
          residuoLaboral++;
        }
      }

      count = workInWeeks + residuoLaboral;
    } else {
      // Dirección negativa: contar hacia atrás
      var absDays       = Math.abs(diffDays);
      var fullWeeksNeg  = Math.floor(absDays / 7);
      var workNeg       = fullWeeksNeg * 6;
      var remNeg        = absDays % 7;

      var checkNeg = new Date(from.getTime());
      checkNeg.setDate(checkNeg.getDate() - (fullWeeksNeg * 7));
      var residuoNeg = 0;
      for (var rn = 0; rn < remNeg; rn++) {
        checkNeg.setDate(checkNeg.getDate() - 1);
        if (checkNeg.getDay() !== 0) {
          residuoNeg++;
        }
      }

      count = -(workNeg + residuoNeg);
    }

    return count;
  }

  // ──────────────────────────────────────────────
  // Conteo de Domingos
  // ──────────────────────────────────────────────

  /**
   * Cuenta los domingos desde fromDate hasta toDate (inclusive de toDate).
   * fromDate se asume que es domingo (día 0 → no se cuenta como transcurrido).
   * Si fromDate === toDate y ambos son domingo, retorna 0.
   *
   * @param {Date} fromDate - Primer domingo de referencia.
   * @param {Date} toDate   - Domingo objetivo.
   * @returns {number} Número de domingos transcurridos.
   */
  function countSundays(fromDate, toDate) {
    var from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    var to   = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

    // Diferencia en milisegundos
    var diffMs = to.getTime() - from.getTime();
    // Diferencia en días
    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 0;

    // Cada 7 días hay exactamente un domingo
    // Como fromDate y toDate ambos son domingos, la diferencia
    // en días debería ser múltiplo de 7.
    return Math.floor(diffDays / 7);
  }

  // ──────────────────────────────────────────────
  // API Pública
  // ──────────────────────────────────────────────

  return {
    getScheduleForDate:  getScheduleForDate,
    getRotationForDate:  getRotationForDate,
    getBoatForDeparture: getBoatForDeparture,
    getTodaySchedule:    getTodaySchedule,
    getNextDeparture:    getNextDeparture,
    getActiveBoat:       getActiveBoat,
    ensureTodayZarpes:   ensureTodayZarpes,
    countWorkingDays:    countWorkingDays,
    countSundays:        countSundays
  };

})();
