/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Gestor del Estado del Juego (Game State Manager)
 * ============================================================
 * Nota: Este archivo maneja la progresión, economía y persistencia
 * del juego utilizando localStorage. Es la fuente de verdad.
 * No contiene lógica de interfaz, renderizado ni simulación física.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.GameState = (function() {
    'use strict';

    // Clave de almacenamiento en localStorage
    const SAVE_KEY = 'spa-life-save';

    // Estado inicial por defecto para nuevos jugadores
    const defaultState = {
        level: 1,
        role: 'Recepcionista',
        coins: 0,
        reputation: 0,
        wellness: 0,
        clientsServed: 0,
        perfectMatches: 0,
        wrongMatches: 0,
        currentDay: 1,
        unlockedZones: [
            'Recepción'
        ]
    };

    // Objeto en memoria que almacena el estado actual
    let currentState = JSON.parse(JSON.stringify(defaultState));

    /**
     * Guarda el estado actual en el localStorage del navegador.
     */
    function saveGame() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(currentState));
        } catch (error) {
            console.error('[SpaLife GameState] Error al guardar el juego:', error);
        }
    }

    /**
     * Carga el estado guardado desde localStorage.
     * Si no existe o hay un error, mantiene el estado por defecto.
     */
    function loadGame() {
        try {
            const savedData = localStorage.getItem(SAVE_KEY);
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                // Combinar estado por defecto con el guardado para evitar llaves faltantes en actualizaciones
                currentState = { ...defaultState, ...parsedData };
                
                // Asegurar que unlockedZones sea un array y no se corrompa
                if (!Array.isArray(currentState.unlockedZones)) {
                    currentState.unlockedZones = [...defaultState.unlockedZones];
                }
            }
        } catch (error) {
            console.error('[SpaLife GameState] Error al cargar la partida guardada:', error);
            resetGame();
        }
    }

    /**
     * Borra el progreso actual y restablece el juego a su estado original.
     */
    function resetGame() {
        currentState = JSON.parse(JSON.stringify(defaultState));
        saveGame();
    }

    /**
     * Retorna una copia de solo lectura del estado actual.
     * @returns {Object} Copia del estado del juego.
     */
    function getState() {
        return JSON.parse(JSON.stringify(currentState));
    }

    /**
     * Actualiza múltiples propiedades del estado a la vez y guarda el progreso.
     * @param {Object} partialState - Objeto con las propiedades a actualizar.
     */
    function setState(partialState) {
        if (typeof partialState !== 'object' || partialState === null) return;
        currentState = { ...currentState, ...partialState };
        // Validación de monedas en caso de forzar un estado manual
        if (currentState.coins < 0) currentState.coins = 0;
        saveGame();
    }

    /**
     * Añade o resta monedas al jugador. Previene saldos negativos.
     * @param {number} amount - Cantidad de monedas a sumar (o restar si es negativo).
     */
    function addCoins(amount) {
        currentState.coins += amount;
        if (currentState.coins < 0) {
            currentState.coins = 0;
        }
        saveGame();
    }

    /**
     * Añade puntos de reputación al jugador.
     * @param {number} amount - Puntos de reputación a sumar.
     */
    function addReputation(amount) {
        currentState.reputation += amount;
        saveGame();
    }

    /**
     * Añade puntos a la métrica principal del juego: El Bienestar.
     * @param {number} amount - Puntos de bienestar generados.
     */
    function addWellness(amount) {
        currentState.wellness += amount;
        saveGame();
    }

    /**
     * Incrementa el contador total de clientes atendidos en 1.
     */
    function incrementClientsServed() {
        currentState.clientsServed += 1;
        saveGame();
    }

    /**
     * Incrementa el contador de terapias asignadas correctamente.
     */
    function incrementPerfectMatches() {
        currentState.perfectMatches += 1;
        saveGame();
    }

    /**
     * Incrementa el contador de terapias asignadas incorrectamente.
     */
    function incrementWrongMatches() {
        currentState.wrongMatches += 1;
        saveGame();
    }

    /**
     * Desbloquea una nueva zona en el spa, evitando duplicados.
     * @param {string} zoneName - El nombre de la zona a desbloquear.
     */
    function unlockZone(zoneName) {
        if (!currentState.unlockedZones.includes(zoneName)) {
            currentState.unlockedZones.push(zoneName);
            saveGame();
        }
    }

    /**
     * Avanza el contador de días simulados dentro del juego.
     */
    function advanceDay() {
        currentState.currentDay += 1;
        saveGame();
    }

    // -------------------------------------------------------------------------
    // Inicialización automática: Intentar cargar la partida al cargar el script
    // -------------------------------------------------------------------------
    loadGame();

    // EXPOSICIÓN DE LA API PÚBLICA
    return {
        getState: getState,
        setState: setState,
        addCoins: addCoins,
        addReputation: addReputation,
        addWellness: addWellness,
        incrementClientsServed: incrementClientsServed,
        incrementPerfectMatches: incrementPerfectMatches,
        incrementWrongMatches: incrementWrongMatches,
        unlockZone: unlockZone,
        advanceDay: advanceDay,
        saveGame: saveGame,
        loadGame: loadGame,
        resetGame: resetGame
    };

})();
