/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Misiones (Mission System) - Arquitectura 2026
 * ============================================================
 * Nota: Este módulo gestiona las misiones dinámicas y los
 * objetivos del jugador. Funciona completamente en segundo plano,
 * sin generar interfaces visuales (DOM) propias.
 * * ============================================================
 * COMPATIBILIDAD FUTURA (ARQUITECTURA 2026)
 * ============================================================
 * - SaveSystem: Podrá exportar e importar el estado completo 
 * del sistema usando exportData() e importData().
 * - NotificationSystem: Reemplazará al helper interno notify() 
 * para centralizar la emisión de mensajes.
 * - AchievementSystem: Podrá consultar hitos de misiones superadas.
 * - VIPSystem: Integrado como un tipo de objetivo evaluable.
 * - AnalyticsSystem: Podrá suscribirse a los eventos de misión completada
 * para llevar métricas del jugador.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.MissionSystem = (function() {
    'use strict';

    // ============================================================
    // CONSTANTES Y CONFIGURACIÓN
    // ============================================================
    
    // Límite máximo del historial para evitar desbordamientos de memoria
    const MAX_HISTORY = 100;

    // ============================================================
    // BASE DE DATOS DE MISIONES
    // ============================================================
    
    const missionTemplates = [
        {
            id: 'serve-clients',
            name: 'Atender Clientes',
            description: 'Atiende 5 clientes.',
            target: 5,
            rewardCoins: 100,
            rewardReputation: 10,
            type: 'clientsServed'
        },
        {
            id: 'perfect-matches',
            name: 'Diagnósticos Perfectos',
            description: 'Obtén 3 diagnósticos perfectos.',
            target: 3,
            rewardCoins: 150,
            rewardReputation: 15,
            type: 'perfectMatches'
        },
        {
            id: 'earn-reputation',
            name: 'Construir Reputación',
            description: 'Obtén 50 puntos de reputación.',
            target: 50,
            rewardCoins: 200,
            rewardReputation: 20,
            type: 'reputation'
        },
        {
            id: 'vip-visit',
            name: 'Cliente VIP',
            description: 'Completa una visita VIP.',
            target: 1,
            rewardCoins: 300,
            rewardReputation: 30,
            type: 'vipCompleted'
        }
    ];

    // ============================================================
    // VARIABLES PRIVADAS Y ESTADO INTERNO
    // ============================================================
    
    let activeMission = null;
    let completedMissions = [];
    let missionCounter = 0;
    let monitorInterval = null;
    let lastMissionTemplateId = null;

    // ============================================================
    // MÉTODOS PRIVADOS (UTILIDADES Y HELPERS)
    // ============================================================

    /**
     * Centraliza la emisión de notificaciones al jugador.
     * PREPARACIÓN FUTURA: Este helper redirigirá todo a NotificationSystem.notify().
     * @param {string} message - El texto a notificar.
     */
    function notify(message) {
        if (typeof window.SpaLife.showDialogue === 'function') {
            window.SpaLife.showDialogue("Sistema", message);
        }

        if (typeof window.SpaLife.announce === 'function') {
            window.SpaLife.announce(message);
        }

        console.log(`[SpaLife MissionSystem] ${message}`);
    }

    /**
     * Obtiene el valor absoluto histórico de la métrica solicitada 
     * leyendo directamente desde el GameState o el VIPSystem.
     * @param {string} type - El tipo de métrica a consultar.
     * @returns {number} Valor total acumulado de la métrica (seguro contra NaN).
     */
    function _getCurrentAbsoluteValue(type) {
        let value = 0;

        if (type === 'vipCompleted') {
            if (window.SpaLife.VIPSystem && typeof window.SpaLife.VIPSystem.getTotalVIPsCompleted === 'function') {
                value = window.SpaLife.VIPSystem.getTotalVIPsCompleted();
            }
        } else if (window.SpaLife.GameState) {
            const state = window.SpaLife.GameState.getState();
            if (type === 'clientsServed') value = state.clientsServed;
            if (type === 'perfectMatches') value = state.perfectMatches;
            if (type === 'reputation') value = state.reputation;
        }

        return (typeof value === 'number' && isFinite(value) && !isNaN(value)) ? value : 0;
    }

    // ============================================================
    // MÉTODOS CORE
    // ============================================================

    /**
     * Elige una misión aleatoria de la base de datos garantizando que 
     * no sea idéntica a la última misión generada.
     * @returns {Object} Copia de la plantilla de la misión generada con su instanceId.
     */
    function generateMission() {
        if (missionTemplates.length === 0) return null;

        let randomIndex;
        let template;

        // Bucle de prevención de repetición consecutiva (si hay más de 1 plantilla)
        if (missionTemplates.length > 1) {
            do {
                randomIndex = Math.floor(Math.random() * missionTemplates.length);
                template = missionTemplates[randomIndex];
            } while (template.id === lastMissionTemplateId);
        } else {
            template = missionTemplates[0];
        }

        // Actualizar el historial de última misión generada
        lastMissionTemplateId = template.id;

        return {
            ...template,
            instanceId: ++missionCounter
        };
    }

    /**
     * Intenta iniciar una nueva misión aleatoria si no existe ninguna en curso.
     * @returns {boolean} True si se inició una nueva misión, false si ya había una activa.
     */
    function startMission() {
        if (activeMission) {
            return false;
        }

        const newMission = generateMission();
        
        // Registrar el valor inicial de la métrica para calcular el progreso posterior
        newMission.startValue = _getCurrentAbsoluteValue(newMission.type);
        
        activeMission = newMission;

        // Utilizar el nuevo helper centralizado
        notify(`Nueva misión: ${activeMission.name}`);

        return true;
    }

    /**
     * Calcula y retorna el progreso de la misión actual en curso de forma robusta.
     * Nunca retorna negativos, NaN o Infinity.
     * @returns {number} Progreso acumulado (siempre un número finito y válido >= 0).
     */
    function getMissionProgress() {
        if (!activeMission) return 0;

        const currentAbsValue = _getCurrentAbsoluteValue(activeMission.type);
        let progress = currentAbsValue - activeMission.startValue;

        // Filtro estricto de seguridad numérica
        if (isNaN(progress) || !isFinite(progress)) {
            progress = 0;
        }

        // Evitar progresos negativos
        return Math.max(0, progress);
    }

    /**
     * Monitorea el progreso de la misión activa.
     * Si el progreso alcanza o supera el objetivo, desencadena la finalización.
     */
    function checkMission() {
        if (!activeMission) {
            return;
        }

        const progress = getMissionProgress();

        if (progress >= activeMission.target) {
            completeMission();
        }
    }

    /**
     * Cierra la misión actual, otorga recompensas al jugador, guarda el 
     * historial limitando su crecimiento y arranca automáticamente la siguiente.
     */
    function completeMission() {
        if (!activeMission) return;

        const missionToComplete = activeMission;

        // Otorgar recompensas en el GameState
        if (
            window.SpaLife.GameState &&
            typeof window.SpaLife.GameState.addCoins === 'function' &&
            typeof window.SpaLife.GameState.addReputation === 'function'
        ) {
            window.SpaLife.GameState.addCoins(missionToComplete.rewardCoins);
            window.SpaLife.GameState.addReputation(missionToComplete.rewardReputation);
        } else {
            console.warn('[SpaLife MissionSystem] GameState no disponible para otorgar recompensas de misión.');
        }

        // Guardar misión en el historial
        completedMissions.push({
            ...missionToComplete,
            completedAt: Date.now()
        });

        // Limitar tamaño del historial para prevención de desbordamientos
        if (completedMissions.length > MAX_HISTORY) {
            completedMissions.shift();
        }

        // Utilizar el helper de notificaciones
        notify(`Misión completada: ${missionToComplete.name}`);

        // Eliminar misión activa actual y arrancar la siguiente
        activeMission = null;
        startMission();
    }

    // ============================================================
    // EXPORTACIÓN E IMPORTACIÓN DE DATOS (SAVE SYSTEM READY)
    // ============================================================

    /**
     * Exporta el estado interno completo del sistema para su persistencia.
     * No utiliza localStorage; simplemente devuelve el bloque de datos estructurado.
     * @returns {Object} Estado crítico actual del MissionSystem.
     */
    function exportData() {
        return {
            activeMission: activeMission ? { ...activeMission } : null,
            completedMissions: [...completedMissions],
            missionCounter: missionCounter,
            lastMissionTemplateId: lastMissionTemplateId
        };
    }

    /**
     * Importa y restaura el estado interno a partir de un objeto de datos válido.
     * Utiliza validaciones de seguridad para no lanzar excepciones si data es corrupto.
     * @param {Object} data - Objeto previamente generado por exportData().
     */
    function importData(data) {
        if (!data || typeof data !== 'object') {
            return; // Fallback silencioso ante datos inválidos
        }

        if (data.activeMission !== undefined) {
            activeMission = data.activeMission;
        }

        if (Array.isArray(data.completedMissions)) {
            // Asegurarnos de que no exceda el límite permitido al importar
            completedMissions = data.completedMissions.slice(-MAX_HISTORY);
        }

        if (typeof data.missionCounter === 'number' && isFinite(data.missionCounter)) {
            missionCounter = data.missionCounter;
        }

        if (data.lastMissionTemplateId !== undefined) {
            lastMissionTemplateId = data.lastMissionTemplateId;
        }
    }

    // ============================================================
    // MÉTODOS DE CONSULTA Y LIMPIEZA
    // ============================================================

    /**
     * Retorna la misión activa actualmente.
     * @returns {Object|null}
     */
    function getActiveMission() {
        return activeMission;
    }

    /**
     * Retorna el arreglo completo de misiones superadas con éxito.
     * @returns {Array}
     */
    function getCompletedMissions() {
        return [...completedMissions];
    }

    /**
     * Retorna la cantidad total de misiones completadas en la sesión actual o importada.
     * @returns {number}
     */
    function getCompletedCount() {
        return completedMissions.length;
    }

    /**
     * Restablece por completo el estado del sistema.
     */
    function reset() {
        activeMission = null;
        completedMissions = [];
        missionCounter = 0;
        lastMissionTemplateId = null;
    }

    // ============================================================
    // CICLO DE VIDA (LIFECYCLE)
    // ============================================================

    /**
     * Inicializa el sistema, arranca la primera misión y establece
     * el ciclo de comprobación continua de forma segura.
     */
    function init() {
        if (monitorInterval) {
            return; // Prevenir doble inicialización
        }

        console.log('[SpaLife MissionSystem] Inicializado.');

        // Crear la primera misión si no hay una cargada por el SaveSystem
        if (!activeMission) {
            startMission();
        }

        // Arrancar intervalo de revisión constante
        monitorInterval = setInterval(checkMission, 1000);
    }

    /**
     * Detiene los ciclos de memoria y restablece el sistema.
     */
    function destroy() {
        if (monitorInterval) {
            clearInterval(monitorInterval);
            monitorInterval = null;
        }

        reset();
        
        console.log('[SpaLife MissionSystem] Destruido.');
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================

    return {
        init,
        destroy,
        
        generateMission,
        startMission,
        checkMission,
        completeMission,
        
        getMissionProgress,
        getActiveMission,
        getCompletedMissions,
        getCompletedCount,
        
        exportData,
        importData,
        
        reset
    };

})();
