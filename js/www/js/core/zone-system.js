/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Zonas (Zone System)
 * ============================================================
 * Nota: Este módulo gestiona exclusivamente la base de datos de
 * las áreas físicas del spa y su renderizado visual en el mapa.
 * No gestiona clientes, movimiento, terapias ni progresión.
 * Actualizado a estándares de arquitectura 2026.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.ZoneSystem = (function() {
    'use strict';

    // ============================================================
    // BASE DE DATOS INTERNA DE ZONAS
    // ============================================================
    
    // Objeto central que almacena la configuración topográfica y lógica de cada área
    const zonesDb = {
        'reception': {
            id: 'reception',
            name: 'Recepción',
            x: 35,
            y: 60,
            width: 20,
            height: 20,
            locked: false
        },
        'cabin-1': {
            id: 'cabin-1',
            name: 'Cabina 1',
            x: 70,
            y: 45,
            width: 18,
            height: 18,
            locked: false
        },
        'waiting-room': {
            id: 'waiting-room',
            name: 'Sala de Espera',
            x: 15,
            y: 45,
            width: 20,
            height: 20,
            locked: false
        },
        'premium-area': {
            id: 'premium-area',
            name: 'Área Premium',
            x: 80,
            y: 20,
            width: 18,
            height: 18,
            locked: true
        },
        'clinic-room': {
            id: 'clinic-room',
            name: 'Consultorio Clínico',
            x: 80,
            y: 75,
            width: 18,
            height: 18,
            locked: true
        }
    };

    // ============================================================
    // MÉTODOS DE RENDERIZADO VISUAL
    // ============================================================

    /**
     * Dibuja todas las zonas en el lienzo del juego basándose en su estado actual.
     * Utiliza elementos DOM absolutos y aplica estilos CSS definidos.
     */
    function renderZones() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('[SpaLife ZoneSystem] Error: Contenedor #game-canvas no encontrado.');
            return;
        }

        // Limpiar únicamente las zonas previamente renderizadas para no afectar a los personajes
        const existingZones = canvas.querySelectorAll('.spa-zone-element');
        existingZones.forEach(el => el.parentNode.removeChild(el));

        // Iterar y dibujar cada zona del registro
        Object.values(zonesDb).forEach(zone => {
            const el = document.createElement('div');
            el.className = 'spa-zone-element';
            el.id = `zone-${zone.id}`;

            // 1. Estructura y Posicionamiento (Sistema de coordenadas en % basado en el centro)
            el.style.position = 'absolute';
            el.style.left = `${zone.x}%`;
            el.style.top = `${zone.y}%`;
            el.style.width = `${zone.width}%`;
            el.style.height = `${zone.height}%`;
            el.style.transform = 'translate(-50%, -50%)';
            el.style.zIndex = '10'; // Capa de piso/background (debajo del mobiliario y personajes)

            // 2. Apariencia Visual (Glassmorphism sutil y bordes dorados)
            el.style.borderRadius = '16px';
            el.style.border = '2px solid rgba(212, 175, 55, 0.35)';
            el.style.background = 'rgba(212, 175, 55, 0.08)';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.textAlign = 'center';
            
            // 3. Tipografía Base
            el.style.color = '#d4af37';
            el.style.fontFamily = 'sans-serif';
            el.style.fontWeight = 'bold';
            el.style.fontSize = 'clamp(10px, 1.2vw, 14px)';
            el.style.textShadow = '0px 2px 4px rgba(0, 0, 0, 0.7)';
            el.style.padding = '4px';

            // 4. Accesibilidad (TalkBack)
            el.setAttribute('role', 'img');
            el.setAttribute('aria-label', `Zona ${zone.name}${zone.locked ? ' Bloqueada' : ''}`);

            // 5. Aplicación de Estado (Bloqueado vs Desbloqueado)
            if (zone.locked) {
                el.style.opacity = '0.35';
                el.style.filter = 'grayscale(100%)';
                
                const nameNode = document.createElement('span');
                nameNode.textContent = zone.name;
                
                const lockedNode = document.createElement('span');
                lockedNode.textContent = 'BLOQUEADA';
                lockedNode.style.fontSize = '0.8em';
                lockedNode.style.color = '#ff6b6b';
                lockedNode.style.marginTop = '4px';
                lockedNode.style.letterSpacing = '1px';

                el.appendChild(nameNode);
                el.appendChild(lockedNode);
            } else {
                el.textContent = zone.name;
            }

            // Anexar al DOM
            canvas.appendChild(el);
        });
    }

    // ============================================================
    // MÉTODOS PÚBLICOS DE GESTIÓN LOGICA (API)
    // ============================================================

    /**
     * Retorna la información completa de una zona específica.
     * @param {string} id - El identificador único de la zona.
     * @returns {Object|null} Objeto con la metadata de la zona o null si no existe.
     */
    function getZone(id) {
        return zonesDb[id] || null;
    }

    /**
     * Retorna un arreglo con todas las zonas registradas en el sistema.
     * @returns {Array} Colección de objetos de zonas.
     */
    function getAllZones() {
        return Object.values(zonesDb);
    }

    /**
     * Verifica de forma rápida el estado de acceso de una zona.
     * @param {string} id - El identificador único de la zona.
     * @returns {boolean} True si la zona está desbloqueada, false si está bloqueada o no existe.
     */
    function isZoneUnlocked(id) {
        const zone = zonesDb[id];
        if (!zone) return false;
        return !zone.locked;
    }

    /**
     * Habilita una zona previamente bloqueada y actualiza la visualización.
     * @param {string} id - El identificador único de la zona.
     */
    function unlockZone(id) {
        if (zonesDb[id]) {
            zonesDb[id].locked = false;
            console.log(`[SpaLife ZoneSystem] Zona desbloqueada: ${id}`);
            renderZones();
        } else {
            console.warn(`[SpaLife ZoneSystem] Intento de desbloquear zona inexistente: ${id}`);
        }
    }

    /**
     * Restringe el acceso a una zona y actualiza la visualización.
     * @param {string} id - El identificador único de la zona.
     */
    function lockZone(id) {
        if (zonesDb[id]) {
            zonesDb[id].locked = true;
            console.log(`[SpaLife ZoneSystem] Zona bloqueada: ${id}`);
            renderZones();
        } else {
            console.warn(`[SpaLife ZoneSystem] Intento de bloquear zona inexistente: ${id}`);
        }
    }

    /**
     * Inicializa el sistema completo, construyendo la topografía base y dibujándola.
     */
    function init() {
        console.log('[SpaLife ZoneSystem] Inicializando mapa de zonas del spa...');
        
        // El estado base ya está definido en zonesDb, simplemente renderizamos el estado inicial.
        renderZones();
    }

    // ============================================================
    // EXPOSICIÓN DE LA API
    // ============================================================
    
    return {
        init: init,
        getZone: getZone,
        getAllZones: getAllZones,
        isZoneUnlocked: isZoneUnlocked,
        unlockZone: unlockZone,
        lockZone: lockZone,
        renderZones: renderZones
    };

})();
