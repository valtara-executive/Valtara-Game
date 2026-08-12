/* ================================================================
   VALTARA · El Arte del Bienestar
   Motor de juego — archivo único, sin dependencias externas.
   ----------------------------------------------------------------
   Índice:
     1. Namespace, utilidades y estado persistente
     2. Datos: servicios y perfiles de clientes
     3. Motor visual: personajes, escena, partículas
     4. Diálogo y notificaciones
     5. Bucle de juego: recepción, evaluación, recompensas
     6. Economía y personal (staff)
     7. Mejoras (upgrades) y progresión
     8. Vistas: recepción / personal / mejoras / progreso
     9. Arranque
   ================================================================ */

'use strict';
window.Valtara = window.Valtara || {};

/* ================================================================
   1. UTILIDADES Y ESTADO
   ================================================================ */
const V = window.Valtara;

V.$ = (sel, root) => (root || document).querySelector(sel);
V.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
V.rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
V.randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
V.clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const SAVE_KEY = 'valtara-save-v1';

const DEFAULT_STATE = {
  day: 1,
  coins: 120,
  reputation: 0,
  clientsServed: 0,
  perfectMatches: 0,
  wrongMatches: 0,
  streak: 0,
  bestStreak: 0,
  clientsToday: 0,
  clientsPerDay: 6,
  staff: [],          // ids de personal contratado
  upgrades: [],        // ids de mejoras compradas
  unlockedAt: Date.now()
};

const State = (function () {
  let s = JSON.parse(JSON.stringify(DEFAULT_STATE));

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        s = Object.assign({}, DEFAULT_STATE, parsed);
        if (!Array.isArray(s.staff)) s.staff = [];
        if (!Array.isArray(s.upgrades)) s.upgrades = [];
      }
    } catch (e) {
      console.warn('[Valtara] No se pudo cargar la partida, iniciando nueva.', e);
      s = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }
    catch (e) { console.warn('[Valtara] No se pudo guardar.', e); }
  }

  function get() { return s; }

  function set(patch) {
    Object.assign(s, patch);
    if (s.coins < 0) s.coins = 0;
    save();
  }

  function reset() {
    s = JSON.parse(JSON.stringify(DEFAULT_STATE));
    save();
  }

  return { load, save, get, set, reset };
})();

V.State = State;

/* ================================================================
   2. DATOS — SERVICIOS
   ================================================================ */
const SERVICES = [
  { id:'MA-01', name:'Relajante Neuro Adaptativo', icon:'🌙', category:'Relajación', duration:'50 min', reward:100, reputation:10,
    desc:'Presiones lentas y fluidas para desenredar la tensión de cuello y hombros.' },
  { id:'MA-02', name:'Masaje Deportivo & Descompresión', icon:'💪', category:'Deportivo', duration:'50 min', reward:150, reputation:20,
    desc:'Presión clínica directa a la fascia para liberar ácido láctico y contracturas.' },
  { id:'MA-03', name:'Ayurveda & Aromaterapia', icon:'🪔', category:'Holístico', duration:'50 min', reward:120, reputation:15,
    desc:'Inmersión sensorial con óleos esenciales tibios contra la dispersión mental.' },
  { id:'MA-04', name:'Esferas Chinas & Velas Aromáticas', icon:'🕯️', category:'Inmersivo', duration:'60 min', reward:140, reputation:18,
    desc:'Resonancia térmica y cera natural para combatir el insomnio.' },
  { id:'MA-05', name:'Reductivo & Maderoterapia', icon:'🪵', category:'Estético', duration:'Sesión', reward:160, reputation:22,
    desc:'Fricción manual y maderoterapia para drenaje linfático y textura cutánea.' },
  { id:'MA-06', name:'Terapia para Parálisis Facial', icon:'🌿', category:'Clínico', duration:'45 min', reward:200, reputation:30,
    desc:'Rehabilitación gradual mediante estimulación neuromuscular focalizada.' },
  { id:'MA-07', name:'Shiatsu en Cama · Complemento', icon:'⚡', category:'Express', duration:'20 min', reward:60, reputation:5,
    desc:'Digitopuntura profunda y rápida en las zonas de mayor carga.' },
  { id:'MA-08', name:'Ritual Lomi Lomi Supremo', icon:'🌊', category:'Premium', duration:'Sesión Premium', reward:350, reputation:50,
    desc:'Obra maestra sensorial con antebrazos simulando el oleaje del océano.' }
];

V.SERVICES = SERVICES;
V.serviceByName = (name) => SERVICES.find(s => s.name === name);

/* ================================================================
   2b. DATOS — PERFILES DE CLIENTES (50 perfiles narrativos)
   ================================================================ */
