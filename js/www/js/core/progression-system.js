/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Progresión (Progression System)
 * ============================================================
 * Nota: Este módulo gestiona el avance de nivel del jugador
 * basándose en su reputación de forma completamente automática.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.ProgressionSystem = (function() {
    'use strict';

    // ============================================================
    // VARIABLES PRIVADAS Y DATOS DE CONFIGURACIÓN
    // ============================================================

    const levelRequirements = [
        { level: 10, minReputation: 1600 },
        { level: 9, minReputation: 1250 },
        { level: 8, minReputation: 950 },
        { level: 7, minReputation: 700 },
        { level: 6, minReputation: 500 },
        { level: 5, minReputation: 350 },
        { level: 4, minReputation: 220 },
        { level: 3, minReputation: 120 },
        { level: 2, minReputation: 50 },
        { level: 1, minReputation: 0 }
    ];

    const roles = {
        1: 'Recepcionista',
        2: 'Recepcionista Senior',
        3: 'Terapeuta Junior',
        4: 'Terapeuta Clínico',
        5: 'Especialista',
        6: 'Supervisor',
        7: 'Coordinador',
        8: 'Gerente',
        9: 'Director Operativo',
        10: 'Director General'
    };

    // ============================================================
    // MÉTODOS DE LÓGICA
    // ============================================================

    /**
     * Retorna el nivel correspondiente a una cantidad de reputación dada.
     * @param {number} reputation - La reputación actual del jugador.
     * @returns {number} El nivel calculado.
     */
    function getLevelFromReputation(reputation) {
        // Iteramos de mayor a menor para encontrar el nivel más alto cumplido
        for (let i = 0; i < levelRequirements.length; i++) {
            if (reputation >= levelRequirements[i].minReputation) {
                return levelRequirements[i].level;
            }
        }
        return 1; // Nivel base por seguridad
    }

    /**
     * Retorna el nombre del rol asociado a un nivel.
     * @param {number} level - El nivel del jugador.
     * @returns {string} El nombre del rol.
     */
    function getRoleForLevel(level) {
        return roles[level] || roles[1];
    }

    /**
     * Aplica el nuevo nivel y rol al estado del juego y notifica al jugador.
     * @param {number} level - El nuevo nivel alcanzado.
     */
    function applyLevel(level) {
        const roleName = getRoleForLevel(level);

        // Actualizar el estado del juego
        window.SpaLife.GameState.setState({
            level: level,
            role: roleName
        });

        // Generar retroalimentación visual y auditiva
        const message = `¡Ascenso! Ahora eres ${roleName}`;
        
        if (typeof window.SpaLife.showDialogue === 'function') {
            window.SpaLife.showDialogue('Sistema', message);
        }
        
        if (typeof window.SpaLife.announce === 'function') {
            window.SpaLife.announce(message);
        }
    }

    /**
     * Verifica periódicamente si el jugador ha ganado suficiente reputación
     * para subir de nivel.
     */
    function checkLevelUp() {
        if (!window.SpaLife.GameState) return;

        const state = window.SpaLife.GameState.getState();
        const expectedLevel = getLevelFromReputation(state.reputation);

        // Evaluar si corresponde un ascenso
        if (expectedLevel > state.level) {
            applyLevel(expectedLevel);
        }
    }

    // ============================================================
    // MODO AUTOMÁTICO
    // ============================================================

    // Ejecutar la comprobación de nivel en segundo plano de forma automática
    setInterval(checkLevelUp, 1000);

    // EXPOSICIÓN DE LA API PÚBLICA
    return {
        checkLevelUp: checkLevelUp,
        getLevelFromReputation: getLevelFromReputation,
        getRoleForLevel: getRoleForLevel,
        applyLevel: applyLevel
    };

})();
