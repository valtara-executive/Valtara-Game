/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Ciclo de Días (Day System)
 * ============================================================
 * Nota: Este módulo controla el progreso de las jornadas
 * laborales dentro del spa. Determina cuántos clientes
 * se atenderán por día, registra los avances y maneja
 * las transiciones automáticas entre un día y el siguiente.
 * No gestiona economía, ni terapias, ni progresión de nivel.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.DaySystem = (function() {
    'use strict';

    // ============================================================
    // VARIABLES PRIVADAS Y ESTADO INTERNO
    // ============================================================

    let clientsCompletedToday = 0;
    let dayActive = false;

    // ============================================================
    // MÉTODOS PRIVADOS (UTILIDADES)
    // ============================================================

    /**
     * Calcula la cantidad de clientes máximos para una jornada específica.
     * La fórmula progresiva es: Día + 4.
     * (Día 1 = 5, Día 2 = 6, Día 3 = 7...)
     * @param {number} day - El número del día actual.
     * @returns {number} La meta de clientes para el día.
     */
    function getMaxClientsForDay(day) {
        return day + 4;
    }

    /**
     * Pausa la ejecución por una cantidad específica de milisegundos.
     * @param {number} ms - Milisegundos a esperar.
     * @returns {Promise} Promesa que se resuelve tras el tiempo indicado.
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============================================================
    // MÉTODOS PÚBLICOS (API CENTRAL)
    // ============================================================

    /**
     * Inicializa el gestor de jornadas laborales reseteando el estado local.
     */
    function init() {
        console.log('[SpaLife DaySystem] Inicializando sistema de jornadas...');
        clientsCompletedToday = 0;
        dayActive = false;
    }

    /**
     * Retorna el número de la jornada actual directamente consultando el GameState.
     * @returns {number} El día actual del jugador, o 1 si no se encuentra disponible.
     */
    function getCurrentDay() {
        if (window.SpaLife.GameState) {
            return window.SpaLife.GameState.getState().currentDay || 1;
        }
        return 1;
    }

    /**
     * Arranca formalmente una nueva jornada laboral en el spa, estableciendo
     * la bandera de actividad y reiniciando el conteo de clientes diarios.
     * Al finalizar, solicita automáticamente la llegada del primer paciente.
     */
    function startDay() {
        const currentDay = getCurrentDay();
        console.log(`[SpaLife DaySystem] Iniciando Jornada ${currentDay}...`);
        
        clientsCompletedToday = 0;
        dayActive = true;

        const targetClients = getMaxClientsForDay(currentDay);
        
        // Notificación opcional de inicio de día (manteniendo consistencia con la arquitectura)
        const msgInicio = `Día ${currentDay} iniciado. Meta: ${targetClients} clientes.`;
        if (window.SpaLife.showDialogue) {
            window.SpaLife.showDialogue("Sistema", msgInicio);
        }
        if (window.SpaLife.announce) {
            window.SpaLife.announce(msgInicio);
        }

        // Solicitar el ingreso del primer cliente de la jornada
        if (
            window.SpaLife.CustomerFlow &&
            typeof window.SpaLife.CustomerFlow.requestNextCustomer === 'function'
        ) {
            window.SpaLife.CustomerFlow.requestNextCustomer();
        }
    }

    /**
     * Verifica si la jornada activa ha alcanzado su límite de clientes permitidos.
     * @returns {boolean} True si se ha cumplido la meta del día, false en caso contrario.
     */
    function isDayFinished() {
        const currentDay = getCurrentDay();
        const targetClients = getMaxClientsForDay(currentDay);
        return clientsCompletedToday >= targetClients;
    }

    /**
     * Registra que un cliente ha finalizado completamente su ciclo en el spa.
     * Evalúa automáticamente si este cliente era el último de la jornada.
     */
    function registerClientCompleted() {
        if (!dayActive) return;

        clientsCompletedToday++;
        const currentDay = getCurrentDay();
        const target = getMaxClientsForDay(currentDay);
        
        console.log(`[SpaLife DaySystem] Cliente registrado. Avance: ${clientsCompletedToday}/${target}`);

        if (isDayFinished()) {
            endDay();
        }
    }

    /**
     * Finaliza la jornada actual, cierra la admisión, notifica al jugador, avanza 
     * el estado global de progresión temporal y transiciona hacia el próximo día.
     */
    async function endDay() {
        if (!dayActive) return;
        
        // Bloquear progreso adicional del día
        dayActive = false;
        console.log('[SpaLife DaySystem] Meta diaria alcanzada. Cerrando jornada.');

        // 1. Mostrar diálogo de finalización
        const msgFin = "Jornada completada";
        if (window.SpaLife.showDialogue) {
            window.SpaLife.showDialogue("Sistema", msgFin);
        }
        
        // 2. Anunciar a lectores de pantalla (TalkBack)
        if (window.SpaLife.announce) {
            window.SpaLife.announce(msgFin);
        }

        // 3. Avanzar GameState.currentDay de forma persistente
        if (window.SpaLife.GameState) {
            window.SpaLife.GameState.advanceDay();
            
            // Forzar actualización visual si el HUD está disponible
            if (window.SpaLife.HUD && typeof window.SpaLife.HUD.update === 'function') {
                window.SpaLife.HUD.update();
            }
        } else {
            console.warn('[SpaLife DaySystem] Advertencia: GameState no disponible para avanzar el día.');
        }

        // 4. Pausa dramática de 3 segundos
        await sleep(3000);

        // 5. Iniciar automáticamente el siguiente día
        startDay();
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================
    
    return {
        init: init,
        startDay: startDay,
        endDay: endDay,
        getCurrentDay: getCurrentDay,
        registerClientCompleted: registerClientCompleted,
        isDayFinished: isDayFinished
    };

})();
