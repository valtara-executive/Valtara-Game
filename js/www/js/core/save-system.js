/**
 * ============================================================
 * SPA LIFE 2026: EL VIAJE DEL BIENESTAR
 * Sistema Global de Guardado (Save System)
 * ============================================================
 * Nota: Este módulo es la autoridad absoluta en la persistencia
 * de datos del juego. Coordina la extracción e inyección de datos
 * entre todos los módulos activos, gestionando guardados, cargas,
 * exportaciones, copias de seguridad y validación de integridad.
 * Funciona completamente en segundo plano.
 * * ============================================================
 * COMPATIBILIDAD FUTURA OBLIGATORIA (ARQUITECTURA 2026)
 * ============================================================
 * - NotificationSystem: Reemplazará al helper de notificaciones local.
 * - AnalyticsSystem: Registrará eventos de guardado/carga para métricas de retención.
 * - CloudSaveSystem: Sincronizará la cadena JSON generada con servidores remotos.
 * - GoogleDriveSync: Permitirá respaldar la exportación JSON en la nube del usuario.
 * - SteamCloud: Preparado para sincronización en builds de PC.
 * - CrossDeviceSync: Facilitará la migración entre web, Android y desktop usando exportToJSON().
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.SaveSystem = (function() {
    'use strict';

    // ============================================================
    // CONFIGURACIÓN Y CONSTANTES
    // ============================================================

    const SAVE_KEY = 'spalife-save-data';
    const SAVE_VERSION = '1.0.0';
    const AUTO_SAVE_INTERVAL = 60000; // 60 segundos
    const MAX_BACKUPS = 3;

    // ============================================================
    // ESTADO INTERNO
    // ============================================================

    let autoSaveTimer = null;
    let lastSaveTimestamp = null;

    // ============================================================
    // HELPERS PRIVADOS
    // ============================================================

    /**
     * Canaliza de manera temporal las notificaciones hacia el sistema clásico.
     * FUTURO: Integración centralizada con NotificationSystem.
     * @param {string} message - El mensaje a mostrar.
     */
    function notify(message) {
        if (typeof window.SpaLife.showDialogue === 'function') {
            window.SpaLife.showDialogue("Sistema", message);
        }
        if (typeof window.SpaLife.announce === 'function') {
            window.SpaLife.announce(message);
        }
        console.log(`[SpaLife SaveSystem] ${message}`);
    }

    /**
     * Inyecta el bloque de datos correspondiente a cada módulo si existe.
     * @param {Object} data - Estructura completa validada del save.
     */
    function _loadData(data) {
        if (!data || !data.modules) return;

        const mods = data.modules;

        if (mods.gameState && window.SpaLife.GameState && typeof window.SpaLife.GameState.importData === 'function') {
            window.SpaLife.GameState.importData(mods.gameState);
        }
        
        if (mods.economy && window.SpaLife.EconomySystem && typeof window.SpaLife.EconomySystem.importData === 'function') {
            window.SpaLife.EconomySystem.importData(mods.economy);
        }
        
        if (mods.staff && window.SpaLife.StaffSystem && typeof window.SpaLife.StaffSystem.importData === 'function') {
            window.SpaLife.StaffSystem.importData(mods.staff);
        }
        
        if (mods.cabins && window.SpaLife.CabinManager && typeof window.SpaLife.CabinManager.importData === 'function') {
            window.SpaLife.CabinManager.importData(mods.cabins);
        }
        
        if (mods.missions && window.SpaLife.MissionSystem && typeof window.SpaLife.MissionSystem.importData === 'function') {
            window.SpaLife.MissionSystem.importData(mods.missions);
        }
        
        if (mods.vip && window.SpaLife.VIPSystem && typeof window.SpaLife.VIPSystem.importData === 'function') {
            window.SpaLife.VIPSystem.importData(mods.vip);
        }
        
        if (mods.statistics && window.SpaLife.StatisticsSystem && typeof window.SpaLife.StatisticsSystem.importData === 'function') {
            window.SpaLife.StatisticsSystem.importData(mods.statistics);
        }
    }

    // ============================================================
    // CONSTRUCCIÓN Y EXPORTACIÓN DE DATOS (NÚCLEO)
    // ============================================================

    /**
     * Consulta a todos los módulos compatibles y construye la estructura unificada de guardado.
     * No arroja errores si un módulo no está presente.
     * @returns {Object} Objeto estructurado con todos los datos serializables.
     */
    function buildSaveData() {
        const modulesData = {};

        if (window.SpaLife.GameState && typeof window.SpaLife.GameState.exportData === 'function') {
            modulesData.gameState = window.SpaLife.GameState.exportData();
        }

        if (window.SpaLife.EconomySystem && typeof window.SpaLife.EconomySystem.exportData === 'function') {
            modulesData.economy = window.SpaLife.EconomySystem.exportData();
        }

        if (window.SpaLife.StaffSystem && typeof window.SpaLife.StaffSystem.exportData === 'function') {
            modulesData.staff = window.SpaLife.StaffSystem.exportData();
        }

        if (window.SpaLife.CabinManager && typeof window.SpaLife.CabinManager.exportData === 'function') {
            modulesData.cabins = window.SpaLife.CabinManager.exportData();
        }

        if (window.SpaLife.MissionSystem && typeof window.SpaLife.MissionSystem.exportData === 'function') {
            modulesData.missions = window.SpaLife.MissionSystem.exportData();
        }

        if (window.SpaLife.VIPSystem && typeof window.SpaLife.VIPSystem.exportData === 'function') {
            modulesData.vip = window.SpaLife.VIPSystem.exportData();
        }
        
        if (window.SpaLife.StatisticsSystem && typeof window.SpaLife.StatisticsSystem.exportData === 'function') {
            modulesData.statistics = window.SpaLife.StatisticsSystem.exportData();
        }

        return {
            version: SAVE_VERSION,
            timestamp: Date.now(),
            modules: modulesData
        };
    }

    // ============================================================
    // VALIDACIÓN DE INTEGRIDAD
    // ============================================================

    /**
     * Valida la estructura e integridad de un objeto de guardado.
     * @param {any} data - El objeto a validar.
     * @returns {boolean} True si el objeto tiene un formato aceptable.
     */
    function validateSaveData(data) {
        if (!data || typeof data !== 'object') {
            console.warn('[SpaLife SaveSystem] Datos de guardado inválidos (no es un objeto).');
            return false;
        }

        if (!data.version || typeof data.version !== 'string') {
            console.warn('[SpaLife SaveSystem] Falla de validación: Versión faltante o corrupta.');
            return false;
        }

        if (!data.timestamp || typeof data.timestamp !== 'number') {
            console.warn('[SpaLife SaveSystem] Falla de validación: Timestamp faltante o corrupto.');
            return false;
        }

        if (!data.modules || typeof data.modules !== 'object') {
            console.warn('[SpaLife SaveSystem] Falla de validación: Bloque de módulos faltante o corrupto.');
            return false;
        }

        return true;
    }

    // ============================================================
    // OPERACIONES DE ALMACENAMIENTO (LOCALSTORAGE)
    // ============================================================

    /**
     * Crea un sistema de rotación de backups antes de sobrescribir el archivo principal.
     * @returns {boolean} True si el respaldo fue exitoso.
     */
    function createBackup() {
        try {
            const currentSave = localStorage.getItem(SAVE_KEY);
            if (!currentSave) return false;

            // Rotación: Mover backup N a N+1
            for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
                const olderBackup = localStorage.getItem(`${SAVE_KEY}-backup-${i}`);
                if (olderBackup) {
                    localStorage.setItem(`${SAVE_KEY}-backup-${i + 1}`, olderBackup);
                }
            }

            // El guardado actual pasa a ser el backup 1
            localStorage.setItem(`${SAVE_KEY}-backup-1`, currentSave);
            return true;
        } catch (error) {
            console.warn('[SpaLife SaveSystem] Error al crear backup. Posible límite de cuota superado.', error);
            return false;
        }
    }

    /**
     * Construye, empaqueta y persiste el estado actual del juego en el almacenamiento local.
     * @returns {boolean} True si se guardó con éxito, false si hubo errores.
     */
    function saveGame() {
        try {
            const dataObj = buildSaveData();
            
            // Siempre intentar hacer backup del guardado anterior antes de sobreescribir
            createBackup();

            const jsonString = JSON.stringify(dataObj);
            localStorage.setItem(SAVE_KEY, jsonString);
            
            lastSaveTimestamp = dataObj.timestamp;
            console.log(`[SpaLife SaveSystem] Partida guardada correctamente (v${dataObj.version}).`);
            return true;
        } catch (error) {
            console.error('[SpaLife SaveSystem] Error crítico al intentar guardar la partida:', error);
            notify("Error al guardar la partida. Verifica el espacio en tu dispositivo.");
            return false;
        }
    }

    /**
     * Lee, valida y distribuye los datos guardados en el almacenamiento local hacia los módulos.
     * @returns {boolean} True si la carga fue exitosa.
     */
    function loadGame() {
        try {
            const jsonString = localStorage.getItem(SAVE_KEY);
            if (!jsonString) {
                console.log('[SpaLife SaveSystem] No se encontró ninguna partida guardada.');
                return false;
            }

            const dataObj = JSON.parse(jsonString);

            if (!validateSaveData(dataObj)) {
                console.error('[SpaLife SaveSystem] El archivo de guardado local está corrupto.');
                notify("El archivo de guardado está dañado.");
                return false;
            }

            _loadData(dataObj);
            lastSaveTimestamp = dataObj.timestamp;
            
            console.log(`[SpaLife SaveSystem] Partida cargada exitosamente (v${dataObj.version}).`);
            notify("Progreso cargado correctamente.");
            return true;
        } catch (error) {
            console.error('[SpaLife SaveSystem] Error crítico al intentar cargar la partida:', error);
            notify("Error al intentar leer los datos guardados.");
            return false;
        }
    }

    /**
     * Elimina todos los registros de guardado y backups del almacenamiento local.
     * @returns {boolean}
     */
    function deleteSave() {
        try {
            localStorage.removeItem(SAVE_KEY);
            for (let i = 1; i <= MAX_BACKUPS; i++) {
                localStorage.removeItem(`${SAVE_KEY}-backup-${i}`);
            }
            lastSaveTimestamp = null;
            console.log('[SpaLife SaveSystem] Datos de guardado eliminados permanentemente.');
            return true;
        } catch (error) {
            console.error('[SpaLife SaveSystem] Error al intentar eliminar los datos:', error);
            return false;
        }
    }

    // ============================================================
    // ESTADÍSTICAS E INFORMACIÓN DEL GUARDADO
    // ============================================================

    /**
     * Verifica si existe una partida guardada en el almacenamiento local.
     * @returns {boolean}
     */
    function hasSave() {
        try {
            return localStorage.getItem(SAVE_KEY) !== null;
        } catch (e) {
            return false;
        }
    }

    /**
     * Devuelve el timestamp de la última vez que se guardó la partida.
     * @returns {number|null} Timestamp en milisegundos o null si no hay datos.
     */
    function getLastSaveDate() {
        try {
            if (lastSaveTimestamp) return lastSaveTimestamp;
            
            const jsonString = localStorage.getItem(SAVE_KEY);
            if (jsonString) {
                const data = JSON.parse(jsonString);
                return data.timestamp || null;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Devuelve la versión de los datos guardados actualmente.
     * @returns {string|null} Cadena de versión (ej. '1.0.0') o null.
     */
    function getSaveVersion() {
        try {
            const jsonString = localStorage.getItem(SAVE_KEY);
            if (jsonString) {
                const data = JSON.parse(jsonString);
                return data.version || null;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    // ============================================================
    // EXPORTACIÓN E IMPORTACIÓN EXTERNA (ARCHIVOS / NUBE)
    // ============================================================

    /**
     * Exporta el progreso actual en formato JSON legible.
     * Útil para migración entre dispositivos o copias de seguridad manuales.
     * @returns {string} Cadena JSON formateada.
     */
    function exportToJSON() {
        try {
            const dataObj = buildSaveData();
            return JSON.stringify(dataObj, null, 2);
        } catch (error) {
            console.error('[SpaLife SaveSystem] Error al exportar a JSON:', error);
            return "{}";
        }
    }

    /**
     * Importa y aplica el progreso a partir de una cadena JSON externa.
     * @param {string} jsonString - Cadena JSON con la estructura de guardado.
     * @returns {boolean} True si se procesó correctamente.
     */
    function importFromJSON(jsonString) {
        try {
            if (!jsonString || typeof jsonString !== 'string') {
                return false;
            }

            const dataObj = JSON.parse(jsonString);

            if (!validateSaveData(dataObj)) {
                console.error('[SpaLife SaveSystem] El JSON importado tiene un formato inválido.');
                return false;
            }

            // Inyectar datos a los módulos
            _loadData(dataObj);
            
            // Forzar un guardado local inmediato para persistir la importación
            saveGame();
            
            notify("Datos importados y aplicados correctamente.");
            return true;
        } catch (error) {
            console.error('[SpaLife SaveSystem] Error al importar desde JSON:', error);
            notify("Error de formato en el archivo importado.");
            return false;
        }
    }

    // ============================================================
    // GESTIÓN DE AUTOGUARDADO
    // ============================================================

    /**
     * Inicia el ciclo de guardado automático en segundo plano.
     */
    function startAutoSave() {
        if (autoSaveTimer) {
            return;
        }
        autoSaveTimer = setInterval(() => {
            saveGame();
        }, AUTO_SAVE_INTERVAL);
        console.log(`[SpaLife SaveSystem] Autoguardado activado cada ${AUTO_SAVE_INTERVAL / 1000}s.`);
    }

    /**
     * Detiene el ciclo de guardado automático.
     */
    function stopAutoSave() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
            autoSaveTimer = null;
            console.log('[SpaLife SaveSystem] Autoguardado detenido.');
        }
    }

    // ============================================================
    // CICLO DE VIDA (LIFECYCLE)
    // ============================================================

    /**
     * Reinicia el estado interno del sistema de guardado (No borra el save físico).
     */
    function reset() {
        stopAutoSave();
        lastSaveTimestamp = null;
    }

    /**
     * Inicializa el sistema, registra el servicio y arranca el autoguardado.
     */
    function init() {
        console.log('[SpaLife SaveSystem] Inicializado.');
        startAutoSave();
    }

    /**
     * Destruye la instancia operativa, libera intervalos y limpia memoria.
     */
    function destroy() {
        stopAutoSave();
        reset();
        console.log('[SpaLife SaveSystem] Destruido.');
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================

    return {
        init,
        destroy,
        
        saveGame,
        loadGame,
        
        buildSaveData,
        createBackup,
        
        exportToJSON,
        importFromJSON,
        
        validateSaveData,
        deleteSave,
        
        hasSave,
        getLastSaveDate,
        getSaveVersion,
        
        startAutoSave,
        stopAutoSave,
        
        reset
    };

})();
