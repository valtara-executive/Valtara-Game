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
  staff: [],              // ids de personal contratado
  upgrades: [],            // ids de mejoras compradas
  cabins: [],               // ids de cabinas construidas
  achievements: [],          // ids de logros desbloqueados
  triviaCorrect: 0,
  triviaAnswered: 0,
  lightningTriviaCorrect: 0,
  gevizzTriviaSeen: 0,
  minigamesPlayed: 0,
  bestRhythmScore: 0,
  bestMemoryTime: null,
  totalTipsReceived: 0,
  weeklyGoalClaimed: 0,     // último número de semana reclamado
  foundSecretClient: false,
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
        if (!Array.isArray(s.cabins)) s.cabins = [];
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
const SoundEngine = (function () {
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

  /* ---- Ruido de viento/agua muy sutil de fondo, con variación climática ----
     El "clima sonoro" alterna aleatoriamente entre silencio, viento suave
     y lluvia suave para que el ambiente no se sienta siempre idéntico. */
  let windSource = null, windGain = null;
  let rainSource = null, rainGain = null;
  let weatherTimer = null;

  function buildNoiseBuffer() {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    return buffer;
  }

  function scheduleWindWhisper() {
    if (!ctx || windSource) return;
    const noise = ctx.createBufferSource();
    noise.buffer = buildNoiseBuffer();
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.6;

    windGain = ctx.createGain();
    windGain.gain.value = 0.012;

    noise.connect(filter);
    filter.connect(windGain);
    windGain.connect(musicGain);
    noise.start();
    windSource = noise;

    startWeatherCycle();
  }

  function startRain(targetGain) {
    if (!ctx || rainSource) return;
    const noise = ctx.createBufferSource();
    noise.buffer = buildNoiseBuffer();
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2200;

    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    noise.connect(filter);
    filter.connect(rainGain);
    rainGain.connect(musicGain);
    noise.start();
    rainSource = noise;

    rainGain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 3);
  }

  function stopRain() {
    if (!rainSource || !rainGain) return;
    const src = rainSource, g = rainGain;
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);
    setTimeout(() => { try { src.stop(); } catch (e) {} }, 3200);
    rainSource = null; rainGain = null;
  }

  /* Cada 90-180s, con baja probabilidad, activa lluvia suave por un rato
     y luego la desvanece — un pequeño cambio de ambiente ocasional. */
  function startWeatherCycle() {
    clearTimeout(weatherTimer);
    function cycle() {
      if (!rainSource && Math.random() < 0.3) {
        startRain(0.02);
        setTimeout(() => stopRain(), V.randInt(25000, 50000));
      }
      weatherTimer = setTimeout(cycle, V.randInt(90000, 180000));
    }
    weatherTimer = setTimeout(cycle, V.randInt(30000, 70000));
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
V.SoundEngine = SoundEngine;

/* ================================================================
   3. DATOS — SERVICIOS
   ================================================================ */
const SERVICES = [
  { id:'MA-01', name:'Relajante Neuro Adaptativo', icon:'🌙', category:'Relajación', duration:'50 min', reward:38, reputation:8,
    desc:'Presiones lentas y fluidas para desenredar la tensión de cuello y hombros.' },
  { id:'MA-02', name:'Masaje Deportivo & Descompresión', icon:'💪', category:'Deportivo', duration:'50 min', reward:56, reputation:15,
    desc:'Presión clínica directa a la fascia para liberar ácido láctico y contracturas.' },
  { id:'MA-03', name:'Ayurveda & Aromaterapia', icon:'🪔', category:'Holístico', duration:'50 min', reward:46, reputation:12,
    desc:'Inmersión sensorial con óleos esenciales tibios contra la dispersión mental.' },
  { id:'MA-04', name:'Esferas Chinas & Velas Aromáticas', icon:'🕯️', category:'Inmersivo', duration:'60 min', reward:53, reputation:14,
    desc:'Resonancia térmica y cera natural para combatir el insomnio.' },
  { id:'MA-05', name:'Reductivo & Maderoterapia', icon:'🪵', category:'Estético', duration:'Sesión', reward:60, reputation:17,
    desc:'Fricción manual y maderoterapia para drenaje linfático y textura cutánea.' },
  { id:'MA-06', name:'Terapia para Parálisis Facial', icon:'🌿', category:'Clínico', duration:'45 min', reward:76, reputation:23,
    desc:'Rehabilitación gradual mediante estimulación neuromuscular focalizada.' },
  { id:'MA-07', name:'Shiatsu en Cama · Complemento', icon:'⚡', category:'Express', duration:'20 min', reward:22, reputation:4,
    desc:'Digitopuntura profunda y rápida en las zonas de mayor carga.' },
  { id:'MA-08', name:'Ritual Lomi Lomi Supremo', icon:'🌊', category:'Premium', duration:'Sesión Premium', reward:132, reputation:38,
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
  {id:'P-050',name:'Mario Escamilla',age:'55-65',job:'Catedrático e Investigador',mood:'Aletargado',symptom:'Rigidez corporal total por estudio intelectual.',service:'Ritual Lomi Lomi Supremo',line:'Mi cuerpo se olvidó de cómo relajarse después de tantas investigaciones. Necesito una experiencia premium para regresar a la vida.'},
  {id:'P-051',name:'Renata Ibarra',age:'25-35',job:'Ingeniera de Software',mood:'Fatigada',symptom:'Tensión ocular y cervical por pantallas.',service:'Relajante Neuro Adaptativo',line:'Llevo dos sprints seguidos sin parar. Necesito algo lento que me devuelva la calma, no otro correo urgente.',recurring:true},
  {id:'P-052',name:'Leonardo Bátiz',age:'40-50',job:'Corredor de Bolsa',mood:'Ansioso',symptom:'Presión constante en el pecho y hombros.',service:'Relajante Neuro Adaptativo',line:'Los mercados no paran y yo tampoco. Necesito veinte minutos donde nada se mueva excepto mi respiración.'},
  {id:'P-053',name:'Ximena Godoy',age:'22-30',job:'Instructora de Yoga',mood:'Irónicamente Tensa',symptom:'Sobrecarga en trapecios por enseñar todo el día.',service:'Masaje Deportivo & Descompresión',line:'Es curioso: enseño a relajarse y yo misma llego hecha nudo. Ayúdenme a practicar lo que predico.'},
  {id:'P-054',name:'Iván Marroquín',age:'30-40',job:'Escalador Recreativo',mood:'Adolorido',symptom:'Antebrazos y hombros sobrecargados.',service:'Masaje Deportivo & Descompresión',line:'Terminé una vía difícil este fin de semana. Los antebrazos se me quedaron duros como cuerda tensa.'},
  {id:'P-055',name:'Paola Nieves',age:'28-38',job:'Terapeuta Ocupacional',mood:'Empática pero Agotada',symptom:'Fatiga por dar cuidado constante a otros.',service:'Ayurveda & Aromaterapia',line:'Cuido a mis pacientes todo el día. Hoy quiero que alguien cuide de mí, aunque sea por una hora.',recurring:true},
  {id:'P-056',name:'Emilio Bravo',age:'45-55',job:'Chef de Alta Cocina',mood:'Quemado',symptom:'Estrés térmico y agotamiento sensorial.',service:'Ayurveda & Aromaterapia',line:'Entre el calor de la cocina y la presión del servicio, mis sentidos están saturados. Necesito aromas suaves, no más humo.'},
  {id:'P-057',name:'Daniela Cordero',age:'35-45',job:'Directora de Orquesta',mood:'Hiperconcentrada',symptom:'Rigidez en cuello por dirigir de pie.',service:'Esferas Chinas & Velas Aromáticas',line:'Dirijo de pie durante horas, con los brazos en alto. Necesito calor que baje toda esa tensión acumulada.'},
  {id:'P-058',name:'Rodrigo Salcedo',age:'50-60',job:'Piloto de Carreras Retirado',mood:'Inquieto',symptom:'Insomnio por exceso de adrenalina residual.',service:'Esferas Chinas & Velas Aromáticas',line:'Pasé veinte años viviendo a 300 km/h. Ahora mi cuerpo no sabe cómo estar quieto para dormir.'},
  {id:'P-059',name:'Alejandra Feregrino',age:'30-40',job:'Influencer de Bienestar',mood:'Irónicamente Estresada',symptom:'Ansiedad por mantener una imagen de calma.',service:'Esferas Chinas & Velas Aromáticas',line:'Todo el día publico sobre paz interior y en realidad ando destrozada. Necesito que esto sea real, no para la foto.',recurring:true},
  {id:'P-060',name:'Tomás Villagómez',age:'40-50',job:'Ejecutivo de Manufactura',mood:'Rígido',symptom:'Piernas cargadas por recorrer la planta.',service:'Reductivo & Maderoterapia',line:'Camino la planta entera tres veces al día. Las piernas se me cargan de un peso que no se quita con nada.'},
  {id:'P-061',name:'Fernanda Ocampo',age:'25-35',job:'Bailarina de Salsa Profesional',mood:'Exigida',symptom:'Piernas y glúteos con adiposidad localizada por esfuerzo repetido.',service:'Reductivo & Maderoterapia',line:'Tengo un campeonato en dos semanas. Necesito que mi cuerpo esté afinado como un instrumento.'},
  {id:'P-062',name:'Bruno Salcido',age:'35-45',job:'Fisicoculturista Amateur',mood:'Determinado',symptom:'Retención localizada pre-competencia.',service:'Reductivo & Maderoterapia',line:'Faltan diez días para el escenario. Cada detalle cuenta, necesito definición donde el espejo aún no la muestra.'},
  {id:'P-063',name:'Consuelo Aragón',age:'55-65',job:'Ex Bailarina de Ballet',mood:'Melancólica',symptom:'Rigidez articular por años de exigencia física.',service:'Terapia para Parálisis Facial',line:'El cuerpo recuerda cada función que bailé. A veces mi rostro no responde como antes, necesito paciencia y respeto.'},
  {id:'P-064',name:'Héctor Villaseñor',age:'45-55',job:'Locutor de Noticias',mood:'Preocupado',symptom:'Asimetría leve al hablar frente a cámara.',service:'Terapia para Parálisis Facial',line:'Salgo en vivo todas las noches. Noté algo raro en mi gesto y necesito que alguien lo trate con delicadeza y sin prisa.'},
  {id:'P-065',name:'Marcela del Río',age:'30-40',job:'Cirujana Plástica',mood:'Profesionalmente Cautelosa',symptom:'Debilidad muscular facial post-jornada extensa.',service:'Terapia para Parálisis Facial',line:'Paso el día operando el rostro de otros. Hoy necesito que alguien cuide el mío con la misma precisión.'}
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
    skipBtn.addEventListener('click', () => { SoundEngine.sfxClick(); opts.onSkip(); });
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

/* Reacciones variadas de personajes: varias frases posibles por resultado,
   para que la escena no repita siempre la misma línea. */
const SUCCESS_REACTIONS = [
  (n) => `${n} sale renovado. Diagnóstico perfecto.`,
  (n) => `${n} respira profundo y sonríe. Justo lo que necesitaba.`,
  (n) => `${n} agradece con una reverencia. Sesión impecable.`,
  (n) => `${n} sale con los hombros más relajados que nunca.`,
  (n) => `${n} promete volver pronto a Valtara.`,
  (n) => `${n} dice que este será su nuevo lugar favorito.`
];
const FAIL_REACTIONS = [
  (n) => `${n} agradece el esfuerzo, aunque no era lo que buscaba.`,
  (n) => `${n} se va pensativo. Quizás la próxima vez.`,
  (n) => `${n} sonríe con cortesía, pero algo faltó.`,
  (n) => `${n} lo intentará en su próxima visita.`
];
const FAIL_PENALTY_REACTIONS = [
  (n) => `${n} se va decepcionado. Perdiste algo de reputación.`,
  (n) => `${n} no oculta su frustración al salir.`,
  (n) => `${n} deja saber que esperaba más de Valtara hoy.`
];

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
    const vipChance = Upgrades.hasFlag('moreVip') ? 0.20 : 0.12;
    const roll = Math.random();
    if (roll < vipChance) return { type: 'vip', label: 'Cliente VIP · paga doble si aciertas', multiplier: 2 };
    if (roll < vipChance + 0.08) return { type: 'difficult', label: 'Cliente difícil · resta reputación si fallas', multiplier: 1 };
    return null;
  }

  function effectiveClientsPerDay() {
    return State.get().clientsPerDay + Staff.getClientsPerDayBonus();
  }

  async function bringNextCustomer() {
    interactionOpen = false;
    closeServiceSheet();
    clearDialogue();

    // Intercalar trivia (normal, relámpago, o mini-juego) antes del siguiente cliente
    if (maybeTriggerTrivia()) {
      const roll = Math.random();
      if (roll < 0.12) {
        Minigames.openRhythm(() => bringNextCustomer());
      } else if (roll < 0.24) {
        Minigames.openMemory(() => bringNextCustomer());
      } else if (roll < 0.45) {
        Trivia.openLightning(() => bringNextCustomer());
      } else {
        Trivia.open(() => bringNextCustomer());
      }
      return;
    }

    const profile = pickNextProfile();
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

    // Modo hora pico: un segundo cliente aparece esperando a un costado.
    maybeSpawnPeakHourWaiting();

    SoundEngine.sfxBell();
    const meta = activeEvent
      ? `${profile.job} · ${profile.age} años · ${activeEvent.label}`
      : `${profile.job} · ${profile.age} años`;
    showDialogue(profile.name, profile.line, meta, { skippable: true, onSkip: () => { clearDialogue(); openServiceSheet(profile); } });
    openServiceSheet(profile);
  }

  /* Selección de perfil: da preferencia ocasional a clientes "recurrentes"
     para que se sientan como caras conocidas del spa, no solo aleatorios. */
  /* Cliente secreto: easter egg rarísimo con línea especial. */
  const SECRET_CLIENT = {
    id:'P-SECRET', name:'El Fundador', age:'??', job:'Visitante misterioso', mood:'Sereno',
    symptom:'Nadie sabe realmente qué necesita.', service:'Ritual Lomi Lomi Supremo',
    line:'He visitado spas en todo el mundo buscando uno que entienda que el descanso también se gana con trabajo bien hecho. Sorpréndeme.'
  };

  function pickNextProfile() {
    if (Math.random() < 0.01) return SECRET_CLIENT;
    if (Math.random() < 0.22) {
      const recurring = PROFILES.filter(p => p.recurring);
      if (recurring.length) return V.rand(recurring);
    }
    return V.randomProfile();
  }

  /* Hora pico: poco frecuente, a partir del día 3. Un segundo cliente
     aparece visiblemente esperando junto al mostrador mientras se atiende
     al primero, dando sensación de ritmo sin romper la interacción 1 a 1. */
  let waitingCustomerId = null;
  let waitingProfile = null;
  function maybeSpawnPeakHourWaiting() {
    if (waitingCustomerId) return;
    if (State.get().day < 3 || Math.random() > 0.16) return;
    const profile = V.randomProfile();
    waitingProfile = profile;
    const wId = 'waiting-' + profile.id + '-' + Date.now();
    waitingCustomerId = wId;
    Actors.create({ id: wId, name: profile.name, role: 'customer', x: 88, y: DESK_Y + 14, moodColor: MOOD_COLORS[profile.mood] });
    toast(`${profile.name} espera su turno.`, '⏳');
  }
  function promoteWaitingCustomer() {
    if (!waitingCustomerId) return false;
    const wId = waitingCustomerId, profile = waitingProfile;
    waitingCustomerId = null; waitingProfile = null;
    currentProfile = profile;
    currentCustomerId = wId;
    activeEvent = rollDayEvent();
    Actors.moveTo(wId, DESK_X, DESK_Y, 'talking');
    SoundEngine.sfxBell();
    const meta = `${profile.job} · ${profile.age} años`;
    showDialogue(profile.name, profile.line, meta, { skippable: true, onSkip: () => { clearDialogue(); openServiceSheet(profile); } });
    setTimeout(() => openServiceSheet(profile), 650);
    return true;
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
      btn.addEventListener('click', () => { SoundEngine.sfxClick(); handleChoice(svc); });
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
    const bonusMult = V.Staff.getServiceBonus()
      + Staff.getCategoryBonus(service.category)
      + Cabins.getCategoryBonus(service.category);
    const eventMult = (activeEvent && activeEvent.type === 'vip' && correct) ? activeEvent.multiplier : 1;

    if (correct) {
      let coinGain = Math.round(service.reward * bonusMult * eventMult);
      let repGain = Math.round(service.reputation * (1 + Upgrades.totalRepBonus()));

      // Propina aleatoria: pequeña sorpresa post-sesión, ~18% de probabilidad
      let tip = 0;
      if (Math.random() < 0.18) {
        tip = V.randInt(8, 30);
        coinGain += tip;
      }

      const prevCoins = State.get().coins;
      const patch = {
        coins: prevCoins + coinGain,
        reputation: State.get().reputation + repGain,
        clientsServed: State.get().clientsServed + 1,
        perfectMatches: State.get().perfectMatches + 1,
        clientsToday: State.get().clientsToday + 1,
        streak: State.get().streak + 1,
        bestStreak: Math.max(State.get().bestStreak, State.get().streak + 1)
      };
      if (tip > 0) patch.totalTipsReceived = State.get().totalTipsReceived + tip;
      if (currentProfile.id === 'P-SECRET') patch.foundSecretClient = true;
      V.State.set(patch);
      SoundEngine.sfxCoins();
      flashFeedback(true, coinGain, repGain, eventMult > 1);
      Particles.burstConfetti(50, 45);
      Particles.petalRain();
      Particles.floatCoins(coinGain);
      Particles.animateCounter(V.$('#stat-coins'), prevCoins, State.get().coins);
      let msg = eventMult > 1
        ? `${currentProfile.name} queda encantado. ¡Pago VIP doble!`
        : V.rand(SUCCESS_REACTIONS)(currentProfile.name);
      if (tip > 0) msg += ` Además dejó una propina de ${tip} ◈.`;
      showDialogue('Valtara', msg, 'Sesión completada');
      if (currentCustomerId) Actors.setState(currentCustomerId, 'talking');
    } else {
      const consolationCoins = Math.round(15 * bonusMult);
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
      SoundEngine.sfxFail();
      flashFeedback(false, consolationCoins, -repPenalty);
      Particles.animateCounter(V.$('#stat-coins'), prevCoins, State.get().coins);
      const msg = repPenalty > 0
        ? V.rand(FAIL_PENALTY_REACTIONS)(currentProfile.name)
        : V.rand(FAIL_REACTIONS)(currentProfile.name);
      showDialogue('Valtara', msg, 'Diagnóstico incorrecto');
    }

    V.HUD.refresh();
    Achievements.checkAll();

    const pace = Upgrades.hasFlag('fastPace') ? 1300 : 1900;
    setTimeout(() => {
      exitCustomer();
      if (State.get().clientsToday >= effectiveClientsPerDay()) {
        V.DayCycle.endDay();
      } else if (waitingCustomerId) {
        promoteWaitingCustomer();
      } else {
        bringNextCustomer();
      }
    }, pace);
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

  /* Reabre el panel de tratamientos para el cliente que ya estaba esperando
     (por ejemplo, tras salir de una pausa a mitad de una interacción). */
  function resumeInteraction() {
    if (!currentProfile) return;
    openServiceSheet(currentProfile);
  }

  /* Limpia toda la escena (recepcionista + cliente actual) para permitir
     un arranque limpio, por ejemplo tras "Jugar" desde el menú o tras un
     reinicio total de partida. */
  function hardReset() {
    interactionOpen = false;
    closeServiceSheet();
    clearDialogue();
    Modal.setLocked(false);
    if (currentCustomerId) Actors.remove(currentCustomerId);
    if (waitingCustomerId) Actors.remove(waitingCustomerId);
    Actors.remove(RECEPTIONIST_ID);
    currentCustomerId = null;
    currentProfile = null;
    activeEvent = null;
    turnsSinceLastTrivia = 0;
    waitingCustomerId = null;
    waitingProfile = null;
  }

  return {
    init, bringNextCustomer, pause, hardReset, resumeInteraction, effectiveClientsPerDay,
    get currentProfile() { return currentProfile; },
    get interactionOpen() { return interactionOpen; }
  };
})();
V.Reception = Reception;

/* ================================================================
   7. PERSONAL (STAFF)
   ================================================================ */
const STAFF_ROSTER = [
  { id:'sf-01', name:'Renata Ibáñez', role:'Terapeuta Junior', icon:'🧑‍⚕️', cost:1800, bonus:0.05,
    desc:'Aumenta un 5% las ganancias por sesión.' },
  { id:'sf-05', name:'Brenda Casillas', role:'Recepcionista Junior', icon:'🛎️', cost:2400, bonus:0, clientBonus:1,
    desc:'Agiliza la recepción: +1 cliente por día.' },
  { id:'sf-02', name:'Ismael Coto', role:'Terapeuta Senior', icon:'🧑‍⚕️', cost:4300, bonus:0.09,
    desc:'Aumenta un 9% las ganancias por sesión.' },
  { id:'sf-06', name:'Yolanda Prieto', role:'Especialista en Aromaterapia', icon:'🪔', cost:3900, bonus:0, categoryBonus:{ category:'Holístico', amount:0.20 },
    desc:'+20% en pagos de tratamientos de categoría Holístico.' },
  { id:'sf-07', name:'Adrián Fonseca', role:'Fisioterapeuta Deportivo', icon:'💪', cost:4500, bonus:0, categoryBonus:{ category:'Deportivo', amount:0.20 },
    desc:'+20% en pagos de tratamientos de categoría Deportivo.' },
  { id:'sf-11', name:'Karina Ochoa', role:'Instructora de Respiración', icon:'🌬️', cost:5200, bonus:0.07,
    desc:'Aumenta un 7% las ganancias por sesión.' },
  { id:'sf-03', name:'Dulce Marín', role:'Coordinadora de Bienestar', icon:'🌸', cost:8100, bonus:0.14,
    desc:'Aumenta un 14% las ganancias y mejora la reputación general.' },
  { id:'sf-08', name:'Gustavo Nájera', role:'Esteticista Clínica', icon:'🧴', cost:7400, bonus:0, categoryBonus:{ category:'Clínico', amount:0.24 },
    desc:'+24% en pagos de tratamientos de categoría Clínico y Estético.' },
  { id:'sf-12', name:'Rubén Salgado', role:'Terapeuta Ayurvédico Certificado', icon:'📿', cost:9600, bonus:0, categoryBonus:{ category:'Holístico', amount:0.18 },
    desc:'+18% adicional en pagos de tratamientos Holísticos.' },
  { id:'sf-09', name:'Norma Aceves', role:'Gerente de Experiencia', icon:'✨', cost:11500, bonus:0, reputationPerDay:3,
    desc:'Suma +3 de reputación automáticamente al iniciar cada día.' },
  { id:'sf-04', name:'Óscar Beltrán', role:'Especialista Clínico', icon:'🩺', cost:15000, bonus:0.20,
    desc:'Personal de élite: +20% en cada sesión completada.' },
  { id:'sf-13', name:'Camila Reséndiz', role:'Directora Médica de Bienestar', icon:'⚕️', cost:22000, bonus:0.18, reputationPerDay:4,
    desc:'+18% en ganancias y +4 de reputación pasiva por día.' },
  { id:'sf-10', name:'Valentina Sarabia', role:'Directora de Spa', icon:'👑', cost:32000, bonus:0.22, unlocksCabin:'cb-04',
    desc:'Bono global de +22% y desbloquea la Cabina VIP.' },
  { id:'sf-14', name:'Maestro Ishida', role:'Consultor Internacional de Bienestar', icon:'🎓', cost:48000, bonus:0.28,
    desc:'Personal legendario: +28% permanente en cada sesión.' }
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

  /* Bono adicional cuando el tratamiento coincide con la categoría
     de especialización de algún miembro contratado. */
  function getCategoryBonus(category) {
    return owned().reduce((sum, id) => {
      const m = STAFF_ROSTER.find(s => s.id === id);
      if (m && m.categoryBonus && m.categoryBonus.category === category) return sum + m.categoryBonus.amount;
      return sum;
    }, 0);
  }

  function getClientsPerDayBonus() {
    return owned().reduce((sum, id) => {
      const m = STAFF_ROSTER.find(s => s.id === id);
      return sum + (m && m.clientBonus ? m.clientBonus : 0);
    }, 0);
  }

  function getReputationPerDay() {
    return owned().reduce((sum, id) => {
      const m = STAFF_ROSTER.find(s => s.id === id);
      return sum + (m && m.reputationPerDay ? m.reputationPerDay : 0);
    }, 0);
  }

  function hire(id) {
    const member = STAFF_ROSTER.find(s => s.id === id);
    if (!member || isOwned(id)) return false;
    const s = State.get();
    if (s.coins < member.cost) { toast('No tienes suficientes monedas para contratar.', '◈'); return false; }
    State.set({ coins: s.coins - member.cost, staff: [...s.staff, id] });
    SoundEngine.sfxCoins();
    toast(`${member.name} se unió al equipo.`, member.icon);
    V.HUD.refresh();
    Achievements.checkAll();
    return true;
  }

  return { owned, isOwned, getServiceBonus, getCategoryBonus, getClientsPerDayBonus, getReputationPerDay, hire };
})();
V.Staff = Staff;

