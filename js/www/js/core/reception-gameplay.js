/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Juego en Recepción (Reception Gameplay)
 * ============================================================
 * Nota: Este módulo gestiona el bucle interactivo de recepción.
 * Permite al jugador analizar síntomas y asignar terapias.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.ReceptionGameplay = (function() {
    'use strict';

    // ============================================================
    // VARIABLES PRIVADAS
    // ============================================================
    let currentProfile = null;
    let currentCustomer = null;
    let isInteractionActive = false;
    let uiContainer = null;

    // ============================================================
    // MÉTODOS DE INTERFAZ (UI)
    // ============================================================

    /**
     * Construye el contenedor para las opciones de terapias.
     */
    function createServiceMenu() {
        const uiLayer = document.getElementById('ui-layer');
        if (!uiLayer) {
            console.error('[SpaLife ReceptionGameplay] Error: Capa #ui-layer no encontrada.');
            return;
        }

        // Limpiar interfaz previa si existiera
        clearUI();

        uiContainer = document.createElement('div');
        uiContainer.id = 'reception-service-menu';
        
        // Estilos solicitados
        uiContainer.style.position = 'absolute';
        uiContainer.style.bottom = '160px';
        uiContainer.style.left = '50%';
        uiContainer.style.transform = 'translateX(-50%)';
        uiContainer.style.width = '90%';
        uiContainer.style.maxWidth = '600px';
        uiContainer.style.display = 'flex';
        uiContainer.style.flexDirection = 'column';
        uiContainer.style.gap = '10px';
        uiContainer.style.zIndex = '100';

        // Estilo Glassmorphism (similar a la capa de diálogos)
        uiContainer.style.background = 'rgba(255, 255, 255, 0.15)';
        uiContainer.style.backdropFilter = 'blur(10px)';
        uiContainer.style.webkitBackdropFilter = 'blur(10px)';
        uiContainer.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        uiContainer.style.borderRadius = '16px';
        uiContainer.style.padding = '15px';
        uiContainer.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';

        uiLayer.appendChild(uiContainer);
    }

    /**
     * Carga y muestra los servicios disponibles como botones interactivos.
     * @param {Object} profile - Perfil actual del cliente para contexto.
     */
    function showServiceOptions(profile) {
        if (!uiContainer || !window.SpaLife.Services) return;

        const services = window.SpaLife.Services.getAllServices();

        services.forEach(service => {
            const btn = document.createElement('button');
            btn.textContent = service.name;
            
            // Atributos de accesibilidad
            btn.setAttribute('role', 'button');
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('aria-label', `Asignar tratamiento: ${service.name}`);

            // Reglas visuales requeridas
            btn.style.minHeight = '48px';
            btn.style.borderRadius = '8px';
            btn.style.border = 'none';
            btn.style.backgroundColor = '#333333'; // Alto contraste
            btn.style.color = '#ffffff';
            btn.style.fontSize = '16px';
            btn.style.fontWeight = 'bold';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'background-color 0.2s ease, transform 0.1s ease';

            // Efecto Hover "Gold" nativo mediante eventos JS para no depender de CSS externo
            btn.addEventListener('mouseover', () => btn.style.backgroundColor = '#d4af37');
            btn.addEventListener('mouseout', () => btn.style.backgroundColor = '#333333');
            btn.addEventListener('focus', () => btn.style.backgroundColor = '#d4af37');
            btn.addEventListener('blur', () => btn.style.backgroundColor = '#333333');
            btn.addEventListener('mousedown', () => btn.style.transform = 'scale(0.98)');
            btn.addEventListener('mouseup', () => btn.style.transform = 'scale(1)');

            // Soporte de interacción por click y teclado
            const triggerSelection = () => handleServiceSelection(service.name);

            btn.addEventListener('click', triggerSelection);
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerSelection();
                }
            });

            uiContainer.appendChild(btn);
        });
    }

    /**
     * Limpia completamente el contenedor del menú y destruye sus elementos.
     */
    function clearUI() {
        if (uiContainer) {
            uiContainer.innerHTML = ''; // Destruir botones
            if (uiContainer.parentNode) {
                uiContainer.parentNode.removeChild(uiContainer); // Destruir contenedor
            }
            uiContainer = null;
        }
    }

    // ============================================================
    // LÓGICA DE JUEGO (GAMEPLAY)
    // ============================================================

    /**
     * Procesa la selección evitando múltiples inputs.
     * @param {string} serviceName - Nombre del servicio seleccionado.
     */
    function handleServiceSelection(serviceName) {
        if (!isInteractionActive) return;
        isInteractionActive = false; // Prevenir doble clic

        evaluateSelection(serviceName);
    }

    /**
     * Evalúa si el servicio asignado coincide con la necesidad del paciente.
     * @param {string} serviceName - Nombre del servicio seleccionado.
     */
    function evaluateSelection(serviceName) {
        if (serviceName === currentProfile.recommendedService) {
            showSuccess(serviceName);
        } else {
            showFailure();
        }
    }

    /**
     * Flujo de victoria: Otorga recompensas completas y despide al cliente feliz.
     * @param {string} serviceName - Nombre del servicio para buscar sus recompensas.
     */
    function showSuccess(serviceName) {
        // Ocultar opciones de inmediato
        clearUI();

        // Buscar el objeto del servicio para extraer su reward y reputation
        const services = window.SpaLife.Services.getAllServices();
        const assignedService = services.find(s => s.name === serviceName) || { reward: 50, reputation: 5 };

        // Actualizar GameState
        window.SpaLife.GameState.addCoins(assignedService.reward);
        window.SpaLife.GameState.addReputation(assignedService.reputation);
        window.SpaLife.GameState.incrementClientsServed();
        window.SpaLife.GameState.incrementPerfectMatches();

        // Retroalimentación al jugador
        const successMessage = "Excelente diagnóstico. El cliente fue asignado correctamente.";
        window.SpaLife.showDialogue("Sistema", successMessage);
        window.SpaLife.announce(successMessage);

        // Feedback visual en el personaje (aro de luz de talking)
        if (currentCustomer && currentCustomer.id) {
            window.SpaLife.CharacterSystem.setState(currentCustomer.id, 'talking');
        }

        // Esperar 3 segundos y traer al siguiente cliente
        setTimeout(() => {
            startNextCustomer();
        }, 3000);
    }

    /**
     * Flujo de fallo: Otorga recompensa mínima de consolación.
     */
    function showFailure() {
        // Ocultar opciones de inmediato
        clearUI();

        // Actualizar GameState con penalización relativa
        window.SpaLife.GameState.addCoins(10);
        window.SpaLife.GameState.incrementClientsServed();
        window.SpaLife.GameState.incrementWrongMatches();

        // Retroalimentación al jugador
        const failureMessage = "El tratamiento seleccionado no era el más adecuado.";
        window.SpaLife.showDialogue("Sistema", failureMessage);
        window.SpaLife.announce(failureMessage);

        // Esperar 3 segundos y traer al siguiente cliente
        setTimeout(() => {
            startNextCustomer();
        }, 3000);
    }

    /**
     * Ciclo principal: Despide al cliente actual e invoca a uno nuevo.
     */
    async function startNextCustomer() {
        // Eliminar cliente anterior de la escena y de la interfaz
        window.SpaLife.ReceptionScene.removeCustomer();
        clearUI();

        // Obtener nuevo perfil aleatorio
        const newProfile = window.SpaLife.CustomerProfiles.getRandomCustomerProfile();
        const expectedId = 'customer-' + newProfile.id;

        // Animar la llegada del nuevo cliente
        window.SpaLife.ReceptionScene.spawnCustomer(newProfile);
        
        // Pausar ejecución hasta que el personaje alcance el mostrador (x:35, y:60 en ReceptionScene)
        await window.SpaLife.ReceptionScene.waitForCharacterArrival(expectedId, 35, 60);

        // Cambiar estados a hablando
        window.SpaLife.CharacterSystem.setState(expectedId, 'talking');
        
        // Mostrar diálogo del cliente
        window.SpaLife.showDialogue(newProfile.name, newProfile.dialogue);
        window.SpaLife.announce(`El cliente ${newProfile.name} dice: ${newProfile.dialogue}`);

        // Obtener la referencia fresca del personaje recién creado
        const newCustomerObj = window.SpaLife.CharacterSystem.getCharacter(expectedId);

        // Reiniciar el ciclo de juego
        init(newProfile, newCustomerObj);
    }

    // ============================================================
    // INICIALIZACIÓN
    // ============================================================

    /**
     * Arranca la lógica jugable para un paciente que acaba de llegar al mostrador.
     * @param {Object} profile - Perfil narrativo del paciente.
     * @param {Object} customer - Objeto lógico del sistema de personajes.
     */
    function init(profile, customer) {
        currentProfile = profile;
        currentCustomer = customer;
        isInteractionActive = true;

        createServiceMenu();
        showServiceOptions(currentProfile);
    }

    // EXPOSICIÓN DE LA API PÚBLICA
    return {
        init: init,
        startNextCustomer: startNextCustomer
    };

})();
