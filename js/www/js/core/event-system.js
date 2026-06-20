/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema Global de Eventos (Event System)
 * ============================================================
 * Nota: Este módulo funciona como un servicio autónomo en segundo 
 * plano. Gestiona la ocurrencia de eventos aleatorios que afectan
 * el transcurso de los días en el spa.
 * No crea interfaz visual ni interactúa directamente con el DOM.
 * * // FUTURO:
 * // NotificationSystem
 * // VIPSystem
 * // MissionSystem
 * // EconomySystem
 * // podrán escuchar los eventos activos
 * // mediante getActiveEvent().
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.EventSystem = (function() {
    'use strict';

    // ============================================================
    // BASE DE DATOS DE EVENTOS
    // ============================================================
    
    const eventsDatabase = [
        {
            id: 'happy-day',
            name: 'Día Afortunado',
            description: 'Los clientes generan más reputación.',
            durationDays: 1
        },
        {
            id: 'social-media',
            name: 'Mención en Redes',
            description: 'Aumenta la llegada de clientes.',
            durationDays: 2
        },
        {
            id: 'promotion-week',
            name: 'Semana Promocional',
            description: 'Mayor flujo de visitantes.',
            durationDays: 3
        },
        {
            id: 'vip-visit',
            name: 'Visita VIP',
            description: 'Un cliente VIP visitará el spa.',
            durationDays: 1
        },
        {
            id: 'inspection',
            name: 'Inspección Sanitaria',
            description: 'Se evaluará la calidad del spa.',
            durationDays: 1
        }
    ];

    // ============================================================
    // VARIABLES PRIVADAS Y ESTADO INTERNO
    // ============================================================
    
    let activeEvent = null;
    let lastKnownDay = 1;
    let monitorInterval = null;
    
    // Contadores de instancias e historial de eventos
    let eventCounter = 0;
    let totalEventsTriggered = 0;
    let totalEventsCompleted = 0;

    // ============================================================
    // MÉTODOS DE LÓGICA CORE
    // ============================================================

    /**
     * Retorna una copia de solo lectura de la base de datos de eventos.
     * @returns {Array} Copia del arreglo de eventos.
     */
    function getEventsDatabase() {
        return [...eventsDatabase];
    }

    /**
     * Selecciona y retorna un evento aleatorio de la base de datos.
     * @returns {Object} Plantilla del evento seleccionado.
     */
    function generateRandomEvent() {
        const randomIndex = Math.floor(Math.random() * eventsDatabase.length);
        return eventsDatabase[randomIndex];
    }

    /**
     * Intenta iniciar un nuevo evento aleatorio si no hay ninguno activo.
     * @returns {boolean} True si se inició un evento, false si ya había uno activo.
     */
    function startRandomEvent() {
        if (activeEvent) {
            return false;
        }

        const eventTemplate = generateRandomEvent();
        
        // Asignar evento usando spread operator y agregar ID de instancia
        activeEvent = {
            ...eventTemplate,
            instanceId: ++eventCounter
        };

        // Incrementar estadística de eventos iniciados
        totalEventsTriggered++;

        const msg = `Evento activo: ${activeEvent.name}`;

        // Mostrar notificaciones a través de los sistemas principales
        if (typeof window.SpaLife.showDialogue === 'function') {
            window.SpaLife.showDialogue("Sistema", msg);
        }

        if (typeof window.SpaLife.announce === 'function') {
            window.SpaLife.announce(msg);
        }

        console.log(`[SpaLife EventSystem] ${msg} - ${activeEvent.description}`);

        return true;
    }

    /**
     * Limpia el evento activo actual y notifica su finalización.
     */
    function clearEvent() {
        if (activeEvent) {
            const msg = `Evento finalizado: ${activeEvent.name}`;

            if (typeof window.SpaLife.showDialogue === 'function') {
                window.SpaLife.showDialogue("Sistema", msg);
            }

            if (typeof window.SpaLife.announce === 'function') {
                window.SpaLife.announce(msg);
            }

            console.log(`[SpaLife EventSystem] ${msg}`);
            
            // Incrementar estadística de eventos completados
            totalEventsCompleted++;
        }
        
        activeEvent = null;
    }

    /**
     * Retorna el evento que se encuentra activo en este momento.
     * @returns {Object|null} El objeto del evento o null.
     */
    function getActiveEvent() {
        return activeEvent;
    }

    /**
     * Verifica si existe algún evento corriendo actualmente.
     * @returns {boolean} True si hay evento activo.
     */
    function hasActiveEvent() {
        return activeEvent !== null;
    }

    /**
     * Se ejecuta periódicamente para revisar si el día ha cambiado
     * y actualizar la duración de los eventos en curso o generar nuevos.
     */
    function updateEvent() {
        // Protección para evitar errores si el DaySystem no está listo
        if (
            !window.SpaLife.DaySystem ||
            typeof window.SpaLife.DaySystem.getCurrentDay !== 'function'
        ) {
            return;
        }

        // Consultar el día actual al DaySystem
        const currentDay = window.SpaLife.DaySystem.getCurrentDay();

        // Detectar cambio de día
        if (currentDay !== lastKnownDay) {
            lastKnownDay = currentDay;

            // Si existe un evento activo, restar a su duración
            if (activeEvent) {
                activeEvent.durationDays -= 1;
                
                if (activeEvent.durationDays <= 0) {
                    clearEvent();
                }
            }

            // Después de procesar, si no hay evento, hay un 20% de probabilidad de iniciar uno
            if (!activeEvent) {
                if (Math.random() < 0.20) {
                    startRandomEvent();
                }
            }
        }
    }

    // ============================================================
    // MÉTODOS DE ESTADÍSTICAS Y CONTROL
    // ============================================================

    /**
     * Retorna la cantidad total de eventos que han iniciado.
     * @returns {number}
     */
    function getTotalEventsTriggered() {
        return totalEventsTriggered;
    }

    /**
     * Retorna la cantidad total de eventos que han concluido su ciclo.
     * @returns {number}
     */
    function getTotalEventsCompleted() {
        return totalEventsCompleted;
    }

    /**
     * Restablece el sistema a su estado inicial.
     */
    function reset() {
        activeEvent = null;
        lastKnownDay = 1;
        totalEventsTriggered = 0;
        totalEventsCompleted = 0;
    }

    // ============================================================
    // MÉTODOS DE CICLO DE VIDA (LIFECYCLE)
    // ============================================================

    /**
     * Inicializa el sistema de eventos, establece el día inicial
     * y arranca el ciclo de comprobación continua.
     */
    function init() {
        if (monitorInterval) {
            return; // Prevenir doble inicialización
        }

        console.log('[SpaLife EventSystem] Inicializado.');

        // Inicializar lastKnownDay de forma segura
        if (window.SpaLife.DaySystem && typeof window.SpaLife.DaySystem.getCurrentDay === 'function') {
            lastKnownDay = window.SpaLife.DaySystem.getCurrentDay();
        } else {
            lastKnownDay = 1;
        }

        // Ejecutar monitorización cada 5 segundos
        monitorInterval = setInterval(updateEvent, 5000);
    }

    /**
     * Destruye el ciclo de monitoreo y restablece el estado interno.
     */
    function destroy() {
        if (monitorInterval) {
            clearInterval(monitorInterval);
            monitorInterval = null;
        }
        
        reset();
        
        console.log('[SpaLife EventSystem] Destruido.');
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================

    return {
        init,
        destroy,
        
        generateRandomEvent,
        startRandomEvent,
        
        clearEvent,
        
        getActiveEvent,
        hasActiveEvent,
        
        getEventsDatabase,
        
        getTotalEventsTriggered,
        getTotalEventsCompleted,
        
        updateEvent,
        
        reset
    };

})();