/* ================================================================
   8. MEJORAS (UPGRADES)
   ================================================================ */
const UPGRADES = [
  { id:'up-01', name:'Difusores de Aromaterapia', icon:'🪔', cost:1500,
    desc:'Los clientes llegan de mejor ánimo. +1 cliente por día.', apply:(s)=>({ clientsPerDay: s.clientsPerDay + 1 }) },
  { id:'up-02', name:'Mobiliario de Recepción', icon:'🪑', cost:2900,
    desc:'Una recepción más cómoda mejora cada pago en un 7%.', apply:null, bonus:0.07 },
  { id:'up-05', name:'Sistema de Reservas', icon:'📋', cost:3600,
    desc:'Menos tiempo de espera entre clientes: el ritmo del día se siente más ágil.', apply:null, flag:'fastPace' },
  { id:'up-11', name:'Batas y Toallas Premium', icon:'🧺', cost:4100,
    desc:'Detalles que se notan: +6% en cada pago.', apply:null, bonus:0.06 },
  { id:'up-06', name:'Música en Vivo', icon:'🎻', cost:4700,
    desc:'Una experiencia más memorable: +15% de reputación ganada por sesión.', apply:null, repBonus:0.15 },
  { id:'up-12', name:'Kit de Aceites Esenciales Importados', icon:'🧴', cost:5400,
    desc:'Insumos de mayor calidad: +8% en cada pago.', apply:null, bonus:0.08 },
  { id:'up-03', name:'Iluminación Ambiental', icon:'🕯️', cost:6200,
    desc:'Atmósfera premium: +2 clientes por día.', apply:(s)=>({ clientsPerDay: s.clientsPerDay + 2 }) },
  { id:'up-07', name:'Spa Rooftop', icon:'🏙️', cost:7300,
    desc:'Nueva terraza al aire libre: +2 clientes por día.', apply:(s)=>({ clientsPerDay: s.clientsPerDay + 2 }) },
  { id:'up-13', name:'Certificación en Bioseguridad', icon:'🧼', cost:8500,
    desc:'Confianza total del cliente: +10% de reputación ganada por sesión.', apply:null, repBonus:0.10 },
  { id:'up-08', name:'Valet Parking', icon:'🚗', cost:9800,
    desc:'Clientes VIP llegan con más frecuencia.', apply:null, flag:'moreVip' },
  { id:'up-04', name:'Sala de Espera VIP', icon:'✦', cost:11500,
    desc:'Clientes de alto perfil pagan más. +12% en cada pago.', apply:null, bonus:0.12 },
  { id:'up-14', name:'Equipo de Diagnóstico Avanzado', icon:'🔬', cost:13000,
    desc:'Lecturas más precisas de cada síntoma: +10% en cada pago.', apply:null, bonus:0.10 },
  { id:'up-09', name:'Alberca de Sales Minerales', icon:'🌊', cost:15500,
    desc:'Desbloquea la posibilidad de tratamientos premium exclusivos con mejor paga.', apply:null, bonus:0.10 },
  { id:'up-15', name:'Certificación Nacional de Excelencia', icon:'🎖️', cost:18000,
    desc:'Reconocimiento oficial del sector: +12% permanente en todos los pagos.', apply:null, bonus:0.12 },
  { id:'up-10', name:'Certificación Internacional', icon:'🏅', cost:24000,
    desc:'El spa gana renombre global: +15% permanente en todos los pagos.', apply:null, bonus:0.15 },
  { id:'up-16', name:'Alianza con Gremio Internacional de Spas', icon:'🌐', cost:34000,
    desc:'El máximo reconocimiento de la industria: +18% permanente en todos los pagos.', apply:null, bonus:0.18 }
];
V.UPGRADES = UPGRADES;