const PROFILES = [
  {id:'P-001',name:'Carlos Ruiz',age:'25-35',job:'Desarrollador de Software',mood:'Estresado',symptom:'Tensión severa en cuello y hombros.',service:'Relajante Neuro Adaptativo',line:'Paso 10 horas diarias frente a la computadora. Siento el cuello como si fuera de piedra y no logro relajarme en casa.'},
  {id:'P-002',name:'Mariana Vega',age:'30-40',job:'Contadora Pública',mood:'Ansiosa',symptom:'Bruxismo y rigidez de mandíbula.',service:'Relajante Neuro Adaptativo',line:'Llevo semanas cerrando el mes fiscal. Me despierto con dolor de cabeza porque aprieto la mandíbula toda la noche.'},
  {id:'P-003',name:'Luis Fernando',age:'40-50',job:'Arquitecto',mood:'Agotado',symptom:'Postura encorvada, dolor de espalda alta.',service:'Relajante Neuro Adaptativo',line:'Paso horas encorvado sobre los planos en la oficina. Mi respiración es muy corta por la mala postura.'},
  {id:'P-004',name:'Elena Torres',age:'20-30',job:'Recepcionista',mood:'Fatigada',symptom:'Espasmos en la nuca.',service:'Relajante Neuro Adaptativo',line:'Atiendo cientos de llamadas al día. Tengo un nudo constante en la base de la nuca que ya no soporto.'},
  {id:'P-005',name:'Roberto Blanc',age:'45-55',job:'Abogado Penalista',mood:'Hiperalerta',symptom:'Sistema nervioso alterado.',service:'Relajante Neuro Adaptativo',line:'Tengo un juicio muy importante esta semana. Mi cuerpo está en modo de alerta constante y no puedo descansar.'},
  {id:'P-006',name:'Valeria Castro',age:'35-45',job:'Gerente de Tienda',mood:'Abrumada',symptom:'Coraza de tensión en trapecios.',service:'Relajante Neuro Adaptativo',line:'Estoy todo el día de pie resolviendo problemas. Siento que llevo una mochila de rocas sobre los hombros.'},
  {id:'P-007',name:'Diego Navarro',age:'28-38',job:'Diseñador Gráfico',mood:'Tenso',symptom:'Dolor en zona cervical.',service:'Relajante Neuro Adaptativo',line:'La pantalla me tiene la vista y las cervicales destruidas. Necesito que alguien me quite esta tensión.'},
  {id:'P-008',name:'Mateo Ortiz',age:'25-35',job:'Corredor Amateur',mood:'Dolorido',symptom:'Ácido láctico en pantorrillas y muslos.',service:'Masaje Deportivo & Descompresión',line:'Estoy entrenando para mi primer maratón. Mis piernas están duras como rocas y apenas puedo subir escaleras.'},
  {id:'P-009',name:'Sofía Méndez',age:'20-30',job:'Ciclista Profesional',mood:'Exigida',symptom:'Contractura severa en glúteos y piernas.',service:'Masaje Deportivo & Descompresión',line:'Ayer hice 100 kilómetros en la montaña. Necesito una intervención clínica profunda para liberar las piernas.'},
  {id:'P-010',name:'Javier Luján',age:'30-40',job:'Entrenador Personal',mood:'Sobrecargado',symptom:'Trapecios y dorsales bloqueados.',service:'Masaje Deportivo & Descompresión',line:'Ayer cargué mi peso máximo en peso muerto. Mis trapecios están totalmente contracturados, necesito presión fuerte.'},
  {id:'P-011',name:'Lucía Beltrán',age:'22-32',job:'Bailarina Contemporánea',mood:'Fatigada',symptom:'Falta de rango de movimiento.',service:'Masaje Deportivo & Descompresión',line:'Tuve tres ensayos seguidos. Siento que mis músculos están acortados y necesito recuperar mi flexibilidad hoy mismo.'},
  {id:'P-012',name:'Andrés Gómez',age:'40-50',job:'Trabajador de Construcción',mood:'Agotado Físicamente',symptom:'Lumbalgia y espalda baja rígida.',service:'Masaje Deportivo & Descompresión',line:'Mi trabajo requiere mucha fuerza física. La espalda baja me está matando y el dolor no me deja trabajar bien.'},
  {id:'P-013',name:'Paula Ríos',age:'25-35',job:'Tenista',mood:'Molesta',symptom:'Fatiga aguda en hombro derecho.',service:'Masaje Deportivo & Descompresión',line:'Practiqué mis saques durante tres horas. Tengo el hombro y el brazo derecho bloqueados por el esfuerzo.'},
  {id:'P-014',name:'Tomás Aguilar',age:'28-38',job:'Nadador de Fondo',mood:'Tenso',symptom:'Fascia restringida en hombros y brazos.',service:'Masaje Deportivo & Descompresión',line:'Tengo una competencia pronto y la fricción del agua me tensó los dorsales. Necesito liberar la fascia con urgencia.'},
  {id:'P-015',name:'Carmen Salas',age:'35-45',job:'Gerente de Recursos Humanos',mood:'Saturada',symptom:'Cansancio emocional y mental.',service:'Ayurveda & Aromaterapia',line:'Mi trabajo es absorber los problemas de los demás todo el día. Me siento emocionalmente vacía y saturada.'},
  {id:'P-016',name:'Jorge Pineda',age:'45-55',job:'Músico Sinfónico',mood:'Disperso',symptom:'Ansiedad e hiperactividad mental.',service:'Ayurveda & Aromaterapia',line:'La temporada de conciertos me tiene con mucha ansiedad. No puedo concentrarme, necesito regresar a mi centro.'},
  {id:'P-017',name:'Natalia Reyes',age:'30-40',job:'Psicóloga Clínica',mood:'Desconectada',symptom:'Falta de energía y estrés crónico.',service:'Ayurveda & Aromaterapia',line:'Doy terapias sin parar. Siento un frío interno muy extraño y mi mente simplemente se niega a estar en silencio.'},
  {id:'P-018',name:'Ricardo Silva',age:'40-50',job:'Ejecutivo de Ventas',mood:'Acelerado',symptom:'Exceso de viajes, desequilibrio.',service:'Ayurveda & Aromaterapia',line:'He tomado seis vuelos este mes. Siento que mi energía está regada por todos lados. Necesito algo sensorial.'},
  {id:'P-019',name:'Mónica Blanco',age:'28-38',job:'Organizadora de Eventos',mood:'Nerviosa',symptom:'Mente hiperactiva, insomnio leve.',service:'Ayurveda & Aromaterapia',line:'Tengo tres bodas este fin de semana. Mi cerebro no se apaga, necesito aceites esenciales tibios para calmarme.'},
  {id:'P-020',name:'Fernando Paz',age:'50-60',job:'Escritor',mood:'Bloqueado',symptom:'Tensión sutil y bloqueo creativo.',service:'Ayurveda & Aromaterapia',line:'Llevo un mes de bloqueo del escritor. Necesito una experiencia que nutra mi estado de ánimo y me dé paz absoluta.'},
  {id:'P-021',name:'Blanca Soto',age:'55-65',job:'Maestra Retirada',mood:'Sensible',symptom:'Sensibilidad cutánea y dolor articular.',service:'Esferas Chinas & Velas Aromáticas',line:'Me duele el cuerpo, pero no soporto los masajes fuertes. Busco algo místico, tibio y muy respetuoso con mi piel.'},
  {id:'P-022',name:'Hugo Bernal',age:'18-25',job:'Estudiante Universitario',mood:'Agotado',symptom:'Insomnio crónico por exámenes.',service:'Esferas Chinas & Velas Aromáticas',line:'Llevo tres días sin dormir bien por los exámenes finales. Necesito que engañen a mis defensas para poder descansar.'},
  {id:'P-023',name:'Silvia Cruz',age:'40-50',job:'Investigadora',mood:'Desgastada',symptom:'Cansancio visual y auditivo.',service:'Esferas Chinas & Velas Aromáticas',line:'Los ruidos del laboratorio me tienen loca. Quiero un aislamiento sensorial completo, luz tenue y mucha calma.'},
  {id:'P-024',name:'Arturo León',age:'35-45',job:'Relojero',mood:'Rígido',symptom:'Tensión por posturas milimétricas.',service:'Esferas Chinas & Velas Aromáticas',line:'Mi trabajo requiere precisión extrema. Solo quiero sentir calor reconfortante recorriendo mis brazos y espalda.'},
  {id:'P-025',name:'Patricia Mora',age:'30-40',job:'Enfermera',mood:'Desvelada',symptom:'Alteración del ciclo de sueño.',service:'Esferas Chinas & Velas Aromáticas',line:'Hago turnos nocturnos en urgencias. Mi ritmo circadiano está destruido, busco frecuencias de sueño reparador.'},
  {id:'P-026',name:'Raúl Cárdenas',age:'28-38',job:'Analista Financiero',mood:'Inquieto',symptom:'Imposibilidad para desconectar.',service:'Esferas Chinas & Velas Aromáticas',line:'El parpadeo de las pantallas de la bolsa me persigue al cerrar los ojos. Quiero terapia rítmica para apagar la mente.'},
  {id:'P-027',name:'Camila Rojas',age:'20-30',job:'Modelo',mood:'Enfocada',symptom:'Retención de líquidos.',service:'Reductivo & Maderoterapia',line:'Tengo una campaña de fotos en playa mañana. Retengo muchos líquidos y necesito un drenaje intenso rápido.'},
  {id:'P-028',name:'Víctor Solís',age:'25-35',job:'Competidor Fitness',mood:'Motivado',symptom:'Adiposidad localizada pre-torneo.',service:'Reductivo & Maderoterapia',line:'Compito la próxima semana. Busco romper la capa más difícil de grasa en el abdomen bajo con fricción fuerte.'},
  {id:'P-029',name:'Lorena Fuentes',age:'28-38',job:'Novia',mood:'Ilusionada',symptom:'Pesadez y deseo de moldear figura.',service:'Reductivo & Maderoterapia',line:'Me caso en un mes y el vestido me aprieta un poco en la cintura. Confío en ustedes para ayudarme a esculpir mi figura.'},
  {id:'P-030',name:'Sergio Valdés',age:'35-45',job:'Banquero',mood:'Incómodo',symptom:'Piernas congestionadas por sedentarismo.',service:'Reductivo & Maderoterapia',line:'Paso 12 horas sentado en mi escritorio. Siento las piernas hinchadas y muy pesadas, quiero movilizar toxinas.'},
  {id:'P-031',name:'Gabriela Ortiz',age:'40-50',job:'Empresaria Textil',mood:'Decidida',symptom:'Celulitis y textura de piel.',service:'Reductivo & Maderoterapia',line:'Estoy haciendo dieta y ejercicio, pero necesito que la maderoterapia anatómica mejore la textura de mis piernas.'},
  {id:'P-032',name:'Martín Paredes',age:'30-40',job:'Actor',mood:'Exigente',symptom:'Falta de definición abdominal.',service:'Reductivo & Maderoterapia',line:'Tengo grabaciones sin camisa la próxima semana. Necesito trabajo con geles termogénicos premium para definir.'},
  {id:'P-033',name:'Rosa Quintero',age:'45-55',job:'Chef Ejecutiva',mood:'Vulnerable',symptom:'Parálisis periférica por estrés.',service:'Terapia para Parálisis Facial',line:'Tuve un pico de estrés brutal en la cocina. La mitad de mi rostro no responde bien, me siento muy frustrada.'},
  {id:'P-034',name:'Eduardo Mendieta',age:'50-60',job:'Director Escolar',mood:'Esperanzado',symptom:'Falta de simetría facial post-viral.',service:'Terapia para Parálisis Facial',line:'Tuve una infección viral leve que me dejó secuelas faciales. Mi médico me pidió buscar reeducación muscular gradual.'},
  {id:'P-035',name:'Daniela Vivas',age:'30-40',job:'Locutora de Radio',mood:'Preocupada',symptom:'Debilidad en mandíbula y labios.',service:'Terapia para Parálisis Facial',line:'Mi herramienta de trabajo es la voz. He notado asimetría al hablar, necesito una estimulación neuromuscular muy fina.'},
  {id:'P-036',name:'Ignacio Rivas',age:'35-45',job:'Piloto Comercial',mood:'Cansado',symptom:'Pérdida de sensibilidad neurológica.',service:'Terapia para Parálisis Facial',line:'Viajé a diferentes presiones y el frío afectó mi nervio facial. Necesito un ambiente de total respeto para mi recuperación.'},
  {id:'P-037',name:'Verónica Luna',age:'28-38',job:'Abogada Corporativa',mood:'Sensible',symptom:'Recuperación lenta de movilidad.',service:'Terapia para Parálisis Facial',line:'Llevo meses con este problema. Me da pena que me toquen la cara, pero leí que su protocolo es clínico y respetuoso.'},
  {id:'P-038',name:'César del Valle',age:'40-50',job:'Profesor Universitario',mood:'Paciente',symptom:'Necesidad de despertar propiocepción.',service:'Terapia para Parálisis Facial',line:'Tengo problemas de movilidad en el ojo derecho. Sé que requiere paciencia absoluta, estoy listo para iniciar terapia.'},
  {id:'P-039',name:'Isabel Montes',age:'35-45',job:'CEO de Startup',mood:'Apresurada',symptom:'Tensión aguda pre-junta.',service:'Shiatsu en Cama · Complemento',line:'Tengo la junta de mi vida en 30 minutos. Necesito un hack de productividad urgente, destruye la tensión de mis hombros ya.'},
  {id:'P-040',name:'Antonio Farias',age:'45-55',job:'Inversionista',mood:'Práctico',symptom:'Dolor punzante en las sienes.',service:'Shiatsu en Cama · Complemento',line:'Mi tiempo vale oro. Hazme esa digitopuntura profunda en el cuello durante veinte minutos y volveré a trabajar.'},
  {id:'P-041',name:'Laura Villalobos',age:'30-40',job:'Madre de Gemelos',mood:'Desesperada',symptom:'Carga física en espalda alta.',service:'Shiatsu en Cama · Complemento',line:'Tengo exactamente media hora de libertad antes de recoger a los niños. Quítame este bloque de cemento del cuello.'},
  {id:'P-042',name:'Manuel Estrada',age:'40-50',job:'Conductor de Uber',mood:'Agotado',symptom:'Hombros levantados por conducir.',service:'Shiatsu en Cama · Complemento',line:'Llevo 14 horas manejando. Tengo los hombros pegados a las orejas. Necesito una ráfaga rápida de oxígeno mental.'},
  {id:'P-043',name:'Clara Domínguez',age:'25-35',job:'Fotógrafa de Bodas',mood:'Dolorida',symptom:'Trapecio inflamado por la cámara.',service:'Shiatsu en Cama · Complemento',line:'Vengo arrastrando tres cámaras pesadas. Necesito liberar el espasmo de la espalda alta súper rápido.'},
  {id:'P-044',name:'Pedro Castañeda',age:'22-32',job:'Repartidor',mood:'Tenso',symptom:'Cuello rígido por la mochila.',service:'Shiatsu en Cama · Complemento',line:'Andar en moto con peso me lastimó. ¿Tienen algo de 20 minutos solo para el cuello? Tengo que volver a la ruta.'},
  {id:'P-045',name:'Julia Navarro',age:'40-50',job:'Fundadora de Empresa',mood:'Triunfante pero Agotada',symptom:'Fatiga crónica y deseo de recompensa.',service:'Ritual Lomi Lomi Supremo',line:'Acabo de vender mi empresa tras diez años sin vacaciones. Quiero la obra maestra sensorial que ofrecen. Cero límites.'},
  {id:'P-046',name:'Roberto Alarcón',age:'50-60',job:'Cirujano Cardiovascular',mood:'Burnout severo',symptom:'Agotamiento profundo que duele físicamente.',service:'Ritual Lomi Lomi Supremo',line:'Salvé una vida hoy, pero estoy vacío. Mi cansancio es tan profundo que duele. Necesito que mi cerebro se apague por completo.'},
  {id:'P-047',name:'Diana y Carlos',age:'35-45',job:'Turistas VIP',mood:'Celebración',symptom:'Deseo de experiencia holística máxima.',service:'Ritual Lomi Lomi Supremo',line:'Es nuestro aniversario de bodas de plata. Queremos experimentar la danza del océano y salir sintiéndonos invencibles.'},
  {id:'P-048',name:'Felipe Vargas',age:'45-55',job:'Productor de Cine',mood:'Saturado',symptom:'Estrés de nivel directivo intenso.',service:'Ritual Lomi Lomi Supremo',line:'Terminamos el rodaje. Mi mente está en cortocircuito constante. Por favor, simula ese oleaje continuo para no pensar en nada.'},
  {id:'P-049',name:'Adriana Miralles',age:'30-40',job:'Cantante Internacional',mood:'Exigente',symptom:'Fatiga de gira, necesidad de exclusividad.',service:'Ritual Lomi Lomi Supremo',line:'He estado bajo los reflectores por tres meses. Solo quiero privacidad, aromaterapia exclusiva y un lujo absoluto.'},
  {id:'P-050',name:'Mario Escamilla',age:'55-65',job:'Catedrático e Investigador',mood:'Aletargado',symptom:'Rigidez corporal total por estudio intelectual.',service:'Ritual Lomi Lomi Supremo',line:'Mi cuerpo se olvidó de cómo relajarse después de tantas investigaciones. Necesito una experiencia premium para regresar a la vida.'}
];

