/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Personajes (Prototipo Ligero Basado en DOM)
 * ============================================================
 * Nota: Este módulo gestiona la creación, accesibilidad, estados y 
 * movimiento visual de los personajes en la pantalla.
 * Funciona exclusivamente a través del DOM y posiciones relativas (%),
 * asegurando compatibilidad en cualquier tamaño de pantalla vertical.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.CharacterSystem = (function() {
    'use strict';

    // 1. ALMACENAMIENTO DE PERSONAJES
    // Objeto central que almacena la información y nodos del DOM de todos los personajes activos
    const characters = {};

    // 2. CONFIGURACIÓN DEL MOTOR DE ANIMACIÓN
    let engineRunning = false;
    let lastFrameTime = 0;
    
    // Velocidad de movimiento: 15% del ancho/alto de la pantalla por segundo
    const MOVEMENT_SPEED = 15; 

    /**
     * Inicia el bucle de animación si no está corriendo.
     * Utiliza requestAnimationFrame para un rendimiento óptimo de 60fps.
     */
    function startEngine() {
        if (!engineRunning) {
            engineRunning = true;
            lastFrameTime = performance.now();
            requestAnimationFrame(gameLoop);
        }
    }

    /**
     * El bucle principal que calcula las físicas y el movimiento gradual.
     * @param {number} timestamp - Tiempo transcurrido entregado por el navegador.
     */
    function gameLoop(timestamp) {
        // Calcular la diferencia de tiempo (Delta Time) en segundos
        const deltaTime = (timestamp - lastFrameTime) / 1000;
        lastFrameTime = timestamp;

        let activelyMoving = false;

        // Procesar la lógica de cada personaje
        for (const id in characters) {
            const char = characters[id];

            if (char.state === 'walking') {
                activelyMoving = true;
                
                // Calcular distancia y vectores hacia el objetivo
                const dx = char.targetX - char.x;
                const dy = char.targetY - char.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Paso de movimiento permitido en este frame
                const moveStep = MOVEMENT_SPEED * deltaTime;

                if (distance <= moveStep) {
                    // El personaje llegó a su destino, encajar coordenadas exactas
                    char.x = char.targetX;
                    char.y = char.targetY;
                    setState(id, 'idle');
                } else {
                    // Moverse gradualmente en dirección al objetivo (Interpolación lineal)
                    char.x += (dx / distance) * moveStep;
                    char.y += (dy / distance) * moveStep;
                }

                // Actualizar las propiedades CSS en el DOM
                updateVisualPosition(char);
            }
        }

        // Mantener el bucle vivo
        if (engineRunning) {
            requestAnimationFrame(gameLoop);
        }
    }

    /**
     * Refleja las coordenadas (X, Y) internas del personaje en su elemento DOM.
     * @param {Object} char - Referencia al objeto del personaje.
     */
    function updateVisualPosition(char) {
        if (char && char.element) {
            char.element.style.left = char.x + '%';
            char.element.style.top = char.y + '%';
        }
    }

    // 3. MÉTODOS PÚBLICOS DEL SISTEMA

    /**
     * Crea y renderiza un nuevo personaje en el lienzo.
     * @param {Object} config - Configuración {id, name, role, x, y}
     * @returns {Object|null} El objeto del personaje creado o null si hubo error.
     */
    function createCharacter(config) {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('[SpaLife CharacterSystem] Contenedor #game-canvas no encontrado.');
            return null;
        }

        // Prevenir duplicados
        if (characters[config.id]) {
            console.warn(`[SpaLife CharacterSystem] El personaje con ID ${config.id} ya existe.`);
            return characters[config.id];
        }

        // 3.1. Construcción del elemento DOM (Marcador circular)
        const el = document.createElement('div');
        el.id = 'char-' + config.id;
        
        // Atributos de accesibilidad obligatorios
        const rolLabel = config.role === 'receptionist' ? 'Recepcionista' : 'Cliente';
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', `${rolLabel} ${config.name}`);

        // Estilos base (Apariencia del marcador)
        el.style.position = 'absolute';
        el.style.width = '45px';
        el.style.height = '45px';
        el.style.borderRadius = '50%';
        el.style.transform = 'translate(-50%, -50%)'; // Centra el elemento en sus coordenadas
        el.style.border = '2px solid rgba(255, 255, 255, 0.85)';
        el.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.4)';
        el.style.transition = 'box-shadow 0.3s ease, transform 0.2s ease';
        el.style.zIndex = '50';

        // Diferenciación visual por rol
        if (config.role === 'receptionist') {
            el.style.backgroundColor = 'var(--color-gold, #d4af37)'; 
            el.style.zIndex = '40'; // El staff se renderiza ligeramente por debajo del cliente en cruces
        } else {
            el.style.backgroundColor = '#4361EE'; // Azul relajante para clientes
        }

        // Agregar al lienzo
        canvas.appendChild(el);

        // 3.2. Modelo de datos del personaje
        const newCharacter = {
            id: config.id,
            name: config.name,
            role: config.role,
            x: config.x || 0,
            y: config.y || 0,
            targetX: config.x || 0,
            targetY: config.y || 0,
            state: 'idle',
            element: el
        };

        // Posicionamiento inicial e indexación
        updateVisualPosition(newCharacter);
        characters[config.id] = newCharacter;

        // Asegurarse de que el motor de físicas está activo
        startEngine();

        return newCharacter;
    }

    /**
     * Elimina un personaje del mapa (tanto visualmente como en memoria).
     * @param {string} id - ID del personaje a eliminar.
     */
    function removeCharacter(id) {
        const char = characters[id];
        if (char) {
            if (char.element && char.element.parentNode) {
                char.element.parentNode.removeChild(char.element);
            }
            delete characters[id];
        }
    }

    /**
     * Retorna la información de un personaje específico.
     * @param {string} id - ID del personaje.
     * @returns {Object|undefined} El objeto del personaje o undefined.
     */
    function getCharacter(id) {
        return characters[id];
    }

    /**
     * Retorna una lista con todos los personajes activos en el mapa.
     * @returns {Array} Array de objetos de personaje.
     */
    function getAllCharacters() {
        return Object.values(characters);
    }

    /**
     * Ordena a un personaje que comience a moverse hacia una nueva coordenada.
     * @param {string} id - ID del personaje.
     * @param {number} targetX - Coordenada X destino (0-100%).
     * @param {number} targetY - Coordenada Y destino (0-100%).
     */
    function moveCharacter(id, targetX, targetY) {
        const char = characters[id];
        if (!char) return;

        char.targetX = Math.max(0, Math.min(100, targetX)); // Mantener dentro del límite 0-100
        char.targetY = Math.max(0, Math.min(100, targetY));
        
        setState(id, 'walking');
    }

    /**
     * Cambia el estado (comportamiento) de un personaje y aplica respuestas visuales sutiles.
     * @param {string} id - ID del personaje.
     * @param {string} state - Nuevo estado ('idle', 'walking', 'waiting', 'talking').
     */
    function setState(id, state) {
        const char = characters[id];
        if (!char) return;

        char.state = state;

        // Feedback visual básico según el estado
        if (state === 'talking') {
            // Resplandor para indicar quién está hablando
            char.element.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.9)';
            char.element.style.transform = 'translate(-50%, -50%) scale(1.05)';
        } else if (state === 'waiting') {
            // Un poco más transparente o tenue al estar a la espera
            char.element.style.opacity = '0.7';
        } else {
            // Estados regulares (idle, walking)
            char.element.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.4)';
            char.element.style.transform = 'translate(-50%, -50%) scale(1)';
            char.element.style.opacity = '1';
        }
    }

    // EXPOSICIÓN DE LA API
    return {
        createCharacter: createCharacter,
        removeCharacter: removeCharacter,
        getCharacter: getCharacter,
        getAllCharacters: getAllCharacters,
        moveCharacter: moveCharacter,
        setState: setState
    };

})();
