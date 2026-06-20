/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Sistema de Tratamientos (Treatment System)
 * ============================================================
 * Nota: Este módulo gestiona la fase de tratamiento después de 
 * que el jugador selecciona una terapia correcta. Controla el 
 * flujo, los tiempos de espera simulados, el movimiento del 
 * personaje hacia la cabina y la generación de recompensas.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.TreatmentSystem = (function() {
    'use strict';

    // ============================================================
    // VARIABLES PRIVADAS
    // ============================================================
    
    let activeTreatment = null;
    let isProcessing = false;

    // ============================================================
    // MÉTODOS PRIVADOS (UTILIDADES)
    // ============================================================

    /**
     * Consulta repetidamente la posición del personaje hasta que alcance su destino.
     * Utiliza un poll loop de 100ms para mantener el módulo independiente.
     * @param {string} characterId - El ID del personaje a monitorear.
     * @param {number} targetX - La coordenada X esperada.
     * @param {number} targetY - La coordenada Y esperada.
     * @returns {Promise} Se resuelve cuando el personaje llega a su destino o es eliminado.
     */
    function waitForCharacterArrival(characterId, targetX, targetY) {
        return new Promise((resolve) => {
            const pollInterval = setInterval(() => {
                const char = window.SpaLife.CharacterSystem.getCharacter(characterId);
                
                // Abortar si el personaje fue eliminado de la memoria
                if (!char) {
                    clearInterval(pollInterval);
                    resolve(false);
                    return;
                }

                // Calcular la distancia restante (con margen de tolerancia)
                const dx = Math.abs(char.x - targetX);
                const dy = Math.abs(char.y - targetY);

                if (dx < 0.5 && dy < 0.5) {
                    clearInterval(pollInterval);
                    resolve(true);
                }
            }, 100);
        });
    }

    /**
     * Pausa la ejecución por una cantidad específica de milisegundos.
     * @param {number} ms - Milisegundos a esperar.
     * @returns {Promise}
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============================================================
    // MÉTODOS PÚBLICOS (API)
    // ============================================================

    /**
     * Inicia la secuencia completa de tratamiento para un cliente.
     * @param {Object} profile - Perfil narrativo e información del cliente.
     * @param {Object} customerCharacter - Referencia al objeto del personaje en el sistema.
     * @param {Object} selectedService - Datos del servicio/terapia a aplicar.
     */
    async function startTreatment(profile, customerCharacter, selectedService) {
        // 1. Validar argumentos y estado actual
        if (!profile || !customerCharacter || !selectedService) {
            console.error('[SpaLife TreatmentSystem] Error: Argumentos inválidos para iniciar tratamiento.');
            return;
        }

        if (isProcessing) {
            console.warn('[SpaLife TreatmentSystem] Ya existe un tratamiento en proceso.');
            return;
        }

        // 2. Crear estado interno de tratamiento activo
        isProcessing = true;
        activeTreatment = {
            profile: profile,
            character: customerCharacter,
            service: selectedService,
            startTime: Date.now()
        };

        const charId = customerCharacter.id;

        // 3. Mostrar mensaje inicial
        const msgDirigiendo = "Dirigiendo al cliente a la cabina...";
        if (window.SpaLife.showDialogue) window.SpaLife.showDialogue("Sistema", msgDirigiendo);
        if (window.SpaLife.announce) window.SpaLife.announce(msgDirigiendo);

        // 4. Mover al cliente a la cabina simulada
        window.SpaLife.CharacterSystem.moveCharacter(charId, 70, 45);

        // 5. Esperar hasta que el personaje llegue a la cabina
        const arrivedAtCabin = await waitForCharacterArrival(charId, 70, 45);
        if (!arrivedAtCabin || !isProcessing) return; // Abortar si fue cancelado o eliminado

        // 6. Cambiar estado a 'waiting'
        window.SpaLife.CharacterSystem.setState(charId, 'waiting');

        // 7. Mostrar mensaje de inicio de tratamiento
        const msgIniciando = "Iniciando tratamiento...";
        if (window.SpaLife.showDialogue) window.SpaLife.showDialogue("Sistema", msgIniciando);
        if (window.SpaLife.announce) window.SpaLife.announce(msgIniciando);

        // 8. Simular duración reducida basada en la dificultad
        // Fórmula de acuerdo a los requerimientos: (dificultad + 1) * 1000 ms
        const difficulty = selectedService.difficulty || 1;
        const durationMs = (difficulty + 1) * 1000;
        
        await sleep(durationMs);
        if (!isProcessing) return; // Verificar si se canceló durante la espera

        // 9. Al terminar, cambiar estado a 'talking' y notificar
        window.SpaLife.CharacterSystem.setState(charId, 'talking');
        
        const msgFinalizado = "Tratamiento finalizado exitosamente.";
        if (window.SpaLife.showDialogue) window.SpaLife.showDialogue("Sistema", msgFinalizado);
        if (window.SpaLife.announce) window.SpaLife.announce(msgFinalizado);

        // 10 & 11. Generar recompensas utilizando GameState
        if (window.SpaLife.GameState) {
            const rewardCoins = selectedService.reward || 50;
            const rewardReputation = selectedService.reputation || 5;
            const wellnessBoost = difficulty * 5;

            window.SpaLife.GameState.addCoins(rewardCoins);
            window.SpaLife.GameState.addReputation(rewardReputation);
            window.SpaLife.GameState.addWellness(wellnessBoost);
        } else {
            console.warn('[SpaLife TreatmentSystem] GameState no encontrado. Recompensas omitidas.');
        }

        // 12. Esperar 2 segundos antes de la salida
        await sleep(2000);
        if (!isProcessing) return;

        // Cambiar estado a caminando y mover a la salida del spa
        window.SpaLife.CharacterSystem.setState(charId, 'walking');
        window.SpaLife.CharacterSystem.moveCharacter(charId, 110, 60);

        // 13. Cuando salga (llegue al destino final), eliminar personaje
        await waitForCharacterArrival(charId, 110, 60);
        if (isProcessing) {
            window.SpaLife.CharacterSystem.removeCharacter(charId);
            
            // Limpiar estado
            activeTreatment = null;
            isProcessing = false;
        }
    }

    /**
     * Cancela forzosamente el tratamiento en curso, reseteando el estado del sistema.
     */
    function cancelTreatment() {
        if (!isProcessing) return;

        console.log('[SpaLife TreatmentSystem] Tratamiento cancelado.');
        
        if (activeTreatment && activeTreatment.character) {
            window.SpaLife.CharacterSystem.removeCharacter(activeTreatment.character.id);
        }

        activeTreatment = null;
        isProcessing = false;
    }

    /**
     * Retorna la información del tratamiento que se está ejecutando actualmente.
     * @returns {Object|null} Objeto con datos del tratamiento o null si no hay ninguno.
     */
    function getCurrentTreatment() {
        return activeTreatment;
    }

    /**
     * 14. Verifica si el sistema está procesando actualmente una terapia.
     * @returns {boolean} True si hay un tratamiento en curso, false de lo contrario.
     */
    function isTreatmentActive() {
        return isProcessing;
    }

    // ============================================================
    // EXPOSICIÓN DE LA API PÚBLICA
    // ============================================================
    
    return {
        startTreatment: startTreatment,
        cancelTreatment: cancelTreatment,
        getCurrentTreatment: getCurrentTreatment,
        isTreatmentActive: isTreatmentActive
    };

})();
