/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Estadísticas (Statistics System)
 * ============================================================
 * Nota: Este módulo funciona exclusivamente como una capa analítica.
 * No renderiza elementos visuales ni modifica el estado del juego.
 * Su responsabilidad es consultar el GameState, calcular métricas 
 * derivadas y proporcionar reportes de rendimiento.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.StatisticsSystem = (function() {
    'use strict';

    // ============================================================
    // MÉTODOS PRIVADOS (UTILIDADES)
    // ============================================================

    /**
     * Obtiene el estado actual del juego de forma segura.
     * @returns {Object} El estado actual o un objeto con valores por defecto.
     */
    function _getState() {
        if (window.SpaLife.GameState) {
            return window.SpaLife.GameState.getState();
        }
        console.warn('[SpaLife StatisticsSystem] GameState no disponible. Retornando valores nulos.');
        return {
            coins: 0,
            reputation: 0,
            wellness: 0,
            level: 1,
            role: 'Recepcionista',
            currentDay: 1,
            clientsServed: 0,
            perfectMatches: 0,
            wrongMatches: 0
        };
    }

    // ============================================================
    // MÉTODOS PÚBLICOS (API)
    // ============================================================

    /**
     * Inicializa el sistema analítico.
     */
    function init() {
        console.log('[SpaLife StatisticsSystem] Inicializado.');
    }

    /**
     * Retorna un resumen de los datos crudos desde el GameState.
     * @returns {Object} Resumen de métricas principales.
     */
    function getSummary() {
        const state = _getState();
        return {
            coins: state.coins || 0,
            reputation: state.reputation || 0,
            wellness: state.wellness || 0,
            level: state.level || 1,
            role: state.role || 'Recepcionista',
            currentDay: state.currentDay || 1,
            clientsServed: state.clientsServed || 0,
            perfectMatches: state.perfectMatches || 0,
            wrongMatches: state.wrongMatches || 0
        };
    }

    /**
     * Calcula la tasa de éxito general en asignación de terapias.
     * @returns {number} Porcentaje de éxito (número entero). Retorna 0 si no hay partidas.
     */
    function getSuccessRate() {
        const state = _getState();
        const perfect = state.perfectMatches || 0;
        const wrong = state.wrongMatches || 0;
        const totalMatches = perfect + wrong;

        if (totalMatches === 0) {
            return 0;
        }

        return Math.round((perfect / totalMatches) * 100);
    }

    /**
     * Calcula el promedio de bienestar generado por cada cliente atendido.
     * @returns {number} Promedio de bienestar. Retorna 0 si no hay clientes.
     */
    function getAverageWellnessPerClient() {
        const state = _getState();
        const clients = state.clientsServed || 0;

        if (clients === 0) {
            return 0;
        }

        return (state.wellness || 0) / clients;
    }

    /**
     * Calcula el promedio de reputación obtenida por cada cliente atendido.
     * @returns {number} Promedio de reputación. Retorna 0 si no hay clientes.
     */
    function getAverageReputationPerClient() {
        const state = _getState();
        const clients = state.clientsServed || 0;

        if (clients === 0) {
            return 0;
        }

        return (state.reputation || 0) / clients;
    }

    /**
     * Calcula el promedio de monedas ganadas por cada cliente atendido.
     * @returns {number} Promedio de monedas. Retorna 0 si no hay clientes.
     */
    function getAverageCoinsPerClient() {
        const state = _getState();
        const clients = state.clientsServed || 0;

        if (clients === 0) {
            return 0;
        }

        return (state.coins || 0) / clients;
    }

    /**
     * Evalúa el rendimiento del jugador basándose en su reputación total.
     * @returns {string} El rango de rendimiento actual.
     */
    function getPerformanceRank() {
        const state = _getState();
        const rep = state.reputation || 0;

        if (rep <= 49) return 'Principiante';
        if (rep <= 119) return 'Promesa';
        if (rep <= 219) return 'Profesional';
        if (rep <= 349) return 'Especialista';
        if (rep <= 499) return 'Experto';
        if (rep <= 699) return 'Maestro';
        return 'Leyenda del Bienestar';
    }

    /**
     * Devuelve un reporte analítico completo combinando todas las métricas calculadas.
     * @returns {Object} Reporte estadístico completo.
     */
    function getFullReport() {
        return {
            summary: getSummary(),
            successRate: getSuccessRate(),
            averageCoinsPerClient: getAverageCoinsPerClient(),
            averageReputationPerClient: getAverageReputationPerClient(),
            averageWellnessPerClient: getAverageWellnessPerClient(),
            performanceRank: getPerformanceRank()
        };
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================
    
    return {
        init: init,
        getSummary: getSummary,
        getSuccessRate: getSuccessRate,
        getAverageCoinsPerClient: getAverageCoinsPerClient,
        getAverageReputationPerClient: getAverageReputationPerClient,
        getAverageWellnessPerClient: getAverageWellnessPerClient,
        getPerformanceRank: getPerformanceRank,
        getFullReport: getFullReport
    };

})();
