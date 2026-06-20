/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Arranque (Boot System)
 * ============================================================
 * Nota: Este archivo inicializa la aplicación de forma segura.
 * Actúa como el centro neurálgico de inicialización, gestionando
 * la carga dinámica y escalable de más de 30 módulos previstos
 * para la arquitectura final del simulador.
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

// ============================================================
// 2. DEFINICIÓN DE UTILIDADES DEL SISTEMA CENTRAL
// ============================================================

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

/**
 * Inicializa un módulo de la arquitectura de forma segura.
 * Verifica su existencia y la presencia del método init().
 * Previene errores fatales si un módulo futuro aún no ha sido implementado.
 * @param {string} name - Nombre del módulo en window.SpaLife (ej. 'HUD').
 * @param {string} [path] - Ruta teórica del módulo para propósitos de logging.
 */
const initializeModule = (name, path = '') => {
    if (window.SpaLife[name]) {
        if (typeof window.SpaLife[name].init === 'function') {
            try {
                window.SpaLife[name].init();
                console.log(`[SpaLife Boot] Module Ready: ${name}`);
            } catch (error) {
                // Captura de errores internos del módulo para no detener el Boot Sequence
                console.error(`[SpaLife Boot] Module Error (${name}):`, error);
            }
        } else {
            // Módulos de datos o utilitarios que no requieren inicialización activa
            console.log(`[SpaLife Boot] Module Ready (Passive): ${name}`);
        }
    } else {
        // Advertencia no fatal para módulos planeados pero no implementados
        console.warn(`[SpaLife Boot] Module Missing: ${name}`);
    }
};

// ============================================================
// 3. REGISTRO DE MÓDULOS DEL NÚCLEO (CORE ARCHITECTURE)
// ============================================================

/**
 * Arreglo maestro que define todos los sistemas que componen o compondrán 
 * el motor de Spa Life. El Boot System los recorrerá automáticamente.
 */
const modules = [
    'HUD',
    'ZoneSystem',
    'CustomerFlow',
    'DaySystem',
    'ProgressionSystem',
    'UnlockSystem',
    'StatisticsSystem',
    'SaveUI',
    'EventSystem',
    'VIPSystem',
    'StaffSystem',
    'EconomySystem',
    'AchievementSystem',
    'MissionSystem',
    'TutorialSystem',
    'SettingsSystem',
    'AudioSystem',
    'NotificationSystem',
    'AnalyticsSystem',
    'CabinManager'
];

// ============================================================
// 4. SECUENCIA DE INICIALIZACIÓN (DOM READY)
// ============================================================

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

    // Abortar si falta algún elemento crucial estructural
    if (!isEnvironmentValid) {
        console.error('[SpaLife Boot] Inicialización abortada debido a elementos DOM faltantes.');
        return;
    }

    // Registro de validación exitosa
    console.log('[SpaLife Boot] Todas las capas requeridas han sido verificadas exitosamente.');
    window.SpaLife.state.isLoaded = true;

    // ============================================================
    // 5. TRANSICIÓN DE ARRANQUE (BOOT SEQUENCE)
    // ============================================================
    
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

        // ------------------------------------------------------------
        // FASE A: Inicialización del Registro de Módulos
        // ------------------------------------------------------------
        console.log('[SpaLife Boot] Inicializando arquitectura principal...');
        modules.forEach(moduleName => {
            initializeModule(moduleName);
        });

        // ------------------------------------------------------------
        // FASE B: Arranque Exclusivo de Escenas y Controladores de Flujo
        // Se ejecuta después de la inicialización pasiva de módulos
        // ------------------------------------------------------------

        // 1 & 2. HUD y ZoneSystem ya fueron inicializados en el loop anterior.
        // Se garantiza que sus constructores visuales están activos antes de la escena.

        // 3. Inicializar Escena de Recepción
        if (
            window.SpaLife.ReceptionScene &&
            typeof window.SpaLife.ReceptionScene.init === 'function'
        ) {
            console.log('[SpaLife Boot] Starting Reception Scene...');
            window.SpaLife.ReceptionScene.init();
        } else {
            console.warn('[SpaLife Boot] ReceptionScene no está disponible.');
        }

        // 4. Arrancar de manera única el flujo de la jornada
        if (
            window.SpaLife.DaySystem &&
            typeof window.SpaLife.DaySystem.startDay === 'function'
        ) {
            console.log('[SpaLife Boot] Starting Day Flow...');
            window.SpaLife.DaySystem.startDay();
        } else {
            console.warn('[SpaLife Boot] DaySystem no está disponible para iniciar la jornada.');
        }

    }, 1500);
});
