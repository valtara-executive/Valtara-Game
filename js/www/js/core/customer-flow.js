/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Flujo de Clientes (Customer Flow)
 * ============================================================
 * Nota: Este módulo actúa como el "Director de Tráfico" del spa.
 * Gestiona la cola de espera, previene superposiciones en el 
 * mostrador y coordina la llegada física de los pacientes antes 
 * de derivarlos a la jugabilidad clínica.
 * No gestiona economía, progresión ni lógica de terapias.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.CustomerFlow = (function() {
    'use strict';

    // ============================================================
    // VARIABLES PRIVADAS Y ESTADO INTERNO
    // ============================================================
    
    // Cola interna preparada para futuras expansiones (múltiples clientes, sala de espera)
    let customerQueue = [];
    
    // Referencias al cliente actualmente activo en recepción
    let currentCustomerProfile = null;
    let currentCustomerCharacter = null;
    
    // Bandera de bloqueo de recepción (evita superposición de entidades)
    let busy = false;

    // ============================================================
    // MÉTODOS PRIVADOS (FUTURAS EXPANSIONES)
    // ============================================================

    /**
     * Ordena la cola basada en prioridades (Preparación para clientes VIP).
     * Actualmente es un placeholder arquitectónico.
     */
    function sortQueueByPriority() {
        customerQueue.sort((a, b) => {
            const priorityA = a.isVIP ? 1 : 0;
            const priorityB = b.isVIP ? 1 : 0;
            return priorityB - priorityA;
        });
    }

    // ============================================================
    // MÉTODOS PÚBLICOS (API CENTRAL)
    // ============================================================

    /**
     * Inicializa el gestor de tráfico de clientes.
     */
    function init() {
        console.log('[SpaLife CustomerFlow] Inicializando director de tráfico...');
        clearQueue();
        finishCurrentCustomer();
    }

    /**
     * Solicita la llegada del siguiente cliente al mostrador.
     * Si la recepción está ocupada, aborta (o en un futuro, encola).
     * Si está libre, genera un perfil nuevo o lo toma de la cola y lo procesa.
     */
    function requestNextCustomer() {
        // 3. Evitar que aparezcan dos clientes simultáneamente en recepción
        if (busy) {
            console.warn('[SpaLife CustomerFlow] La recepción está ocupada. Solicitud ignorada.');
            return;
        }

        busy = true;

        let nextProfile = null;

        // Si hay clientes en la sala de espera (cola), tomar el primero
        if (customerQueue.length > 0) {
            nextProfile = customerQueue.shift();
        } else {
            // 2. Generar perfil procedural aleatorio si la cola está vacía
            if (window.SpaLife.CustomerProfiles) {
                nextProfile = window.SpaLife.CustomerProfiles.getRandomCustomerProfile();
            } else {
                console.error('[SpaLife CustomerFlow] Error: CustomerProfiles no disponible.');
                busy = false;
                return;
            }
        }

        // Ejecutar el proceso de spawn y caminata
        spawnCustomer(nextProfile);
    }

    /**
     * Coordina la creación visual del cliente, su caminata hacia el mostrador,
     * el almacenamiento de referencias y la presentación de sus diálogos.
     * @param {Object} profile - Perfil narrativo del cliente a instanciar.
     */
    async function spawnCustomer(profile) {
        if (!profile) return;

        const characterId = 'customer-' + profile.id;

        // 6. Utilizar ReceptionScene para instanciar al cliente físicamente
        if (window.SpaLife.ReceptionScene) {
            window.SpaLife.ReceptionScene.spawnCustomer(profile);
        } else {
            console.error('[SpaLife CustomerFlow] Error: ReceptionScene no disponible.');
            busy = false;
            return;
        }

        // 7. Esperar a que el cliente llegue al mostrador (x: 35, y: 60)
        const arrived = await window.SpaLife.ReceptionScene.waitForCharacterArrival(characterId, 35, 60);

        if (arrived) {
            // 8. Guardar referencias internas
            currentCustomerProfile = profile;
            
            if (window.SpaLife.CharacterSystem) {
                currentCustomerCharacter = window.SpaLife.CharacterSystem.getCharacter(characterId);
                
                // Efecto visual: El cliente y la recepcionista comienzan a interactuar
                window.SpaLife.CharacterSystem.setState(characterId, 'talking');
                const receptionist = window.SpaLife.CharacterSystem.getCharacter('receptionist-001');
                if (receptionist) {
                    window.SpaLife.CharacterSystem.setState('receptionist-001', 'talking');
                }
            }

            // 8. Mostrar diálogo
            if (window.SpaLife.showDialogue) {
                window.SpaLife.showDialogue(profile.name, profile.dialogue);
            }

            // 8. Anunciar mediante TalkBack para accesibilidad
            if (window.SpaLife.announce) {
                const announcement = `El cliente ${profile.name} ha llegado. Dice: ${profile.dialogue}`;
                window.SpaLife.announce(announcement);
            }
            
            // NOTA: A partir de este punto, el cliente está listo para que
            // ReceptionGameplay o cualquier otro módulo recoja el evento y 
            // ofrezca las opciones de terapia. Este módulo (CustomerFlow) 
            // ya hizo su trabajo.
        } else {
            // Si hubo un error en la ruta, liberar el mostrador
            console.warn(`[SpaLife CustomerFlow] El cliente ${characterId} no pudo llegar al destino.`);
            finishCurrentCustomer();
        }
    }

    /**
     * Limpia completamente la cola de pacientes (ej. al cerrar el spa o terminar el día).
     */
    function clearQueue() {
        customerQueue = [];
        console.log('[SpaLife CustomerFlow] Cola de pacientes vaciada.');
    }

    /**
     * Retorna una copia de la cola de pacientes en espera.
     * Útil para futuras interfaces de "Sala de Espera".
     * @returns {Array} Array de perfiles de clientes.
     */
    function getQueue() {
        return [...customerQueue];
    }

    /**
     * Verifica si la recepción está actualmente procesando o atendiendo a un cliente.
     * @returns {boolean} True si hay un cliente en el mostrador o en tránsito hacia él.
     */
    function isBusy() {
        return busy;
    }

    /**
     * Retorna las referencias combinadas del cliente activo actualmente.
     * @returns {Object|null} Objeto con 'profile' y 'character', o null si no hay ninguno.
     */
    function getCurrentCustomer() {
        if (!currentCustomerProfile || !currentCustomerCharacter) {
            return null;
        }
        return {
            profile: currentCustomerProfile,
            character: currentCustomerCharacter
        };
    }

    /**
     * Limpia las referencias internas del cliente actual. 
     * Debe ser invocado por módulos externos (ej. TreatmentSystem) cuando
     * terminan de procesar al cliente y este abandona el spa.
     */
    function finishCurrentCustomer() {
        currentCustomerProfile = null;
        currentCustomerCharacter = null;
        busy = false;
        console.log('[SpaLife CustomerFlow] Cliente finalizado. Mostrador libre.');
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================
    
    return {
        init: init,
        requestNextCustomer: requestNextCustomer,
        spawnCustomer: spawnCustomer,
        clearQueue: clearQueue,
        getQueue: getQueue,
        isBusy: isBusy,
        getCurrentCustomer: getCurrentCustomer,
        finishCurrentCustomer: finishCurrentCustomer
    };

})();
