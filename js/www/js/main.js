/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Arranque (Boot System)
 * ============================================================
 * Nota: Este archivo inicializa la aplicación de forma segura.
 * No contiene el bucle del juego, lógicas de simulación ni 
 * renderizado complejo.
 */

// 1. CREACIÓN DEL NAMESPACE GLOBAL Y ESTADO BÁSICO
window.SpaLife = window.SpaLife || {};

window.SpaLife.state = {
    isLoaded: false,
    currentLevel: 1,
    currentRole: 'Recepcionista',
    playerName: 'Jugador'
};

// Almacenamiento de referencias del DOM para acceso rápido y seguro
window.SpaLife.layers = {};

// 2. DEFINICIÓN DE MÉTODOS DEL SISTEMA

/**
 * Muestra un diálogo en la capa correspondiente utilizando las clases de accesibilidad.
 * @param {string} speaker - El nombre del personaje o sistema que habla.
 * @param {string} message - El mensaje que se mostrará.
 */
window.SpaLife.showDialogue = (speaker, message) => {
    const dialogueLayer = window.SpaLife.layers['dialogue-layer'];
    if (!dialogueLayer) return;

    // Limpia la capa y renderiza el contenido usando las clases de a11y-talkback.css
    dialogueLayer.innerHTML = `
        <span class="dialogue-speaker">${speaker}</span>
        <span class="dialogue-message">${message}</span>
    `;
};

/**
 * Anuncia un mensaje directamente a los lectores de pantalla (TalkBack)
 * utilizando la región con aria-live="assertive".
 * @param {string} message - El mensaje a leer en voz alta.
 */
window.SpaLife.announce = (message) => {
    const a11yLayer = window.SpaLife.layers['accessibility-layer'];
    if (!a11yLayer) return;

    // Actualizar el textContent fuerza a TalkBack a leer el nuevo cambio
    a11yLayer.textContent = message;
};

// 3. SECUENCIA DE INICIALIZACIÓN (DOM READY)

document.addEventListener('DOMContentLoaded', () => {
    
    // Lista de identificadores que la aplicación requiere para funcionar
    const requiredLayers = [
        'loading-screen',
        'game-container',
        'game-canvas',
        'ui-layer',
        'dialogue-layer',
        'accessibility-layer'
    ];

    let isEnvironmentValid = true;

    // Verificación de existencia de las capas en el DOM
    requiredLayers.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            window.SpaLife.layers[id] = element;
        } else {
            console.error(`[SpaLife Boot] Error Crítico: No se encontró la capa requerida '#${id}'.`);
            isEnvironmentValid = false;
        }
    });

    // Abortar si falta algún elemento crucial
    if (!isEnvironmentValid) {
        console.error('[SpaLife Boot] Inicialización abortada debido a elementos DOM faltantes.');
        return;
    }

    // Registro de validación exitosa
    console.log('[SpaLife Boot] Todas las capas requeridas han sido verificadas exitosamente.');
    window.SpaLife.state.isLoaded = true;

    // 4. TRANSICIÓN DE ARRANQUE (BOOT SEQUENCE)
    
    // Esperar 1500ms para simular el proceso de carga antes de iniciar la UI
    setTimeout(() => {
        const loadingScreen = window.SpaLife.layers['loading-screen'];
        
        // Ocultar la pantalla de carga (Removerla del flujo y de la vista)
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
            loadingScreen.setAttribute('aria-busy', 'false');
            loadingScreen.setAttribute('aria-hidden', 'true');
        }

        // Mensaje inicial del sistema
        const welcomeSpeaker = 'Sistema';
        const welcomeMessage = 'Bienvenido a Spa Life. Tu viaje en el bienestar está por comenzar.';

        // Mostrar en pantalla
        window.SpaLife.showDialogue(
            welcomeSpeaker,
            welcomeMessage
        );

        // Anunciar en TalkBack
        window.SpaLife.announce(
            welcomeMessage
        );

        // Inicializar HUD
        if (
            window.SpaLife.HUD &&
            typeof window.SpaLife.HUD.init === 'function'
        ) {
            console.log('[SpaLife Boot] Starting HUD...');
            window.SpaLife.HUD.init();
        }

        // Inicializar Escena de Recepción
        if (
            window.SpaLife.ReceptionScene &&
            typeof window.SpaLife.ReceptionScene.init === 'function'
        ) {
            console.log('[SpaLife Boot] Starting Reception Scene...');
            window.SpaLife.ReceptionScene.init();
        }

        // Confirmar ProgressionSystem
        if (
            window.SpaLife.ProgressionSystem
        ) {
            console.log('[SpaLife Boot] Progression System Ready.');
        }

    }, 1500);
});
