/**
 * ============================================================
 * SPA LIFE 2026: EL VIAJE DEL BIENESTAR
 * Sistema Económico Central (Economy System)
 * ============================================================
 * Nota: Este módulo es la única autoridad económica del juego.
 * Gestiona de forma centralizada todos los ingresos, gastos,
 * historiales y validaciones financieras de la clínica.
 * No genera interfaces visuales ni desbloquea elementos lógicos.
 * * ============================================================
 * COMPATIBILIDAD FUTURA OBLIGATORIA (ARQUITECTURA 2026)
 * ============================================================
 * - UnlockSystem: Solicitará purchaseZone() para validar fondos antes de desbloquear.
 * - StaffSystem: Solicitará hireStaff() para el pago de contrataciones y salarios.
 * - CabinManager: Solicitará buyUpgrade() y payMaintenance() para gestión de cabinas.
 * - SaveSystem: Serializará el progreso usando exportData() e importData().
 * - NotificationSystem: Reemplazará al helper interno notify() para centralizar alertas.
 * - MissionSystem: Consultará getFinancialReport() para evaluar misiones de ingresos.
 * - VIPSystem: Inyectará pagos premium mediante addIncome(..., 'vip-bonus').
 * - AnalyticsSystem: Consumirá getTransactionHistory() para graficar métricas.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.EconomySystem = (function() {
    'use strict';

    // ============================================================
    // CATÁLOGO CENTRAL DE PRECIOS
    // ============================================================
    
    const economyCatalog = {
        zones: {
            'clinic-room': 500,
            'premium-area': 1200,
            'cabin-2': 2000,
            'vip-lounge': 5000,
            'hydrotherapy-zone': 7500,
            'medical-spa-wing': 12000
        },
        staff: {
            'assistant': 300,
            'therapist': 800,
            'specialist': 2000,
            'doctor': 5000,
            'supervisor': 7000
        },
        upgrades: {
            'furniture': 250,
            'aromatherapy': 400,
            'premiumEquipment': 1000,
            'luxuryDecoration': 2500,
            'automationTools': 4000
        },
        maintenance: {
            'dailyBasic': 50,
            'dailyPremium': 100,
            'utilities': 80,
            'cleaning': 40
        },
        consumables: {
            'oils': 30,
            'towels': 20,
            'aromatherapyPack': 60,
            'medicalSupplies': 120
        }
    };

    // ============================================================
    // ESTADO PRIVADO
    // ============================================================
    
    let economyStats = {
        totalIncome: 0,
        totalExpenses: 0,
        totalZonePurchases: 0,
        totalStaffExpenses: 0,
        totalUpgradeExpenses: 0,
        totalMaintenanceExpenses: 0,
        totalConsumableExpenses: 0,
        biggestIncome: 0,
        biggestExpense: 0
    };

    let transactionHistory = [];
    const MAX_HISTORY = 500;

    // ============================================================
    // UTILIDADES PRIVADAS (HELPERS)
    // ============================================================

    /**
     * Valida de manera estricta que una cantidad monetaria sea un número 
     * válido, positivo y finito, previniendo errores matemáticos o inyecciones.
     * @param {any} amount - El valor a evaluar.
     * @returns {boolean} 
     */
    function isValidAmount(amount) {
        if (amount === null || amount === undefined) return false;
        if (typeof amount !== 'number') return false;
        if (isNaN(amount) || !isFinite(amount)) return false;
        if (amount <= 0) return false;
        return true;
    }

    /**
     * Canaliza de manera temporal las notificaciones hacia el sistema clásico.
     * @param {string} message - El mensaje a mostrar.
     */
    function notify(message) {
        if (typeof window.SpaLife.showDialogue === 'function') {
            window.SpaLife.showDialogue("Finanzas", message);
        }
        if (typeof window.SpaLife.announce === 'function') {
            window.SpaLife.announce(message);
        }
        console.log(`[SpaLife EconomySystem] ${message}`);
    }

    /**
     * Registra una transacción en el historial y actualiza las métricas económicas.
     * @param {string} type - 'income' o 'expense'.
     * @param {string} category - Categoría (zone, staff, upgrade, maintenance, consumable, generic).
     * @param {number} amount - Cantidad transferida.
     * @param {string} description - Identificador o detalle.
     */
    function recordTransaction(type, category, amount, description) {
        // 1. Almacenar en el historial
        const transaction = {
            timestamp: Date.now(),
            type: type,
            category: category,
            amount: amount,
            description: description
        };
        transactionHistory.push(transaction);

        // Limitar la memoria del historial
        if (transactionHistory.length > MAX_HISTORY) {
            transactionHistory.shift();
        }

        // 2. Actualizar estadísticas globales
        if (type === 'income') {
            economyStats.totalIncome += amount;
            if (amount > economyStats.biggestIncome) {
                economyStats.biggestIncome = amount;
            }
        } else if (type === 'expense') {
            economyStats.totalExpenses += amount;
            if (amount > economyStats.biggestExpense) {
                economyStats.biggestExpense = amount;
            }

            // 3. Actualizar sub-categorías de gastos
            switch (category) {
                case 'zone': economyStats.totalZonePurchases += amount; break;
                case 'staff': economyStats.totalStaffExpenses += amount; break;
                case 'upgrade': economyStats.totalUpgradeExpenses += amount; break;
                case 'maintenance': economyStats.totalMaintenanceExpenses += amount; break;
                case 'consumable': economyStats.totalConsumableExpenses += amount; break;
            }
        }
    }

    /**
     * Obtiene de forma segura la cantidad actual de monedas desde GameState.
     * @returns {number} Monedas disponibles.
     */
    function _getCurrentCoins() {
        if (window.SpaLife.GameState) {
            const state = window.SpaLife.GameState.getState();
            return (typeof state.coins === 'number' && isFinite(state.coins) && !isNaN(state.coins)) ? state.coins : 0;
        }
        return 0;
    }

    // ============================================================
    // MÉTODOS NÚCLEO (CORE)
    // ============================================================

    /**
     * Evalúa si el jugador posee fondos suficientes para una operación.
     * @param {number} amount - Costo de la operación.
     * @returns {boolean}
     */
    function canAfford(amount) {
        if (!isValidAmount(amount)) return false;
        return _getCurrentCoins() >= amount;
    }

    /**
     * Inyecta capital a la economía del juego.
     * @param {number} amount - Dinero a ingresar.
     * @param {string} source - Origen del ingreso.
     * @returns {boolean} Éxito de la operación.
     */
    function addIncome(amount, source = 'generic') {
        if (!isValidAmount(amount)) {
            console.warn(`[SpaLife EconomySystem] Ingreso rechazado por monto inválido: ${amount}`);
            return false;
        }

        if (window.SpaLife.GameState && typeof window.SpaLife.GameState.addCoins === 'function') {
            window.SpaLife.GameState.addCoins(amount);
            recordTransaction('income', 'generic', amount, source);
            return true;
        }
        return false;
    }

    /**
     * Retira fondos de la cuenta del jugador previa validación de saldo.
     * @param {number} amount - Dinero a gastar.
     * @param {string} category - Categoría contable.
     * @param {string} description - Detalle opcional.
     * @returns {boolean} True si se completó el pago, false si fondos insuficientes.
     */
    function spendCoins(amount, category = 'generic', description = '') {
        if (!isValidAmount(amount)) return false;
        
        if (!canAfford(amount)) {
            notify(`Fondos insuficientes para: ${description || category}`);
            return false;
        }

        if (window.SpaLife.GameState && typeof window.SpaLife.GameState.addCoins === 'function') {
            // Pasamos cantidad negativa a addCoins para realizar la deducción
            window.SpaLife.GameState.addCoins(-amount);
            recordTransaction('expense', category, amount, description);
            return true;
        }
        
        return false;
    }

    // ============================================================
    // CONSULTA DE CATÁLOGO
    // ============================================================

    /**
     * Consulta el precio de un elemento en el catálogo central.
     * @param {string} category - ('zones', 'staff', 'upgrades', 'maintenance', 'consumables').
     * @param {string} id - Clave del elemento.
     * @returns {number|null} Precio o null si no existe.
     */
    function getCost(category, id) {
        if (economyCatalog[category] && economyCatalog[category][id] !== undefined) {
            return economyCatalog[category][id];
        }
        console.warn(`[SpaLife EconomySystem] Artículo no encontrado en catálogo: ${category} -> ${id}`);
        return null;
    }

    // ============================================================
    // MÉTODOS DE OPERACIONES ESPECÍFICAS
    // ============================================================

    function purchaseZone(zoneId) {
        const cost = getCost('zones', zoneId);
        if (cost === null) return false;
        return spendCoins(cost, 'zone', zoneId);
    }

    function hireStaff(staffType) {
        const cost = getCost('staff', staffType);
        if (cost === null) return false;
        return spendCoins(cost, 'staff', staffType);
    }

    function buyUpgrade(upgradeId) {
        const cost = getCost('upgrades', upgradeId);
        if (cost === null) return false;
        return spendCoins(cost, 'upgrade', upgradeId);
    }

    function payMaintenance(type) {
        const cost = getCost('maintenance', type);
        if (cost === null) return false;
        return spendCoins(cost, 'maintenance', type);
    }

    function buyConsumable(item) {
        const cost = getCost('consumables', item);
        if (cost === null) return false;
        return spendCoins(cost, 'consumable', item);
    }

    // ============================================================
    // REPORTES Y ANÁLISIS
    // ============================================================

    /**
     * Genera un reporte financiero de alto nivel.
     * @returns {Object} Informe condensado de la economía.
     */
    function getFinancialReport() {
        return {
            currentCoins: _getCurrentCoins(),
            totalIncome: economyStats.totalIncome,
            totalExpenses: economyStats.totalExpenses,
            netProfit: economyStats.totalIncome - economyStats.totalExpenses,
            transactionCount: transactionHistory.length,
            biggestIncome: economyStats.biggestIncome,
            biggestExpense: economyStats.biggestExpense
        };
    }

    /**
     * Retorna una copia inmutable de las estadísticas desglosadas.
     * @returns {Object}
     */
    function getEconomyStats() {
        return { ...economyStats };
    }

    /**
     * Retorna una copia segura del historial transaccional.
     * @returns {Array}
     */
    function getTransactionHistory() {
        return [...transactionHistory];
    }

    // ============================================================
    // PERSISTENCIA DE DATOS (SAVE SYSTEM READY)
    // ============================================================

    /**
     * Exporta el estado del sistema para guardado.
     * @returns {Object}
     */
    function exportData() {
        return {
            economyStats: { ...economyStats },
            transactionHistory: [...transactionHistory]
        };
    }

    /**
     * Importa y restaura el estado económico desde una fuente externa.
     * @param {Object} data - Objeto de datos previamente serializado.
     */
    function importData(data) {
        if (!data || typeof data !== 'object') return;

        if (data.economyStats) {
            economyStats = {
                totalIncome: data.economyStats.totalIncome || 0,
                totalExpenses: data.economyStats.totalExpenses || 0,
                totalZonePurchases: data.economyStats.totalZonePurchases || 0,
                totalStaffExpenses: data.economyStats.totalStaffExpenses || 0,
                totalUpgradeExpenses: data.economyStats.totalUpgradeExpenses || 0,
                totalMaintenanceExpenses: data.economyStats.totalMaintenanceExpenses || 0,
                totalConsumableExpenses: data.economyStats.totalConsumableExpenses || 0,
                biggestIncome: data.economyStats.biggestIncome || 0,
                biggestExpense: data.economyStats.biggestExpense || 0
            };
        }

        if (Array.isArray(data.transactionHistory)) {
            // Garantizar límite máximo
            transactionHistory = data.transactionHistory.slice(-MAX_HISTORY);
        }
    }

    /**
     * Reinicia por completo la economía analítica del módulo.
     */
    function reset() {
        economyStats = {
            totalIncome: 0,
            totalExpenses: 0,
            totalZonePurchases: 0,
            totalStaffExpenses: 0,
            totalUpgradeExpenses: 0,
            totalMaintenanceExpenses: 0,
            totalConsumableExpenses: 0,
            biggestIncome: 0,
            biggestExpense: 0
        };
        transactionHistory = [];
        console.log('[SpaLife EconomySystem] Estadísticas e historial reiniciados.');
    }

    // ============================================================
    // CICLO DE VIDA (LIFECYCLE)
    // ============================================================

    function init() {
        console.log('[SpaLife EconomySystem] Inicializado. Autoridad financiera activa.');
    }

    function destroy() {
        reset();
        console.log('[SpaLife EconomySystem] Destruido.');
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================

    return {
        init,
        canAfford,
        addIncome,
        spendCoins,
        
        purchaseZone,
        hireStaff,
        buyUpgrade,
        payMaintenance,
        buyConsumable,
        
        getCost,
        getFinancialReport,
        getEconomyStats,
        getTransactionHistory,
        
        exportData,
        importData,
        
        reset,
        destroy
    };

})();