V.PROFILES = PROFILES;
V.randomProfile = () => V.rand(PROFILES);

/* Paleta de avatares — se asigna determinísticamente por hash del nombre,
   así cada cliente conserva siempre el mismo color entre visitas. */
const AVATAR_PALETTE = [
  '#e3c896', '#9cbaa8', '#d17e68', '#a8b7d1', '#d1a8c4', '#c4c088', '#8fc4c0', '#c9a8d1'
];
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
}
V.avatarColorFor = (name) => AVATAR_PALETTE[hashStr(name) % AVATAR_PALETTE.length];
V.initialsFor = (name) => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/* ================================================================
   3. MOTOR VISUAL — PERSONAJES Y ESCENA
   ================================================================ */
const Actors = (function () {
  const registry = {};
  let engineRunning = false;
  let lastTime = 0;
  const SPEED = 28; // % de pantalla por segundo

  function layer() { return V.$('#character-layer'); }

  function loop(ts) {
    const dt = (ts - lastTime) / 1000;
    lastTime = ts;
    let moving = false;

    for (const id in registry) {
      const a = registry[id];
      if (a.state === 'walking') {
        moving = true;
        const dx = a.targetX - a.x, dy = a.targetY - a.y;
        const dist = Math.hypot(dx, dy);
        const step = SPEED * dt;
        if (dist <= step) {
          a.x = a.targetX; a.y = a.targetY;
          setState(id, a.nextState || 'idle');
        } else {
          a.x += (dx / dist) * step;
          a.y += (dy / dist) * step;
        }
        paint(a);
      }
    }
    if (engineRunning) requestAnimationFrame(loop);
  }

  function ensureEngine() {
    if (!engineRunning) {
      engineRunning = true;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function paint(a) {
    a.el.style.left = a.x + '%';
    a.el.style.top = a.y + '%';
  }

  function create(cfg) {
    const parent = layer();
    if (!parent) return null;
    if (registry[cfg.id]) return registry[cfg.id];

    const el = document.createElement('div');
    el.className = 'actor role-' + (cfg.role === 'staff' ? 'staff' : 'customer');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', (cfg.role === 'staff' ? 'Personal' : 'Cliente') + ' ' + cfg.name);

    const avatar = document.createElement('div');
    avatar.className = 'actor-avatar';
    const color = cfg.role === 'staff' ? null : V.avatarColorFor(cfg.name);
    if (color) avatar.style.background = `linear-gradient(150deg, ${color}, ${shade(color, -18)})`;
    avatar.textContent = V.initialsFor(cfg.name);

    const body = document.createElement('div');
    body.className = 'actor-body';
    body.style.background = cfg.role === 'staff'
      ? 'linear-gradient(160deg,#4a3d2e,#332921)'
      : `linear-gradient(160deg, ${shade(color, -6)}, ${shade(color, -30)})`;

    const tag = document.createElement('div');
    tag.className = 'actor-name-tag';
    tag.textContent = cfg.name;

    el.appendChild(avatar);
    el.appendChild(body);
    el.appendChild(tag);
    parent.appendChild(el);

    const actor = {
      id: cfg.id, name: cfg.name, role: cfg.role,
      x: cfg.x, y: cfg.y, targetX: cfg.x, targetY: cfg.y,
      state: 'idle', nextState: 'idle', el
    };
    paint(actor);
    registry[cfg.id] = actor;
    ensureEngine();
    return actor;
  }

  function shade(hex, percent) {
    if (!hex) return '#3c3128';
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + Math.round(2.55 * percent);
    let g = ((n >> 8) & 0xff) + Math.round(2.55 * percent);
    let b = (n & 0xff) + Math.round(2.55 * percent);
    r = V.clamp(r, 0, 255); g = V.clamp(g, 0, 255); b = V.clamp(b, 0, 255);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function remove(id) {
    const a = registry[id];
    if (a) {
      a.el.remove();
      delete registry[id];
    }
  }

  function get(id) { return registry[id]; }

  function moveTo(id, x, y, nextState) {
    const a = registry[id];
    if (!a) return;
    a.targetX = V.clamp(x, 4, 96);
    a.targetY = V.clamp(y, 10, 88);
    a.nextState = nextState || 'idle';
    setState(id, 'walking');
  }

  function setState(id, state) {
    const a = registry[id];
    if (!a) return;
    a.state = state;
    a.el.classList.toggle('walking', state === 'walking');
    a.el.classList.toggle('talking', state === 'talking');
  }

  function waitForArrival(id) {
    return new Promise((resolve) => {
      const iv = setInterval(() => {
        const a = registry[id];
        if (!a) { clearInterval(iv); resolve(false); return; }
        if (a.state !== 'walking') { clearInterval(iv); resolve(true); }
      }, 80);
    });
  }

  return { create, remove, get, moveTo, setState, waitForArrival };
})();
V.Actors = Actors;

/* Ambient dust motes for the scene */
function spawnMotes() {
  const host = V.$('#motes');
  if (!host) return;
  host.innerHTML = '';
  const count = 14;
  for (let i = 0; i < count; i++) {
    const m = document.createElement('div');
    m.className = 'mote';
    m.style.left = V.randInt(0, 100) + '%';
    m.style.bottom = V.randInt(0, 30) + '%';
    m.style.animationDuration = (V.randInt(8, 18)) + 's';
    m.style.animationDelay = (Math.random() * 10) + 's';
    host.appendChild(m);
  }
}

/* ================================================================
   4. DIÁLOGO Y NOTIFICACIONES
   ================================================================ */
function showDialogue(speaker, message, meta) {
  const host = V.$('#dialogue-layer');
  if (!host) return;
  host.innerHTML = `
    <div class="dlg-card" id="dlg-card">
      <span class="dlg-speaker">${escapeHtml(speaker)}</span>
      ${meta ? `<span class="dlg-meta">${escapeHtml(meta)}</span>` : ''}
      <span class="dlg-message">${escapeHtml(message)}</span>
    </div>`;
  requestAnimationFrame(() => {
    const card = V.$('#dlg-card');
    if (card) card.classList.add('show');
  });
  announce(speaker + ': ' + message);
}
function clearDialogue() {
  const host = V.$('#dialogue-layer');
  if (host) host.innerHTML = '';
}
function announce(msg) {
  const a11y = V.$('#accessibility-layer');
  if (a11y) a11y.textContent = msg;
}
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}
function toast(msg, icon) {
  const host = V.$('#notification-layer');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${icon || '✦'}</span><span>${escapeHtml(msg)}</span>`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}
V.showDialogue = showDialogue;
V.clearDialogue = clearDialogue;
V.announce = announce;
V.toast = toast;

/* ================================================================
   5. BUCLE DE JUEGO — RECEPCIÓN
   ================================================================ */
const Reception = (function () {
  const RECEPTIONIST_ID = 'staff-receptionist';
  const DESK_X = 50, DESK_Y = 62;
  let currentProfile = null;
  let currentCustomerId = null;
  let interactionOpen = false;

  function spawnReceptionist() {
    Actors.create({ id: RECEPTIONIST_ID, name: 'Valeria', role: 'staff', x: DESK_X, y: DESK_Y - 6 });
    Actors.setState(RECEPTIONIST_ID, 'idle');
  }

  async function bringNextCustomer() {
    interactionOpen = false;
    closeServiceSheet();
    clearDialogue();

    const profile = V.randomProfile();
    currentProfile = profile;
    const custId = 'customer-' + profile.id + '-' + Date.now();
    currentCustomerId = custId;

    const entrySide = Math.random() < 0.5 ? 6 : 94;
    Actors.create({ id: custId, name: profile.name, role: 'customer', x: entrySide, y: DESK_Y });
    Actors.moveTo(custId, DESK_X, DESK_Y, 'idle');

    await Actors.waitForArrival(custId);
    Actors.setState(custId, 'talking');
    Actors.setState(RECEPTIONIST_ID, 'talking');

    showDialogue(profile.name, profile.line, `${profile.job} · ${profile.age} años`);
    openServiceSheet(profile);
  }

  function openServiceSheet(profile) {
    interactionOpen = true;
    const hint = V.$('#symptom-hint');
    hint.style.display = 'flex';
    hint.innerHTML = `
      <span class="sh-icon">🩺</span>
      <span class="sh-text"><b>Síntoma:</b> ${escapeHtml(profile.symptom)} <br><b>Estado de ánimo:</b> ${escapeHtml(profile.mood)}</span>`;

    const grid = V.$('#service-grid');
    grid.innerHTML = '';
    // Baraja el orden para que no sea siempre predecible
    const shuffled = [...SERVICES].sort(() => Math.random() - 0.5);
    shuffled.forEach(svc => {
      const btn = document.createElement('button');
      btn.className = 'service-card';
      btn.setAttribute('aria-label', 'Asignar tratamiento: ' + svc.name);
      btn.innerHTML = `
        <span class="sc-name">${svc.icon} ${escapeHtml(svc.name)}</span>
        <span class="sc-meta"><span>${escapeHtml(svc.duration)}</span><span class="sc-reward">◈ ${svc.reward}</span></span>`;
      btn.addEventListener('click', () => handleChoice(svc));
      grid.appendChild(btn);
    });

    V.$('#bottom-sheet').classList.add('open');
  }

  function closeServiceSheet() {
    V.$('#bottom-sheet').classList.remove('open');
    V.$('#symptom-hint').style.display = 'none';
  }

  function handleChoice(service) {
    if (!interactionOpen) return;
    interactionOpen = false;
    closeServiceSheet();

    const correct = service.name === currentProfile.service;
    const bonusMult = V.Staff.getServiceBonus();

    if (correct) {
      const coinGain = Math.round(service.reward * bonusMult);
      const repGain = service.reputation;
      V.State.set({
        coins: State.get().coins + coinGain,
        reputation: State.get().reputation + repGain,
        clientsServed: State.get().clientsServed + 1,
        perfectMatches: State.get().perfectMatches + 1,
        clientsToday: State.get().clientsToday + 1,
        streak: State.get().streak + 1,
        bestStreak: Math.max(State.get().bestStreak, State.get().streak + 1)
      });
      flashFeedback(true, coinGain, repGain);
      showDialogue('Valtara', `${currentProfile.name} sale renovado. Diagnóstico perfecto.`, 'Sesión completada');
      if (currentCustomerId) Actors.setState(currentCustomerId, 'talking');
    } else {
      const consolationCoins = Math.round(18 * bonusMult);
      V.State.set({
        coins: State.get().coins + consolationCoins,
        clientsServed: State.get().clientsServed + 1,
        wrongMatches: State.get().wrongMatches + 1,
        clientsToday: State.get().clientsToday + 1,
        streak: 0
      });
      flashFeedback(false, consolationCoins, 0);
      showDialogue('Valtara', `${currentProfile.name} agradece el esfuerzo, aunque no era lo que buscaba.`, 'Diagnóstico incorrecto');
    }

    V.HUD.refresh();
    checkUnlocks();

    setTimeout(() => {
      exitCustomer();
      if (State.get().clientsToday >= State.get().clientsPerDay) {
        V.DayCycle.endDay();
      } else {
        bringNextCustomer();
      }
    }, 1900);
  }

  function exitCustomer() {
    if (!currentCustomerId) return;
    const id = currentCustomerId;
    const exitSide = Math.random() < 0.5 ? 4 : 96;
    Actors.moveTo(id, exitSide, DESK_Y, 'idle');
    setTimeout(() => Actors.remove(id), 1200);
    currentCustomerId = null;
    currentProfile = null;
  }

  function flashFeedback(good, coins, rep) {
    const host = V.$('#feedback-flash');
    host.innerHTML = `
      <div class="feedback-badge ${good ? 'good' : 'bad'}">
        ${good ? '✓ Diagnóstico perfecto' : '✕ No era el indicado'}
        <small>+${coins} ◈ monedas${rep ? ' · +' + rep + ' reputación' : ''}</small>
      </div>`;
    host.classList.remove('show');
    void host.offsetWidth; // reflow to restart animation
    host.classList.add('show');
  }

  function checkUnlocks() {
    const s = State.get();
    // Cada 5 clientes atendidos correctamente sin fallar sube el cupo diario
    if (s.bestStreak > 0 && s.bestStreak % 8 === 0) {
      // silent — handled by progression view
    }
  }

  function init() {
    spawnReceptionist();
    setTimeout(bringNextCustomer, 700);
  }

  function pause() {
    interactionOpen = false;
    closeServiceSheet();
  }

  return { init, bringNextCustomer, pause, get currentProfile() { return currentProfile; } };
})();
V.Reception = Reception;

/* ================================================================
   6. PERSONAL (STAFF)
   ================================================================ */
const STAFF_ROSTER = [
  { id:'sf-01', name:'Renata Ibáñez', role:'Terapeuta Junior', icon:'🧑‍⚕️', cost:200, bonus:0.06,
    desc:'Aumenta un 6% las ganancias por sesión.' },
  { id:'sf-02', name:'Ismael Coto', role:'Terapeuta Senior', icon:'🧑‍⚕️', cost:480, bonus:0.12,
    desc:'Aumenta un 12% las ganancias por sesión.' },
  { id:'sf-03', name:'Dulce Marín', role:'Coordinadora de Bienestar', icon:'🌸', cost:850, bonus:0.20,
    desc:'Aumenta un 20% las ganancias y mejora la reputación general.' },
  { id:'sf-04', name:'Óscar Beltrán', role:'Especialista Clínico', icon:'🩺', cost:1400, bonus:0.30,
    desc:'Personal de élite: +30% en cada sesión completada.' }
];
V.STAFF_ROSTER = STAFF_ROSTER;

const Staff = (function () {
  function owned() { return State.get().staff; }
  function isOwned(id) { return owned().includes(id); }

  function getServiceBonus() {
    const total = owned().reduce((sum, id) => {
      const m = STAFF_ROSTER.find(s => s.id === id);
      return sum + (m ? m.bonus : 0);
    }, 0);
    return 1 + total;
  }

  function hire(id) {
    const member = STAFF_ROSTER.find(s => s.id === id);
    if (!member || isOwned(id)) return false;
    const s = State.get();
    if (s.coins < member.cost) { toast('No tienes suficientes monedas para contratar.', '◈'); return false; }
    State.set({ coins: s.coins - member.cost, staff: [...s.staff, id] });
    toast(`${member.name} se unió al equipo.`, member.icon);
    V.HUD.refresh();
    return true;
  }

  return { owned, isOwned, getServiceBonus, hire };
})();
V.Staff = Staff;

/* ================================================================
   7. MEJORAS (UPGRADES)
   ================================================================ */
const UPGRADES = [
  { id:'up-01', name:'Difusores de Aromaterapia', icon:'🪔', cost:150,
    desc:'Los clientes llegan de mejor ánimo. +2 clientes por día.', apply:(s)=>({ clientsPerDay: s.clientsPerDay + 2 }) },
  { id:'up-02', name:'Mobiliario de Recepción', icon:'🪑', cost:320,
    desc:'Una recepción más cómoda mejora cada pago en un 10%.', apply:null, bonus:0.10 },
  { id:'up-03', name:'Iluminación Ambiental', icon:'🕯️', cost:600,
    desc:'Atmósfera premium: +3 clientes por día.', apply:(s)=>({ clientsPerDay: s.clientsPerDay + 3 }) },
  { id:'up-04', name:'Sala de Espera VIP', icon:'✦', cost:1100,
    desc:'Clientes de alto perfil pagan más. +18% en cada pago.', apply:null, bonus:0.18 }
];
V.UPGRADES = UPGRADES;

const Upgrades = (function () {
  function owned() { return State.get().upgrades; }
  function isOwned(id) { return owned().includes(id); }

  function totalBonus() {
    return UPGRADES.filter(u => isOwned(u.id) && u.bonus).reduce((sum, u) => sum + u.bonus, 0);
  }

  function buy(id) {
    const up = UPGRADES.find(u => u.id === id);
    if (!up || isOwned(id)) return false;
    const s = State.get();
    if (s.coins < up.cost) { toast('No tienes suficientes monedas.', '◈'); return false; }
    let patch = { coins: s.coins - up.cost, upgrades: [...s.upgrades, id] };
    if (up.apply) patch = Object.assign(patch, up.apply(s));
    State.set(patch);
    toast(`${up.name} instalado.`, up.icon);
    V.HUD.refresh();
    return true;
  }

  return { owned, isOwned, totalBonus, buy };
})();
V.Upgrades = Upgrades;

/* Ajustar el bono de servicio para incluir mejoras además de personal */
const _origGetServiceBonus = Staff.getServiceBonus;
Staff.getServiceBonus = function () {
  return _origGetServiceBonus() + Upgrades.totalBonus();
};

/* ================================================================
   8. CICLO DE DÍA
   ================================================================ */
const DayCycle = (function () {
  function endDay() {
    Reception.pause();
    const s = State.get();
    const dayCoins = s.clientsToday; // referencia informativa
    showDaySummary();
  }

  function showDaySummary() {
    const s = State.get();
    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">Fin del día ${s.day}</div>
      <div class="modal-sub">Valtara cierra sus puertas por hoy. Esto es lo que lograste en esta jornada.</div>
      <div class="stat-row"><span class="label">🧑‍🤝‍🧑 Clientes atendidos</span><span class="value">${s.clientsToday}</span></div>
      <div class="stat-row"><span class="label">✓ Diagnósticos perfectos</span><span class="value pos">${s.perfectMatches}</span></div>
      <div class="stat-row"><span class="label">✕ Diagnósticos errados</span><span class="value neg">${s.wrongMatches}</span></div>
      <div class="stat-row"><span class="label">◈ Monedas totales</span><span class="value">${s.coins}</span></div>
      <div class="stat-row"><span class="label">☾ Reputación</span><span class="value">${s.reputation}</span></div>
      <button class="btn-primary" id="btn-next-day">Comenzar día ${s.day + 1}</button>
    `);
    V.$('#btn-next-day').addEventListener('click', () => {
      State.set({ day: s.day + 1, clientsToday: 0 });
      Modal.close();
      V.HUD.refresh();
      Reception.bringNextCustomer();
    });
  }

  return { endDay };
})();
V.DayCycle = DayCycle;