const Upgrades = (function () {
  function owned() { return State.get().upgrades; }
  function isOwned(id) { return owned().includes(id); }

  function totalBonus() {
    return UPGRADES.filter(u => isOwned(u.id) && u.bonus).reduce((sum, u) => sum + u.bonus, 0);
  }

  function totalRepBonus() {
    return UPGRADES.filter(u => isOwned(u.id) && u.repBonus).reduce((sum, u) => sum + u.repBonus, 0);
  }

  function hasFlag(flag) {
    return UPGRADES.some(u => isOwned(u.id) && u.flag === flag);
  }

  function buy(id) {
    const up = UPGRADES.find(u => u.id === id);
    if (!up || isOwned(id)) return false;
    const s = State.get();
    if (s.coins < up.cost) { toast('No tienes suficientes monedas.', '◈'); return false; }
    let patch = { coins: s.coins - up.cost, upgrades: [...s.upgrades, id] };
    if (up.apply) patch = Object.assign(patch, up.apply(s));
    State.set(patch);
    SoundEngine.sfxCoins();
    toast(`${up.name} instalado.`, up.icon);
    V.HUD.refresh();
    Achievements.checkAll();
    return true;
  }

  return { owned, isOwned, totalBonus, totalRepBonus, hasFlag, buy };
})();
V.Upgrades = Upgrades;

/* Ajustar el bono de servicio para incluir mejoras además de personal */
const _origGetServiceBonus = Staff.getServiceBonus;
Staff.getServiceBonus = function () {
  return _origGetServiceBonus() + Upgrades.totalBonus();
};

/* ================================================================
   8b. CABINAS — salas especializadas del spa
   ================================================================ */
