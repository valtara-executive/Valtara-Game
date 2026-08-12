/* ================================================================
   VALTARA · El Arte del Bienestar
   Motor de juego — archivo único, sin dependencias externas.
   ----------------------------------------------------------------
   Índice:
     1. Namespace, utilidades y estado persistente
     2. Audio — Web Audio API (música + SFX generados)
     3. Datos: servicios y perfiles de clientes
     4. Motor visual: personajes, escena, mobiliario, partículas
     5. Diálogo y notificaciones
     6. Bucle de juego: recepción, evaluación, recompensas
     7. Economía y personal (staff)
     8. Mejoras (upgrades) y progresión
     9. Trivia y eventos aleatorios
     10. Logros
     11. Vistas: recepción / personal / mejoras / progreso
     12. Pantallas: menú / ajustes / créditos / juego / pausa
     13. Arranque
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
V.prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  staff: [],            // ids de personal contratado
  upgrades: [],          // ids de mejoras compradas
  achievements: [],       // ids de logros desbloqueados
  triviaCorrect: 0,
  triviaAnswered: 0,
  hasSavedGame: false,
  seenTutorial: false,
  settings: {
    musicVolume: 0.55,
    sfxVolume: 0.8,
    muted: false,
    dialogueSkip: false,
    contrastMode: false,
    language: 'es'
  },
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
        s.settings = Object.assign({}, DEFAULT_STATE.settings, parsed.settings || {});
        if (!Array.isArray(s.staff)) s.staff = [];
        if (!Array.isArray(s.upgrades)) s.upgrades = [];
        if (!Array.isArray(s.achievements)) s.achievements = [];
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

  function setSettings(patch) {
    Object.assign(s.settings, patch);
    save();
  }

  function reset() {
    s = JSON.parse(JSON.stringify(DEFAULT_STATE));
    save();
  }

  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); }
    catch (e) { return false; }
  }

  return { load, save, get, set, setSettings, reset, hasSave };
})();

V.State = State;

/* ================================================================
   2. AUDIO — Web Audio API, todo generado por código
   ================================================================ */
const Audio = (function () {
  let ctx = null;
  let started = false;
  let musicGain = null, sfxGain = null, masterGain = null;
  let musicTimer = null;
  let ambientTimer = null;

  // Escala pentatónica lofi (A menor pentatónica), para el pad generativo
  const SCALE = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = State.get().settings.musicVolume;
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = State.get().settings.sfxVolume;
    sfxGain.connect(masterGain);

    applyMuteState();
    return ctx;
  }

  function applyMuteState() {
    if (!masterGain) return;
    masterGain.gain.value = State.get().settings.muted ? 0 : 1;
  }

  function start() {
    if (started) return;
    const c = ensureContext();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    started = true;
    scheduleAmbientPad();
    scheduleWindWhisper();
  }

  /* ---- Música ambiental generativa: pads suaves en escala pentatónica ---- */
  function playPadNote(freq, duration, delay) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 1.005; // leve detune para calidez
    const g = ctx.createGain();
    g.gain.value = 0;
    osc1.connect(g); osc2.connect(g);
    g.connect(musicGain);

    const peak = 0.05;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + duration * 0.35);
    g.gain.linearRampToValueAtTime(0, t0 + duration);

    osc1.start(t0); osc2.start(t0);
    osc1.stop(t0 + duration + 0.1);
    osc2.stop(t0 + duration + 0.1);
  }

  function scheduleAmbientPad() {
    if (!ctx) return;
    const note = V.rand(SCALE) / 2; // octava baja para pad de fondo
    const duration = V.randInt(4, 7);
    playPadNote(note, duration, 0);
    // Nota ocasional una octava arriba, tipo campanita lejana
    if (Math.random() < 0.4) {
      playPadNote(V.rand(SCALE), duration * 0.6, 0.8);
    }
    const nextIn = V.randInt(3000, 5500);
    musicTimer = setTimeout(scheduleAmbientPad, nextIn);
  }

  /* ---- Ruido de viento/agua muy sutil de fondo ---- */
  let windSource = null;
  function scheduleWindWhisper() {
    if (!ctx || windSource) return;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.6;

    const g = ctx.createGain();
    g.gain.value = 0.012;

    noise.connect(filter);
    filter.connect(g);
    g.connect(musicGain);
    noise.start();
    windSource = noise;
  }

  /* ---- SFX puntuales ---- */
  function sfxTone(freq, type, duration, gainPeak, delay) {
    const c = ensureContext();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainPeak, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function sfxBell() {
    // Campanita: dos armónicos suaves
    sfxTone(880, 'sine', 0.5, 0.12, 0);
    sfxTone(1318.5, 'sine', 0.45, 0.06, 0.03);
  }

  function sfxCoins() {
    // Tintineo: varias notas agudas rápidas y escalonadas
    const notes = [1046.5, 1318.5, 1568, 2093];
    notes.forEach((f, i) => sfxTone(f, 'triangle', 0.28, 0.09, i * 0.045));
  }

  function sfxFail() {
    // Tono neutro descendente, no punitivo
    sfxTone(392, 'sine', 0.35, 0.08, 0);
    sfxTone(311, 'sine', 0.4, 0.06, 0.09);
  }

  function sfxClick() {
    sfxTone(1200, 'square', 0.045, 0.02, 0);
  }

  function sfxAchievement() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => sfxTone(f, 'triangle', 0.35, 0.08, i * 0.08));
  }

  function setMusicVolume(v) {
    State.setSettings({ musicVolume: v });
    if (musicGain) musicGain.gain.value = v;
  }
  function setSfxVolume(v) {
    State.setSettings({ sfxVolume: v });
    if (sfxGain) sfxGain.gain.value = v;
    sfxClick();
  }
  function setMuted(m) {
    State.setSettings({ muted: m });
    applyMuteState();
  }

  return {
    start, sfxBell, sfxCoins, sfxFail, sfxClick, sfxAchievement,
    setMusicVolume, setSfxVolume, setMuted
  };
})();
V.Audio = Audio;

/* ================================================================
   3. DATOS — SERVICIOS
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
   3b. DATOS — PERFILES DE CLIENTES (50 perfiles narrativos)
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

/* Ambigüedad progresiva: pares de servicios que se confunden fácilmente,
   usados a partir del día 4 para presentar 2 opciones plausibles. */
