/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Base de Datos de Servicios y Terapias (Game Data)
 * ============================================================
 * Nota: Este archivo contiene las mecánicas base de los servicios.
 * Extraído directamente de catalogo_masajes.js para mantener la 
 * coherencia narrativa y vinculado a pool-perfiles.js.
 * No contiene lógica de manipulación del DOM ni renderizado.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.Services = (function() {
    'use strict';

    // 1. BASE DE DATOS DE TRATAMIENTOS (Game Entities)
    // Dificultad: 1 (Beginner), 2 (Intermediate), 3 (Advanced), 4 (Expert), 5 (Premium)
    const servicesData = [
        {
            id: 'MA-01',
            name: 'Relajante Neuro Adaptativo',
            category: 'Relajación',
            duration: '50 Min',
            difficulty: 1, 
            reward: 100,      // Monedas/Ingresos generados por sesión
            reputation: 10,   // Puntos de reputación/bienestar generados
            zones: ['Espalda completa', 'Cuello y hombros', 'Piernas', 'Cuerpo completo'],
            description: 'Coreografía de presiones fluidas y lentas para desenredar la coraza muscular en cuello y hombros. Regula el sistema nervioso y devuelve el ritmo de la respiración.'
        },
        {
            id: 'MA-02',
            name: 'Masaje Deportivo & Descompresión',
            category: 'Deportivo',
            duration: '50 Minutos',
            difficulty: 3, 
            reward: 150,
            reputation: 20,
            zones: ['Piernas y glúteos', 'Espalda alta', 'Hombros y brazos', 'Cuerpo completo'],
            description: 'Presión clínica directa a la fascia para liberar ácido láctico y destruir contracturas severas. Ideal para recuperar rango de movimiento y fatiga crónica.'
        },
        {
            id: 'MA-03',
            name: 'Ayurveda & Aromaterapia',
            category: 'Holístico',
            duration: '50 Minutos',
            difficulty: 2, 
            reward: 120,
            reputation: 15,
            zones: ['Espalda y caderas', 'Cuello y rostro', 'Brazos y manos', 'Cuerpo completo'],
            description: 'Inmersión sensorial con fricción sostenida y óleos esenciales tibios. Ayuda a combatir la dispersión, el frío interno y la saturación mental ejecutiva.'
        },
        {
            id: 'MA-04',
            name: 'Esferas Chinas & Velas Aromáticas',
            category: 'Inmersivo',
            duration: '60 Minutos',
            difficulty: 2, 
            reward: 140,
            reputation: 18,
            zones: ['Espalda y columna', 'Piernas', 'Cuello y hombros', 'Cuerpo completo'],
            description: 'Aislamiento sensorial mediante resonancia térmica de esferas y cera natural. Diseñado para engañar las defensas en personas sensibles y combatir el insomnio.'
        },
        {
            id: 'MA-05',
            name: 'Reductivo & Maderoterapia',
            category: 'Estético',
            duration: 'Sesión',
            difficulty: 3, 
            reward: 160,
            reputation: 22,
            zones: ['Abdomen y cintura', 'Piernas y glúteos', 'Brazos', 'Cuerpo completo'],
            description: 'Ingeniería estética con intensa fricción manual y maderoterapia para estimular el drenaje linfático, movilizar toxinas y mejorar la textura cutánea.'
        },
        {
            id: 'MA-06',
            name: 'Terapia para Parálisis Facial',
            category: 'Clínico',
            duration: '45 Minutos',
            difficulty: 4, 
            reward: 200,
            reputation: 30,
            zones: ['Rostro completo', 'Mandíbula y sienes', 'Frente y ojos', 'Cuello'],
            description: 'Rehabilitación clínica gradual mediante estimulación neuromuscular focalizada. Un protocolo de empatía y técnica para despertar la conciencia propioceptiva.'
        },
        {
            id: 'MA-07',
            name: 'Shiatsu en Cama · Complemento',
            category: 'Express',
            duration: '20 Minutos',
            difficulty: 1, 
            reward: 60,
            reputation: 5,
            zones: ['Cuello', 'Hombros', 'Espalda alta'],
            description: 'Táctica express de digitopuntura profunda enfocada en las zonas de carga corporativas. Una ráfaga rápida para soltar el espasmo en tiempo récord.'
        },
        {
            id: 'MA-08',
            name: 'Ritual Lomi Lomi Supremo',
            category: 'Premium',
            duration: 'Sesión Premium',
            difficulty: 5, 
            reward: 350,
            reputation: 50,
            zones: ['Espalda completa', 'Piernas', 'Brazos', 'Cuerpo completo'],
            description: 'Obra maestra sensorial. Integración holística con antebrazos simulando el oleaje continuo del océano. Crea un cortocircuito benigno mental para un descanso invencible.'
        }
    ];

    // 2. MÉTODOS PÚBLICOS DEL MÓDULO

    /**
     * Retorna todos los servicios disponibles en el juego.
     * @returns {Array} Arreglo completo de objetos de servicios.
     */
    function getAllServices() {
        return servicesData;
    }

    /**
     * Busca y retorna un servicio específico mediante su ID técnico.
     * @param {string} id - El identificador único del servicio (ej. 'MA-01').
     * @returns {Object|null} El objeto del servicio, o null si no se encuentra.
     */
    function getServiceById(id) {
        const found = servicesData.find(service => service.id === id);
        return found || null;
    }

    /**
     * Busca y retorna un servicio específico mediante su nombre.
     * Usado para cruzar datos con el 'recommendedService' de pool-perfiles.js
     * @param {string} name - El nombre exacto del servicio.
     * @returns {Object|null} El objeto del servicio, o null si no se encuentra.
     */
    function getServiceByName(name) {
        const found = servicesData.find(service => service.name === name);
        return found || null;
    }

    // 3. EXPOSICIÓN DE LA API DEL MÓDULO
    return {
        getAllServices: getAllServices,
        getServiceById: getServiceById,
        getServiceByName: getServiceByName
    };

})();
