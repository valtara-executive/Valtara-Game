/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de VIPs (VIP System)
 * ============================================================
 * Nota: Este módulo gestiona la aparición y recompensas de 
 * clientes VIP. Funciona de manera independiente y en segundo
 * plano, trabajando únicamente con datos.
 * Prepara la arquitectura para futura integración con ReceptionGameplay.
 * * // FUTURO:
 * //
 * // EventSystem podrá aumentar la
 * // probabilidad de aparición VIP.
 * //
 * // ReceptionGameplay podrá convertir
 * // clientes normales en VIP.
 * //
 * // SaveSystem persistirá estadísticas VIP.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.VIPSystem = (function() {
    'use strict';

    // ============================================================
    // BASE DE DATOS DE PERFILES VIP
    // ============================================================
    
    const vipProfiles = [
        {
            id: 'vip-001',
            name: 'Empresario Local',
            bonusCoins: 100,
            bonusReputation: 20
        },
        {
            id: 'vip-002',
            name: 'Influencer Wellness',
            bonusCoins: 150,
            bonusReputation: 30
        },
        {
            id: 'vip-003',
            name: 'Doctor Reconocido',
            bonusCoins: 200,
            bonusReputation: 40
        },
        {
            id: 'vip-004',
            name: 'Celebridad',
            bonusCoins: 300,
            bonusReputation: 60
        }
    ];

    // ============================================================
    // VARIABLES PRIVADAS Y ESTADO INTERNO
    // ============================================================
    
    let currentVIP = null;
    let vipArrivedToday = false;
    let monitorInterval = null;
    let lastKnownDay = 1;

    let vipCounter = 0;
    let totalVIPsSpawned = 0;
    let totalVIPsCompleted = 0;

    // ============================================================
    // MÉTODOS CORE
    // ============================================================

    /**
     * Retorna una copia de solo lectura de la base de datos de perfiles VIP.
     * @returns {Array} Copia del arreglo de perfiles VIP.
     */
    function getVIPDatabase() {
        return [...vipProfiles];
    }

    /**
     * Selecciona y retorna una copia de un perfil VIP aleatorio.
     * @returns {Object} Copia del objeto VIP.
     */
    function generateVIP() {
        const randomIndex = Math.floor(Math.random() * vipProfiles.length);
        return { ...vipProfiles[randomIndex] };
    }

    /**
     * Evalúa si es posible generar un VIP en el momento actual.
     * @returns {boolean} True si se cumplen las condiciones de probabilidad (15%) y límite diario.
     */
    function canSpawnVIP() {
        if (vipArrivedToday) {
            return false;
        }
        return Math.random() < 0.15;
    }

    /**
     * Intenta instanciar un nuevo VIP, marcando el límite diario y emitiendo notificaciones.
     * @returns {boolean} True si el VIP fue generado con éxito, false si ya existía uno.
     */
    function spawnVIP() {
        if (currentVIP) {
            return false;
        }

        // Generar VIP y agregar instance ID
        currentVIP = {
            ...generateVIP(),
            instanceId: ++vipCounter
        };
        
        vipArrivedToday = true;
        totalVIPsSpawned++;

        const msg = `Cliente VIP en camino: ${currentVIP.name}`;

        if (typeof window.SpaLife.showDialogue === 'function') {
            window.SpaLife.showDialogue("Sistema", msg);
        }

        if (typeof window.SpaLife.announce === 'function') {
            window.SpaLife.announce(msg);
        }

        console.log(`[SpaLife VIPSystem] ${msg}`);

        return true;
    }

    /**
     * Otorga las recompensas asociadas al VIP activo tras finalizar su tratamiento
     * y limpia la variable de estado.
     */
    function completeVIPVisit() {
        if (!currentVIP) {
            return;
        }

        // Proteger otorgamiento de recompensas asegurando la existencia del GameState y sus métodos
        if (
            window.SpaLife.GameState &&
            typeof window.SpaLife.GameState.addCoins === 'function' &&
            typeof window.SpaLife.GameState.addReputation === 'function'
        ) {
            window.SpaLife.GameState.addCoins(currentVIP.bonusCoins);
            window.SpaLife.GameState.addReputation(currentVIP.bonusReputation);
        } else {
            console.warn('[SpaLife VIPSystem] GameState no disponible para otorgar recompensas VIP.');
        }

        const msg = `VIP satisfecho: ${currentVIP.name}`;

        if (typeof window.SpaLife.showDialogue === 'function') {
            window.SpaLife.showDialogue("Sistema", msg);
        }

        if (typeof window.SpaLife.announce === 'function') {
            window.SpaLife.announce(msg);
        }

        console.log(`[SpaLife VIPSystem] ${msg}`);

        totalVIPsCompleted++;
        currentVIP = null;
    }

    /**
     * Reinicia el límite de visitas diarias para permitir la aparición de un nuevo VIP.
     */
    function resetDailyVIP() {
        vipArrivedToday = false;
    }

    /**
     * Retorna la información del cliente VIP actualmente activo.
     * @returns {Object|null} Objeto VIP o null.
     */
    function getCurrentVIP() {
        return currentVIP;
    }

    /**
     * Verifica si existe un cliente VIP activo en el spa.
     * @returns {boolean} True si hay un VIP.
     */
    function hasActiveVIP() {
        return currentVIP !== null;
    }

    /**
     * Detecta los cambios de día para restablecer la disponibilidad
     * e intenta instanciar un VIP basado en probabilidades.
     */
    function update() {
        // Protección y lectura del día actual
        let currentDay = lastKnownDay;
        
        if (window.SpaLife.DaySystem && typeof window.SpaLife.DaySystem.getCurrentDay === 'function') {
            currentDay = window.SpaLife.DaySystem.getCurrentDay();
        }

        // Detectar si el día ha cambiado
        if (currentDay !== lastKnownDay) {
            lastKnownDay = currentDay;
            
            // Reiniciar estado diario
            resetDailyVIP();

            // Intentar generar un VIP
            if (canSpawnVIP()) {
                spawnVIP();
            }
        }
    }

    // ============================================================
    // MÉTODOS DE ESTADÍSTICAS Y CONTROL
    // ============================================================

    /**
     * Retorna la cantidad total de VIPs que han sido generados.
     * @returns {number}
     */
    function getTotalVIPsSpawned() {
        return totalVIPsSpawned;
    }

    /**
     * Retorna la cantidad total de VIPs que han completado su visita exitosamente.
     * @returns {number}
     */
    function getTotalVIPsCompleted() {
        return totalVIPsCompleted;
    }

    /**
     * Restablece el sistema a su estado inicial.
     */
    function reset() {
        currentVIP = null;
        vipArrivedToday = false;
        lastKnownDay = 1;
        totalVIPsSpawned = 0;
        totalVIPsCompleted = 0;
    }

    // ============================================================
    // MÉTODOS DE CICLO DE VIDA
    // ============================================================

    /**
     * Inicializa el monitor de VIPs de forma segura previniendo dobles instancias.
     */
    function init() {
        if (monitorInterval) {
            return;
        }

        console.log('[SpaLife VIPSystem] Inicializado.');

        if (window.SpaLife.DaySystem && typeof window.SpaLife.DaySystem.getCurrentDay === 'function') {
            lastKnownDay = window.SpaLife.DaySystem.getCurrentDay();
        } else {
            lastKnownDay = 1;
        }

        // Iniciar intervalo de 5 segundos
        monitorInterval = setInterval(update, 5000);
    }

    /**
     * Detiene el monitor y limpia referencias de memoria.
     */
    function destroy() {
        if (monitorInterval) {
            clearInterval(monitorInterval);
            monitorInterval = null;
        }
        
        reset();
        
        console.log('[SpaLife VIPSystem] Destruido.');
    }

    // ============================================================
    // EXPOSICIÓN DE LA API
    // ============================================================

    return {
        init,
        destroy,
        
        getVIPDatabase,
        generateVIP,
        
        canSpawnVIP,
        spawnVIP,
        completeVIPVisit,
        
        resetDailyVIP,
        
        getCurrentVIP,
        hasActiveVIP,
        
        getTotalVIPsSpawned,
        getTotalVIPsCompleted,
        
        update,
        
        reset
    };

})();
