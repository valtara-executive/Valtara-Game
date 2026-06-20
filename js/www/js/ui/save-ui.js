/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Interfaz de Guardado y Menú (Save UI) - 2026
 * ============================================================
 * Nota: Este módulo visualiza el menú lateral flotante que permite 
 * al jugador guardar su partida, reiniciarla y consultar un 
 * reporte de estadísticas. Se comunica de forma exclusiva con 
 * GameState y StatisticsSystem.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.SaveUI = (function() {
    'use strict';

    // ============================================================
    // VARIABLES PRIVADAS Y ESTADO INTERNO
    // ============================================================
    
    let isInitialized = false;
    let isPanelOpen = false;
    let buttonEl = null;
    let panelEl = null;
    let refreshInterval = null;
    
    // Almacenamiento de referencias a los nodos de texto para actualizaciones rápidas
    const uiNodes = {};

    // ============================================================
    // MÉTODOS DE CONSTRUCCIÓN DOM (RENDERIZADO)
    // ============================================================

    /**
     * Crea el botón flotante principal para desplegar el menú.
     */
    function createButton() {
        const uiLayer = document.getElementById('ui-layer');
        if (!uiLayer) {
            console.error('[SpaLife SaveUI] Error: #ui-layer no encontrado.');
            return;
        }

        buttonEl = document.createElement('button');
        buttonEl.id = 'spalife-save-button';
        
        // Atributos de Accesibilidad
        buttonEl.setAttribute('role', 'button');
        buttonEl.setAttribute('aria-label', 'Abrir menú del juego');
        buttonEl.setAttribute('tabindex', '0');

        // Estilos solicitados
        buttonEl.textContent = '☰';
        buttonEl.style.position = 'absolute';
        buttonEl.style.top = '80px';
        buttonEl.style.right = '10px';
        buttonEl.style.width = '48px';
        buttonEl.style.height = '48px';
        buttonEl.style.borderRadius = '50%';
        buttonEl.style.background = '#d4af37'; // Acento dorado
        buttonEl.style.color = '#000000';
        buttonEl.style.border = 'none';
        buttonEl.style.fontSize = '24px';
        buttonEl.style.fontWeight = 'bold';
        buttonEl.style.cursor = 'pointer';
        buttonEl.style.zIndex = '300';
        buttonEl.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.4)';
        buttonEl.style.display = 'flex';
        buttonEl.style.alignItems = 'center';
        buttonEl.style.justifyContent = 'center';
        buttonEl.style.transition = 'transform 0.2s ease, background-color 0.2s ease';

        // Eventos
        buttonEl.addEventListener('click', togglePanel);
        buttonEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                togglePanel();
            }
        });

        uiLayer.appendChild(buttonEl);
    }

    /**
     * Construye el panel lateral interno si aún no existe.
     */
    function buildPanel() {
        const uiLayer = document.getElementById('ui-layer');
        if (!uiLayer) return;

        panelEl = document.createElement('div');
        panelEl.id = 'spalife-save-panel';

        // Atributos de Accesibilidad
        panelEl.setAttribute('role', 'region');
        panelEl.setAttribute('aria-label', 'Menú de opciones y estadísticas');

        // Estilos Glassmorphism solicitados
        panelEl.style.position = 'absolute';
        panelEl.style.top = '140px';
        panelEl.style.right = '10px';
        panelEl.style.width = '320px';
        panelEl.style.maxWidth = '90vw';
        panelEl.style.background = 'rgba(20, 20, 20, 0.85)';
        panelEl.style.backdropFilter = 'blur(12px)';
        panelEl.style.webkitBackdropFilter = 'blur(12px)';
        panelEl.style.border = '1px solid rgba(212, 175, 55, 0.3)';
        panelEl.style.borderRadius = '16px';
        panelEl.style.padding = '15px';
        panelEl.style.color = 'white';
        panelEl.style.zIndex = '300';
        panelEl.style.display = 'none'; // Oculto por defecto
        panelEl.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
        panelEl.style.fontFamily = 'sans-serif';

        // Título del Panel
        const title = document.createElement('h3');
        title.textContent = 'Menú del Spa';
        title.style.margin = '0 0 15px 0';
        title.style.color = '#d4af37';
        title.style.textAlign = 'center';
        panelEl.appendChild(title);

        // Contenedor de Estadísticas
        const statsContainer = document.createElement('div');
        statsContainer.style.marginBottom = '20px';

        // Definición de las filas a mostrar
        const metrics = [
            { key: 'level', label: 'Nivel' },
            { key: 'role', label: 'Rol' },
            { key: 'day', label: 'Día' },
            { key: 'coins', label: 'Monedas' },
            { key: 'reputation', label: 'Reputación' },
            { key: 'wellness', label: 'Bienestar' },
            { key: 'clients', label: 'Clientes Atendidos' },
            { key: 'success', label: 'Tasa de Éxito' },
            { key: 'rank', label: 'Rango' }
        ];

        // Construir cada fila de estadística
        metrics.forEach(metric => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '6px 0';
            row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';

            const labelEl = document.createElement('span');
            labelEl.textContent = metric.label;
            labelEl.style.color = '#cccccc';
            labelEl.style.fontSize = '14px';

            const valueEl = document.createElement('span');
            valueEl.textContent = '-';
            valueEl.style.fontWeight = 'bold';
            valueEl.style.color = '#ffffff';
            valueEl.style.fontSize = '14px';

            row.appendChild(labelEl);
            row.appendChild(valueEl);
            statsContainer.appendChild(row);

            // Guardar referencia para evitar recrear DOM después
            uiNodes[metric.key] = valueEl;
        });

        panelEl.appendChild(statsContainer);

        // Botón Guardar Partida
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Guardar Partida';
        saveBtn.style.width = '100%';
        saveBtn.style.padding = '12px';
        saveBtn.style.marginBottom = '10px';
        saveBtn.style.borderRadius = '8px';
        saveBtn.style.border = 'none';
        saveBtn.style.background = '#4CAF50';
        saveBtn.style.color = 'white';
        saveBtn.style.fontWeight = 'bold';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.fontSize = '15px';

        saveBtn.addEventListener('click', () => {
            if (window.SpaLife.GameState) {
                window.SpaLife.GameState.saveGame();
                const msg = "Partida guardada correctamente";
                if (window.SpaLife.showDialogue) window.SpaLife.showDialogue("Sistema", msg);
                if (window.SpaLife.announce) window.SpaLife.announce(msg);
            }
        });

        // Botón Reiniciar Partida
        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reiniciar Partida';
        resetBtn.style.width = '100%';
        resetBtn.style.padding = '12px';
        resetBtn.style.borderRadius = '8px';
        resetBtn.style.border = 'none';
        resetBtn.style.background = '#e53935';
        resetBtn.style.color = 'white';
        resetBtn.style.fontWeight = 'bold';
        resetBtn.style.cursor = 'pointer';
        resetBtn.style.fontSize = '15px';

        resetBtn.addEventListener('click', () => {
            if (confirm('¿Deseas borrar todo tu progreso?')) {
                if (window.SpaLife.GameState) {
                    window.SpaLife.GameState.resetGame();
                    refreshData(); // Refrescar los textos inmediatamente
                    const msg = "Partida reiniciada";
                    if (window.SpaLife.showDialogue) window.SpaLife.showDialogue("Sistema", msg);
                    if (window.SpaLife.announce) window.SpaLife.announce(msg);
                }
            }
        });

        panelEl.appendChild(saveBtn);
        panelEl.appendChild(resetBtn);

        uiLayer.appendChild(panelEl);
    }

    // ============================================================
    // LÓGICA DEL PANEL
    // ============================================================

    /**
     * Alterna la visibilidad del menú lateral.
     */
    function togglePanel() {
        if (isPanelOpen) {
            closePanel();
        } else {
            openPanel();
        }
    }

    /**
     * Despliega el menú, lo construye si es necesario e inicia
     * el ciclo de actualización de estadísticas en tiempo real.
     */
    function openPanel() {
        if (isPanelOpen) return;

        if (!panelEl) {
            buildPanel();
        }

        panelEl.style.display = 'block';
        buttonEl.setAttribute('aria-expanded', 'true');
        
        // Sincronización inmediata
        refreshData();
        
        // Comenzar ciclo de refresco cada 1000ms modificando solo textos
        refreshInterval = setInterval(() => {
            refreshData();
        }, 1000);
        
        isPanelOpen = true;
    }

    /**
     * Oculta el menú lateral y detiene el ciclo de actualizaciones.
     */
    function closePanel() {
        if (!isPanelOpen) return;

        if (panelEl) {
            panelEl.style.display = 'none';
        }
        
        buttonEl.setAttribute('aria-expanded', 'false');

        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }

        isPanelOpen = false;
    }

    /**
     * Obtiene el reporte completo desde StatisticsSystem y actualiza
     * las referencias de los nodos de texto de manera eficiente.
     */
    function refreshData() {
        if (!window.SpaLife.StatisticsSystem) return;

        const report = window.SpaLife.StatisticsSystem.getFullReport();
        if (!report || !report.summary) return;

        // Actualizar valores de nodos de texto sin reconstruir DOM
        if (uiNodes['level']) uiNodes['level'].textContent = report.summary.level;
        if (uiNodes['role']) uiNodes['role'].textContent = report.summary.role;
        if (uiNodes['day']) uiNodes['day'].textContent = report.summary.currentDay;
        if (uiNodes['coins']) uiNodes['coins'].textContent = report.summary.coins;
        if (uiNodes['reputation']) uiNodes['reputation'].textContent = report.summary.reputation;
        if (uiNodes['wellness']) uiNodes['wellness'].textContent = report.summary.wellness;
        if (uiNodes['clients']) uiNodes['clients'].textContent = report.summary.clientsServed;
        if (uiNodes['success']) uiNodes['success'].textContent = report.successRate + '%';
        if (uiNodes['rank']) uiNodes['rank'].textContent = report.performanceRank;
    }

    // ============================================================
    // MÉTODOS PÚBLICOS (API)
    // ============================================================

    /**
     * Inicializa el sistema, previene ejecuciones dobles y renderiza el botón base.
     */
    function init() {
        if (isInitialized) {
            console.warn('[SpaLife SaveUI] Ya se encuentra inicializado.');
            return;
        }

        console.log('[SpaLife SaveUI] Inicializando módulo de guardado y estadísticas...');
        createButton();
        isInitialized = true;
    }

    /**
     * Destruye por completo la interfaz visual y detiene los ciclos de memoria.
     */
    function destroy() {
        closePanel();

        if (panelEl && panelEl.parentNode) {
            panelEl.parentNode.removeChild(panelEl);
        }
        if (buttonEl && buttonEl.parentNode) {
            buttonEl.parentNode.removeChild(buttonEl);
        }

        panelEl = null;
        buttonEl = null;
        isInitialized = false;
    }

    // EXPOSICIÓN
    return {
        init: init,
        createButton: createButton,
        togglePanel: togglePanel,
        openPanel: openPanel,
        closePanel: closePanel,
        refreshData: refreshData,
        destroy: destroy
    };

})();