const SERVICE_CONFUSABLES = {
  'Relajante Neuro Adaptativo': 'Esferas Chinas & Velas Aromáticas',
  'Masaje Deportivo & Descompresión': 'Reductivo & Maderoterapia',
  'Ayurveda & Aromaterapia': 'Ritual Lomi Lomi Supremo',
  'Esferas Chinas & Velas Aromáticas': 'Relajante Neuro Adaptativo',
  'Reductivo & Maderoterapia': 'Masaje Deportivo & Descompresión',
  'Terapia para Parálisis Facial': 'Shiatsu en Cama · Complemento',
  'Shiatsu en Cama · Complemento': 'Terapia para Parálisis Facial',
  'Ritual Lomi Lomi Supremo': 'Ayurveda & Aromaterapia'
};
V.SERVICE_CONFUSABLES = SERVICE_CONFUSABLES;

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
   4. MOTOR VISUAL — PERSONAJES, ESCENA, MOBILIARIO, PARTÍCULAS
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

    for (const id in registry) {
      const a = registry[id];
      if (a.state === 'walking') {
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
    // Variación sutil de "vestimenta" (borde de color) según mood del cliente
    if (cfg.moodColor) avatar.style.borderColor = cfg.moodColor;

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
function spawnMotes(hostSel) {
  const host = V.$(hostSel || '#motes');
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
V.spawnMotes = spawnMotes;

/* ---- Mobiliario ambiental de la escena (velas, lámparas, plantas, etc.) ---- */
function spawnDecor() {
  const host = V.$('#decor-layer');
  if (!host) return;
  host.innerHTML = '';

  const pieces = [
    { cls: 'decor-lamp', style: 'left:12%;', html: '<div class="lamp-cord"></div><div class="lamp-shade"><div class="lamp-glow"></div></div>' },
    { cls: 'decor-lamp', style: 'right:12%;', html: '<div class="lamp-cord"></div><div class="lamp-shade"><div class="lamp-glow"></div></div>' },
    { cls: 'decor-candle', style: 'left:6%;', html: '<div class="c-stick short"><div class="c-flame"></div></div><div class="c-stick tall"><div class="c-flame"></div></div><div class="c-stick mid"><div class="c-flame"></div></div>' },
    { cls: 'decor-candle', style: 'right:6%;', html: '<div class="c-stick mid"><div class="c-flame"></div></div><div class="c-stick tall"><div class="c-flame"></div></div><div class="c-stick short"><div class="c-flame"></div></div>' },
    { cls: 'decor-plant', style: 'left:2%; bottom:30%;', html: '<div class="p-leaves"></div><div class="p-pot"></div>' },
    { cls: 'decor-plant', style: 'right:3%; bottom:31%;', html: '<div class="p-leaves"></div><div class="p-pot"></div>' },
    { cls: 'decor-shelf', style: 'left:8%;', html: '<div class="sh-board"></div><div class="sh-items"><div class="sh-item"></div><div class="sh-item"></div><div class="sh-item"></div></div>' },
    { cls: 'decor-shelf', style: 'right:8%;', html: '<div class="sh-board"></div><div class="sh-items"><div class="sh-item"></div><div class="sh-item"></div><div class="sh-item"></div></div>' },
    { cls: 'decor-curtain', style: 'left:0;', html: '<div class="cur-fold"></div>' },
    { cls: 'decor-curtain', style: 'right:0;', html: '<div class="cur-fold"></div>' }
  ];

  pieces.forEach(p => {
    const el = document.createElement('div');
    el.className = 'decor-piece ' + p.cls;
    el.style.cssText = p.style;
    el.innerHTML = p.html;
    host.appendChild(el);
  });
}
V.spawnDecor = spawnDecor;

/* ---- Partículas de celebración: confeti + pétalos + monedas voladoras ---- */
const Particles = (function () {
  function burstConfetti(originXPercent, originYPercent) {
    if (V.prefersReducedMotion()) return;
    const host = V.$('#particle-layer');
    if (!host) return;
    const colors = ['#e3c896', '#c9a876', '#d17e68', '#9cbaa8', '#f3ead9'];
    const count = 22;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      const angle = Math.random() * Math.PI * 2;
      const dist = V.randInt(60, 160);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 40;
      p.style.setProperty('--confetti-end', `translate(${dx}px, ${dy}px)`);
      p.style.setProperty('--confetti-rot', (V.randInt(-360, 360)) + 'deg');
      p.style.left = (originXPercent != null ? originXPercent : 50) + '%';
      p.style.top = (originYPercent != null ? originYPercent : 45) + '%';
      p.style.background = V.rand(colors);
      p.style.animationDelay = (Math.random() * 0.15) + 's';
      host.appendChild(p);
      setTimeout(() => p.remove(), 1800);
    }
  }

  function floatCoins(coinGain, targetEl) {
    const host = V.$('#particle-layer');
    const target = targetEl || V.$('#pill-coins');
    if (!host || !target) return;
    const targetRect = target.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2 - hostRect.left;
    const endY = targetRect.top + targetRect.height / 2 - hostRect.top;

    const count = Math.min(6, Math.max(2, Math.round(coinGain / 40)));
    for (let i = 0; i < count; i++) {
      const c = document.createElement('div');
      c.className = 'coin-float';
      c.textContent = '◈';
      const startX = 50 + V.randInt(-8, 8);
      const startY = 46 + V.randInt(-4, 4);
      c.style.left = startX + '%';
      c.style.top = startY + '%';
      const startPxX = (startX / 100) * hostRect.width;
      const startPxY = (startY / 100) * hostRect.height;
      c.style.setProperty('--coin-end', `translate(${endX - startPxX}px, ${endY - startPxY}px)`);
      c.style.animationDelay = (i * 0.07) + 's';
      host.appendChild(c);
      setTimeout(() => c.remove(), 1200 + i * 70);
    }

    // Bump animation on the coin pill
    target.closest('.pill') && target.closest('.pill').classList.remove('bump');
    void (target.closest('.pill') && target.closest('.pill').offsetWidth);
    setTimeout(() => { target.closest('.pill') && target.closest('.pill').classList.add('bump'); }, count * 70 + 850);
  }

  function petalRain() {
    if (V.prefersReducedMotion()) return;
    const host = V.$('#particle-layer');
    if (!host) return;
    const count = 10;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'petal';
      p.style.left = V.randInt(5, 95) + '%';
      p.style.setProperty('--petal-drift', (V.randInt(-60, 60)) + 'px');
      p.style.animationDuration = V.randInt(2200, 3600) + 'ms';
      p.style.animationDelay = (Math.random() * 0.6) + 's';
      host.appendChild(p);
      setTimeout(() => p.remove(), 4400);
    }
  }

  /* Contador de monedas animado: cuenta del valor viejo al nuevo con easing */
  function animateCounter(el, from, to, duration) {
    if (!el) return;
    if (V.prefersReducedMotion()) { el.textContent = to.toLocaleString('es-MX'); return; }
    const start = performance.now();
    const dur = duration || 650;
    function tick(now) {
      const t = V.clamp((now - start) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(from + (to - from) * eased);
      el.textContent = val.toLocaleString('es-MX');
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  return { burstConfetti, floatCoins, petalRain, animateCounter };
})();
V.Particles = Particles;

/* ================================================================
   5. DIÁLOGO Y NOTIFICACIONES
   ================================================================ */
let dialogueSkipTimer = null;

function showDialogue(speaker, message, meta, opts) {
  const host = V.$('#dialogue-layer');
  if (!host) return;
  clearTimeout(dialogueSkipTimer);
  const skippable = opts && opts.skippable;
  host.innerHTML = `
    <div class="dlg-card" id="dlg-card">
      <span class="dlg-speaker">
        <span>${escapeHtml(speaker)}</span>
        ${skippable ? '<button class="dlg-skip" id="dlg-skip-btn" aria-label="Saltar diálogo">Saltar ▸</button>' : ''}
      </span>
      ${meta ? `<span class="dlg-meta">${escapeHtml(meta)}</span>` : ''}
      <span class="dlg-message">${escapeHtml(message)}</span>
    </div>`;
  requestAnimationFrame(() => {
    const card = V.$('#dlg-card');
    if (card) card.classList.add('show');
  });
  const skipBtn = V.$('#dlg-skip-btn');
  if (skipBtn && opts && opts.onSkip) {
    skipBtn.addEventListener('click', () => { Audio.sfxClick(); opts.onSkip(); });
  }
  announce(speaker + ': ' + message);

  // Modo "saltar diálogo" activado en ajustes: auto-avanza tras un instante
  if (opts && opts.onSkip && State.get().settings.dialogueSkip) {
    dialogueSkipTimer = setTimeout(() => opts.onSkip(), 550);
  }
}
function clearDialogue() {
  clearTimeout(dialogueSkipTimer);
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
function toast(msg, icon, kind) {
  const host = V.$('#notification-layer');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind === 'achievement' ? ' achievement' : '');
  el.innerHTML = `<span>${icon || '✦'}</span><span>${escapeHtml(msg)}</span>`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}
V.showDialogue = showDialogue;
V.clearDialogue = clearDialogue;
V.announce = announce;
V.toast = toast;

/* ================================================================
   6. BUCLE DE JUEGO — RECEPCIÓN
   ================================================================ */
const MOOD_COLORS = {
  'Estresado':'#d17e68','Ansiosa':'#d1a8c4','Agotado':'#a8b7d1','Fatigada':'#c4c088',
  'Hiperalerta':'#d17e68','Abrumada':'#d1a8c4','Tenso':'#d17e68','Dolorido':'#d17e68',
  'Exigida':'#9cbaa8','Sobrecargado':'#c4c088','Saturada':'#a8b7d1','Disperso':'#d1a8c4'
};

const Reception = (function () {
  const RECEPTIONIST_ID = 'staff-receptionist';
  const DESK_X = 50, DESK_Y = 62;
  let currentProfile = null;
  let currentCustomerId = null;
  let interactionOpen = false;
  let turnsSinceLastTrivia = 0;
  let activeEvent = null; // { type, multiplier, label } — evento del cliente actual

  function spawnReceptionist() {
    Actors.create({ id: RECEPTIONIST_ID, name: 'Valeria', role: 'staff', x: DESK_X, y: DESK_Y - 6 });
    Actors.setState(RECEPTIONIST_ID, 'idle');
  }

  function maybeTriggerTrivia() {
    turnsSinceLastTrivia++;
    // Cada 4-6 clientes, con algo de azar, se intercala una trivia
    if (turnsSinceLastTrivia >= V.randInt(4, 6)) {
      turnsSinceLastTrivia = 0;
      return true;
    }
    return false;
  }

  function rollDayEvent() {
    const s = State.get();
    if (s.day < 2) return null;
    const roll = Math.random();
    if (roll < 0.12) return { type: 'vip', label: 'Cliente VIP · paga doble si aciertas', multiplier: 2 };
    if (roll < 0.20) return { type: 'difficult', label: 'Cliente difícil · resta reputación si fallas', multiplier: 1 };
    return null;
  }

  async function bringNextCustomer() {
    interactionOpen = false;
    closeServiceSheet();
    clearDialogue();

    // Intercalar trivia antes de traer al siguiente cliente
    if (maybeTriggerTrivia()) {
      Trivia.open(() => bringNextCustomer());
      return;
    }

    const profile = V.randomProfile();
    currentProfile = profile;
    const custId = 'customer-' + profile.id + '-' + Date.now();
    currentCustomerId = custId;
    activeEvent = rollDayEvent();

    const entrySide = Math.random() < 0.5 ? 6 : 94;
    Actors.create({ id: custId, name: profile.name, role: 'customer', x: entrySide, y: DESK_Y, moodColor: MOOD_COLORS[profile.mood] });
    Actors.moveTo(custId, DESK_X, DESK_Y, 'idle');

    await Actors.waitForArrival(custId);
    Actors.setState(custId, 'talking');
    Actors.setState(RECEPTIONIST_ID, 'talking');

    Audio.sfxBell();
    const meta = activeEvent
      ? `${profile.job} · ${profile.age} años · ${activeEvent.label}`
      : `${profile.job} · ${profile.age} años`;
    showDialogue(profile.name, profile.line, meta, { skippable: true, onSkip: () => { clearDialogue(); openServiceSheet(profile); } });
    openServiceSheet(profile);
  }

  function difficultyAmbiguous() {
    // A partir del día 4, ~35% de los clientes presentan un distractor plausible
    return State.get().day >= 4 && Math.random() < 0.35;
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
    let shuffled = [...SERVICES].sort(() => Math.random() - 0.5);

    // Dificultad progresiva: asegura que el distractor confusable esté visible y cerca
    if (difficultyAmbiguous()) {
      const confusable = SERVICE_CONFUSABLES[profile.service];
      if (confusable) {
        shuffled = shuffled.filter(s => s.name !== confusable);
        shuffled.splice(1, 0, SERVICES.find(s => s.name === confusable));
      }
    }

    shuffled.forEach(svc => {
      const btn = document.createElement('button');
      btn.className = 'service-card';
      btn.setAttribute('aria-label', 'Asignar tratamiento: ' + svc.name);
      btn.innerHTML = `
        <span class="sc-name">${svc.icon} ${escapeHtml(svc.name)}</span>
        <span class="sc-meta"><span>${escapeHtml(svc.duration)}</span><span class="sc-reward">◈ ${svc.reward}</span></span>`;
      btn.addEventListener('click', () => { Audio.sfxClick(); handleChoice(svc); });
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
    const eventMult = (activeEvent && activeEvent.type === 'vip' && correct) ? activeEvent.multiplier : 1;

    if (correct) {
      const coinGain = Math.round(service.reward * bonusMult * eventMult);
      const repGain = service.reputation;
      const prevCoins = State.get().coins;
      V.State.set({
        coins: prevCoins + coinGain,
        reputation: State.get().reputation + repGain,
        clientsServed: State.get().clientsServed + 1,
        perfectMatches: State.get().perfectMatches + 1,
        clientsToday: State.get().clientsToday + 1,
        streak: State.get().streak + 1,
        bestStreak: Math.max(State.get().bestStreak, State.get().streak + 1)
      });
      Audio.sfxCoins();
      flashFeedback(true, coinGain, repGain, eventMult > 1);
      Particles.burstConfetti(50, 45);
      Particles.petalRain();
      Particles.floatCoins(coinGain);
      Particles.animateCounter(V.$('#stat-coins'), prevCoins, State.get().coins);
      const msg = eventMult > 1
        ? `${currentProfile.name} queda encantado. ¡Pago VIP doble!`
        : `${currentProfile.name} sale renovado. Diagnóstico perfecto.`;
      showDialogue('Valtara', msg, 'Sesión completada');
      if (currentCustomerId) Actors.setState(currentCustomerId, 'talking');
    } else {
      const consolationCoins = Math.round(18 * bonusMult);
      const repPenalty = (activeEvent && activeEvent.type === 'difficult') ? 8 : 0;
      const prevCoins = State.get().coins;
      V.State.set({
        coins: prevCoins + consolationCoins,
        reputation: Math.max(0, State.get().reputation - repPenalty),
        clientsServed: State.get().clientsServed + 1,
        wrongMatches: State.get().wrongMatches + 1,
        clientsToday: State.get().clientsToday + 1,
        streak: 0
      });
      Audio.sfxFail();
      flashFeedback(false, consolationCoins, -repPenalty);
      Particles.animateCounter(V.$('#stat-coins'), prevCoins, State.get().coins);
      const msg = repPenalty > 0
        ? `${currentProfile.name} se va decepcionado. Perdiste algo de reputación.`
        : `${currentProfile.name} agradece el esfuerzo, aunque no era lo que buscaba.`;
      showDialogue('Valtara', msg, 'Diagnóstico incorrecto');
    }

    V.HUD.refresh();
    Achievements.checkAll();

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
    activeEvent = null;
  }

  function flashFeedback(good, coins, rep, isVip) {
    const host = V.$('#feedback-flash');
    const repText = rep > 0 ? ' · +' + rep + ' reputación' : (rep < 0 ? ' · ' + rep + ' reputación' : '');
    host.innerHTML = `
      <div class="feedback-badge ${good ? 'good' : 'bad'}">
        ${good ? (isVip ? '✦ ¡Pago VIP!' : '✓ Diagnóstico perfecto') : '✕ No era el indicado'}
        <small>+${coins} ◈ monedas${repText}</small>
      </div>`;
    host.classList.remove('show');
    void host.offsetWidth; // reflow to restart animation
    host.classList.add('show');
  }

  function init() {
    spawnReceptionist();
    setTimeout(bringNextCustomer, 700);
  }

  function pause() {
    interactionOpen = false;
    closeServiceSheet();
  }

  /* Limpia toda la escena (recepcionista + cliente actual) para permitir
     un arranque limpio, por ejemplo tras "Jugar" desde el menú o tras un
     reinicio total de partida. */
  function hardReset() {
    interactionOpen = false;
    closeServiceSheet();
    clearDialogue();
    if (currentCustomerId) Actors.remove(currentCustomerId);
    Actors.remove(RECEPTIONIST_ID);
    currentCustomerId = null;
    currentProfile = null;
    activeEvent = null;
    turnsSinceLastTrivia = 0;
  }

  return {
    init, bringNextCustomer, pause, hardReset,
    get currentProfile() { return currentProfile; },
    get interactionOpen() { return interactionOpen; }
  };
})();
V.Reception = Reception;

/* ================================================================
   7. PERSONAL (STAFF)
   ================================================================ */
const STAFF_ROSTER = [
  { id:'sf-01', name:'Renata Ibáñez', role:'Terapeuta Junior', icon:'🧑‍⚕️', cost:180, bonus:0.06,
    desc:'Aumenta un 6% las ganancias por sesión.' },
  { id:'sf-02', name:'Ismael Coto', role:'Terapeuta Senior', icon:'🧑‍⚕️', cost:420, bonus:0.12,
    desc:'Aumenta un 12% las ganancias por sesión.' },
  { id:'sf-03', name:'Dulce Marín', role:'Coordinadora de Bienestar', icon:'🌸', cost:780, bonus:0.20,
    desc:'Aumenta un 20% las ganancias y mejora la reputación general.' },
  { id:'sf-04', name:'Óscar Beltrán', role:'Especialista Clínico', icon:'🩺', cost:1300, bonus:0.30,
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
    Audio.sfxCoins();
    toast(`${member.name} se unió al equipo.`, member.icon);
    V.HUD.refresh();
    Achievements.checkAll();
    return true;
  }

  return { owned, isOwned, getServiceBonus, hire };
})();
V.Staff = Staff;

/* ================================================================
   8. MEJORAS (UPGRADES)
   ================================================================ */
const UPGRADES = [
  { id:'up-01', name:'Difusores de Aromaterapia', icon:'🪔', cost:130,
    desc:'Los clientes llegan de mejor ánimo. +2 clientes por día.', apply:(s)=>({ clientsPerDay: s.clientsPerDay + 2 }) },
  { id:'up-02', name:'Mobiliario de Recepción', icon:'🪑', cost:280,
    desc:'Una recepción más cómoda mejora cada pago en un 10%.', apply:null, bonus:0.10 },
  { id:'up-03', name:'Iluminación Ambiental', icon:'🕯️', cost:520,
    desc:'Atmósfera premium: +3 clientes por día.', apply:(s)=>({ clientsPerDay: s.clientsPerDay + 3 }) },
  { id:'up-04', name:'Sala de Espera VIP', icon:'✦', cost:950,
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
    Audio.sfxCoins();
    toast(`${up.name} instalado.`, up.icon);
    V.HUD.refresh();
    Achievements.checkAll();
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
   9. TRIVIA Y EVENTOS
   ================================================================ */
const TRIVIA_BANK = [
  { q: '¿Qué aceite esencial es más conocido por ayudar a conciliar el sueño?', options: ['Lavanda', 'Menta', 'Cítrico', 'Eucalipto'], correct: 0 },
  { q: '¿Qué técnica de masaje utiliza piedras o esferas calientes?', options: ['Shiatsu', 'Terapia con esferas chinas', 'Drenaje linfático', 'Reflexología'], correct: 1 },
  { q: '¿Qué sistema del cuerpo ayuda a activar el drenaje linfático?', options: ['Circulatorio', 'Digestivo', 'Linfático', 'Respiratorio'], correct: 2 },
  { q: '¿De qué país es originario el masaje Lomi Lomi?', options: ['Tailandia', 'Hawái', 'Japón', 'India'], correct: 1 },
  { q: '¿Qué disciplina milenaria da origen a la aromaterapia con hierbas y aceites?', options: ['Ayurveda', 'Feng Shui', 'Reiki', 'Acupuntura'], correct: 0 },
  { q: '¿Qué presión muscular ayuda a liberar el ácido láctico tras el ejercicio?', options: ['Presión superficial', 'Presión clínica profunda', 'Vibración', 'Ninguna'], correct: 1 },
  { q: '¿Qué significa "shiatsu" en japonés?', options: ['Agua caliente', 'Presión de dedos', 'Movimiento lento', 'Aceite tibio'], correct: 1 },
  { q: '¿Qué mineral se asocia comúnmente con la relajación muscular?', options: ['Hierro', 'Magnesio', 'Calcio', 'Zinc'], correct: 1 },
  { q: '¿Qué parte del día se recomienda para tratamientos de estimulación energética?', options: ['Mañana', 'Media noche', 'Nunca', 'Solo festivos'], correct: 0 },
  { q: '¿Qué madera se usa tradicionalmente en la maderoterapia?', options: ['Bambú o haya', 'Cristal', 'Metal', 'Piedra volcánica'], correct: 0 },
  { q: '¿Qué beneficio principal ofrece la maderoterapia?', options: ['Aumentar masa muscular', 'Modelar y reducir medidas', 'Broncear la piel', 'Fortalecer huesos'], correct: 1 },
  { q: '¿Qué color de vela se asocia comúnmente con calma en aromaterapia?', options: ['Rojo intenso', 'Lavanda o crema', 'Negro', 'Neón'], correct: 1 }
];
V.TRIVIA_BANK = TRIVIA_BANK;

const Trivia = (function () {
  function open(onDone) {
    const item = V.rand(TRIVIA_BANK);
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    let answered = false;

    const optsHtml = order.map(i => `<button class="trivia-opt" data-idx="${i}">${escapeHtml(item.options[i])}</button>`).join('');

    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">✦ Momento trivia</div>
      <div class="modal-sub">Bonus de monedas y reputación si aciertas. Sin penalización si fallas.</div>
      <div class="trivia-q">${escapeHtml(item.q)}</div>
      <div id="trivia-opts">${optsHtml}</div>
    `);

    V.$$('#trivia-opts .trivia-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const idx = parseInt(btn.dataset.idx, 10);
        const isCorrect = idx === item.correct;
        Audio.sfxClick();

        V.$$('#trivia-opts .trivia-opt').forEach(b => {
          const bi = parseInt(b.dataset.idx, 10);
          if (bi === item.correct) b.classList.add('correct');
          else if (b === btn) b.classList.add('wrong');
        });

        const s = State.get();
        const patch = { triviaAnswered: s.triviaAnswered + 1 };
        if (isCorrect) {
          patch.triviaCorrect = s.triviaCorrect + 1;
          patch.coins = s.coins + 40;
          patch.reputation = s.reputation + 6;
          Audio.sfxCoins();
          toast('¡Correcto! +40 ◈ y +6 reputación.', '✦');
        } else {
          Audio.sfxFail();
          toast('No era esa, ¡para la próxima!', '✦');
        }
        State.set(patch);
        V.HUD.refresh();
        Achievements.checkAll();

        setTimeout(() => {
          Modal.close();
          if (onDone) onDone();
        }, 1400);
      });
    });
  }
  return { open };
})();
V.Trivia = Trivia;

/* ================================================================
   10. LOGROS
   ================================================================ */
const ACHIEVEMENTS = [
  { id:'ach-01', name:'Primeros pasos', icon:'🌱', desc:'Atiende a 10 clientes.', check:(s)=> s.clientsServed >= 10 },
  { id:'ach-02', name:'Spa de confianza', icon:'🧑‍🤝‍🧑', desc:'Atiende a 50 clientes.', check:(s)=> s.clientsServed >= 50 },
  { id:'ach-03', name:'Equipo completo', icon:'👥', desc:'Contrata a todo el personal.', check:(s)=> s.staff.length >= STAFF_ROSTER.length },
  { id:'ach-04', name:'En racha', icon:'🔥', desc:'Alcanza una racha de 10 diagnósticos perfectos.', check:(s)=> s.bestStreak >= 10 },
  { id:'ach-05', name:'Spa boutique', icon:'✦', desc:'Instala todas las mejoras.', check:(s)=> s.upgrades.length >= UPGRADES.length },
  { id:'ach-06', name:'Mente de bienestar', icon:'🧠', desc:'Responde correctamente 5 trivias.', check:(s)=> s.triviaCorrect >= 5 },
  { id:'ach-07', name:'Una semana de Valtara', icon:'☾', desc:'Llega al día 7.', check:(s)=> s.day >= 7 }
];
V.ACHIEVEMENTS = ACHIEVEMENTS;

const Achievements = (function () {
  function checkAll() {
    const s = State.get();
    let unlocked = [];
    ACHIEVEMENTS.forEach(a => {
      if (!s.achievements.includes(a.id) && a.check(s)) {
        unlocked.push(a);
      }
    });
    if (unlocked.length) {
      State.set({ achievements: [...s.achievements, ...unlocked.map(a => a.id)] });
      unlocked.forEach((a, i) => {
        setTimeout(() => {
          Audio.sfxAchievement();
          toast(`Logro desbloqueado: ${a.name}`, a.icon, 'achievement');
        }, i * 600);
      });
    }
  }
  return { checkAll };
})();
V.Achievements = Achievements;

/* ================================================================
   11. CICLO DE DÍA
   ================================================================ */
const DayCycle = (function () {
  function endDay() {
    Reception.pause();
    showDaySummary();
  }

  function renderDayMap(currentDay) {
    const totalNodes = 10;
    const startDay = Math.max(1, currentDay - 4);
    let html = '<div class="day-map">';
    for (let d = startDay; d < startDay + totalNodes; d++) {
      const state = d < currentDay ? 'done' : (d === currentDay ? 'current' : '');
      html += `<div class="day-node-wrap">
        <div class="day-node ${state}">${d}</div>
        ${d < startDay + totalNodes - 1 ? `<div class="day-connector ${d < currentDay ? 'done' : ''}"></div>` : ''}
      </div>`;
    }
    html += '</div>';
    return html;
  }

  function showDaySummary() {
    const s = State.get();
    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">Fin del día ${s.day}</div>
      <div class="modal-sub">Valtara cierra sus puertas por hoy. Esto es lo que lograste en esta jornada.</div>
      ${renderDayMap(s.day)}
      <div class="stat-row"><span class="label">🧑‍🤝‍🧑 Clientes atendidos</span><span class="value">${s.clientsToday}</span></div>
      <div class="stat-row"><span class="label">✓ Diagnósticos perfectos</span><span class="value pos">${s.perfectMatches}</span></div>
      <div class="stat-row"><span class="label">✕ Diagnósticos errados</span><span class="value neg">${s.wrongMatches}</span></div>
      <div class="stat-row"><span class="label">◈ Monedas totales</span><span class="value">${s.coins}</span></div>
      <div class="stat-row"><span class="label">☾ Reputación</span><span class="value">${s.reputation}</span></div>
      <button class="btn-primary" id="btn-next-day">Comenzar día ${s.day + 1}</button>
    `);
    V.$('#btn-next-day').addEventListener('click', () => {
      Audio.sfxClick();
      State.set({ day: s.day + 1, clientsToday: 0 });
      Modal.close();
      V.HUD.refresh();
      Reception.bringNextCustomer();
    });
  }

  return { endDay, renderDayMap };
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
  let lastCoins = null;

  function refresh() {
    const s = State.get();
    V.$('#stat-day').textContent = 'Día ' + s.day;

    const coinsEl = V.$('#stat-coins');
    if (lastCoins === null) {
      coinsEl.textContent = s.coins.toLocaleString('es-MX');
    } else if (lastCoins !== s.coins) {
      Particles.animateCounter(coinsEl, lastCoins, s.coins);
    }
    lastCoins = s.coins;

    const streakPill = V.$('#pill-streak');
    if (s.streak > 0) {
      streakPill.classList.remove('hidden');
      V.$('#stat-streak').textContent = s.streak;
    } else {
      streakPill.classList.add('hidden');
    }

    const repForFill = V.clamp(s.reputation % 500, 0, 500) / 500 * 100;
    V.$('#wellness-fill').style.width = repForFill + '%';
    V.$('#wellness-value').textContent = s.reputation;
  }
  return { refresh };
})();
V.HUD = HUD;

/* ================================================================
   12. VISTAS — Personal / Mejoras / Progreso
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
    V.$('#btn-close-modal').addEventListener('click', () => { Audio.sfxClick(); Modal.close(); });
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
    V.$('#btn-close-modal').addEventListener('click', () => { Audio.sfxClick(); Modal.close(); });
  }

  function renderStats() {
    const s = State.get();
    const total = s.perfectMatches + s.wrongMatches;
    const accuracy = total > 0 ? Math.round((s.perfectMatches / total) * 100) : 0;

    const achvRows = ACHIEVEMENTS.map(a => {
      const unlocked = s.achievements.includes(a.id);
      return `
        <div class="achv-row ${unlocked ? '' : 'locked'}">
          <div class="achv-icon">${a.icon}</div>
          <div class="achv-info">
            <div class="a-name">${escapeHtml(a.name)}</div>
            <div class="a-desc">${escapeHtml(a.desc)}</div>
          </div>
        </div>`;
    }).join('');

    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">Tu progreso</div>
      <div class="modal-sub">El recorrido de Valtara hasta ahora.</div>
      ${DayCycle.renderDayMap(s.day)}
      <div class="stat-row"><span class="label">☾ Día actual</span><span class="value">${s.day}</span></div>
      <div class="stat-row"><span class="label">◈ Monedas</span><span class="value">${s.coins}</span></div>
      <div class="stat-row"><span class="label">✦ Reputación</span><span class="value">${s.reputation}</span></div>
      <div class="stat-row"><span class="label">🧑‍🤝‍🧑 Clientes atendidos</span><span class="value">${s.clientsServed}</span></div>
      <div class="stat-row"><span class="label">🎯 Precisión de diagnóstico</span><span class="value pos">${accuracy}%</span></div>
      <div class="stat-row"><span class="label">🔥 Mejor racha</span><span class="value">${s.bestStreak}</span></div>
      <div class="stat-row"><span class="label">👥 Personal contratado</span><span class="value">${s.staff.length} / ${STAFF_ROSTER.length}</span></div>
      <div class="stat-row"><span class="label">✨ Mejoras instaladas</span><span class="value">${s.upgrades.length} / ${UPGRADES.length}</span></div>
      <div class="settings-group-title" style="margin-top:18px;">Logros</div>
      ${achvRows}
      <button class="btn-secondary" id="btn-close-modal">Cerrar</button>
    `);
    V.$('#btn-close-modal').addEventListener('click', () => { Audio.sfxClick(); Modal.close(); });
  }

  return { renderStaff, renderUpgrades, renderStats };
})();
V.Views = Views;

/* ================================================================
   TUTORIAL
   ================================================================ */
const Tutorial = (function () {
  const STEPS = [
    { title: '¡Bienvenido a Valtara!', body: 'Administras un spa de bienestar. Cada cliente que llega tiene un síntoma real — léelo con atención.' },
    { title: 'Elige el tratamiento correcto', body: 'En el panel inferior verás las opciones de tratamiento. Escoge el que mejor resuelva el síntoma del cliente.' },
    { title: 'Gana monedas y reputación', body: 'Un diagnóstico perfecto te da monedas y reputación. Ambas suben tu spa de nivel.' },
    { title: 'Contrata e invierte', body: 'Usa tus monedas para contratar personal y comprar mejoras desde la barra inferior. ¡Que disfrutes Valtara!' }
  ];
  let idx = 0;

  function render() {
    const step = STEPS[idx];
    const isLast = idx === STEPS.length - 1;
    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">${escapeHtml(step.title)}</div>
      <div class="modal-sub">${escapeHtml(step.body)}</div>
      <div class="stat-row" style="justify-content:center; border:none;">
        <span class="label" style="color:var(--ivory-dim);">Paso ${idx + 1} de ${STEPS.length}</span>
      </div>
      <button class="btn-primary" id="btn-tut-next">${isLast ? 'Comenzar a jugar' : 'Siguiente'}</button>
      ${idx > 0 ? '<button class="btn-secondary" id="btn-tut-back">Atrás</button>' : ''}
    `);
    V.$('#btn-tut-next').addEventListener('click', () => {
      Audio.sfxClick();
      if (isLast) {
        State.set({ seenTutorial: true });
        Modal.close();
      } else {
        idx++;
        render();
      }
    });
    const backBtn = V.$('#btn-tut-back');
    if (backBtn) backBtn.addEventListener('click', () => { Audio.sfxClick(); idx--; render(); });
  }

  function start() {
    idx = 0;
    render();
  }

  return { start };
})();
V.Tutorial = Tutorial;

/* ================================================================
   13. PANTALLAS — Menú / Ajustes / Créditos / Juego / Pausa
   ================================================================ */
const Screens = (function () {
  let current = null;
  let isPaused = false;
  let settingsReturnTo = 'screen-menu';

  function go(id) {
    V.$$('.app-screen').forEach(el => el.classList.remove('active'));
    const target = V.$('#' + id);
    if (target) target.classList.add('active');
    current = id;
  }

  function goMenu() {
    go('screen-menu');
    V.$('#btn-menu-continue').style.display = (State.hasSave() && (State.get().day > 1 || State.get().clientsServed > 0)) ? 'flex' : 'none';
    spawnMotes('#menu-motes');
  }

  function goSettings(returnTo) {
    settingsReturnTo = returnTo || 'screen-menu';
    go('screen-settings');
    Settings.render();
  }
  function goCredits() { go('screen-credits'); }
  function settingsBack() {
    if (settingsReturnTo === 'screen-game') {
      go('screen-game');
      Screens.openPause();
    } else {
      goMenu();
    }
  }

  function goGame(isNewGame) {
    go('screen-game');
    Audio.start();
    if (isNewGame) {
      State.reset();
      Reception.hardReset();
    }
    HUD.refresh();
    spawnMotes('#motes');
    spawnDecor();
    if (!Reception.currentProfile) {
      Reception.init();
    }
    if (!State.get().seenTutorial) {
      setTimeout(() => Tutorial.start(), 900);
    }
  }

  function openPause() {
    if (isPaused) return;
    isPaused = true;
    Reception.pause();
    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">Pausa</div>
      <div class="modal-sub">Valtara espera tu regreso.</div>
      <button class="pause-menu-btn" id="btn-pause-resume"><span class="pm-ic">▶</span>Reanudar</button>
      <button class="pause-menu-btn" id="btn-pause-settings"><span class="pm-ic">⚙</span>Ajustes</button>
      <button class="pause-menu-btn" id="btn-pause-restart-day"><span class="pm-ic">↺</span>Reiniciar día</button>
      <button class="pause-menu-btn" id="btn-pause-menu"><span class="pm-ic">☰</span>Menú principal</button>
    `);
    V.$('#btn-pause-resume').addEventListener('click', closePause);
    V.$('#btn-pause-settings').addEventListener('click', () => {
      Audio.sfxClick();
      Modal.close();
      isPaused = false;
      goSettings('screen-game');
    });
    V.$('#btn-pause-restart-day').addEventListener('click', () => {
      Audio.sfxClick();
      State.set({ clientsToday: 0 });
      Modal.close();
      isPaused = false;
      HUD.refresh();
      Reception.bringNextCustomer();
    });
    V.$('#btn-pause-menu').addEventListener('click', () => {
      Audio.sfxClick();
      Modal.close();
      isPaused = false;
      goMenu();
    });
  }
  function closePause() {
    Audio.sfxClick();
    Modal.close();
    isPaused = false;
    if (!Reception.interactionOpen && !Reception.currentProfile) {
      Reception.bringNextCustomer();
    }
  }

  return { go, goMenu, goSettings, goCredits, goGame, openPause, closePause, settingsBack, get current() { return current; } };
})();
V.Screens = Screens;

/* ================================================================
   AJUSTES — render de la pantalla de settings
   ================================================================ */
const Settings = (function () {
  function render() {
    const s = State.get().settings;
    const body = V.$('#settings-body');
    body.innerHTML = `
      <div class="settings-group">
        <div class="settings-group-title">Audio</div>
        <div class="settings-card">
          <div class="settings-row" style="flex-direction:column; align-items:stretch;">
            <div class="settings-row-label"><span class="sr-ic">🎵</span>Música</div>
            <div class="slider-wrap">
              <input type="range" id="slider-music" min="0" max="100" value="${Math.round(s.musicVolume * 100)}">
              <span class="slider-val" id="slider-music-val">${Math.round(s.musicVolume * 100)}</span>
            </div>
          </div>
          <div class="settings-row" style="flex-direction:column; align-items:stretch;">
            <div class="settings-row-label"><span class="sr-ic">🔔</span>Efectos</div>
            <div class="slider-wrap">
              <input type="range" id="slider-sfx" min="0" max="100" value="${Math.round(s.sfxVolume * 100)}">
              <span class="slider-val" id="slider-sfx-val">${Math.round(s.sfxVolume * 100)}</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-label"><span class="sr-ic">🔇</span>Silenciar todo</div>
            <div class="toggle ${s.muted ? 'on' : ''}" id="toggle-mute"><div class="knob"></div></div>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Juego</div>
        <div class="settings-card">
          <div class="settings-row">
            <div>
              <div class="settings-row-label"><span class="sr-ic">⏭</span>Saltar diálogos</div>
              <div class="settings-row-sub">Avanza automáticamente sin esperar</div>
            </div>
            <div class="toggle ${s.dialogueSkip ? 'on' : ''}" id="toggle-skip"><div class="knob"></div></div>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-label"><span class="sr-ic">◐</span>Alto contraste</div>
              <div class="settings-row-sub">Colores más legibles</div>
            </div>
            <div class="toggle ${s.contrastMode ? 'on' : ''}" id="toggle-contrast"><div class="knob"></div></div>
          </div>
          <div class="settings-row">
            <div class="settings-row-label"><span class="sr-ic">🌐</span>Idioma</div>
            <div class="segmented">
              <button class="seg-btn ${s.language === 'es' ? 'active' : ''}" data-lang="es">ES</button>
              <button class="seg-btn ${s.language === 'en' ? 'active' : ''}" data-lang="en" disabled title="Próximamente">EN</button>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Partida</div>
        <button class="settings-danger-btn" id="btn-settings-reset">Reiniciar partida</button>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Acerca de</div>
        <div class="settings-card">
          <div class="settings-row">
            <div class="settings-row-label"><span class="sr-ic">🕯️</span>Valtara</div>
            <span class="settings-row-sub">v1.0</span>
          </div>
        </div>
      </div>
    `;

    wire();
  }

  function wire() {
    const musicSlider = V.$('#slider-music');
    const sfxSlider = V.$('#slider-sfx');
    musicSlider.addEventListener('input', () => {
      const v = musicSlider.value / 100;
      V.$('#slider-music-val').textContent = musicSlider.value;
      Audio.setMusicVolume(v);
    });
    sfxSlider.addEventListener('input', () => {
      const v = sfxSlider.value / 100;
      V.$('#slider-sfx-val').textContent = sfxSlider.value;
      Audio.setSfxVolume(v);
    });

    V.$('#toggle-mute').addEventListener('click', () => {
      const isOn = !State.get().settings.muted;
      Audio.setMuted(isOn);
      render();
    });
    V.$('#toggle-skip').addEventListener('click', () => {
      State.setSettings({ dialogueSkip: !State.get().settings.dialogueSkip });
      Audio.sfxClick();
      render();
    });
    V.$('#toggle-contrast').addEventListener('click', () => {
      const isOn = !State.get().settings.contrastMode;
      State.setSettings({ contrastMode: isOn });
      document.body.classList.toggle('contrast-mode', isOn);
      Audio.sfxClick();
      render();
    });
    V.$$('[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        State.setSettings({ language: btn.dataset.lang });
        Audio.sfxClick();
        render();
      });
    });

    V.$('#btn-settings-reset').addEventListener('click', () => {
      Audio.sfxClick();
      Modal.open(`
        <div class="modal-handle"></div>
        <div class="modal-title">¿Reiniciar todo?</div>
        <div class="modal-sub">Perderás monedas, reputación, personal y mejoras. Esta acción no se puede deshacer.</div>
        <button class="btn-primary" id="btn-confirm-reset" style="background:linear-gradient(155deg, var(--clay-br), var(--clay)); color:#fff;">Sí, reiniciar</button>
        <button class="btn-secondary" id="btn-cancel-reset">Cancelar</button>
      `);
      V.$('#btn-confirm-reset').addEventListener('click', () => {
        State.reset();
        V.Reception.hardReset();
        Modal.close();
        Screens.goMenu();
      });
      V.$('#btn-cancel-reset').addEventListener('click', () => { Audio.sfxClick(); Modal.close(); });
    });
  }

  return { render };
})();
V.Settings = Settings;

/* ================================================================
   NAVEGACIÓN DEL JUEGO Y ARRANQUE
   ================================================================ */
function wireGameNav() {
  const buttons = {
    reception: V.$('#nav-reception'),
    staff: V.$('#nav-staff'),
    upgrades: V.$('#nav-upgrades'),
    stats: V.$('#nav-stats')
  };

  function setActive(view) {
    Object.keys(buttons).forEach(k => buttons[k].classList.toggle('active', k === view));
  }

  buttons.reception.addEventListener('click', () => { Audio.sfxClick(); setActive('reception'); Modal.close(); });
  buttons.staff.addEventListener('click', () => { Audio.sfxClick(); setActive('reception'); Views.renderStaff(); });
  buttons.upgrades.addEventListener('click', () => { Audio.sfxClick(); setActive('reception'); Views.renderUpgrades(); });
  buttons.stats.addEventListener('click', () => { Audio.sfxClick(); setActive('reception'); Views.renderStats(); });

  V.$('#modal-backdrop').addEventListener('click', Modal.close);
  V.$('#btn-pause').addEventListener('click', () => { Audio.sfxClick(); Screens.openPause(); });
}

function wireMenuNav() {
  V.$('#btn-menu-play').addEventListener('click', () => {
    Audio.start();
    Audio.sfxClick();
    Screens.goGame(true);
  });
  V.$('#btn-menu-continue').addEventListener('click', () => {
    Audio.start();
    Audio.sfxClick();
    State.load();
    Screens.goGame(false);
  });
  V.$('#btn-menu-settings').addEventListener('click', () => { Audio.start(); Audio.sfxClick(); Screens.goSettings(); });
  V.$('#btn-menu-credits').addEventListener('click', () => { Audio.start(); Audio.sfxClick(); Screens.goCredits(); });

  V.$('#btn-settings-back').addEventListener('click', () => {
    Audio.sfxClick();
    Screens.settingsBack();
  });
  V.$('#btn-credits-back').addEventListener('click', () => { Audio.sfxClick(); Screens.goMenu(); });
}

function requestFullscreenIfPossible() {
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  } catch (e) { /* silencioso: algunos navegadores bloquean sin gesto directo */ }
}

function boot() {
  State.load();
  if (State.get().settings.contrastMode) document.body.classList.add('contrast-mode');

  wireMenuNav();
  wireGameNav();

  const loading = V.$('#loading-screen');
  let dismissed = false;
  function dismissLoading() {
    if (dismissed) return;
    dismissed = true;
    Audio.start();
    requestFullscreenIfPossible();
    if (loading) loading.classList.add('hidden');
    Screens.goMenu();
  }

  // Arranca tras el primer toque (gesto requerido para audio) o tras un tiempo breve
  loading.addEventListener('click', dismissLoading, { once: true });
  loading.addEventListener('touchstart', dismissLoading, { once: true, passive: true });
  setTimeout(dismissLoading, 2200);

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
