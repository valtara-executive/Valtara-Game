/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema HUD (Heads-Up Display)
 * ============================================================
 * Nota: Este módulo gestiona el panel de progreso en tiempo real.
 * Renderiza estadísticas clave sin recrear el DOM constantemente.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.HUD = (function() {
    'use strict';

    // ============================================================
    // VARIABLES PRIVADAS
    // ============================================================
    let hudContainer = null;
    let refreshInterval = null;
    let uiNodes = {}; // Almacena referencias a los nodos de texto para actualización rápida

    // ============================================================
    // MÉTODOS INTERNOS Y CONSTRUCCIÓN VISUAL
    // ============================================================

    /**
     * Construye la estructura DOM del HUD una sola vez.
     */
    function render() {
        const uiLayer = document.getElementById('ui-layer');
        if (!uiLayer) {
            console.error('[SpaLife HUD] Error: #ui-layer no encontrado.');
            return;
        }

        hudContainer = document.createElement('div');
        hudContainer.id = 'spalife-hud';
        
        // Atributos de accesibilidad
        hudContainer.setAttribute('role', 'region');
        hudContainer.setAttribute('aria-label', 'Panel de progreso del jugador');

        // Estilos base (Glassmorphism, posicionamiento y mobile-first)
        hudContainer.style.position = 'absolute';
        hudContainer.style.top = '10px';
        hudContainer.style.left = '50%';
        hudContainer.style.transform = 'translateX(-50%)';
        hudContainer.style.width = '95%';
        hudContainer.style.maxWidth = '700px';
        hudContainer.style.zIndex = '200';
        hudContainer.style.display = 'flex';
        hudContainer.style.flexWrap = 'wrap';
        hudContainer.style.justifyContent = 'center';
        hudContainer.style.gap = '6px';
        hudContainer.style.padding = '10px';
        hudContainer.style.borderRadius = '12px';
        
        // Apariencia visual estricta
        hudContainer.style.background = 'rgba(25, 25, 25, 0.75)';
        hudContainer.style.backdropFilter = 'blur(12px)';
        hudContainer.style.webkitBackdropFilter = 'blur(12px)';
        hudContainer.style.border = '1px solid rgba(212, 175, 55, 0.3)'; // Acento dorado (Gold)
        hudContainer.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.4)';
        hudContainer.style.color = '#ffffff';
        hudContainer.style.fontFamily = 'sans-serif';
        hudContainer.style.fontSize = '14px';

        // Definición de las métricas a mostrar
        const metrics = [
            { key: 'coins', icon: '💰', label: 'Monedas' },
            { key: 'reputation', icon: '⭐', label: 'Reputación' },
            { key: 'wellness', icon: '🌿', label: 'Bienestar' },
            { key: 'clients', icon: '👥', label: 'Clientes' },
            { key: 'perfectMatches', icon: '🎯', label: 'Aciertos' },
            { key: 'wrongMatches', icon: '❌', label: 'Errores' },
            { key: 'level', icon: '🏆', label: 'Nivel' },
            { key: 'day', icon: '📅', label: 'Día' },
            { key: 'role', icon: '👤', label: 'Rol' }
        ];

        // Construir cada indicador
        metrics.forEach(metric => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '4px';
            item.style.background = 'rgba(0, 0, 0, 0.4)';
            item.style.padding = '4px 8px';
            item.style.borderRadius = '6px';
            item.style.border = '1px solid rgba(255, 255, 255, 0.05)';
            
            // Etiqueta aria dinámica
            item.setAttribute('aria-label', `${metric.label}: calculando`);
            item.setAttribute('tabindex', '0'); // Permite que TalkBack lo lea individualmente

            const iconNode = document.createElement('span');
            iconNode.textContent = metric.icon;
            iconNode.setAttribute('aria-hidden', 'true');

            const valueNode = document.createElement('span');
            valueNode.textContent = '-';
            valueNode.style.fontWeight = 'bold';
            valueNode.style.color = '#d4af37'; // Acento dorado de alto contraste

            item.appendChild(iconNode);
            item.appendChild(valueNode);
            hudContainer.appendChild(item);

            // Guardar referencias para actualización rápida O(1)
            uiNodes[metric.key] = {
                container: item,
                valueText: valueNode,
                labelName: metric.label
            };
        });

        uiLayer.appendChild(hudContainer);
    }

    /**
     * Actualiza los valores de texto en el HUD consultando el GameState.
     * Nunca recrea elementos del DOM.
     */
    function update() {
        if (!hudContainer || !window.SpaLife.GameState) return;

        const state = window.SpaLife.GameState.getState();

        // Mapeo directo entre el estado y la UI
        const stateMapping = {
            coins: state.coins,
            reputation: state.reputation,
            wellness: state.wellness,
            clients: state.clientsServed,
            perfectMatches: state.perfectMatches,
            wrongMatches: state.wrongMatches,
            level: state.level,
            day: state.currentDay,
            role: state.role || 'Recepcionista'
        };

        for (const key in stateMapping) {
            if (uiNodes[key]) {
                const newValue = String(stateMapping[key]);
                const node = uiNodes[key];
                
                // Evitar reflows innecesarios si el valor no ha cambiado
                if (node.valueText.textContent !== newValue) {
                    node.valueText.textContent = newValue;
                    // Actualizar texto para lectores de pantalla
                    node.container.setAttribute('aria-label', `${node.labelName}: ${newValue}`);
                }
            }
        }
    }

    // ============================================================
    // MÉTODOS PÚBLICOS
    // ============================================================

    /**
     * Inicializa el HUD, lo dibuja en pantalla y arranca el ciclo de refresco.
     */
    function init() {
        if (hudContainer) return; // Evitar inicialización doble

        render();
        update(); // Renderizado inmediato de datos

        refreshInterval = setInterval(() => {
            update();
        }, 500);
    }

    /**
     * Destruye el HUD y detiene los ciclos de actualización.
     */
    function destroy() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }

        if (hudContainer && hudContainer.parentNode) {
            hudContainer.parentNode.removeChild(hudContainer);
        }

        hudContainer = null;
        uiNodes = {};
    }

    // EXPOSICIÓN DE LA API PÚBLICA
    return {
        init: init,
        render: render,
        update: update,
        destroy: destroy
    };

})();
