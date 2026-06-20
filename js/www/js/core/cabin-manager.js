/**
 * ============================================================
 * SPA LIFE 2026: EL VIAJE DEL BIENESTAR
 * Sistema de Gestión de Cabinas (Cabin Manager)
 * ============================================================
 * Nota: Este módulo es la autoridad absoluta en la administración
 * del estado estructural y operativo de las cabinas del spa.
 * No genera interfaces, no mueve personajes ni asigna terapias.
 * Funciona puramente gestionando el estado de los datos.
 * * ============================================================
 * COMPATIBILIDAD FUTURA OBLIGATORIA (ARQUITECTURA 2026)
 * ============================================================
 * - TreatmentSystem: Consultará findAvailableCabin() para derivar pacientes.
 * - CustomerFlow: Validará la disponibilidad general antes de aceptar clientes.
 * - UnlockSystem: Invocará unlockCabin() al subir de nivel.
 * - ZoneSystem: Se sincronizará para cambiar el renderizado de la zona de cabina.
 * - VIPSystem: Consultará getVIPCabins() para clientes exclusivos.
 * - EconomySystem: Cobrará mantenimiento u otorgará ingresos por tratamientos.
 * - StaffSystem: Validará asignaciones mediante assignEmployee().
 * - AnalyticsSystem: Recopilará datos desde getCabinReport().
 * - SaveSystem: Exportará e importará el estado mediante exportData() e importData().
 * - NotificationSystem: Reemplazará el uso de notify() clásico.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.CabinManager = (function() {
    'use strict';

    // ============================================================
    // CONSTANTES Y ESTADO INTERNO
    // ============================================================

    const MAX_HISTORY = 1000;
    let cabinHistory = [];
    
    // Plantilla inicial para soportar múltiples cabinas (100+)
    let cabins = [];

    // ============================================================
    // HELPERS PRIVADOS
    // ============================================================

    /**
     * Registra una acción en el historial de operaciones de cabinas,
     * limitando el tamaño máximo en memoria.
     * @param {string} action - La acción ejecutada (ej. 'unlock', 'occupy').
     * @param {string} details - Descripción de la operación.
     */
    function logHistory(action, details) {
        cabinHistory.push({
            timestamp: Date.now(),
            action: action,
            details: details
        });

        if (cabinHistory.length > MAX_HISTORY) {
            cabinHistory.shift();
        }
    }

    /**
     * Emite notificaciones al sistema visual/auditivo.
     * FUTURO: Integración con NotificationSystem.
     * @param {string} message - El mensaje a notificar.
     */
    function notify(message) {
        if (typeof window.SpaLife.showDialogue === 'function') {
            window.SpaLife.showDialogue("Gestor de Cabinas", message);
        }
        if (typeof window.SpaLife.announce === 'function') {
            window.SpaLife.announce(message);
        }
        console.log(`[SpaLife CabinManager] ${message}`);
    }

    // ============================================================
    // CONSULTAS BÁSICAS
    // ============================================================

    /**
     * Devuelve el objeto completo de una cabina por su ID.
     * @param {string} cabinId 
     * @returns {Object|null}
     */
    function getCabin(cabinId) {
        return cabins.find(c => c.id === cabinId) || null;
    }

    /**
     * Devuelve todas las cabinas registradas en el sistema.
     * @returns {Array}
     */
    function getAllCabins() {
        return [...cabins];
    }

    /**
     * Devuelve la cantidad total de cabinas.
     * @returns {number}
     */
    function getCabinCount() {
        return cabins.length;
    }

    /**
     * Devuelve un arreglo con todas las cabinas desbloqueadas.
     * @returns {Array}
     */
    function getUnlockedCabins() {
        return cabins.filter(c => c.unlocked);
    }

    /**
     * Devuelve un arreglo con todas las cabinas bloqueadas.
     * @returns {Array}
     */
    function getLockedCabins() {
        return cabins.filter(c => !c.unlocked);
    }

    /**
     * Devuelve un arreglo con las cabinas disponibles (desbloqueadas, vacías y sin mantenimiento).
     * @returns {Array}
     */
    function getAvailableCabins() {
        return cabins.filter(c => c.unlocked && !c.occupied && !c.maintenanceRequired);
    }

    /**
     * Devuelve un arreglo con las cabinas actualmente ocupadas.
     * @returns {Array}
     */
    function getOccupiedCabins() {
        return cabins.filter(c => c.occupied);
    }

    /**
     * Devuelve un arreglo con las cabinas que requieren mantenimiento.
     * @returns {Array}
     */
    function getMaintenanceCabins() {
        return cabins.filter(c => c.maintenanceRequired);
    }

    /**
     * Devuelve un arreglo con las cabinas exclusivas para VIP.
     * @returns {Array}
     */
    function getVIPCabins() {
        return cabins.filter(c => c.vipOnly);
    }

    // ============================================================
    // VALIDACIONES
    // ============================================================

    /**
     * Verifica si una cabina existe en el sistema.
     * @param {string} cabinId 
     * @returns {boolean}
     */
    function exists(cabinId) {
        return getCabin(cabinId) !== null;
    }

    /**
     * Verifica si una cabina está desbloqueada.
     * @param {string} cabinId 
     * @returns {boolean}
     */
    function isCabinUnlocked(cabinId) {
        const c = getCabin(cabinId);
        return c ? c.unlocked : false;
    }

    /**
     * Verifica si una cabina está ocupada.
     * @param {string} cabinId 
     * @returns {boolean}
     */
    function isCabinOccupied(cabinId) {
        const c = getCabin(cabinId);
        return c ? c.occupied : false;
    }

    /**
     * Verifica si una cabina es exclusiva VIP.
     * @param {string} cabinId 
     * @returns {boolean}
     */
    function isVIPOnly(cabinId) {
        const c = getCabin(cabinId);
        return c ? c.vipOnly : false;
    }

    /**
     * Verifica si una cabina requiere mantenimiento.
     * @param {string} cabinId 
     * @returns {boolean}
     */
    function needsMaintenance(cabinId) {
        const c = getCabin(cabinId);
        return c ? c.maintenanceRequired : false;
    }

    // ============================================================
    // DESBLOQUEOS
    // ============================================================

    /**
     * Desbloquea una cabina para su uso operativo.
     * @param {string} cabinId 
     * @returns {boolean}
     */
    function unlockCabin(cabinId) {
        const cabin = getCabin(cabinId);
        if (!cabin) return false;
        if (cabin.unlocked) return true; // Ya estaba desbloqueada

        cabin.unlocked = true;
        logHistory('unlock', `Cabina desbloqueada: ${cabin.name} (${cabinId})`);
        notify(`Nueva instalación disponible: ${cabin.name}`);
        return true;
    }

    /**
     * Bloquea una cabina, impidiendo su uso.
     * @param {string} cabinId 
     * @returns {boolean}
     */
    function lockCabin(cabinId) {
        const cabin = getCabin(cabinId);
        if (!cabin) return false;
        if (!cabin.unlocked) return true;

        cabin.unlocked = false;
        cabin.occupied = false; // Liberar forzosamente
        logHistory('lock', `Cabina bloqueada: ${cabin.name} (${cabinId})`);
        return true;
    }

    // ============================================================
    // OCUPACIÓN
    // ============================================================

    /**
     * Marca una cabina como ocupada si cumple todos los requisitos.
     * @param {string} cabinId 
     * @returns {boolean} True si se ocupó exitosamente.
     */
    function occupyCabin(cabinId) {
        const cabin = getCabin(cabinId);
        if (!cabin) {
            console.warn(`[SpaLife CabinManager] Error al ocupar: Cabina inexistente (${cabinId})`);
            return false;
        }
        if (!cabin.unlocked) {
            console.warn(`[SpaLife CabinManager] Error al ocupar: Cabina bloqueada (${cabinId})`);
            return false;
        }
        if (cabin.maintenanceRequired) {
            console.warn(`[SpaLife CabinManager] Error al ocupar: Cabina requiere mantenimiento (${cabinId})`);
            return false;
        }
        if (cabin.occupied) {
            console.warn(`[SpaLife CabinManager] Error al ocupar: Cabina ya ocupada (${cabinId})`);
            return false;
        }

        cabin.occupied = true;
        logHistory('occupy', `Cabina ocupada: ${cabin.name} (${cabinId})`);
        return true;
    }

    /**
     * Libera una cabina previamente ocupada.
     * @param {string} cabinId 
     * @returns {boolean}
     */
    function releaseCabin(cabinId) {
        const cabin = getCabin(cabinId);
        if (!cabin || !cabin.occupied) return false;

        cabin.occupied = false;
        logHistory('release', `Cabina liberada: ${cabin.name} (${cabinId})`);
        return true;
    }

    // ============================================================
    // EMPLEADOS
    // ============================================================

    /**
     * Asigna un empleado a una cabina específica.
     * Valida la existencia del empleado si el StaffSystem está disponible.
     * @param {string} cabinId 
     * @param {string} employeeId 
     * @returns {boolean}
     */
    function assignEmployee(cabinId, employeeId) {
        const cabin = getCabin(cabinId);
        if (!cabin) return false;

        if (window.SpaLife.StaffSystem && typeof window.SpaLife.StaffSystem.getEmployee === 'function') {
            const emp = window.SpaLife.StaffSystem.getEmployee(employeeId);
            if (!emp || !emp.active) {
                console.warn(`[SpaLife CabinManager] Empleado inválido o inactivo (${employeeId})`);
                return false;
            }
        }

        cabin.assignedEmployee = employeeId;
        logHistory('assign_employee', `Empleado ${employeeId} asignado a ${cabin.name}`);
        return true;
    }

    /**
     * Remueve la asignación de empleado de una cabina.
     * @param {string} cabinId 
     * @returns {boolean}
     */
    function unassignEmployee(cabinId) {
        const cabin = getCabin(cabinId);
        if (!cabin || !cabin.assignedEmployee) return false;

        logHistory('unassign_employee', `Empleado ${cabin.assignedEmployee} retirado de ${cabin.name}`);
        cabin.assignedEmployee = null;
        return true;
    }

    /**
     * Devuelve el ID del empleado asignado a la cabina.
     * @param {string} cabinId 
     * @returns {string|null}
     */
    function getAssignedEmployee(cabinId) {
        const cabin = getCabin(cabinId);
        return cabin ? cabin.assignedEmployee : null;
    }

    // ============================================================
    // MANTENIMIENTO
    // ============================================================

    /**
     * Programa o establece el estado de mantenimiento requerido.
     * @param {string} cabinId 
     * @returns {boolean}
     */
    function scheduleMaintenance(cabinId) {
        const cabin = getCabin(cabinId);
        if (!cabin) return false;

        cabin.maintenanceRequired = true;
        logHistory('maintenance_scheduled', `Mantenimiento requerido en ${cabin.name}`);
        notify(`La ${cabin.name} necesita mantenimiento y no puede utilizarse.`);
        return true;
    }

    /**
     * Marca el mantenimiento como completado y libera la cabina.
     * @param {string} cabinId 
     * @returns {boolean}
     */
    function completeMaintenance(cabinId) {
        const cabin = getCabin(cabinId);
        if (!cabin || !cabin.maintenanceRequired) return false;

        cabin.maintenanceRequired = false;
        logHistory('maintenance_completed', `Mantenimiento completado en ${cabin.name}`);
        notify(`La ${cabin.name} está lista para operar nuevamente.`);
        return true;
    }

    // ============================================================
    // CONFIGURACIÓN VIP
    // ============================================================

    /**
     * Define si una cabina es de uso exclusivo para clientes VIP.
     * @param {string} cabinId 
     * @param {boolean} enabled 
     * @returns {boolean}
     */
    function setVIPOnly(cabinId, enabled) {
        const cabin = getCabin(cabinId);
        if (!cabin) return false;

        cabin.vipOnly = !!enabled;
        logHistory('vip_config', `Cabina ${cabin.name} exclusividad VIP: ${cabin.vipOnly}`);
        return true;
    }

    // ============================================================
    // TRATAMIENTOS
    // ============================================================

    /**
     * Registra la finalización de un tratamiento, incrementando estadísticas.
     * @param {string} cabinId 
     * @param {number} revenue - Ingresos generados por el tratamiento.
     * @returns {boolean}
     */
    function registerTreatment(cabinId, revenue = 0) {
        const cabin = getCabin(cabinId);
        if (!cabin) return false;

        cabin.totalTreatments += 1;
        cabin.totalRevenue += (typeof revenue === 'number' && !isNaN(revenue)) ? revenue : 0;
        
        logHistory('treatment_registered', `Tratamiento finalizado en ${cabin.name}. Ingreso: ${revenue}`);
        return true;
    }

    // ============================================================
    // BÚSQUEDA AUTOMÁTICA
    // ============================================================

    /**
     * Localiza la primera cabina que cumpla las condiciones para ser utilizada.
     * Será empleado por CustomerFlow y TreatmentSystem.
     * @returns {Object|null} La cabina disponible o null.
     */
    function findAvailableCabin() {
        return cabins.find(c => c.unlocked && !c.occupied && !c.maintenanceRequired) || null;
    }

    // ============================================================
    // REPORTES
    // ============================================================

    /**
     * Genera un reporte general del estado de todas las cabinas.
     * @returns {Object}
     */
    function getCabinReport() {
        const unlocked = getUnlockedCabins().length;
        const occupied = getOccupiedCabins().length;
        const totalTreatments = cabins.reduce((sum, c) => sum + c.totalTreatments, 0);
        const totalRevenue = cabins.reduce((sum, c) => sum + c.totalRevenue, 0);

        return {
            totalCabins: cabins.length,
            unlockedCabins: unlocked,
            lockedCabins: cabins.length - unlocked,
            occupiedCabins: occupied,
            availableCabins: getAvailableCabins().length,
            maintenanceCabins: getMaintenanceCabins().length,
            vipCabins: getVIPCabins().length,
            totalTreatments: totalTreatments,
            totalRevenue: totalRevenue
        };
    }

    /**
     * Devuelve las estadísticas detalladas de una cabina individual.
     * @param {string} cabinId 
     * @returns {Object|null}
     */
    function getCabinStatistics(cabinId) {
        const c = getCabin(cabinId);
        if (!c) return null;

        return {
            id: c.id,
            name: c.name,
            unlocked: c.unlocked,
            occupied: c.occupied,
            maintenanceRequired: c.maintenanceRequired,
            vipOnly: c.vipOnly,
            totalTreatments: c.totalTreatments,
            totalRevenue: c.totalRevenue,
            assignedEmployee: c.assignedEmployee
        };
    }

    // ============================================================
    // PERSISTENCIA (SAVE SYSTEM)
    // ============================================================

    /**
     * Exporta los datos estructurales para su almacenamiento.
     * @returns {Object}
     */
    function exportData() {
        return {
            cabins: JSON.parse(JSON.stringify(cabins)),
            cabinHistory: [...cabinHistory]
        };
    }

    /**
     * Importa los datos guardados y restaura el estado.
     * @param {Object} data 
     */
    function importData(data) {
        if (!data || typeof data !== 'object') return;

        if (Array.isArray(data.cabins)) {
            cabins = data.cabins;
        }
        
        if (Array.isArray(data.cabinHistory)) {
            cabinHistory = data.cabinHistory.slice(-MAX_HISTORY);
        }
    }

    // ============================================================
    // REINICIO Y CICLO DE VIDA
    // ============================================================

    /**
     * Reinicia el módulo al estado de fábrica por defecto.
     */
    function reset() {
        cabinHistory = [];
        cabins = [
            {
                id: 'cabin-1',
                zoneId: 'cabin-1',
                name: 'Cabina 1',
                unlocked: true,
                occupied: false,
                assignedEmployee: null,
                maintenanceRequired: false,
                vipOnly: false,
                totalTreatments: 0,
                totalRevenue: 0,
                createdAt: Date.now()
            },
            {
                id: 'cabin-2',
                zoneId: 'cabin-2',
                name: 'Cabina 2',
                unlocked: false,
                occupied: false,
                assignedEmployee: null,
                maintenanceRequired: false,
                vipOnly: false,
                totalTreatments: 0,
                totalRevenue: 0,
                createdAt: Date.now()
            }
        ];
        console.log('[SpaLife CabinManager] Estado reiniciado a fábrica.');
    }

    /**
     * Inicializa el gestor de cabinas y prepara el estado inicial.
     */
    function init() {
        if (cabins.length === 0) {
            reset();
        }
        console.log('[SpaLife CabinManager] Inicializado.');
    }

    /**
     * Destruye la instancia actual y limpia memoria.
     */
    function destroy() {
        reset();
        console.log('[SpaLife CabinManager] Destruido.');
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================

    return {
        init,
        destroy,
        reset,

        getCabin,
        getAllCabins,
        getCabinCount,
        getUnlockedCabins,
        getLockedCabins,
        getAvailableCabins,
        getOccupiedCabins,
        getMaintenanceCabins,
        getVIPCabins,

        exists,
        isCabinUnlocked,
        isCabinOccupied,
        isVIPOnly,
        needsMaintenance,

        unlockCabin,
        lockCabin,
        
        occupyCabin,
        releaseCabin,

        assignEmployee,
        unassignEmployee,
        getAssignedEmployee,

        scheduleMaintenance,
        completeMaintenance,

        setVIPOnly,
        registerTreatment,
        findAvailableCabin,

        getCabinReport,
        getCabinStatistics,

        exportData,
        importData
    };

})();