const CABINS = [
  { id:'cb-01', name:'Cabina Zen', icon:'🌙', cost:6500, category:'Relajación', bonus:0.15,
    desc:'Ambientada para tratamientos de Relajación. +15% si coincide la categoría.' },
  { id:'cb-02', name:'Cabina Deportiva', icon:'💪', cost:8200, category:'Deportivo', bonus:0.15,
    desc:'Equipo especializado en recuperación física. +15% en tratamientos Deportivos.' },
  { id:'cb-05', name:'Cabina Clínica', icon:'🩺', cost:10500, category:'Clínico', bonus:0.16,
    desc:'Ambiente clínico especializado. +16% en tratamientos Clínicos y Estéticos.' },
  { id:'cb-03', name:'Cabina Ritual', icon:'🪔', cost:13800, category:'Holístico', bonus:0.18,
    desc:'Diseñada para experiencias sensoriales completas. +18% en tratamientos Holísticos.' },
  { id:'cb-06', name:'Cabina Inmersiva', icon:'🕯️', cost:17200, category:'Inmersivo', bonus:0.18,
    desc:'Aislamiento sensorial total. +18% en tratamientos Inmersivos.' },
  { id:'cb-04', name:'Cabina VIP', icon:'👑', cost:26000, category:'Premium', bonus:0.28,
    desc:'La joya de Valtara. +28% en tratamientos Premium. Requiere Directora de Spa.' }
];
V.CABINS = CABINS;

const Cabins = (function () {
  function owned() { return State.get().cabins || []; }
  function isOwned(id) { return owned().includes(id); }

  function isUnlocked(cabin) {
    if (!cabin.unlocksRequires) return true;
    return Staff.owned().includes(cabin.unlocksRequires);
  }

  function getCategoryBonus(category) {
    return CABINS.reduce((sum, c) => {
      if (isOwned(c.id) && c.category === category) return sum + c.bonus;
      return sum;
    }, 0);
  }

  function buy(id) {
    const cabin = CABINS.find(c => c.id === id);
    if (!cabin || isOwned(id)) return false;
    // La Cabina VIP requiere haber contratado a la Directora de Spa
    if (id === 'cb-04' && !Staff.isOwned('sf-10')) {
      toast('Necesitas contratar a la Directora de Spa primero.', '👑');
      return false;
    }
    const s = State.get();
    if (s.coins < cabin.cost) { toast('No tienes suficientes monedas.', '◈'); return false; }
    State.set({ coins: s.coins - cabin.cost, cabins: [...owned(), id] });
    SoundEngine.sfxCoins();
    toast(`${cabin.name} lista para recibir clientes.`, cabin.icon);
    V.HUD.refresh();
    Achievements.checkAll();
    return true;
  }

  return { owned, isOwned, getCategoryBonus, buy };
})();
V.Cabins = Cabins;

/* ================================================================
   9. TRIVIA Y EVENTOS
   ================================================================ */
const TRIVIA_BANK = [
  /* ---- Bienestar y spa (categoría base) ---- */
  { cat:'spa', q: '¿Qué aceite esencial es más conocido por ayudar a conciliar el sueño?', options: ['Lavanda', 'Menta', 'Cítrico', 'Eucalipto'], correct: 0 },
  { cat:'spa', q: '¿Qué técnica de masaje utiliza piedras o esferas calientes?', options: ['Shiatsu', 'Terapia con esferas chinas', 'Drenaje linfático', 'Reflexología'], correct: 1 },
  { cat:'spa', q: '¿Qué sistema del cuerpo ayuda a activar el drenaje linfático?', options: ['Circulatorio', 'Digestivo', 'Linfático', 'Respiratorio'], correct: 2 },
  { cat:'spa', q: '¿De qué país es originario el masaje Lomi Lomi?', options: ['Tailandia', 'Hawái', 'Japón', 'India'], correct: 1 },
  { cat:'spa', q: '¿Qué disciplina milenaria da origen a la aromaterapia con hierbas y aceites?', options: ['Ayurveda', 'Feng Shui', 'Reiki', 'Acupuntura'], correct: 0 },
  { cat:'spa', q: '¿Qué presión muscular ayuda a liberar el ácido láctico tras el ejercicio?', options: ['Presión superficial', 'Presión clínica profunda', 'Vibración', 'Ninguna'], correct: 1 },
  { cat:'spa', q: '¿Qué significa "shiatsu" en japonés?', options: ['Agua caliente', 'Presión de dedos', 'Movimiento lento', 'Aceite tibio'], correct: 1 },
  { cat:'spa', q: '¿Qué mineral se asocia comúnmente con la relajación muscular?', options: ['Hierro', 'Magnesio', 'Calcio', 'Zinc'], correct: 1 },
  { cat:'spa', q: '¿Qué parte del día se recomienda para tratamientos de estimulación energética?', options: ['Mañana', 'Media noche', 'Nunca', 'Solo festivos'], correct: 0 },
  { cat:'spa', q: '¿Qué madera se usa tradicionalmente en la maderoterapia?', options: ['Bambú o haya', 'Cristal', 'Metal', 'Piedra volcánica'], correct: 0 },
  { cat:'spa', q: '¿Qué beneficio principal ofrece la maderoterapia?', options: ['Aumentar masa muscular', 'Modelar y reducir medidas', 'Broncear la piel', 'Fortalecer huesos'], correct: 1 },
  { cat:'spa', q: '¿Qué color de vela se asocia comúnmente con calma en aromaterapia?', options: ['Rojo intenso', 'Lavanda o crema', 'Negro', 'Neón'], correct: 1 },
  { cat:'spa', q: '¿Qué es la reflexología?', options: ['Masaje en puntos de pies y manos', 'Un tipo de yoga', 'Terapia con espejos', 'Un aceite esencial'], correct: 0 },
  { cat:'spa', q: '¿Qué busca principalmente el drenaje linfático?', options: ['Aumentar masa muscular', 'Eliminar retención de líquidos', 'Broncear la piel', 'Fortalecer tendones'], correct: 1 },
  { cat:'spa', q: '¿Qué técnica japonesa usa presión de dedos y pulgares sin aceite?', options: ['Shiatsu', 'Lomi Lomi', 'Piedras calientes', 'Reductivo'], correct: 0 },
  { cat:'spa', q: '¿Qué aceite esencial se asocia comúnmente con energía y concentración?', options: ['Romero', 'Manzanilla', 'Lavanda', 'Vainilla'], correct: 0 },
  { cat:'spa', q: '¿Qué buscan aliviar principalmente los tratamientos de aromaterapia?', options: ['Fracturas óseas', 'Estrés y ansiedad', 'Miopía', 'Caries'], correct: 1 },
  { cat:'spa', q: '¿Qué articulación se libera comúnmente en un masaje de trapecios?', options: ['Cadera', 'Hombro y cuello', 'Tobillo', 'Muñeca'], correct: 1 },
  { cat:'spa', q: '¿Qué elemento natural se usa en la terapia con esferas chinas?', options: ['Metal caliente', 'Hielo', 'Agua fría', 'Arena'], correct: 0 },
  { cat:'spa', q: '¿Qué recomienda hacerse antes de un masaje profundo?', options: ['Comer abundante', 'Hidratarse bien', 'Hacer ejercicio intenso', 'Ayunar 24h'], correct: 1 },
  { cat:'spa', q: '¿Qué técnica ayurvédica utiliza un hilo de aceite tibio sobre la frente?', options: ['Shirodhara', 'Shiatsu', 'Lomi Lomi', 'Gua Sha'], correct: 0 },
  { cat:'spa', q: '¿Qué herramienta de piedra se usa en terapias faciales orientales?', options: ['Gua Sha', 'Bisturí', 'Rodillo de metal frío', 'Todas son correctas salvo el bisturí'], correct: 3 },
  { cat:'spa', q: '¿Qué buscan principalmente los rituales "premium" de spa?', options: ['Rapidez', 'Inmersión sensorial completa', 'Solo estética', 'Solo relajación muscular'], correct: 1 },
  { cat:'spa', q: '¿Qué tipo de música se prefiere en un ambiente de spa relajante?', options: ['Heavy metal', 'Ambient o instrumental suave', 'Reguetón a alto volumen', 'Silencio absoluto siempre'], correct: 1 },

  /* ---- Curiosidades de bienestar y salud ---- */
  { cat:'salud', q: '¿Cuántas horas de sueño se recomiendan en promedio para un adulto?', options: ['4-5 horas', '7-9 horas', '10-12 horas', '2-3 horas'], correct: 1 },
  { cat:'salud', q: '¿Qué hormona se asocia comúnmente con el estrés crónico?', options: ['Cortisol', 'Insulina', 'Melatonina', 'Adrenalina únicamente'], correct: 0 },
  { cat:'salud', q: '¿Qué práctica de respiración ayuda a reducir la ansiedad rápidamente?', options: ['Respiración superficial rápida', 'Respiración profunda y lenta', 'Contener el aire por minutos', 'Ninguna ayuda'], correct: 1 },
  { cat:'salud', q: '¿Qué actividad libera endorfinas de forma natural?', options: ['Ejercicio físico', 'Ver televisión', 'Ayunar', 'Estar en silencio total'], correct: 0 },
  { cat:'salud', q: '¿Qué porcentaje del cuerpo humano es agua aproximadamente?', options: ['30%', '50%', '60%', '90%'], correct: 2 },
  { cat:'salud', q: '¿Qué mineral se pierde comúnmente con el sudor durante el ejercicio?', options: ['Hierro', 'Sodio', 'Oro', 'Cobre'], correct: 1 },
  { cat:'salud', q: '¿Qué beneficio aporta principalmente el estiramiento post-ejercicio?', options: ['Reduce la flexibilidad', 'Ayuda a la recuperación muscular', 'Aumenta el riesgo de lesión', 'No tiene beneficios'], correct: 1 },
  { cat:'salud', q: '¿Qué vitamina se sintetiza principalmente con la exposición al sol?', options: ['Vitamina C', 'Vitamina D', 'Vitamina B12', 'Vitamina K'], correct: 1 },
  { cat:'salud', q: '¿Qué efecto tiene la meditación regular sobre el estrés, según estudios comunes?', options: ['Lo aumenta', 'No tiene efecto', 'Tiende a reducirlo', 'Lo elimina por completo siempre'], correct: 2 },
  { cat:'salud', q: '¿Cuál de estas es una técnica común de manejo del estrés?', options: ['Mindfulness', 'Multitarea extrema', 'Cafeína en exceso', 'Aislamiento total'], correct: 0 },
  { cat:'salud', q: '¿Qué articulación soporta más carga al estar sentado muchas horas?', options: ['Muñeca', 'Columna lumbar', 'Codo', 'Tobillo'], correct: 1 },
  { cat:'salud', q: '¿Qué gesto común empeora la tensión cervical frente a una pantalla?', options: ['Mantener la vista al nivel de los ojos', 'Inclinar el cuello hacia adelante por horas', 'Parpadear seguido', 'Sentarse erguido'], correct: 1 },
  { cat:'salud', q: '¿Qué se recomienda hacer cada cierto tiempo si trabajas muchas horas sentado?', options: ['Levantarse y moverse', 'No moverse nunca', 'Dormir en el escritorio', 'Comer sin parar'], correct: 0 },
  { cat:'salud', q: '¿Qué bebida es preferible para mantenerse hidratado durante el día?', options: ['Agua', 'Refresco azucarado', 'Café en exceso', 'Bebidas energéticas'], correct: 0 },
  { cat:'salud', q: '¿Qué parte del cerebro se asocia con la regulación del estrés y las emociones?', options: ['Cerebelo', 'Amígdala', 'Bulbo raquídeo', 'Retina'], correct: 1 },

  /* ---- Cultura general ligera ---- */
  { cat:'cultura', q: '¿Cuál es el océano más grande del planeta?', options: ['Atlántico', 'Índico', 'Pacífico', 'Ártico'], correct: 2 },
  { cat:'cultura', q: '¿En qué continente se encuentran las Islas Hawái?', options: ['Asia', 'Oceanía', 'América (territorio de EE. UU.)', 'África'], correct: 2 },
  { cat:'cultura', q: '¿Qué país es conocido como "la tierra del sol naciente"?', options: ['China', 'Japón', 'Tailandia', 'Corea del Sur'], correct: 1 },
  { cat:'cultura', q: '¿Cuál es el idioma más hablado del mundo por número de hablantes nativos?', options: ['Inglés', 'Español', 'Mandarín', 'Hindi'], correct: 2 },
  { cat:'cultura', q: '¿Qué instrumento se asocia tradicionalmente con la música relajante de meditación?', options: ['Batería', 'Cuencos tibetanos', 'Trompeta', 'Guitarra eléctrica'], correct: 1 },
  { cat:'cultura', q: '¿Qué país es cuna histórica del yoga?', options: ['India', 'Grecia', 'Egipto', 'México'], correct: 0 },
  { cat:'cultura', q: '¿Qué flor se asocia comúnmente con la aromaterapia calmante?', options: ['Girasol', 'Lavanda', 'Cactus', 'Diente de león'], correct: 1 },
  { cat:'cultura', q: '¿Qué civilización antigua es reconocida por sus baños termales públicos?', options: ['Los romanos', 'Los vikingos', 'Los mayas únicamente', 'Ninguna civilización antigua'], correct: 0 },
  { cat:'cultura', q: '¿Qué país es famoso por sus onsen (baños termales tradicionales)?', options: ['Japón', 'Canadá', 'Argentina', 'Marruecos'], correct: 0 },
  { cat:'cultura', q: '¿Qué significa la palabra "spa" según una teoría popular sobre su origen?', options: ['"Salus per aquam" (salud a través del agua)', 'Un acrónimo moderno de EE. UU.', 'Viene del japonés', 'No tiene ningún origen conocido'], correct: 0 },
  { cat:'cultura', q: '¿Qué país tiene la mayor cantidad de spas termales naturales de Europa?', options: ['Islandia', 'Portugal', 'Bélgica', 'Irlanda'], correct: 0 },
  { cat:'cultura', q: '¿Qué gemstone se usa a veces en rodillos faciales de belleza?', options: ['Cuarzo rosa', 'Carbón', 'Grafito', 'Yeso'], correct: 0 },

  /* ---- Guiños Gevizz (identidad de marca, tono ligero) ---- */
  { cat:'gevizz', q: '¿Qué área de Gevizz construyó Valtara?', options: ['Recursos Humanos', 'Dirección de Tecnología, Sistemas y Desarrollo', 'Contabilidad', 'Marketing'], correct: 1 },
  { cat:'gevizz', q: 'Según los créditos de Valtara, ¿qué representarán pronto las monedas del juego?', options: ['Nada, son solo puntos', 'Gevizz Coins canjeables', 'Boletos de rifa', 'Vidas extra'], correct: 1 },
  { cat:'gevizz', q: '¿Qué valor refleja mejor la filosofía detrás de Valtara?', options: ['Competencia agresiva', 'El bienestar del equipo importa', 'Trabajar sin descanso', 'La velocidad sobre todo'], correct: 1 },
  { cat:'gevizz', q: 'En el espíritu de Valtara, ¿qué se considera un logro tan válido como cumplir una meta laboral?', options: ['Ignorar el descanso', 'Tomarse un momento para descansar', 'Trabajar el fin de semana', 'Ninguna de las anteriores'], correct: 1 },
  { cat:'gevizz', q: '¿Qué es lo primero que hace un buen equipo de tecnología antes de construir algo, según el espíritu de Valtara?', options: ['Escuchar el problema real', 'Escribir código sin planear', 'Improvisar sin pensar', 'Copiar sin entender'], correct: 0 }
];
V.TRIVIA_BANK = TRIVIA_BANK;

