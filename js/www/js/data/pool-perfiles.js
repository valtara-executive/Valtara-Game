/**
 * ============================================================
 * SPA LIFE: EL VIAJE DEL BIENESTAR
 * Base de Datos de Perfiles de Clientes (Narrativa procedural)
 * ============================================================
 * Nota: Este archivo contiene exclusivamente la base de datos de 
 * personajes y necesidades de los pacientes. Los servicios recomendados
 * coinciden exactamente con los de catalogo_masajes.js.
 * No contiene lógica de simulación ni manipulación del DOM.
 */

window.SpaLife = window.SpaLife || {};

window.SpaLife.CustomerProfiles = (function() {
    'use strict';

    // 1. POOL DE CLIENTES (Mínimo 50 perfiles)
    const perfiles = [
        // --- RELAJANTE NEURO ADAPTATIVO (Sobrecarga nerviosa, tensión, bruxismo) ---
        {
            id: 'P-001', name: 'Carlos Ruiz', ageRange: '25-35', occupation: 'Desarrollador de Software',
            mood: 'Estresado', symptom: 'Tensión severa en cuello y hombros.',
            recommendedService: 'Relajante Neuro Adaptativo',
            dialogue: 'Paso 10 horas diarias frente a la computadora. Siento el cuello como si fuera de piedra y no logro relajarme en casa.'
        },
        {
            id: 'P-002', name: 'Mariana Vega', ageRange: '30-40', occupation: 'Contadora Pública',
            mood: 'Ansiosa', symptom: 'Bruxismo y rigidez de mandíbula.',
            recommendedService: 'Relajante Neuro Adaptativo',
            dialogue: 'Llevo semanas cerrando el mes fiscal. Me despierto con dolor de cabeza porque aprieto la mandíbula toda la noche.'
        },
        {
            id: 'P-003', name: 'Luis Fernando', ageRange: '40-50', occupation: 'Arquitecto',
            mood: 'Agotado', symptom: 'Postura encorvada, dolor de espalda alta.',
            recommendedService: 'Relajante Neuro Adaptativo',
            dialogue: 'Paso horas encorvado sobre los planos en la oficina. Mi respiración es muy corta por la mala postura.'
        },
        {
            id: 'P-004', name: 'Elena Torres', ageRange: '20-30', occupation: 'Recepcionista',
            mood: 'Fatigada', symptom: 'Espasmos en la nuca.',
            recommendedService: 'Relajante Neuro Adaptativo',
            dialogue: 'Atiendo cientos de llamadas al día. Tengo un nudo constante en la base de la nuca que ya no soporto.'
        },
        {
            id: 'P-005', name: 'Roberto Blanc', ageRange: '45-55', occupation: 'Abogado Penalista',
            mood: 'Hiperalerta', symptom: 'Sistema nervioso alterado.',
            recommendedService: 'Relajante Neuro Adaptativo',
            dialogue: 'Tengo un juicio muy importante esta semana. Mi cuerpo está en modo de alerta constante y no puedo descansar.'
        },
        {
            id: 'P-006', name: 'Valeria Castro', ageRange: '35-45', occupation: 'Gerente de Tienda',
            mood: 'Abrumada', symptom: 'Coraza de tensión en trapecios.',
            recommendedService: 'Relajante Neuro Adaptativo',
            dialogue: 'Estoy todo el día de pie resolviendo problemas. Siento que llevo una mochila de rocas sobre los hombros.'
        },
        {
            id: 'P-007', name: 'Diego Navarro', ageRange: '28-38', occupation: 'Diseñador Gráfico',
            mood: 'Tenso', symptom: 'Dolor en zona cervical.',
            recommendedService: 'Relajante Neuro Adaptativo',
            dialogue: 'La pantalla me tiene la vista y las cervicales destruidas. Necesito que alguien me quite esta tensión.'
        },

        // --- MASAJE DEPORTIVO & DESCOMPRESIÓN (Atletas, fatiga muscular profunda, ácido láctico) ---
        {
            id: 'P-008', name: 'Mateo Ortiz', ageRange: '25-35', occupation: 'Corredor Amateur',
            mood: 'Dolorido', symptom: 'Ácido láctico en pantorrillas y muslos.',
            recommendedService: 'Masaje Deportivo & Descompresión',
            dialogue: 'Estoy entrenando para mi primer maratón. Mis piernas están duras como rocas y apenas puedo subir escaleras.'
        },
        {
            id: 'P-009', name: 'Sofía Méndez', ageRange: '20-30', occupation: 'Ciclista Profesional',
            mood: 'Exigida', symptom: 'Contractura severa en glúteos y piernas.',
            recommendedService: 'Masaje Deportivo & Descompresión',
            dialogue: 'Ayer hice 100 kilómetros en la montaña. Necesito una intervención clínica profunda para liberar las piernas.'
        },
        {
            id: 'P-010', name: 'Javier Luján', ageRange: '30-40', occupation: 'Entrenador Personal',
            mood: 'Sobrecargado', symptom: 'Trapecios y dorsales bloqueados.',
            recommendedService: 'Masaje Deportivo & Descompresión',
            dialogue: 'Ayer cargué mi peso máximo en peso muerto. Mis trapecios están totalmente contracturados, necesito presión fuerte.'
        },
        {
            id: 'P-011', name: 'Lucía Beltrán', ageRange: '22-32', occupation: 'Bailarina Contemporánea',
            mood: 'Fatigada', symptom: 'Falta de rango de movimiento.',
            recommendedService: 'Masaje Deportivo & Descompresión',
            dialogue: 'Tuve tres ensayos seguidos. Siento que mis músculos están acortados y necesito recuperar mi flexibilidad hoy mismo.'
        },
        {
            id: 'P-012', name: 'Andrés Gómez', ageRange: '40-50', occupation: 'Trabajador de Construcción',
            mood: 'Agotado Físicamente', symptom: 'Lumbalgia y espalda baja rígida.',
            recommendedService: 'Masaje Deportivo & Descompresión',
            dialogue: 'Mi trabajo requiere mucha fuerza física. La espalda baja me está matando y el dolor no me deja trabajar bien.'
        },
        {
            id: 'P-013', name: 'Paula Ríos', ageRange: '25-35', occupation: 'Tenista',
            mood: 'Molesta', symptom: 'Fatiga aguda en hombro derecho.',
            recommendedService: 'Masaje Deportivo & Descompresión',
            dialogue: 'Practiqué mis saques durante tres horas. Tengo el hombro y el brazo derecho bloqueados por el esfuerzo.'
        },
        {
            id: 'P-014', name: 'Tomás Aguilar', ageRange: '28-38', occupation: 'Nadador de Fondo',
            mood: 'Tenso', symptom: 'Fascia restringida en hombros y brazos.',
            recommendedService: 'Masaje Deportivo & Descompresión',
            dialogue: 'Tengo una competencia pronto y la fricción del agua me tensó los dorsales. Necesito liberar la fascia con urgencia.'
        },

        // --- AYURVEDA & AROMATERAPIA (Desgaste emocional, frío interno, saturación mental) ---
        {
            id: 'P-015', name: 'Carmen Salas', ageRange: '35-45', occupation: 'Gerente de Recursos Humanos',
            mood: 'Saturada', symptom: 'Cansancio emocional y mental.',
            recommendedService: 'Ayurveda & Aromaterapia',
            dialogue: 'Mi trabajo es absorber los problemas de los demás todo el día. Me siento emocionalmente vacía y saturada.'
        },
        {
            id: 'P-016', name: 'Jorge Pineda', ageRange: '45-55', occupation: 'Músico Sinfónico',
            mood: 'Disperso', symptom: 'Ansiedad e hiperactividad mental.',
            recommendedService: 'Ayurveda & Aromaterapia',
            dialogue: 'La temporada de conciertos me tiene con mucha ansiedad. No puedo concentrarme, necesito regresar a mi centro.'
        },
        {
            id: 'P-017', name: 'Natalia Reyes', ageRange: '30-40', occupation: 'Psicóloga Clínica',
            mood: 'Desconectada', symptom: 'Falta de energía y estrés crónico.',
            recommendedService: 'Ayurveda & Aromaterapia',
            dialogue: 'Doy terapias sin parar. Siento un frío interno muy extraño y mi mente simplemente se niega a estar en silencio.'
        },
        {
            id: 'P-018', name: 'Ricardo Silva', ageRange: '40-50', occupation: 'Ejecutivo de Ventas',
            mood: 'Acelerado', symptom: 'Exceso de viajes, desequilibrio.',
            recommendedService: 'Ayurveda & Aromaterapia',
            dialogue: 'He tomado seis vuelos este mes. Siento que mi energía está regada por todos lados. Necesito algo sensorial.'
        },
        {
            id: 'P-019', name: 'Mónica Blanco', ageRange: '28-38', occupation: 'Organizadora de Eventos',
            mood: 'Nerviosa', symptom: 'Mente hiperactiva, insomnio leve.',
            recommendedService: 'Ayurveda & Aromaterapia',
            dialogue: 'Tengo tres bodas este fin de semana. Mi cerebro no se apaga, necesito aceites esenciales tibios para calmarme.'
        },
        {
            id: 'P-020', name: 'Fernando Paz', ageRange: '50-60', occupation: 'Escritor',
            mood: 'Bloqueado', symptom: 'Tensión sutil y bloqueo creativo.',
            recommendedService: 'Ayurveda & Aromaterapia',
            dialogue: 'Llevo un mes de bloqueo del escritor. Necesito una experiencia que nutra mi estado de ánimo y me dé paz absoluta.'
        },

        // --- ESFERAS CHINAS & VELAS AROMÁTICAS (Insomnio, sensibilidad profunda, ruido mental) ---
        {
            id: 'P-021', name: 'Blanca Soto', ageRange: '55-65', occupation: 'Maestra Retirada',
            mood: 'Sensible', symptom: 'Sensibilidad cutánea y dolor articular.',
            recommendedService: 'Esferas Chinas & Velas Aromáticas',
            dialogue: 'Me duele el cuerpo, pero no soporto los masajes fuertes. Busco algo místico, tibio y muy respetuoso con mi piel.'
        },
        {
            id: 'P-022', name: 'Hugo Bernal', ageRange: '18-25', occupation: 'Estudiante Universitario',
            mood: 'Agotado', symptom: 'Insomnio crónico por exámenes.',
            recommendedService: 'Esferas Chinas & Velas Aromáticas',
            dialogue: 'Llevo tres días sin dormir bien por los exámenes finales. Necesito que engañen a mis defensas para poder descansar.'
        },
        {
            id: 'P-023', name: 'Silvia Cruz', ageRange: '40-50', occupation: 'Investigadora',
            mood: 'Desgastada', symptom: 'Cansancio visual y auditivo.',
            recommendedService: 'Esferas Chinas & Velas Aromáticas',
            dialogue: 'Los ruidos del laboratorio me tienen loca. Quiero un aislamiento sensorial completo, luz tenue y mucha calma.'
        },
        {
            id: 'P-024', name: 'Arturo León', ageRange: '35-45', occupation: 'Relojero',
            mood: 'Rígido', symptom: 'Tensión por posturas milimétricas.',
            recommendedService: 'Esferas Chinas & Velas Aromáticas',
            dialogue: 'Mi trabajo requiere precisión extrema. Solo quiero sentir calor reconfortante recorriendo mis brazos y espalda.'
        },
        {
            id: 'P-025', name: 'Patricia Mora', ageRange: '30-40', occupation: 'Enfermera',
            mood: 'Desvelada', symptom: 'Alteración del ciclo de sueño.',
            recommendedService: 'Esferas Chinas & Velas Aromáticas',
            dialogue: 'Hago turnos nocturnos en urgencias. Mi ritmo circadiano está destruido, busco frecuencias de sueño reparador.'
        },
        {
            id: 'P-026', name: 'Raúl Cárdenas', ageRange: '28-38', occupation: 'Analista Financiero',
            mood: 'Inquieto', symptom: 'Imposibilidad para desconectar.',
            recommendedService: 'Esferas Chinas & Velas Aromáticas',
            dialogue: 'El parpadeo de las pantallas de la bolsa me persigue al cerrar los ojos. Quiero terapia rítmica para apagar la mente.'
        },

        // --- REDUCTIVO & MADEROTERAPIA (Objetivos corporales, drenaje linfático, retención) ---
        {
            id: 'P-027', name: 'Camila Rojas', ageRange: '20-30', occupation: 'Modelo',
            mood: 'Enfocada', symptom: 'Retención de líquidos.',
            recommendedService: 'Reductivo & Maderoterapia',
            dialogue: 'Tengo una campaña de fotos en playa mañana. Retengo muchos líquidos y necesito un drenaje intenso rápido.'
        },
        {
            id: 'P-028', name: 'Víctor Solís', ageRange: '25-35', occupation: 'Competidor Fitness',
            mood: 'Motivado', symptom: 'Adiposidad localizada pre-torneo.',
            recommendedService: 'Reductivo & Maderoterapia',
            dialogue: 'Compito la próxima semana. Busco romper la capa más difícil de grasa en el abdomen bajo con fricción fuerte.'
        },
        {
            id: 'P-029', name: 'Lorena Fuentes', ageRange: '28-38', occupation: 'Novia',
            mood: 'Ilusionada', symptom: 'Pesadez y deseo de moldear figura.',
            recommendedService: 'Reductivo & Maderoterapia',
            dialogue: 'Me caso en un mes y el vestido me aprieta un poco en la cintura. Confío en ustedes para ayudarme a esculpir mi figura.'
        },
        {
            id: 'P-030', name: 'Sergio Valdés', ageRange: '35-45', occupation: 'Banquero',
            mood: 'Incómodo', symptom: 'Piernas congestionadas por sedentarismo.',
            recommendedService: 'Reductivo & Maderoterapia',
            dialogue: 'Paso 12 horas sentado en mi escritorio. Siento las piernas hinchadas y muy pesadas, quiero movilizar toxinas.'
        },
        {
            id: 'P-031', name: 'Gabriela Ortiz', ageRange: '40-50', occupation: 'Empresaria Textil',
            mood: 'Decidida', symptom: 'Celulitis y textura de piel.',
            recommendedService: 'Reductivo & Maderoterapia',
            dialogue: 'Estoy haciendo dieta y ejercicio, pero necesito que la maderoterapia anatómica mejore la textura de mis piernas.'
        },
        {
            id: 'P-032', name: 'Martín Paredes', ageRange: '30-40', occupation: 'Actor',
            mood: 'Exigente', symptom: 'Falta de definición abdominal.',
            recommendedService: 'Reductivo & Maderoterapia',
            dialogue: 'Tengo grabaciones sin camisa la próxima semana. Necesito trabajo con geles termogénicos premium para definir.'
        },

        // --- TERAPIA PARA PARÁLISIS FACIAL (Rehabilitación clínica, empatía, neurología) ---
        {
            id: 'P-033', name: 'Rosa Quintero', ageRange: '45-55', occupation: 'Chef Ejecutiva',
            mood: 'Vulnerable', symptom: 'Parálisis periférica por estrés.',
            recommendedService: 'Terapia para Parálisis Facial',
            dialogue: 'Tuve un pico de estrés brutal en la cocina. La mitad de mi rostro no responde bien, me siento muy frustrada.'
        },
        {
            id: 'P-034', name: 'Eduardo Mendieta', ageRange: '50-60', occupation: 'Director Escolar',
            mood: 'Esperanzado', symptom: 'Falta de simetría facial post-viral.',
            recommendedService: 'Terapia para Parálisis Facial',
            dialogue: 'Tuve una infección viral leve que me dejó secuelas faciales. Mi médico me pidió buscar reeducación muscular gradual.'
        },
        {
            id: 'P-035', name: 'Daniela Vivas', ageRange: '30-40', occupation: 'Locutora de Radio',
            mood: 'Preocupada', symptom: 'Debilidad en mandíbula y labios.',
            recommendedService: 'Terapia para Parálisis Facial',
            dialogue: 'Mi herramienta de trabajo es la voz. He notado asimetría al hablar, necesito una estimulación neuromuscular muy fina.'
        },
        {
            id: 'P-036', name: 'Ignacio Rivas', ageRange: '35-45', occupation: 'Piloto Comercial',
            mood: 'Cansado', symptom: 'Pérdida de sensibilidad neurológica.',
            recommendedService: 'Terapia para Parálisis Facial',
            dialogue: 'Viajé a diferentes presiones y el frío afectó mi nervio facial. Necesito un ambiente de total respeto para mi recuperación.'
        },
        {
            id: 'P-037', name: 'Verónica Luna', ageRange: '28-38', occupation: 'Abogada Corporativa',
            mood: 'Sensible', symptom: 'Recuperación lenta de movilidad.',
            recommendedService: 'Terapia para Parálisis Facial',
            dialogue: 'Llevo meses con este problema. Me da pena que me toquen la cara, pero leí que su protocolo es clínico y respetuoso.'
        },
        {
            id: 'P-038', name: 'César del Valle', ageRange: '40-50', occupation: 'Profesor Universitario',
            mood: 'Paciente', symptom: 'Necesidad de despertar propiocepción.',
            recommendedService: 'Terapia para Parálisis Facial',
            dialogue: 'Tengo problemas de movilidad en el ojo derecho. Sé que requiere paciencia absoluta, estoy listo para iniciar terapia.'
        },

        // --- SHIATSU EN CAMA · COMPLEMENTO (Prisa, cuello, hombros, productividad express) ---
        {
            id: 'P-039', name: 'Isabel Montes', ageRange: '35-45', occupation: 'CEO de Startup',
            mood: 'Apresurada', symptom: 'Tensión aguda pre-junta.',
            recommendedService: 'Shiatsu en Cama · Complemento',
            dialogue: 'Tengo la junta de mi vida en 30 minutos. Necesito un hack de productividad urgente, destruye la tensión de mis hombros ya.'
        },
        {
            id: 'P-040', name: 'Antonio Farias', ageRange: '45-55', occupation: 'Inversionista',
            mood: 'Práctico', symptom: 'Dolor punzante en las sienes.',
            recommendedService: 'Shiatsu en Cama · Complemento',
            dialogue: 'Mi tiempo vale oro. Hazme esa digitopuntura profunda en el cuello durante veinte minutos y volveré a trabajar.'
        },
        {
            id: 'P-041', name: 'Laura Villalobos', ageRange: '30-40', occupation: 'Madre de Gemelos',
            mood: 'Desesperada', symptom: 'Carga física en espalda alta.',
            recommendedService: 'Shiatsu en Cama · Complemento',
            dialogue: 'Tengo exactamente media hora de libertad antes de recoger a los niños. Quítame este bloque de cemento del cuello.'
        },
        {
            id: 'P-042', name: 'Manuel Estrada', ageRange: '40-50', occupation: 'Conductor de Uber',
            mood: 'Agotado', symptom: 'Hombros levantados por conducir.',
            recommendedService: 'Shiatsu en Cama · Complemento',
            dialogue: 'Llevo 14 horas manejando. Tengo los hombros pegados a las orejas. Necesito una ráfaga rápida de oxígeno mental.'
        },
        {
            id: 'P-043', name: 'Clara Domínguez', ageRange: '25-35', occupation: 'Fotógrafa de Bodas',
            mood: 'Dolorida', symptom: 'Trapecio inflamado por la cámara.',
            recommendedService: 'Shiatsu en Cama · Complemento',
            dialogue: 'Vengo arrastrando tres cámaras pesadas. Necesito liberar el espasmo de la espalda alta súper rápido.'
        },
        {
            id: 'P-044', name: 'Pedro Castañeda', ageRange: '22-32', occupation: 'Repartidor',
            mood: 'Tenso', symptom: 'Cuello rígido por la mochila.',
            recommendedService: 'Shiatsu en Cama · Complemento',
            dialogue: 'Andar en moto con peso me lastimó. ¿Tienen algo de 20 minutos solo para el cuello? Tengo que volver a la ruta.'
        },

        // --- RITUAL LOMI LOMI SUPREMO (Premium, burnout, lujo, integración profunda) ---
        {
            id: 'P-045', name: 'Julia Navarro', ageRange: '40-50', occupation: 'Fundadora de Empresa',
            mood: 'Triunfante pero Agotada', symptom: 'Fatiga crónica y deseo de recompensa.',
            recommendedService: 'Ritual Lomi Lomi Supremo',
            dialogue: 'Acabo de vender mi empresa tras diez años sin vacaciones. Quiero la obra maestra sensorial que ofrecen. Cero límites.'
        },
        {
            id: 'P-046', name: 'Roberto Alarcón', ageRange: '50-60', occupation: 'Cirujano Cardiovascular',
            mood: 'Burnout severo', symptom: 'Agotamiento profundo que duele físicamente.',
            recommendedService: 'Ritual Lomi Lomi Supremo',
            dialogue: 'Salvé una vida hoy, pero estoy vacío. Mi cansancio es tan profundo que duele. Necesito que mi cerebro se apague por completo.'
        },
        {
            id: 'P-047', name: 'Diana y Carlos', ageRange: '35-45', occupation: 'Turistas VIP',
            mood: 'Celebración', symptom: 'Deseo de experiencia holística máxima.',
            recommendedService: 'Ritual Lomi Lomi Supremo',
            dialogue: 'Es nuestro aniversario de bodas de plata. Queremos experimentar la danza del océano y salir sintiéndonos invencibles.'
        },
        {
            id: 'P-048', name: 'Felipe Vargas', ageRange: '45-55', occupation: 'Productor de Cine',
            mood: 'Saturado', symptom: 'Estrés de nivel directivo intenso.',
            recommendedService: 'Ritual Lomi Lomi Supremo',
            dialogue: 'Terminamos el rodaje. Mi mente está en cortocircuito constante. Por favor, simula ese oleaje continuo para no pensar en nada.'
        },
        {
            id: 'P-049', name: 'Adriana Miralles', ageRange: '30-40', occupation: 'Cantante Internacional',
            mood: 'Exigente', symptom: 'Fatiga de gira, necesidad de exclusividad.',
            recommendedService: 'Ritual Lomi Lomi Supremo',
            dialogue: 'He estado bajo los reflectores por tres meses. Solo quiero privacidad, aromaterapia exclusiva y un lujo absoluto.'
        },
        {
            id: 'P-050', name: 'Mario Escamilla', ageRange: '55-65', occupation: 'Catedrático e Investigador',
            mood: 'Aletargado', symptom: 'Rigidez corporal total por estudio intelectual.',
            recommendedService: 'Ritual Lomi Lomi Supremo',
            dialogue: 'Mi cuerpo se olvidó de cómo relajarse después de tantas investigaciones. Necesito una experiencia premium para regresar a la vida.'
        }
    ];

    // 2. MÉTODOS PÚBLICOS DE CONSULTA Y ACCESO

    /**
     * Retorna un perfil de cliente seleccionado de forma completamente aleatoria.
     * @returns {Object} Objeto con los datos completos del perfil del cliente.
     */
    function getRandomCustomerProfile() {
        const randomIndex = Math.floor(Math.random() * perfiles.length);
        return perfiles[randomIndex];
    }

    /**
     * Retorna todos los perfiles que están asociados a un servicio específico.
     * @param {string} serviceName - El nombre exacto del servicio a buscar.
     * @returns {Array} Un arreglo de objetos de perfiles de clientes.
     */
    function getProfilesByService(serviceName) {
        return perfiles.filter(perfil => perfil.recommendedService === serviceName);
    }

    // 3. EXPOSICIÓN DEL MÓDULO
    return {
        pool: perfiles,
        getRandomCustomerProfile: getRandomCustomerProfile,
        getProfilesByService: getProfilesByService
    };

})();
