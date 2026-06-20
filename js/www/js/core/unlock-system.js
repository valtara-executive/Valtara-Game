/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Desbloqueos (Unlock System)
 * ============================================================
 * Nota: Este módulo gestiona los desbloqueos automáticos de 
 * nuevas áreas del spa conforme el jugador avanza de nivel.
 * Opera en segundo plano monitoreando el estado del jugador.
 * No modifica progresiones de nivel ni economías.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.UnlockSystem = (function() {
    'use strict';

    // ============================================================
    // VARIABLES PRIVADAS Y CONFIGURACIÓN
    // ============================================================

    // Registro interno para prevenir notificaciones y ejecuciones duplicadas
    const unlockedRewards = {};

    // Mapa de recompensas por nivel (id de zona y nombre a mostrar)
    const unlockMap = {
        3: { id: 'clinic-room', name: 'Consultorio Clínico' },
        5: { id: 'premium-area', name: 'Área Premium' },
        7: { id: 'cabin-2', name: 'Cabina 2' },
        9: { id: 'vip-lounge', name: 'Sala VIP' }
    };

    // ============================================================
    // MÉTODOS DE LÓGICA (CORE)
    // ============================================================

    /**
     * Verifica el nivel actual del jugador contra el mapa de desbloqueos.
     * Si el jugador cumple los requisitos y la zona no ha sido desbloqueada antes,
     * procesa la apertura, notifica a los sistemas visuales y muestra mensajes.
     */
    function checkUnlocks() {
        // 1. Consultar dependencias
        if (!window.SpaLife.GameState) return;

        // 2. Obtener nivel actual
        const state = window.SpaLife.GameState.getState();
        const currentLevel = state.level || 1;

        // 3. Evaluar recompensas pendientes
        for (const levelReq in unlockMap) {
            const requiredLevel = parseInt(levelReq, 10);

            if (currentLevel >= requiredLevel) {
                const zoneData = unlockMap[requiredLevel];
                const zoneId = zoneData.id;
                const zoneName = zoneData.name;

                // Prevenir desbloqueos duplicados
                if (!unlockedRewards[zoneId]) {
                    
                    // 4. Desbloquear zona en el ZoneSystem si el módulo está disponible
                    // Evita errores fatales en caso de que ZoneSystem o la zona no existan aún
                    if (window.SpaLife.ZoneSystem && typeof window.SpaLife.ZoneSystem.unlockZone === 'function') {
                        window.SpaLife.ZoneSystem.unlockZone(zoneId);
                    } else {
                        console.warn(`[SpaLife UnlockSystem] Advertencia: ZoneSystem no disponible para desbloquear ${zoneId}.`);
                    }

                    // 5. Registrar el desbloqueo internamente de inmediato
                    unlockedRewards[zoneId] = true;

                    // 6 & 7. Mostrar diálogo y anunciar mediante TalkBack
                    const unlockMessage = `Nueva zona desbloqueada: ${zoneName}`;
                    
                    if (typeof window.SpaLife.showDialogue === 'function') {
                        window.SpaLife.showDialogue("Sistema", unlockMessage);
                    }

                    if (typeof window.SpaLife.announce === 'function') {
                        window.SpaLife.announce(unlockMessage);
                    }
                }
            }
        }
    }

    // ============================================================
    // INICIALIZACIÓN
    // ============================================================

    /**
     * Arranca el servicio de monitoreo de desbloqueos.
     * Ejecuta una revisión inicial y establece un bucle de comprobación.
     */
    function init() {
        console.log('[SpaLife UnlockSystem] Inicializando sistema de desbloqueos...');
        
        // Ejecución inmediata al arrancar
        checkUnlocks();

        // Ciclo automático de validación en segundo plano (cada 1000ms)
        setInterval(() => {
            checkUnlocks();
        }, 1000);
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================
    
    return {
        init: init,
        checkUnlocks: checkUnlocks
    };

})();