/* Cola anti-repetición: mezcla el banco y lo consume sin reemplazo,
   remezclando solo cuando se agota, para que las preguntas no se sientan
   repetitivas en sesiones largas. */
const TriviaQueue = (function () {
  let queue = [];
  function shuffled(arr) { return [...arr].sort(() => Math.random() - 0.5); }
  function next(filterFn) {
    const pool = filterFn ? TRIVIA_BANK.filter(filterFn) : TRIVIA_BANK;
    if (queue.length === 0 || !queue.every(q => pool.includes(q))) {
      queue = shuffled(pool);
    }
    return queue.pop();
  }
  return { next };
})();

const Trivia = (function () {
  function open(onDone) {
    const item = TriviaQueue.next();
    renderQuestion(item, onDone, false);
  }

  /* Trivia relámpago: temporizador visual, mayor bonus, mayor riesgo. */
  function openLightning(onDone) {
    const item = TriviaQueue.next();
    renderQuestion(item, onDone, true);
  }

  function renderQuestion(item, onDone, isLightning) {
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    let answered = false;
    let timerInterval = null;
    const TIME_LIMIT = 8;
    if (isLightning) Modal.setLocked(true);

    const optsHtml = order.map(i => `<button class="trivia-opt" data-idx="${i}">${escapeHtml(item.options[i])}</button>`).join('');
    const badge = isLightning ? '<div class="trivia-timer" id="trivia-timer">8</div>' : '';

    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">${isLightning ? '⚡ Trivia relámpago' : '✦ Momento trivia'}</div>
      <div class="modal-sub">${isLightning ? 'Responde rápido para el bonus doble. Si el tiempo se acaba, no hay penalización, pero tampoco premio.' : 'Bonus de monedas y reputación si aciertas. Sin penalización si fallas.'}</div>
      ${badge}
      <div class="trivia-q">${escapeHtml(item.q)}</div>
      <div id="trivia-opts">${optsHtml}</div>
    `);

    function resolve(idx) {
      if (answered) return;
      answered = true;
      clearInterval(timerInterval);
      if (isLightning) Modal.setLocked(false);
      const isCorrect = idx === item.correct;
      SoundEngine.sfxClick();

      V.$$('#trivia-opts .trivia-opt').forEach(b => {
        const bi = parseInt(b.dataset.idx, 10);
        if (bi === item.correct) b.classList.add('correct');
        else if (bi === idx) b.classList.add('wrong');
      });

      const s = State.get();
      const patch = { triviaAnswered: s.triviaAnswered + 1 };
      if (item.cat === 'gevizz') patch.gevizzTriviaSeen = (s.gevizzTriviaSeen || 0) + 1;

      if (isCorrect) {
        const coinBonus = isLightning ? 70 : 35;
        const repBonus = isLightning ? 10 : 5;
        patch.triviaCorrect = s.triviaCorrect + 1;
        patch.coins = s.coins + coinBonus;
        patch.reputation = s.reputation + repBonus;
        if (isLightning) patch.lightningTriviaCorrect = (s.lightningTriviaCorrect || 0) + 1;
        SoundEngine.sfxCoins();
        toast(`¡Correcto! +${coinBonus} ◈ y +${repBonus} reputación.`, isLightning ? '⚡' : '✦');
      } else if (idx === -1) {
        toast('Se acabó el tiempo. ¡Para la próxima!', '⏱️');
      } else {
        SoundEngine.sfxFail();
        toast('No era esa, ¡para la próxima!', '✦');
      }
      State.set(patch);
      V.HUD.refresh();
      Achievements.checkAll();

      setTimeout(() => {
        Modal.close();
        if (onDone) onDone();
      }, 1400);
    }

    V.$$('#trivia-opts .trivia-opt').forEach(btn => {
      btn.addEventListener('click', () => resolve(parseInt(btn.dataset.idx, 10)));
    });

    if (isLightning) {
      let timeLeft = TIME_LIMIT;
      const timerEl = V.$('#trivia-timer');
      timerInterval = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(timerInterval); resolve(-1); }
      }, 1000);
    }
  }

  return { open, openLightning };
})();
V.Trivia = Trivia;

/* ================================================================
   9b. MINI-JUEGOS — Ritmo de Manos & Memoria de Esencias
   ================================================================ */
const Minigames = (function () {

  /* ---- Ritmo de Manos ----
     Aparecen círculos objetivo con un anillo que se contrae. Hay que
     tocar el círculo cuando el anillo esté lo más cerca posible del
     tamaño final, para simular precisión de digitopuntura/masaje. */
  function openRhythm(onDone) {
    const ROUNDS = 6;
    let round = 0;
    let totalScore = 0;
    let roundActive = false;
    let spawnTimeout = null;
    Modal.setLocked(true);

    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">🎵 Ritmo de Manos</div>
      <div class="modal-sub">Toca cada punto de presión justo cuando el anillo dorado llegue a su tamaño final.</div>
      <div class="rhythm-score" id="rhythm-score-label">Ronda 0 / ${ROUNDS}</div>
      <div class="rhythm-stage" id="rhythm-stage"></div>
      <button class="btn-secondary" id="btn-rhythm-skip">Saltar mini-juego</button>
    `);

    const stage = V.$('#rhythm-stage');
    const scoreLabel = V.$('#rhythm-score-label');

    function spawnTarget() {
      if (round >= ROUNDS) return finish();
      round++;
      roundActive = true;
      scoreLabel.textContent = `Ronda ${round} / ${ROUNDS} · ${totalScore} pts`;

      const x = V.randInt(15, 85);
      const y = V.randInt(15, 85);
      const duration = V.randInt(11, 16) / 10; // 1.1s a 1.6s

      const target = document.createElement('div');
      target.className = 'rhythm-target';
      target.style.left = x + '%';
      target.style.top = y + '%';
      target.style.setProperty('--rhythm-duration', duration + 's');
      target.innerHTML = '<div class="ring"></div><div class="dot"></div>';
      stage.appendChild(target);

      const startTime = performance.now();
      function onHit() {
        if (!roundActive) return;
        roundActive = false;
        const elapsed = (performance.now() - startTime) / 1000;
        const diff = Math.abs(elapsed - duration);
        // Precisión: 100 si el toque coincide exacto, decae con la diferencia
        const precision = V.clamp(Math.round(100 - diff * 220), 0, 100);
        totalScore += precision;
        SoundEngine.sfxClick();

        const label = document.createElement('div');
        label.className = 'rhythm-hit-label';
        label.style.left = x + '%';
        label.style.top = y + '%';
        label.textContent = precision >= 85 ? '¡Perfecto!' : precision >= 50 ? 'Bien' : 'Flojo';
        stage.appendChild(label);
        setTimeout(() => label.remove(), 650);

        target.remove();
        spawnTimeout = setTimeout(spawnTarget, 450);
      }
      target.addEventListener('click', onHit);

      // Si no se toca a tiempo, el anillo termina y se cuenta como fallo (0 pts)
      setTimeout(() => {
        if (roundActive) {
          roundActive = false;
          target.remove();
          spawnTimeout = setTimeout(spawnTarget, 450);
        }
      }, duration * 1000 + 250);
    }

    function finish() {
      clearTimeout(spawnTimeout);
      Modal.setLocked(false);
      const avg = Math.round(totalScore / ROUNDS);
      const s = State.get();
      const coinGain = Math.round(avg * 1.6);
      const patch = {
        coins: s.coins + coinGain,
        minigamesPlayed: (s.minigamesPlayed || 0) + 1,
        bestRhythmScore: Math.max(s.bestRhythmScore || 0, avg)
      };
      State.set(patch);
      SoundEngine.sfxCoins();
      V.HUD.refresh();
      Achievements.checkAll();

      Modal.open(`
        <div class="modal-handle"></div>
        <div class="modal-title">🎵 ¡Ritmo completado!</div>
        <div class="modal-sub">Puntaje promedio: ${avg} / 100</div>
        <div class="stat-row"><span class="label">◈ Monedas ganadas</span><span class="value pos">+${coinGain}</span></div>
        <button class="btn-primary" id="btn-rhythm-done">Continuar</button>
      `);
      V.$('#btn-rhythm-done').addEventListener('click', () => {
        SoundEngine.sfxClick();
        Modal.close();
        if (onDone) onDone();
      });
    }

    V.$('#btn-rhythm-skip').addEventListener('click', () => {
      SoundEngine.sfxClick();
      clearTimeout(spawnTimeout);
      Modal.setLocked(false);
      Modal.close();
      if (onDone) onDone();
    });

    spawnTimeout = setTimeout(spawnTarget, 500);
  }

  /* ---- Memoria de Esencias ----
     Grid de 4x2 (8 cartas, 4 parejas) con símbolos de aromas. Encuentra
     todas las parejas antes de que se agote el tiempo. */
  const ESSENCE_SYMBOLS = ['🌙', '🪔', '🌊', '🌿', '🕯️', '🪵'];

  function openMemory(onDone) {
    const PAIRS = 4;
    const symbols = shuffleArr(ESSENCE_SYMBOLS).slice(0, PAIRS);
    const cards = shuffleArr([...symbols, ...symbols]).map((sym, i) => ({ id: i, sym, flipped: false, matched: false }));
    let firstPick = null;
    let lockBoard = false;
    let matchedCount = 0;
    let timeLeft = 30;
    let timerInterval = null;
    const startTime = performance.now();
    Modal.setLocked(true);

    function shuffleArr(arr) { return [...arr].sort(() => Math.random() - 0.5); }

    function render() {
      const grid = cards.map(c => `
        <div class="memory-card ${c.flipped ? 'flipped' : ''} ${c.matched ? 'matched' : ''}" data-id="${c.id}">
          <span class="mc-face">${(c.flipped || c.matched) ? c.sym : '✦'}</span>
        </div>`).join('');

      Modal.open(`
        <div class="modal-handle"></div>
        <div class="modal-title">🧴 Memoria de Esencias</div>
        <div class="modal-sub">Encuentra las 4 parejas de aromas antes de que se acabe el tiempo.</div>
        <div class="memory-header">
          <span class="memory-timer" id="memory-timer">⏱️ ${timeLeft}s</span>
          <span style="font-size:.78rem; color:var(--ivory-dim);">${matchedCount} / ${PAIRS} parejas</span>
        </div>
        <div class="memory-grid" id="memory-grid">${grid}</div>
        <button class="btn-secondary" id="btn-memory-skip">Saltar mini-juego</button>
      `);

      V.$$('.memory-card').forEach(el => {
        el.addEventListener('click', () => handlePick(parseInt(el.dataset.id, 10)));
      });
      V.$('#btn-memory-skip').addEventListener('click', () => {
        SoundEngine.sfxClick();
        clearInterval(timerInterval);
        Modal.setLocked(false);
        Modal.close();
        if (onDone) onDone();
      });
    }

    function handlePick(id) {
      if (lockBoard) return;
      const card = cards.find(c => c.id === id);
      if (!card || card.flipped || card.matched) return;
      card.flipped = true;
      SoundEngine.sfxClick();
      render();

      if (firstPick === null) {
        firstPick = card;
        return;
      }

      lockBoard = true;
      if (firstPick.sym === card.sym) {
        firstPick.matched = true;
        card.matched = true;
        matchedCount++;
        SoundEngine.sfxCoins();
        firstPick = null;
        lockBoard = false;
        render();
        if (matchedCount >= PAIRS) finish(true);
      } else {
        setTimeout(() => {
          firstPick.flipped = false;
          card.flipped = false;
          firstPick = null;
          lockBoard = false;
          render();
        }, 700);
      }
    }

    function finish(won) {
      clearInterval(timerInterval);
      Modal.setLocked(false);
      const elapsed = (performance.now() - startTime) / 1000;
      const s = State.get();
      const patch = { minigamesPlayed: (s.minigamesPlayed || 0) + 1 };
      let coinGain = 0, repGain = 0;
      if (won) {
        coinGain = Math.max(20, Math.round(120 - elapsed * 2));
        repGain = 8;
        patch.coins = s.coins + coinGain;
        patch.reputation = s.reputation + repGain;
        patch.bestMemoryTime = (s.bestMemoryTime == null) ? elapsed : Math.min(s.bestMemoryTime, elapsed);
      }
      State.set(patch);
      if (won) SoundEngine.sfxAchievement(); else SoundEngine.sfxFail();
      V.HUD.refresh();
      Achievements.checkAll();

      Modal.open(`
        <div class="modal-handle"></div>
        <div class="modal-title">${won ? '🧴 ¡Esencias encontradas!' : '⏱️ Se acabó el tiempo'}</div>
        <div class="modal-sub">${won ? `Lo lograste en ${elapsed.toFixed(1)}s.` : 'No alcanzaste a encontrar todas las parejas. ¡La próxima será!'}</div>
        ${won ? `<div class="stat-row"><span class="label">◈ Monedas ganadas</span><span class="value pos">+${coinGain}</span></div>
        <div class="stat-row"><span class="label">✦ Reputación ganada</span><span class="value pos">+${repGain}</span></div>` : ''}
        <button class="btn-primary" id="btn-memory-done">Continuar</button>
      `);
      V.$('#btn-memory-done').addEventListener('click', () => {
        SoundEngine.sfxClick();
        Modal.close();
        if (onDone) onDone();
      });
    }

    render();
    timerInterval = setInterval(() => {
      timeLeft--;
      const timerEl = V.$('#memory-timer');
      if (timerEl) timerEl.textContent = `⏱️ ${timeLeft}s`;
      if (timeLeft <= 0) { clearInterval(timerInterval); finish(false); }
    }, 1000);
  }

  /* Selector accesible desde el menú principal: permite jugar cualquiera
     de los dos mini-juegos libremente, sin depender de que aparezcan
     como evento aleatorio durante la recepción. */
  function openSelector() {
    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">🎲 Mini-juegos de Valtara</div>
      <div class="modal-sub">Juega libremente y gana monedas y reputación extra para tu spa.</div>
      <button class="pause-menu-btn" id="btn-select-rhythm"><span class="pm-ic">🎵</span>Ritmo de Manos</button>
      <button class="pause-menu-btn" id="btn-select-memory"><span class="pm-ic">🧴</span>Memoria de Esencias</button>
      <button class="btn-secondary" id="btn-select-close">Cerrar</button>
    `);
    function finishAndResume() {
      Modal.close();
      if (Reception.currentProfile && !Reception.interactionOpen) {
        Reception.resumeInteraction();
      } else if (!Reception.interactionOpen && !Reception.currentProfile) {
        Reception.bringNextCustomer();
      }
    }
    V.$('#btn-select-rhythm').addEventListener('click', () => { SoundEngine.sfxClick(); openRhythm(finishAndResume); });
    V.$('#btn-select-memory').addEventListener('click', () => { SoundEngine.sfxClick(); openMemory(finishAndResume); });
    V.$('#btn-select-close').addEventListener('click', () => {
      SoundEngine.sfxClick();
      finishAndResume();
    });
  }

  return { openRhythm, openMemory, openSelector };
})();
V.Minigames = Minigames;

/* ================================================================
   10. LOGROS
   ================================================================ */
const ACHIEVEMENTS = [
  { id:'ach-01', name:'Primeros pasos', icon:'🌱', tier:'bronce', desc:'Atiende a 10 clientes.', check:(s)=> s.clientsServed >= 10 },
  { id:'ach-02', name:'Spa de confianza', icon:'🧑‍🤝‍🧑', tier:'plata', desc:'Atiende a 50 clientes.', check:(s)=> s.clientsServed >= 50 },
  { id:'ach-02b', name:'Spa de referencia', icon:'🏆', tier:'oro', desc:'Atiende a 150 clientes.', check:(s)=> s.clientsServed >= 150 },
  { id:'ach-03', name:'Equipo completo', icon:'👥', tier:'plata', desc:'Contrata a todo el personal.', check:(s)=> s.staff.length >= STAFF_ROSTER.length },
  { id:'ach-04', name:'En racha', icon:'🔥', tier:'bronce', desc:'Alcanza una racha de 10 diagnósticos perfectos.', check:(s)=> s.bestStreak >= 10 },
  { id:'ach-04b', name:'Racha legendaria', icon:'💥', tier:'oro', desc:'Alcanza una racha de 25 diagnósticos perfectos.', check:(s)=> s.bestStreak >= 25 },
  { id:'ach-05', name:'Spa boutique', icon:'✦', tier:'plata', desc:'Instala todas las mejoras.', check:(s)=> s.upgrades.length >= UPGRADES.length },
  { id:'ach-06', name:'Mente de bienestar', icon:'🧠', tier:'bronce', desc:'Responde correctamente 5 trivias.', check:(s)=> s.triviaCorrect >= 5 },
  { id:'ach-06b', name:'Enciclopedia del bienestar', icon:'📚', tier:'oro', desc:'Responde correctamente 30 trivias.', check:(s)=> s.triviaCorrect >= 30 },
  { id:'ach-07', name:'Una semana de Valtara', icon:'☾', tier:'bronce', desc:'Llega al día 7.', check:(s)=> s.day >= 7 },
  { id:'ach-07b', name:'Un mes de Valtara', icon:'🗓️', tier:'oro', desc:'Llega al día 30.', check:(s)=> s.day >= 30 },
  { id:'ach-08', name:'Primera cabina', icon:'🚪', tier:'bronce', desc:'Construye tu primera cabina especializada.', check:(s)=> (s.cabins||[]).length >= 1 },
  { id:'ach-09', name:'Spa de cuatro cabinas', icon:'🏛️', tier:'oro', desc:'Construye las 4 cabinas del spa.', check:(s)=> (s.cabins||[]).length >= CABINS.length },
  { id:'ach-10', name:'Rayo de conocimiento', icon:'⚡', tier:'plata', desc:'Responde 5 trivias relámpago correctamente.', check:(s)=> (s.lightningTriviaCorrect||0) >= 5 },
  { id:'ach-11', name:'Alma Gevizz', icon:'💚', tier:'bronce', desc:'Responde una trivia sobre Gevizz.', check:(s)=> (s.gevizzTriviaSeen||0) >= 1 },
  { id:'ach-12', name:'Propinas generosas', icon:'💝', tier:'plata', desc:'Acumula 300 ◈ en propinas.', check:(s)=> (s.totalTipsReceived||0) >= 300 },
  { id:'ach-13', name:'Ritmo perfecto', icon:'🎵', tier:'plata', desc:'Consigue 90+ de puntaje en Ritmo de Manos.', check:(s)=> (s.bestRhythmScore||0) >= 90 },
  { id:'ach-14', name:'Memoria de esencias', icon:'🧴', tier:'plata', desc:'Completa el juego de Memoria de Esencias.', check:(s)=> s.bestMemoryTime != null },
  { id:'ach-15', name:'Explorador de juegos', icon:'🎲', tier:'bronce', desc:'Juega 5 mini-juegos.', check:(s)=> (s.minigamesPlayed||0) >= 5 },
  { id:'ach-16', name:'Reputación de leyenda', icon:'👑', tier:'oro', desc:'Alcanza el título "Santuario Valtara".', check:(s)=> s.reputation >= 1500 },
  { id:'ach-17', name:'Meta semanal cumplida', icon:'📅', tier:'plata', desc:'Cumple tu primera meta semanal.', check:(s)=> (s.weeklyGoalClaimed||0) >= 1 },
  { id:'ach-18', name:'Cazador de detalles', icon:'🔍', tier:'oro', desc:'Encuentra al cliente secreto de Valtara.', check:(s)=> !!s.foundSecretClient }
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
          SoundEngine.sfxAchievement();
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
    const spaTitle = spaTitleFor(s.reputation);
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
      <div class="stat-row"><span class="label">🏛️ Título del spa</span><span class="value" style="font-size:.8rem;">${escapeHtml(spaTitle)}</span></div>
      <button class="btn-primary" id="btn-next-day">Comenzar día ${s.day + 1}</button>
    `);
    V.$('#btn-next-day').addEventListener('click', () => {
      SoundEngine.sfxClick();
      const repFromStaff = Staff.getReputationPerDay();
      const patch = { day: s.day + 1, clientsToday: 0 };
      if (repFromStaff > 0) patch.reputation = s.reputation + repFromStaff;
      State.set(patch);
      Modal.close();
      V.HUD.refresh();
      if (repFromStaff > 0) toast(`Tu equipo suma +${repFromStaff} de reputación pasiva.`, '✨');
      checkWeeklyGoal();
      Reception.bringNextCustomer();
    });
  }

  /* Título honorífico del spa según reputación acumulada — refuerza la
     sensación de progresión más allá del número crudo. */
  const SPA_TITLES = [
    { min: 0, title: 'Rincón de bienestar' },
    { min: 150, title: 'Casa de descanso Valtara' },
    { min: 400, title: 'Spa boutique Valtara' },
    { min: 800, title: 'Retiro de bienestar Valtara' },
    { min: 1500, title: 'Santuario Valtara' },
    { min: 2600, title: 'Santuario Valtara de Prestigio' },
    { min: 4200, title: 'Leyenda del bienestar · Valtara' }
  ];
  function spaTitleFor(reputation) {
    let current = SPA_TITLES[0].title;
    for (const t of SPA_TITLES) { if (reputation >= t.min) current = t.title; }
    return current;
  }

  /* Meta semanal: cada 7 días, si el jugador atendió suficientes clientes
     en la semana recién cerrada, recibe una recompensa única por semana. */
  function checkWeeklyGoal() {
    const s = State.get();
    const weekNumber = Math.floor((s.day - 1) / 7);
    if (weekNumber < 1) return; // aún no se completa una primera semana
    if (s.weeklyGoalClaimed >= weekNumber) return;
    const target = 30 + (weekNumber - 1) * 10;
    if (s.clientsServed >= target) {
      const reward = 200 + weekNumber * 40;
      State.set({ coins: s.coins + reward, weeklyGoalClaimed: weekNumber });
      SoundEngine.sfxAchievement();
      toast(`Meta semanal cumplida: +${reward} ◈`, '📅', 'achievement');
    } else {
      State.set({ weeklyGoalClaimed: weekNumber });
    }
  }

  return { endDay, renderDayMap, spaTitleFor };
})();
V.DayCycle = DayCycle;

