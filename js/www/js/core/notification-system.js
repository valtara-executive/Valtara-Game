/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Notificaciones (Notification System)
 * ============================================================
 * Nota: Este módulo centraliza todas las notificaciones del juego.
 * Funciona como una capa intermedia con cola de prioridad para 
 * evitar la superposición de mensajes en la interfaz.
 * * // FUTURO:
 * // AchievementSystem
 * // EventSystem
 * // VIPSystem
 * // UnlockSystem
 * // MissionSystem
 * // DaySystem
 * //
 * // deberán migrar posteriormente a:
 * // NotificationSystem.notify()
 * // en lugar de llamar directamente a:
 * // showDialogue()
 * // announce()
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.NotificationSystem = (function() {
    'use strict';

    // ============================================================
    // VARIABLES PRIVADAS Y ESTADO INTERNO
    // ============================================================
    
    let notificationQueue = [];
    let currentNotification = null;
    let isProcessing = false;
    let processInterval = null;
    let totalNotifications = 0;
    
    let notificationIdCounter = 0;

    // Mapa de prioridades para facilitar el ordenamiento numérico
    const priorityWeights = {
        CRITICAL: 4,
        HIGH: 3,
        NORMAL: 2,
        LOW: 1
    };

    // ============================================================
    // MÉTODOS CORE
    // ============================================================

    /**
     * Construye el objeto de notificación, lo añade a la cola y actualiza contadores.
     * @param {string} speaker - Nombre de quien emite el mensaje (ej. "Sistema").
     * @param {string} message - Texto de la notificación.
     * @param {string} priority - Nivel de prioridad ('LOW', 'NORMAL', 'HIGH', 'CRITICAL').
     * @returns {Object} Objeto de notificación recién creado.
     */
    function createNotification(speaker, message, priority = 'NORMAL') {
        const id = ++notificationIdCounter;
        const validPriority = priorityWeights[priority] !== undefined ? priority : 'NORMAL';
        
        const notification = {
            id: id,
            speaker: speaker,
            message: message,
            priority: validPriority,
            timestamp: Date.now()
        };

        notificationQueue.push(notification);
        totalNotifications++;

        return notification;
    }

    /**
     * Ordena la cola de notificaciones basada en el peso de prioridad.
     * A igual prioridad, se atiende primero a la más antigua (FIFO).
     */
    function sortQueue() {
        notificationQueue.sort((a, b) => {
            const weightA = priorityWeights[a.priority];
            const weightB = priorityWeights[b.priority];
            
            if (weightA !== weightB) {
                return weightB - weightA; // Mayor prioridad primero
            }
            // Si la prioridad es igual, gana la más antigua (menor timestamp)
            return a.timestamp - b.timestamp;
        });
    }

    /**
     * Método público para insertar una notificación en la cola usando createNotification.
     */
    function enqueue(speaker, message, priority = 'NORMAL') {
        return createNotification(speaker, message, priority);
    }

    /**
     * Alias de enqueue para mantener una API semántica y directa.
     */
    function notify(speaker, message, priority = 'NORMAL') {
        return enqueue(speaker, message, priority);
    }

    /**
     * Procesa la cola de notificaciones. Si hay una notificación en curso,
     * se detiene. Extrae la siguiente, la muestra y la mantiene en pantalla
     * durante 2500ms antes de liberar el sistema.
     */
    function processQueue() {
        // Bloquear si ya se está mostrando un mensaje
        if (isProcessing || currentNotification !== null) {
            return;
        }

        // Abortar si no hay mensajes pendientes
        if (notificationQueue.length === 0) {
            return;
        }

        // Ordenar la cola para procesar según prioridad
        sortQueue();

        // Extraer la primera notificación (la de mayor prioridad/antigüedad)
        isProcessing = true;
        currentNotification = notificationQueue.shift();

        // Mostrar en la interfaz visual y auditiva
        if (typeof window.SpaLife.showDialogue === 'function') {
            window.SpaLife.showDialogue(currentNotification.speaker, currentNotification.message);
        }

        if (typeof window.SpaLife.announce === 'function') {
            window.SpaLife.announce(currentNotification.message);
        }

        // Esperar 2500ms antes de limpiar y permitir el siguiente mensaje
        setTimeout(() => {
            currentNotification = null;
            isProcessing = false;
        }, 2500);
    }

    // ============================================================
    // MÉTODOS DE CONSULTA Y LIMPIEZA
    // ============================================================

    /**
     * Vacía completamente la cola de notificaciones pendientes.
     */
    function clearQueue() {
        notificationQueue = [];
    }

    /**
     * Retorna una copia exacta del estado actual de la cola.
     * @returns {Array} Copia de la cola de notificaciones.
     */
    function getQueue() {
        return [...notificationQueue];
    }

    /**
     * Retorna la notificación que se está mostrando en este preciso instante.
     * @returns {Object|null} Objeto de notificación actual o null.
     */
    function getCurrentNotification() {
        return currentNotification;
    }

    /**
     * Retorna el contador histórico de notificaciones creadas.
     * @returns {number}
     */
    function getTotalNotifications() {
        return totalNotifications;
    }

    /**
     * Reinicia por completo el sistema y sus métricas a estado de fábrica.
     */
    function reset() {
        clearQueue();
        currentNotification = null;
        isProcessing = false;
        totalNotifications = 0;
        notificationIdCounter = 0;
    }

    // ============================================================
    // CICLO DE VIDA (LIFECYCLE)
    // ============================================================

    /**
     * Inicializa el sistema, previniendo dobles instancias y arrancando
     * el loop de procesamiento.
     */
    function init() {
        if (processInterval) {
            return; // Prevenir doble inicialización
        }

        console.log('[SpaLife NotificationSystem] Inicializado.');

        // Arrancar intervalo de revisión cada 500ms
        processInterval = setInterval(processQueue, 500);
    }

    /**
     * Detiene el ciclo de monitoreo y restablece el sistema.
     */
    function destroy() {
        if (processInterval) {
            clearInterval(processInterval);
            processInterval = null;
        }
        
        reset();
        console.log('[SpaLife NotificationSystem] Destruido.');
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================

    return {
        init,
        destroy,
        
        notify,
        enqueue,
        createNotification,
        processQueue,
        
        clearQueue,
        getQueue,
        getCurrentNotification,
        getTotalNotifications,
        
        reset
    };

})();