/* ================================================================
   MODAL genérico (hoja inferior)
   ================================================================ */
const Modal = (function () {
  function open(html) {
    V.$('#modal-sheet').innerHTML = html;
    V.$('#modal-layer').classList.add('open');
    V.$('#modal-layer').setAttribute('aria-hidden', 'false');
  }
  function close() {
    V.$('#modal-layer').classList.remove('open');
    V.$('#modal-layer').setAttribute('aria-hidden', 'true');
    V.$('#modal-sheet').innerHTML = '';
  }
  return { open, close };
})();
V.Modal = Modal;

/* ================================================================
   HUD — barra superior + medidor de bienestar
   ================================================================ */
const HUD = (function () {
  function refresh() {
    const s = State.get();
    V.$('#stat-day').textContent = 'Día ' + s.day;
    V.$('#stat-coins').textContent = s.coins.toLocaleString('es-MX');

    const repForFill = V.clamp(s.reputation % 500, 0, 500) / 500 * 100;
    V.$('#wellness-fill').style.width = repForFill + '%';
    V.$('#wellness-value').textContent = s.reputation;
  }
  return { refresh };
})();
V.HUD = HUD;

/* ================================================================
   VISTAS — Personal / Mejoras / Progreso
   ================================================================ */
const Views = (function () {

  function renderStaff() {
    const s = State.get();
    const rows = STAFF_ROSTER.map(m => {
      const owned = Staff.isOwned(m.id);
      const affordable = s.coins >= m.cost;
      return `
        <div class="upgrade-row">
          <div class="upgrade-icon">${m.icon}</div>
          <div class="upgrade-info">
            <div class="u-name">${escapeHtml(m.name)} · ${escapeHtml(m.role)}</div>
            <div class="u-desc">${escapeHtml(m.desc)}</div>
          </div>
          <button class="upgrade-buy ${owned ? 'owned' : ''}" data-hire="${m.id}" ${owned || !affordable ? 'disabled' : ''}>
            ${owned ? 'En equipo' : '◈ ' + m.cost}
          </button>
        </div>`;
    }).join('');

    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">Personal de Valtara</div>
      <div class="modal-sub">Cada especialista aumenta permanentemente las ganancias por sesión.</div>
      ${rows}
      <button class="btn-secondary" id="btn-close-modal">Cerrar</button>
    `);
    V.$$('[data-hire]').forEach(btn => {
      btn.addEventListener('click', () => { Staff.hire(btn.dataset.hire); renderStaff(); });
    });
    V.$('#btn-close-modal').addEventListener('click', Modal.close);
  }

  function renderUpgrades() {
    const s = State.get();
    const rows = UPGRADES.map(u => {
      const owned = Upgrades.isOwned(u.id);
      const affordable = s.coins >= u.cost;
      return `
        <div class="upgrade-row">
          <div class="upgrade-icon">${u.icon}</div>
          <div class="upgrade-info">
            <div class="u-name">${escapeHtml(u.name)}</div>
            <div class="u-desc">${escapeHtml(u.desc)}</div>
          </div>
          <button class="upgrade-buy ${owned ? 'owned' : ''}" data-buy="${u.id}" ${owned || !affordable ? 'disabled' : ''}>
            ${owned ? 'Instalado' : '◈ ' + u.cost}
          </button>
        </div>`;
    }).join('');

    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">Mejoras del Spa</div>
      <div class="modal-sub">Inversiones permanentes para atraer más clientes y aumentar tus ingresos.</div>
      ${rows}
      <button class="btn-secondary" id="btn-close-modal">Cerrar</button>
    `);
    V.$$('[data-buy]').forEach(btn => {
      btn.addEventListener('click', () => { Upgrades.buy(btn.dataset.buy); renderUpgrades(); });
    });
    V.$('#btn-close-modal').addEventListener('click', Modal.close);
  }

  function renderStats() {
    const s = State.get();
    const total = s.perfectMatches + s.wrongMatches;
    const accuracy = total > 0 ? Math.round((s.perfectMatches / total) * 100) : 0;
    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">Tu progreso</div>
      <div class="modal-sub">El recorrido de Valtara hasta ahora.</div>
      <div class="stat-row"><span class="label">☾ Día actual</span><span class="value">${s.day}</span></div>
      <div class="stat-row"><span class="label">◈ Monedas</span><span class="value">${s.coins}</span></div>
      <div class="stat-row"><span class="label">✦ Reputación</span><span class="value">${s.reputation}</span></div>
      <div class="stat-row"><span class="label">🧑‍🤝‍🧑 Clientes atendidos</span><span class="value">${s.clientsServed}</span></div>
      <div class="stat-row"><span class="label">🎯 Precisión de diagnóstico</span><span class="value pos">${accuracy}%</span></div>
      <div class="stat-row"><span class="label">🔥 Mejor racha</span><span class="value">${s.bestStreak}</span></div>
      <div class="stat-row"><span class="label">👥 Personal contratado</span><span class="value">${s.staff.length} / ${STAFF_ROSTER.length}</span></div>
      <div class="stat-row"><span class="label">✨ Mejoras instaladas</span><span class="value">${s.upgrades.length} / ${UPGRADES.length}</span></div>
      <button class="btn-secondary" id="btn-reset" style="color:var(--clay-br); border-color:var(--clay);">Reiniciar partida</button>
      <button class="btn-secondary" id="btn-close-modal">Cerrar</button>
    `);
    V.$('#btn-close-modal').addEventListener('click', Modal.close);
    V.$('#btn-reset').addEventListener('click', () => {
      Modal.open(`
        <div class="modal-handle"></div>
        <div class="modal-title">¿Reiniciar todo?</div>
        <div class="modal-sub">Perderás monedas, reputación, personal y mejoras. Esta acción no se puede deshacer.</div>
        <button class="btn-primary" id="btn-confirm-reset" style="background:linear-gradient(155deg, var(--clay-br), var(--clay)); color:#fff;">Sí, reiniciar</button>
        <button class="btn-secondary" id="btn-cancel-reset">Cancelar</button>
      `);
      V.$('#btn-confirm-reset').addEventListener('click', () => {
        State.reset();
        Modal.close();
        location.reload();
      });
      V.$('#btn-cancel-reset').addEventListener('click', renderStats);
    });
  }

  return { renderStaff, renderUpgrades, renderStats };
})();
V.Views = Views;

/* ================================================================
   9. NAVEGACIÓN Y ARRANQUE
   ================================================================ */
function wireNav() {
  const buttons = {
    reception: V.$('#nav-reception'),
    staff: V.$('#nav-staff'),
    upgrades: V.$('#nav-upgrades'),
    stats: V.$('#nav-stats')
  };

  function setActive(view) {
    Object.keys(buttons).forEach(k => buttons[k].classList.toggle('active', k === view));
  }

  buttons.reception.addEventListener('click', () => { setActive('reception'); Modal.close(); });
  buttons.staff.addEventListener('click', () => { setActive('reception'); Views.renderStaff(); });
  buttons.upgrades.addEventListener('click', () => { setActive('reception'); Views.renderUpgrades(); });
  buttons.stats.addEventListener('click', () => { setActive('reception'); Views.renderStats(); });

  V.$('#modal-backdrop').addEventListener('click', Modal.close);
}

function boot() {
  State.load();
  spawnMotes();
  HUD.refresh();
  wireNav();

  const loading = V.$('#loading-screen');
  setTimeout(() => {
    if (loading) loading.classList.add('hidden');
    showDialogue('Valtara', 'Bienvenido de nuevo. Tu spa te espera.', 'Sistema');
    Reception.init();
  }, 1500);

  // Autoguardado periódico por seguridad
  setInterval(() => State.save(), 15000);

  // Guardar al salir / perder foco
  document.addEventListener('visibilitychange', () => { if (document.hidden) State.save(); });
  window.addEventListener('pagehide', () => State.save());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