/* ================================================================
   MODAL genérico (hoja inferior)
   ================================================================ */
const Modal = (function () {
  let locked = false;
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
  function setLocked(v) { locked = v; }
  function isLocked() { return locked; }
  return { open, close, setLocked, isLocked };
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
   11b. CATÁLOGO DE RECOMPENSAS
   ================================================================ */
const REWARD_TIERS = [
  { threshold: 100000, icon: '🌸', name: 'Esencia a tu elección', desc: 'Canjea 100,000 ◈ por la esencia aromática que prefieras.' },
  { threshold: 500000, icon: '🕯️', name: 'Vela aromática a tu elección', desc: 'Canjea 500,000 ◈ por una vela aromática de tu elección.' },
  { threshold: 1000000, icon: '🎁', name: 'Regalo sorpresa', desc: 'Al llegar a 1,000,000 ◈ te tenemos preparado un regalo sorpresa que el equipo asignará directamente.', showClaim: true },
  { threshold: 1500000, icon: '🏆', name: 'Diploma Valtara + sesión de esferas chinas con aromaterapia', desc: 'Completa todos los logros y alcanza 1,500,000 ◈ para obtener tu diploma Valtara y una sesión gratuita de esferas chinas con aromaterapia.', requiresAllAchievements: true, showClaim: true }
];
V.REWARD_TIERS = REWARD_TIERS;

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
    V.$('#btn-close-modal').addEventListener('click', () => { SoundEngine.sfxClick(); Modal.close(); });
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
    V.$('#btn-close-modal').addEventListener('click', () => { SoundEngine.sfxClick(); Modal.close(); });
  }

  function renderStats() {
    const s = State.get();
    const total = s.perfectMatches + s.wrongMatches;
    const accuracy = total > 0 ? Math.round((s.perfectMatches / total) * 100) : 0;
    const spaTitle = DayCycle.spaTitleFor(s.reputation);

    const achvRows = ACHIEVEMENTS.map(a => {
      const unlocked = s.achievements.includes(a.id);
      return `
        <div class="achv-row ${unlocked ? '' : 'locked'}">
          <div class="achv-icon">${a.icon}</div>
          <div class="achv-info">
            <div class="a-name">${escapeHtml(a.name)} <span class="achv-tier ${a.tier}">${a.tier}</span></div>
            <div class="a-desc">${escapeHtml(a.desc)}</div>
          </div>
        </div>`;
    }).join('');

    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">Tu progreso</div>
      <div class="modal-sub">${escapeHtml(spaTitle)}</div>
      ${DayCycle.renderDayMap(s.day)}
      <div class="stat-row"><span class="label">☾ Día actual</span><span class="value">${s.day}</span></div>
      <div class="stat-row"><span class="label">◈ Monedas</span><span class="value">${s.coins.toLocaleString('es-MX')}</span></div>
      <div class="stat-row"><span class="label">✦ Reputación</span><span class="value">${s.reputation}</span></div>
      <div class="stat-row"><span class="label">🧑‍🤝‍🧑 Clientes atendidos</span><span class="value">${s.clientsServed}</span></div>
      <div class="stat-row"><span class="label">🎯 Precisión de diagnóstico</span><span class="value pos">${accuracy}%</span></div>
      <div class="stat-row"><span class="label">🔥 Mejor racha</span><span class="value">${s.bestStreak}</span></div>
      <div class="stat-row"><span class="label">👥 Personal contratado</span><span class="value">${s.staff.length} / ${STAFF_ROSTER.length}</span></div>
      <div class="stat-row"><span class="label">✨ Mejoras instaladas</span><span class="value">${s.upgrades.length} / ${UPGRADES.length}</span></div>
      <div class="stat-row"><span class="label">🚪 Cabinas construidas</span><span class="value">${(s.cabins||[]).length} / ${CABINS.length}</span></div>
      <div class="stat-row"><span class="label">💝 Propinas acumuladas</span><span class="value pos">◈ ${(s.totalTipsReceived||0).toLocaleString('es-MX')}</span></div>
      <button class="btn-primary" id="btn-open-rewards">✦ Ver catálogo de recompensas</button>
      <div class="settings-group-title" style="margin-top:18px;">Logros (${s.achievements.length} / ${ACHIEVEMENTS.length})</div>
      ${achvRows}
      <button class="btn-secondary" id="btn-close-modal">Cerrar</button>
    `);
    V.$('#btn-open-rewards').addEventListener('click', () => { SoundEngine.sfxClick(); renderRewards(); });
    V.$('#btn-close-modal').addEventListener('click', () => { SoundEngine.sfxClick(); Modal.close(); });
  }

  function renderRewards() {
    const s = State.get();
    const rows = REWARD_TIERS.map(tier => {
      const reached = s.coins >= tier.threshold;
      const allAchvDone = tier.requiresAllAchievements ? s.achievements.length >= ACHIEVEMENTS.length : true;
      const unlocked = reached && allAchvDone;
      return `
        <div class="reward-tier ${unlocked ? 'unlocked' : ''}">
          <div class="reward-tier-icon">${tier.icon}</div>
          <div class="reward-tier-info">
            <div class="rt-threshold">${tier.threshold.toLocaleString('es-MX')} ◈${tier.requiresAllAchievements ? ' + todos los logros' : ''}</div>
            <div class="rt-name">${escapeHtml(tier.name)}</div>
            <div class="rt-desc">${escapeHtml(tier.desc)}</div>
          </div>
          ${unlocked ? `<div class="rt-badge">✓ Alcanzado</div>` : ''}
        </div>
        ${unlocked && tier.showClaim ? `
        <div class="reward-claim">
          <p>Toma una captura de pantalla de esto y envíala a nuestro equipo para coordinar tu recompensa.</p>
          <a class="reward-whatsapp-btn" href="https://wa.me/523348572070" target="_blank" rel="noopener">💬 Escribir por WhatsApp</a>
        </div>` : ''}
      `;
    }).join('');

    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">✦ Catálogo de recompensas</div>
      <div class="modal-sub">Tus monedas ◈ se convertirán en Gevizz Coins, saldo real canjeable por estos beneficios. Sigue jugando para desbloquear cada nivel.</div>
      <div class="reward-current">Tienes <b>${s.coins.toLocaleString('es-MX')} ◈</b> acumuladas</div>
      ${rows}
      <button class="btn-secondary" id="btn-rewards-back">Volver a tu progreso</button>
    `);
    V.$('#btn-rewards-back').addEventListener('click', () => { SoundEngine.sfxClick(); renderStats(); });
  }

  function renderCabins() {
    const s = State.get();
    const rows = CABINS.map(c => {
      const owned = Cabins.isOwned(c.id);
      const affordable = s.coins >= c.cost;
      const locked = c.id === 'cb-04' && !Staff.isOwned('sf-10');
      return `
        <div class="upgrade-row">
          <div class="upgrade-icon">${c.icon}</div>
          <div class="upgrade-info">
            <div class="u-name">${escapeHtml(c.name)}</div>
            <div class="u-desc">${escapeHtml(c.desc)}${locked ? ' <i>(requiere Directora de Spa)</i>' : ''}</div>
          </div>
          <button class="upgrade-buy ${owned ? 'owned' : ''}" data-cabin="${c.id}" ${owned || !affordable || locked ? 'disabled' : ''}>
            ${owned ? 'Lista' : '◈ ' + c.cost}
          </button>
        </div>`;
    }).join('');

    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">Cabinas de Valtara</div>
      <div class="modal-sub">Salas especializadas que potencian tratamientos de su categoría.</div>
      ${rows}
      <button class="btn-secondary" id="btn-close-modal">Cerrar</button>
    `);
    V.$$('[data-cabin]').forEach(btn => {
      btn.addEventListener('click', () => { Cabins.buy(btn.dataset.cabin); renderCabins(); });
    });
    V.$('#btn-close-modal').addEventListener('click', () => { SoundEngine.sfxClick(); Modal.close(); });
  }

  return { renderStaff, renderUpgrades, renderStats, renderCabins, renderRewards };
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
      SoundEngine.sfxClick();
      if (isLast) {
        State.set({ seenTutorial: true });
        Modal.close();
      } else {
        idx++;
        render();
      }
    });
    const backBtn = V.$('#btn-tut-back');
    if (backBtn) backBtn.addEventListener('click', () => { SoundEngine.sfxClick(); idx--; render(); });
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
    SoundEngine.start();
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
    if (isPaused || Modal.isLocked()) return;
    isPaused = true;
    Reception.pause();
    Modal.open(`
      <div class="modal-handle"></div>
      <div class="modal-title">Pausa</div>
      <div class="modal-sub">Valtara espera tu regreso.</div>
      <button class="pause-menu-btn" id="btn-pause-resume"><span class="pm-ic">▶</span>Reanudar</button>
      <button class="pause-menu-btn" id="btn-pause-minigames"><span class="pm-ic">🎲</span>Mini-juegos</button>
      <button class="pause-menu-btn" id="btn-pause-settings"><span class="pm-ic">⚙</span>Ajustes</button>
      <button class="pause-menu-btn" id="btn-pause-restart-day"><span class="pm-ic">↺</span>Reiniciar día</button>
      <button class="pause-menu-btn" id="btn-pause-menu"><span class="pm-ic">☰</span>Menú principal</button>
    `);
    V.$('#btn-pause-resume').addEventListener('click', closePause);
    V.$('#btn-pause-minigames').addEventListener('click', () => {
      SoundEngine.sfxClick();
      isPaused = false;
      Minigames.openSelector();
    });
    V.$('#btn-pause-settings').addEventListener('click', () => {
      SoundEngine.sfxClick();
      Modal.close();
      isPaused = false;
      goSettings('screen-game');
    });
    V.$('#btn-pause-restart-day').addEventListener('click', () => {
      SoundEngine.sfxClick();
      State.set({ clientsToday: 0 });
      Modal.close();
      isPaused = false;
      HUD.refresh();
      Reception.bringNextCustomer();
    });
    V.$('#btn-pause-menu').addEventListener('click', () => {
      SoundEngine.sfxClick();
      Modal.close();
      isPaused = false;
      goMenu();
    });
  }
  function closePause() {
    SoundEngine.sfxClick();
    Modal.close();
    isPaused = false;
    if (Reception.currentProfile && !Reception.interactionOpen) {
      // Había un cliente esperando cuando se pausó: reabre su panel de tratamientos
      // en vez de traer a otro cliente nuevo.
      Reception.resumeInteraction();
    } else if (!Reception.interactionOpen && !Reception.currentProfile) {
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
      SoundEngine.setMusicVolume(v);
    });
    sfxSlider.addEventListener('input', () => {
      const v = sfxSlider.value / 100;
      V.$('#slider-sfx-val').textContent = sfxSlider.value;
      SoundEngine.setSfxVolume(v);
    });

    V.$('#toggle-mute').addEventListener('click', () => {
      const isOn = !State.get().settings.muted;
      SoundEngine.setMuted(isOn);
      render();
    });
    V.$('#toggle-skip').addEventListener('click', () => {
      State.setSettings({ dialogueSkip: !State.get().settings.dialogueSkip });
      SoundEngine.sfxClick();
      render();
    });
    V.$('#toggle-contrast').addEventListener('click', () => {
      const isOn = !State.get().settings.contrastMode;
      State.setSettings({ contrastMode: isOn });
      document.body.classList.toggle('contrast-mode', isOn);
      SoundEngine.sfxClick();
      render();
    });
    V.$$('[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        State.setSettings({ language: btn.dataset.lang });
        SoundEngine.sfxClick();
        render();
      });
    });

    V.$('#btn-settings-reset').addEventListener('click', () => {
      SoundEngine.sfxClick();
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
      V.$('#btn-cancel-reset').addEventListener('click', () => { SoundEngine.sfxClick(); Modal.close(); });
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
    cabins: V.$('#nav-cabins'),
    stats: V.$('#nav-stats')
  };

  function setActive(view) {
    Object.keys(buttons).forEach(k => buttons[k].classList.toggle('active', k === view));
  }

  buttons.reception.addEventListener('click', () => { SoundEngine.sfxClick(); setActive('reception'); Modal.close(); });
  buttons.staff.addEventListener('click', () => { SoundEngine.sfxClick(); setActive('reception'); Views.renderStaff(); });
  buttons.upgrades.addEventListener('click', () => { SoundEngine.sfxClick(); setActive('reception'); Views.renderUpgrades(); });
  buttons.cabins.addEventListener('click', () => { SoundEngine.sfxClick(); setActive('reception'); Views.renderCabins(); });
  buttons.stats.addEventListener('click', () => { SoundEngine.sfxClick(); setActive('reception'); Views.renderStats(); });

  V.$('#modal-backdrop').addEventListener('click', Modal.close);
  V.$('#btn-pause').addEventListener('click', () => { SoundEngine.sfxClick(); Screens.openPause(); });
}

function wireMenuNav() {
  V.$('#btn-menu-play').addEventListener('click', () => {
    SoundEngine.start();
    SoundEngine.sfxClick();
    Screens.goGame(true);
  });
  V.$('#btn-menu-continue').addEventListener('click', () => {
    SoundEngine.start();
    SoundEngine.sfxClick();
    State.load();
    Screens.goGame(false);
  });
  V.$('#btn-menu-minigames').addEventListener('click', () => {
    SoundEngine.start();
    SoundEngine.sfxClick();
    State.load();
    Screens.goGame(false);
    setTimeout(() => Minigames.openSelector(), 350);
  });
  V.$('#btn-menu-settings').addEventListener('click', () => { SoundEngine.start(); SoundEngine.sfxClick(); Screens.goSettings(); });
  V.$('#btn-menu-credits').addEventListener('click', () => { SoundEngine.start(); SoundEngine.sfxClick(); Screens.goCredits(); });

  V.$('#btn-settings-back').addEventListener('click', () => {
    SoundEngine.sfxClick();
    Screens.settingsBack();
  });
  V.$('#btn-credits-back').addEventListener('click', () => { SoundEngine.sfxClick(); Screens.goMenu(); });
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
    SoundEngine.start();
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
