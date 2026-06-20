/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Logros (Achievement System)
 * ============================================================
 * Nota: Este módulo funciona de manera transparente en segundo plano.
 * Su responsabilidad es monitorear las métricas de estado de forma
 * periódica y desbloquear logros en memoria, generando notificaciones
 * textuales sin interactuar directamente con la interfaz (DOM).
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.AchievementSystem = (function() {
    'use strict';

    // ============================================================
    // VARIABLES PRIVADAS Y ESTADO
    // ============================================================
    
    let monitorInterval = null;

    // FUTURO:
    // Los estados unlocked serán cargados y guardados
    // desde SaveSystem cuando dicho módulo exista.

    // ============================================================
    // BASE DE DATOS DE LOGROS
    // ============================================================
    
    const achievements = {
        firstClient: {
            id: 'first-client',
            name: 'Primer Cliente',
            description: 'Atiende tu primer cliente.',
            unlocked: false
        },
        tenClients: {
            id: 'ten-clients',
            name: 'Manos Expertas',
            description: 'Atiende 10 clientes.',
            unlocked: false
        },
        fiftyClients: {
            id: 'fifty-clients',
            name: 'Profesional del Bienestar',
            description: 'Atiende 50 clientes.',
            unlocked: false
        },
        firstPerfectMatch: {
            id: 'first-perfect',
            name: 'Diagnóstico Correcto',
            description: 'Realiza tu primer diagnóstico perfecto.',
            unlocked: false
        },
        twentyPerfectMatches: {
            id: 'twenty-perfect',
            name: 'Especialista',
            description: 'Obtén 20 diagnósticos perfectos.',
            unlocked: false
        },
        reputation100: {
            id: 'rep-100',
            name: 'Reconocido',
            description: 'Alcanza 100 de reputación.',
            unlocked: false
        },
        reputation500: {
            id: 'rep-500',
            name: 'Maestro del Spa',
            description: 'Alcanza 500 de reputación.',
            unlocked: false
        },
        wellness200: {
            id: 'wellness-200',
            name: 'Generador de Bienestar',
            description: 'Genera 200 puntos de bienestar.',
            unlocked: false
        }
    };

    // ============================================================
    // MÉTODOS PRIVADOS (LOGICA DE DESBLOQUEO)
    // ============================================================

    /**
     * Procesa el desbloqueo de un logro específico.
     * Previene duplicados y dispara las notificaciones visuales/auditivas.
     * @param {string} key - La clave interna del objeto achievements.
     */
    function unlockAchievement(key) {
        const achievement = achievements[key];
        
        // Protección contra logros inválidos
        if (!achievement) {
            console.warn(`[SpaLife AchievementSystem] Advertencia: Intento de desbloquear logro inválido (${key}).`);
            return;
        }

        // Evitar procesar logros que ya fueron desbloqueados
        if (achievement.unlocked) return;

        // Marcar como desbloqueado
        achievement.unlocked = true;

        // Generar notificación
        const msg = `Logro desbloqueado: ${achievement.name}`;

        if (typeof window.SpaLife.showDialogue === 'function') {
            window.SpaLife.showDialogue("Sistema", msg);
        }

        if (typeof window.SpaLife.announce === 'function') {
            window.SpaLife.announce(msg);
        }

        // Registrar en consola
        console.log(`[SpaLife AchievementSystem] ${msg}`);
    }

    // ============================================================
    // VERIFICACIONES
    // ============================================================

    /**
     * Consulta el GameState actual y evalúa individualmente si se
     * cumplen las condiciones para desbloquear algún logro pendiente.
     */
    function checkAchievements() {
        if (!window.SpaLife.GameState) return;

        const state = window.SpaLife.GameState.getState();

        // Evaluaciones de Clientes Atendidos
        if (!achievements.firstClient.unlocked && state.clientsServed >= 1) unlockAchievement('firstClient');
        if (!achievements.tenClients.unlocked && state.clientsServed >= 10) unlockAchievement('tenClients');
        if (!achievements.fiftyClients.unlocked && state.clientsServed >= 50) unlockAchievement('fiftyClients');

        // Evaluaciones de Aciertos en Diagnóstico (Perfect Matches)
        if (!achievements.firstPerfectMatch.unlocked && state.perfectMatches >= 1) unlockAchievement('firstPerfectMatch');
        if (!achievements.twentyPerfectMatches.unlocked && state.perfectMatches >= 20) unlockAchievement('twentyPerfectMatches');

        // Evaluaciones de Reputación
        if (!achievements.reputation100.unlocked && state.reputation >= 100) unlockAchievement('reputation100');
        if (!achievements.reputation500.unlocked && state.reputation >= 500) unlockAchievement('reputation500');

        // Evaluaciones de Bienestar
        if (!achievements.wellness200.unlocked && state.wellness >= 200) unlockAchievement('wellness200');
    }

    // ============================================================
    // MÉTODOS DE CICLO DE VIDA (LIFECYCLE)
    // ============================================================

    /**
     * Inicializa el sistema realizando una comprobación inmediata
     * e iniciando el ciclo constante de monitoreo, previniendo dobles instancias.
     */
    function init() {
        if (monitorInterval) {
            return; // Prevenir doble inicialización
        }
        
        console.log('[SpaLife AchievementSystem] Inicializando monitor de logros...');
        
        // Evaluación inmediata
        checkAchievements();

        // Ciclo automático (cada segundo)
        monitorInterval = setInterval(checkAchievements, 1000);
    }

    /**
     * Detiene los ciclos de monitoreo del sistema y libera la memoria.
     */
    function destroy() {
        if (monitorInterval) {
            clearInterval(monitorInterval);
            monitorInterval = null;
        }
        console.log('[SpaLife AchievementSystem] Destruido.');
    }

    /**
     * Restablece todos los logros a su estado original (bloqueados).
     * @returns {boolean} Confirmación de la operación.
     */
    function resetAchievements() {
        Object.values(achievements).forEach(achievement => {
            achievement.unlocked = false;
        });
        return true;
    }

    // ============================================================
    // API DE CONSULTA (GETTERS)
    // ============================================================

    /**
     * Devuelve el objeto de un logro específico.
     * @param {string} key - La clave interna del logro.
     * @returns {Object|null} El logro correspondiente o null si no existe.
     */
    function getAchievement(key) {
        return achievements[key] || null;
    }

    /**
     * Retorna todos los logros del sistema (bloqueados y desbloqueados).
     * @returns {Array} Un arreglo de objetos de logros.
     */
    function getAllAchievements() {
        return Object.values(achievements);
    }

    /**
     * Retorna únicamente la lista de logros que el jugador ya ha conseguido.
     * @returns {Array} Un arreglo de objetos de logros.
     */
    function getUnlockedAchievements() {
        return Object.values(achievements).filter(a => a.unlocked);
    }

    /**
     * Verifica si un logro específico se encuentra desbloqueado.
     * @param {string} key - La clave interna del logro.
     * @returns {boolean} Estado del logro.
     */
    function isUnlocked(key) {
        const achievement = achievements[key];
        return achievement ? achievement.unlocked : false;
    }

    /**
     * Obtiene la cantidad exacta de logros que han sido desbloqueados.
     * @returns {number} Número de logros completados.
     */
    function getUnlockedCount() {
        return getUnlockedAchievements().length;
    }

    /**
     * Obtiene la cantidad total de logros registrados en el sistema.
     * @returns {number} Número total de logros.
     */
    function getTotalAchievements() {
        return Object.keys(achievements).length;
    }

    /**
     * Calcula y retorna el porcentaje global de completitud de logros.
     * @returns {number} Número entero de 0 a 100.
     */
    function getCompletionPercentage() {
        const total = getTotalAchievements();
        if (total === 0) return 0;
        
        const unlocked = getUnlockedCount();
        return Math.round((unlocked / total) * 100);
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================

    return {
        init: init,
        destroy: destroy,
        
        checkAchievements: checkAchievements,
        
        getAchievement: getAchievement,
        getAllAchievements: getAllAchievements,
        
        getUnlockedAchievements: getUnlockedAchievements,
        
        getUnlockedCount: getUnlockedCount,
        getTotalAchievements: getTotalAchievements,
        
        isUnlocked: isUnlocked,
        
        resetAchievements: resetAchievements,
        
        getCompletionPercentage: getCompletionPercentage
    };

})();
