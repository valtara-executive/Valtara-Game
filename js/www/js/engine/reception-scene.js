/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Escena de Recepción (Primera Escena Jugable)
 * ============================================================
 * Nota: Este archivo controla la lógica de la zona de recepción.
 * Demuestra la creación de personajes, movimiento, llegada y
 * vinculación de diálogos con el sistema de accesibilidad.
 * * Dependencias: main.js, character-system.js, pool-perfiles.js
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.ReceptionScene = (function() {
    'use strict';

    // ============================================================
    // VARIABLES PRIVADAS DE LA ESCENA
    // ============================================================
    let receptionist = null;
    let currentCustomer = null;
    let currentProfile = null;
    let sceneStarted = false;

    // ============================================================
    // MÉTODOS DE CONSTRUCCIÓN VISUAL
    // ============================================================

    /**
     * Crea el mostrador de recepción en el DOM.
     * Renderiza un bloque visual con propiedades CSS strictas y etiquetas ARIA.
     */
    function createReceptionDesk() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('[SpaLife ReceptionScene] Error: #game-canvas no encontrado.');
            return;
        }

        const desk = document.createElement('div');
        desk.id = 'reception-desk';
        
        // Estilos solicitados por la arquitectura
        desk.style.position = 'absolute';
        desk.style.width = '180px';
        desk.style.height = '80px';
        desk.style.left = '50%';
        desk.style.top = '70%';
        desk.style.transform = 'translate(-50%, -50%)';
        desk.style.background = 'linear-gradient(135deg, #5b4636, #8c6d4d)';
        desk.style.borderRadius = '18px';
        desk.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5)';
        desk.style.zIndex = '30'; // Se ubica por debajo de la recepcionista

        // Atributos de accesibilidad para TalkBack
        desk.setAttribute('role', 'img');
        desk.setAttribute('aria-label', 'Mostrador de recepción');

        canvas.appendChild(desk);
    }

    // ============================================================
    // MÉTODOS DE GESTIÓN DE PERSONAJES
    // ============================================================

    /**
     * Invoca a la recepcionista utilizando el CharacterSystem.
     * La sitúa detrás del mostrador (x: 50, y: 60) en estado inactivo.
     */
    function spawnReceptionist() {
        if (!window.SpaLife.CharacterSystem) {
            console.error('[SpaLife ReceptionScene] Error: CharacterSystem no cargado.');
            return;
        }

        receptionist = window.SpaLife.CharacterSystem.createCharacter({
            id: 'receptionist-001',
            name: 'Valeria',
            role: 'receptionist',
            x: 50,
            y: 60
        });

        window.SpaLife.CharacterSystem.setState('receptionist-001', 'idle');
    }

    /**
     * Crea a un cliente basado en un perfil procedural y le ordena caminar.
     * Aparece en el borde izquierdo (x:0) y camina hasta el mostrador (x:35).
     * @param {Object} profile - El perfil del paciente obtenido de pool-perfiles.js
     */
    function spawnCustomer(profile) {
        currentProfile = profile;
        
        currentCustomer = window.SpaLife.CharacterSystem.createCharacter({
            id: 'customer-' + profile.id,
            name: profile.name,
            role: 'customer',
            x: 0,
            y: 60
        });

        // Ordenar el movimiento y cambiar estado a 'walking'
        window.SpaLife.CharacterSystem.moveCharacter(currentCustomer.id, 35, 60);
        window.SpaLife.CharacterSystem.setState(currentCustomer.id, 'walking');
    }

    /**
     * Elimina visual y lógicamente al cliente actual de la escena.
     */
    function removeCustomer() {
        if (currentCustomer) {
            window.SpaLife.CharacterSystem.removeCharacter(currentCustomer.id);
            currentCustomer = null;
            currentProfile = null;
        }
    }

    // ============================================================
    // MÉTODOS DE CONTROL Y FLUJO (PROMESAS)
    // ============================================================

    /**
     * Consulta repetidamente la posición del personaje hasta que alcance su destino.
     * Utiliza un poll loop de 100ms.
     * @param {string} characterId - El ID del personaje a monitorear.
     * @param {number} targetX - La coordenada X esperada.
     * @param {number} targetY - La coordenada Y esperada.
     * @returns {Promise} Se resuelve cuando el personaje llega a su destino.
     */
    function waitForCharacterArrival(characterId, targetX, targetY) {
        return new Promise((resolve) => {
            const pollInterval = setInterval(() => {
                const char = window.SpaLife.CharacterSystem.getCharacter(characterId);
                
                // Si el personaje fue borrado o no existe, abortar
                if (!char) {
                    clearInterval(pollInterval);
                    resolve(false);
                    return;
                }

                // Calcular la diferencia de posición (con un pequeño margen matemático)
                const dx = Math.abs(char.x - targetX);
                const dy = Math.abs(char.y - targetY);

                if (dx < 0.5 && dy < 0.5) {
                    clearInterval(pollInterval);
                    resolve(true);
                }
            }, 100);
        });
    }

    // ============================================================
    // SECUENCIA DEMOSTRATIVA
    // ============================================================

    /**
     * Controla la demostración de llegada de un paciente, la sincronización
     * de su movimiento y la emisión de sus diálogos.
     */
    async function startDemo() {
        // 1. Seleccionar un perfil procedural aleatorio
        const profile = window.SpaLife.CustomerProfiles.getRandomCustomerProfile();
        
        // 2. Crear al cliente e indicarle que camine
        spawnCustomer(profile);

        // 3. Pausar la ejecución hasta que llegue al mostrador
        await waitForCharacterArrival(currentCustomer.id, 35, 60);

        // 4. Cambiar estados a "hablando" (Activa feedback visual de aros de luz)
        window.SpaLife.CharacterSystem.setState(currentCustomer.id, 'talking');
        window.SpaLife.CharacterSystem.setState(receptionist.id, 'talking');

        // 5. Mostrar el diálogo en el HUD (Capa de diálogos)
        window.SpaLife.showDialogue(profile.name, profile.dialogue);

        // 6. Anunciar estrictamente para lectores de pantalla (TalkBack)
        const announcementText = `El cliente ${profile.name} ha llegado. Dice: ${profile.dialogue}`;
        window.SpaLife.announce(announcementText);

        // 7. Después de 8 segundos, ambos personajes vuelven al estado de reposo (idle)
        setTimeout(() => {
            window.SpaLife.CharacterSystem.setState(currentCustomer.id, 'idle');
            window.SpaLife.CharacterSystem.setState(receptionist.id, 'idle');
            // Nota: Aquí se podría integrar la lógica para despachar al cliente y abrir menú
        }, 8000);
    }

    // ============================================================
    // INICIALIZACIÓN DE LA ESCENA
    // ============================================================

    /**
     * Prepara el entorno inicializando el mobiliario y el personal,
     * y da comienzo a la demostración interactiva.
     */
    function init() {
        if (sceneStarted) {
            console.warn('[SpaLife ReceptionScene] La escena ya ha sido inicializada.');
            return;
        }
        sceneStarted = true;

        console.log('[SpaLife ReceptionScene] Inicializando Escena de Recepción...');
        
        createReceptionDesk();
        spawnReceptionist();
        
        // Esperamos un segundo para que el DOM esté listo y arrancamos la demo
        setTimeout(() => {
            startDemo();
        }, 1000);
    }

    // EXPOSICIÓN DE LA API PÚBLICA
    return {
        init: init,
        createReceptionDesk: createReceptionDesk,
        spawnReceptionist: spawnReceptionist,
        spawnCustomer: spawnCustomer,
        removeCustomer: removeCustomer,
        waitForCharacterArrival: waitForCharacterArrival,
        startDemo: startDemo
    };

})();
