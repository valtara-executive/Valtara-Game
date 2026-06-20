/**
 * ============================================================
 * SPA LIFE 2026: EL VIAJE DEL BIENESTAR
 * Sistema de Personal (Staff System)
 * ============================================================
 * Nota: Este módulo es la autoridad central de recursos humanos.
 * Gestiona contrataciones, despidos, niveles de experiencia,
 * productividades, asignaciones a zonas y pago de salarios.
 * No genera interfaces visuales (DOM) ni maneja dinero directamente.
 * Toda transacción económica se delega al EconomySystem.
 * * ============================================================
 * COMPATIBILIDAD FUTURA OBLIGATORIA (ARQUITECTURA 2026)
 * ============================================================
 * - EconomySystem: Se invoca para hireStaff() y spendCoins() (salarios).
 * - CabinManager: Consultará asignaciones y productividades.
 * - DaySystem: Desencadenará paySalaries() al final de ciertas jornadas.
 * - MissionSystem: Podrá evaluar cantidad de empleados y niveles.
 * - AchievementSystem: Consultará hitos como "Primer Empleado" o "Doctor Nivel 10".
 * - SaveSystem: Exportará/Importará estado vía exportData() / importData().
 * - AnalyticsSystem: Recibirá métricas históricas de RRHH.
 * - NotificationSystem: Reemplazará al helper notify().
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.StaffSystem = (function() {
    'use strict';

    // ============================================================
    // CONSTANTES Y LÍMITES
    // ============================================================
    
    const MAX_EMPLOYEES = 100;
    const MAX_HISTORY = 500;

    // ============================================================
    // BASE DE DATOS DE PLANTILLAS
    // ============================================================
    
    const staffTemplates = {
        assistant: {
            role: 'Asistente',
            salary: 300,
            productivity: 1
        },
        therapist: {
            role: 'Terapeuta',
            salary: 800,
            productivity: 2
        },
        specialist: {
            role: 'Especialista',
            salary: 2000,
            productivity: 4
        },
        doctor: {
            role: 'Doctor',
            salary: 5000,
            productivity: 7
        },
        supervisor: {
            role: 'Supervisor',
            salary: 7000,
            productivity: 10
        }
    };

    // ============================================================
    // ESTADO INTERNO
    // ============================================================
    
    let employees = [];
    let employeeCounter = 0;
    let staffHistory = [];

    // ============================================================
    // MÉTODOS PRIVADOS (UTILIDADES)
    // ============================================================

    /**
     * Helper para emitir notificaciones. PREPARACIÓN: Futura
     * integración con NotificationSystem.
     * @param {string} message - Mensaje a mostrar.
     */
    function notify(message) {
        if (typeof window.SpaLife.showDialogue === 'function') {
            window.SpaLife.showDialogue("RRHH", message);
        }
        if (typeof window.SpaLife.announce === 'function') {
            window.SpaLife.announce(message);
        }
        console.log(`[SpaLife StaffSystem] ${message}`);
    }

    /**
     * Registra un evento en el historial laboral de la clínica.
     * @param {string} action - Tipo de acción (contratación, despido, ascenso, pago).
     * @param {string} details - Descripción del evento.
     */
    function logHistory(action, details) {
        staffHistory.push({
            timestamp: Date.now(),
            action: action,
            details: details
        });

        // Prevenir desbordamiento de memoria
        if (staffHistory.length > MAX_HISTORY) {
            staffHistory.shift();
        }
    }

    // ============================================================
    // MÉTODOS DE GESTIÓN DE PERSONAL (CORE)
    // ============================================================

    /**
     * Contrata un nuevo empleado si se cumplen los requisitos y hay fondos.
     * @param {string} type - Tipo de plantilla (assistant, therapist, etc.).
     * @returns {Object|null} El empleado creado o null si falló.
     */
    function hireEmployee(type) {
        // 1. Validar límite
        const activeCount = getActiveEmployees().length;
        if (activeCount >= MAX_EMPLOYEES) {
            console.warn('[SpaLife StaffSystem] Límite máximo de empleados alcanzado.');
            return null;
        }

        // 2. Validar plantilla
        const template = staffTemplates[type];
        if (!template) {
            console.error(`[SpaLife StaffSystem] Plantilla de personal inválida: ${type}`);
            return null;
        }

        // 3. Solicitar pago a EconomySystem
        if (!window.SpaLife.EconomySystem || typeof window.SpaLife.EconomySystem.hireStaff !== 'function') {
            console.error('[SpaLife StaffSystem] EconomySystem no disponible para procesar el pago.');
            return null;
        }

        const paymentSuccess = window.SpaLife.EconomySystem.hireStaff(type);
        if (!paymentSuccess) {
            // EconomySystem ya notifica si hay fondos insuficientes
            return null;
        }

        // 4. Crear empleado
        const newEmployee = {
            id: `emp-${++employeeCounter}`,
            type: type,
            role: template.role,
            salary: template.salary,
            productivity: template.productivity,
            level: 1,
            experience: 0,
            assignedZone: null,
            hiredAt: Date.now(),
            active: true
        };

        employees.push(newEmployee);

        // 5. Registrar historial y notificar
        logHistory('contratación', `Nuevo empleado contratado: ${newEmployee.role} (${newEmployee.id})`);
        notify(`Nuevo ${newEmployee.role} se ha unido al equipo.`);

        return newEmployee;
    }

    /**
     * Despide a un empleado, marcándolo como inactivo. No elimina registros.
     * @param {string} employeeId - ID del empleado.
     * @returns {boolean} True si se despidió correctamente.
     */
    function fireEmployee(employeeId) {
        const emp = getEmployee(employeeId);
        if (!emp || !emp.active) {
            return false;
        }

        emp.active = false;
        emp.assignedZone = null;

        logHistory('despido', `Empleado despedido: ${emp.role} (${emp.id})`);
        notify(`El empleado ${emp.role} ha dejado la clínica.`);

        return true;
    }

    // ============================================================
    // CONSULTAS
    // ============================================================

    /**
     * Retorna la referencia a un empleado por su ID.
     * @param {string} employeeId 
     * @returns {Object|null}
     */
    function getEmployee(employeeId) {
        return employees.find(e => e.id === employeeId) || null;
    }

    /**
     * Retorna una copia de todos los empleados (activos e inactivos).
     * @returns {Array}
     */
    function getAllEmployees() {
        return [...employees];
    }

    /**
     * Retorna un arreglo con solo los empleados activos.
     * @returns {Array}
     */
    function getActiveEmployees() {
        return employees.filter(e => e.active);
    }

    /**
     * Filtra los empleados activos según su rol.
     * @param {string} role 
     * @returns {Array}
     */
    function getEmployeesByRole(role) {
        return getActiveEmployees().filter(e => e.role === role);
    }

    // ============================================================
    // ASIGNACIONES Y DESARROLLO
    // ============================================================

    /**
     * Asigna a un empleado activo a una zona de la clínica.
     * @param {string} employeeId - ID del empleado.
     * @param {string} zoneId - ID de la zona.
     * @returns {boolean} True si se asignó exitosamente.
     */
    function assignEmployee(employeeId, zoneId) {
        const emp = getEmployee(employeeId);
        if (!emp || !emp.active) {
            console.warn(`[SpaLife StaffSystem] No se puede asignar: Empleado no válido o inactivo (${employeeId}).`);
            return false;
        }

        if (!zoneId) {
            return false;
        }

        emp.assignedZone = zoneId;
        logHistory('asignación', `Empleado ${emp.id} asignado a zona ${zoneId}`);
        
        return true;
    }

    /**
     * Otorga puntos de experiencia a un empleado y gestiona sus subidas de nivel.
     * @param {string} employeeId - ID del empleado.
     * @param {number} amount - Cantidad de experiencia.
     */
    function addExperience(employeeId, amount) {
        const emp = getEmployee(employeeId);
        if (!emp || !emp.active || amount <= 0) return;

        emp.experience += amount;

        // Cada 100 puntos = 1 Nivel (Fórmula acumulativa simple)
        const expectedLevel = Math.floor(emp.experience / 100) + 1;

        if (expectedLevel > emp.level) {
            const levelDifference = expectedLevel - emp.level;
            emp.level = expectedLevel;
            
            // Incrementar productividad: +1 por cada nivel subido
            emp.productivity += levelDifference;

            logHistory('ascenso', `Empleado ${emp.id} subió a nivel ${emp.level}. Productividad: ${emp.productivity}`);
            notify(`¡Tu ${emp.role} ha subido de nivel! Su productividad ha aumentado.`);
        }
    }

    // ============================================================
    // SALARIOS Y PRODUCTIVIDAD
    // ============================================================

    /**
     * Calcula y procesa el pago de salarios de todos los empleados activos.
     * Delega el débito a EconomySystem.spendCoins().
     * @returns {boolean} True si el pago fue exitoso, false si falló por fondos.
     */
    function paySalaries() {
        const activeStaff = getActiveEmployees();
        if (activeStaff.length === 0) return true; // No hay a quien pagar

        const totalPayroll = activeStaff.reduce((sum, emp) => sum + emp.salary, 0);

        if (!window.SpaLife.EconomySystem || typeof window.SpaLife.EconomySystem.spendCoins !== 'function') {
            console.error('[SpaLife StaffSystem] EconomySystem no disponible para nómina.');
            return false;
        }

        const success = window.SpaLife.EconomySystem.spendCoins(totalPayroll, 'staff-salary', 'Pago de nómina');

        if (success) {
            logHistory('pagos', `Nómina pagada exitosamente: ${totalPayroll} monedas.`);
            // Opcional: notify(`Se han pagado ${totalPayroll} monedas en salarios.`);
            return true;
        } else {
            logHistory('pagos', `Fallo al pagar nómina por falta de fondos (${totalPayroll}).`);
            notify("¡Alerta! No hay fondos suficientes para pagar los salarios.");
            return false;
        }
    }

    /**
     * Calcula la productividad total combinada de la clínica.
     * @returns {number} Suma de la productividad del personal activo.
     */
    function getTotalProductivity() {
        return getActiveEmployees().reduce((sum, emp) => sum + emp.productivity, 0);
    }

    // ============================================================
    // REPORTES Y ESTADÍSTICAS
    // ============================================================

    /**
     * Genera un reporte del estado actual de recursos humanos.
     * @returns {Object}
     */
    function getStaffReport() {
        const active = getActiveEmployees();
        const totalPayroll = active.reduce((sum, emp) => sum + emp.salary, 0);
        const avgLevel = active.length > 0 
            ? active.reduce((sum, emp) => sum + emp.level, 0) / active.length 
            : 0;

        return {
            totalEmployees: employees.length,
            activeEmployees: active.length,
            totalPayroll: totalPayroll,
            totalProductivity: getTotalProductivity(),
            averageLevel: Math.round(avgLevel * 10) / 10
        };
    }

    // ============================================================
    // PERSISTENCIA (SAVE SYSTEM READY)
    // ============================================================

    /**
     * Exporta los datos estructurales para ser guardados.
     * @returns {Object}
     */
    function exportData() {
        return {
            employees: JSON.parse(JSON.stringify(employees)),
            employeeCounter: employeeCounter,
            staffHistory: [...staffHistory]
        };
    }

    /**
     * Restaura los datos del módulo desde un estado guardado.
     * @param {Object} data 
     */
    function importData(data) {
        if (!data || typeof data !== 'object') return;

        if (Array.isArray(data.employees)) {
            employees = data.employees;
        }
        if (typeof data.employeeCounter === 'number') {
            employeeCounter = data.employeeCounter;
        }
        if (Array.isArray(data.staffHistory)) {
            staffHistory = data.staffHistory.slice(-MAX_HISTORY);
        }
    }

    // ============================================================
    // CICLO DE VIDA
    // ============================================================

    function reset() {
        employees = [];
        employeeCounter = 0;
        staffHistory = [];
        console.log('[SpaLife StaffSystem] Sistema de personal reiniciado.');
    }

    function init() {
        console.log('[SpaLife StaffSystem] Inicializado. Departamento de RRHH en línea.');
    }

    function destroy() {
        reset();
        console.log('[SpaLife StaffSystem] Destruido.');
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================

    return {
        init,
        destroy,
        reset,

        hireEmployee,
        fireEmployee,
        assignEmployee,
        addExperience,
        paySalaries,

        getEmployee,
        getAllEmployees,
        getActiveEmployees,
        getEmployeesByRole,
        getTotalProductivity,
        getStaffReport,

        exportData,
        importData
    };

})();
