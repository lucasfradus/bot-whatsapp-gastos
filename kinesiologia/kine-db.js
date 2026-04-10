const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..');
const db = new Database(path.join(dataDir, 'kine.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS motivos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id  INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    sintoma      TEXT NOT NULL,
    aparicion    TEXT,
    momento_dia  TEXT,
    movimientos  TEXT,
    afloja_dia   INTEGER DEFAULT 0,
    monto_sesion REAL DEFAULT 0,
    estado       TEXT DEFAULT 'activo',
    created_at   TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS evoluciones (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    motivo_id      INTEGER NOT NULL REFERENCES motivos(id) ON DELETE CASCADE,
    fecha          TEXT NOT NULL,
    notas          TEXT,
    dolor          INTEGER,
    tecnicas       TEXT,
    monto_cobrado  REAL DEFAULT 0,
    pagado         INTEGER DEFAULT 0,
    created_at     TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS estudios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    motivo_id   INTEGER NOT NULL REFERENCES motivos(id) ON DELETE CASCADE,
    nombre      TEXT,
    tipo        TEXT,
    archivo     TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS turnos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER REFERENCES pacientes(id) ON DELETE CASCADE,
    fecha       TEXT NOT NULL,
    hora        TEXT NOT NULL,
    duracion    INTEGER DEFAULT 60,
    motivo      TEXT,
    estado      TEXT DEFAULT 'pendiente',
    notas       TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS documentos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    tipo        TEXT,
    archivo     TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    rol         TEXT NOT NULL DEFAULT 'paciente',
    nombre      TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS pacientes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre      TEXT NOT NULL,
    apellido    TEXT NOT NULL,
    dni         TEXT,
    fecha_nac   TEXT,
    telefono    TEXT,
    email       TEXT,
    obra_social TEXT,
    nro_afiliado TEXT,
    ocupacion   TEXT,
    direccion   TEXT,
    motivo_consulta TEXT,
    antecedentes    TEXT,
    medicacion      TEXT,
    alergias        TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS lesiones (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id   INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    descripcion   TEXT NOT NULL,
    diagnostico   TEXT,
    fecha_lesion  TEXT,
    fecha_ingreso TEXT,
    estado        TEXT DEFAULT 'activa',
    notas         TEXT,
    created_at    TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS sesiones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    lesion_id   INTEGER NOT NULL REFERENCES lesiones(id) ON DELETE CASCADE,
    fecha       TEXT NOT NULL,
    duracion    INTEGER,
    tecnicas    TEXT,
    evolucion   TEXT,
    notas       TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS ejercicios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    categoria   TEXT,
    video_url   TEXT,
    imagen_url  TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS paciente_ejercicios (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id  INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    ejercicio_id INTEGER NOT NULL REFERENCES ejercicios(id) ON DELETE CASCADE,
    series       INTEGER,
    repeticiones INTEGER,
    duracion_seg INTEGER,
    frecuencia   TEXT,
    notas        TEXT,
    fecha_desde  TEXT DEFAULT (date('now','localtime')),
    activo       INTEGER DEFAULT 1
  );
`);

// ── Migraciones seguras ───────────────────────────────────

const cols = db.prepare("PRAGMA table_info(sesiones)").all().map(c => c.name);
if (!cols.includes('tecnicas')) db.exec(`ALTER TABLE sesiones ADD COLUMN tecnicas TEXT`);
if (!cols.includes('evolucion')) db.exec(`ALTER TABLE sesiones ADD COLUMN evolucion TEXT`);

const colsPac = db.prepare("PRAGMA table_info(pacientes)").all().map(c => c.name);
if (!colsPac.includes('usuario_id')) db.exec(`ALTER TABLE pacientes ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL`);
if (!colsPac.includes('nro_afiliado')) db.exec(`ALTER TABLE pacientes ADD COLUMN nro_afiliado TEXT`);
if (!colsPac.includes('ocupacion')) db.exec(`ALTER TABLE pacientes ADD COLUMN ocupacion TEXT`);
if (!colsPac.includes('direccion')) db.exec(`ALTER TABLE pacientes ADD COLUMN direccion TEXT`);
if (!colsPac.includes('motivo_consulta')) db.exec(`ALTER TABLE pacientes ADD COLUMN motivo_consulta TEXT`);
if (!colsPac.includes('antecedentes')) db.exec(`ALTER TABLE pacientes ADD COLUMN antecedentes TEXT`);
if (!colsPac.includes('medicacion')) db.exec(`ALTER TABLE pacientes ADD COLUMN medicacion TEXT`);
if (!colsPac.includes('alergias')) db.exec(`ALTER TABLE pacientes ADD COLUMN alergias TEXT`);

const colsPacNuevos = db.prepare("PRAGMA table_info(pacientes)").all().map(c => c.name);
if (!colsPacNuevos.includes('edad'))   db.exec(`ALTER TABLE pacientes ADD COLUMN edad INTEGER`);
if (!colsPacNuevos.includes('celular')) db.exec(`ALTER TABLE pacientes ADD COLUMN celular TEXT`);

const colsSes = db.prepare("PRAGMA table_info(sesiones)").all().map(c => c.name);
if (!colsSes.includes('dolor')) db.exec(`ALTER TABLE sesiones ADD COLUMN dolor INTEGER`);

const colsEvol = db.prepare("PRAGMA table_info(evoluciones)").all().map(c => c.name);
if (!colsEvol.includes('tecnicas_sesion')) db.exec(`ALTER TABLE evoluciones ADD COLUMN tecnicas_sesion TEXT`);
if (!colsEvol.includes('ejercicios_sesion')) db.exec(`ALTER TABLE evoluciones ADD COLUMN ejercicios_sesion TEXT`);

const colsEj = db.prepare("PRAGMA table_info(ejercicios)").all().map(c => c.name);
if (!colsEj.includes('imagen_url')) db.exec(`ALTER TABLE ejercicios ADD COLUMN imagen_url TEXT`);

// ── Crear admin por defecto si no existe ──────────────────

const adminExiste = db.prepare("SELECT id FROM usuarios WHERE rol='admin' LIMIT 1").get();
if (!adminExiste) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare("INSERT INTO usuarios (email, password, rol, nombre) VALUES (?, ?, 'admin', 'Augusto Ciuró')").run('augusto@ciuro.com', hash);
  console.log('✅ Admin creado: augusto@ciuro.com / admin123');
}

// ── Seed ejercicios ────────────────────────────────────────

{
  const ins = db.prepare(`INSERT INTO ejercicios (nombre, descripcion, categoria, video_url) VALUES (@nombre, @descripcion, @categoria, @video_url)`);
  const seedAll = db.transaction((lista) => {
    db.exec(`DELETE FROM ejercicios`);
    for (const e of lista) ins.run(e);
  });

  const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

  seedAll([
    // ══ TOBILLO ═════════════════════════════════════════════
    // Tibial Anterior
    { nombre: 'Dorsiflexión con Banda', categoria: 'Tobillo · Tibial Anterior', descripcion: 'Sentado, banda en el empeine, llevar la punta del pie hacia la rodilla. Volver lento.', video_url: yt('dorsiflexión tobillo banda tibial anterior') },
    { nombre: 'Marcha sobre Talones', categoria: 'Tobillo · Tibial Anterior', descripcion: 'Caminar apoyando solo los talones con la punta elevada. Activación en cadena cerrada.', video_url: yt('marcha sobre talones tibial anterior') },
    { nombre: 'Dorsiflexión en Polea', categoria: 'Tobillo · Tibial Anterior', descripcion: 'Sentado frente a la polea baja, jalar la punta del pie hacia arriba contra resistencia.', video_url: yt('dorsiflexión tobillo polea tibial anterior') },
    // Peroneo Lateral
    { nombre: 'Eversión con Banda', categoria: 'Tobillo · Peroneo Lateral', descripcion: 'Sentado, banda en el pie, girar el tobillo hacia afuera (eversión) lentamente. Volver controlado.', video_url: yt('eversión tobillo banda peroneo lateral') },
    { nombre: 'Eversión en Polea', categoria: 'Tobillo · Peroneo Lateral', descripcion: 'De pie junto a la polea baja con tobillera, alejar el pie hacia afuera rotando el tobillo.', video_url: yt('eversión tobillo polea peroneo ejercicio') },
    { nombre: 'Marcha Lateral sobre Puntillas', categoria: 'Tobillo · Peroneo Lateral', descripcion: 'Caminar de lado en puntillas. Activa el peroneo en cadena cerrada.', video_url: yt('marcha lateral puntillas peroneo ejercicio') },
    // Sóleo
    { nombre: 'Elevación de Talones Sentado (máquina)', categoria: 'Tobillo · Sóleo', descripcion: 'Sentado con rodillas a 90°, elevar los talones contra la carga. El sóleo trabaja más con rodilla flexionada.', video_url: yt('elevación de talones sentado sóleo máquina') },
    { nombre: 'Elevación de Talones Sentado con Mancuerna', categoria: 'Tobillo · Sóleo', descripcion: 'Sentado, mancuerna sobre el muslo, elevar el talón. Rango completo.', video_url: yt('elevación de talones sentado mancuerna sóleo') },
    { nombre: 'Sentadilla Isométrica con Talones', categoria: 'Tobillo · Sóleo', descripcion: 'En posición de sentadilla parcial, elevar los talones y sostener. Sóleo en cadena cerrada.', video_url: yt('sentadilla isométrica talones sóleo ejercicio') },
    // Gemelos
    { nombre: 'Elevación de Talones de Pie (máquina)', categoria: 'Tobillo · Gemelos', descripcion: 'En la máquina de pantorrilla de pie, elevar al máximo y bajar por debajo del nivel de la plataforma.', video_url: yt('elevación de talones máquina de pie gemelos') },
    { nombre: 'Elevación de Talones en Escalón', categoria: 'Tobillo · Gemelos', descripcion: 'De pie en escalón, elevar y bajar lento superando el rango normal. Sostener arriba 1 seg.', video_url: yt('elevación de talones escalón gemelos técnica') },
    { nombre: 'Salto a la Soga', categoria: 'Tobillo · Gemelos', descripcion: 'Saltar con soga en puntillas. Alta activación de gemelos en cadena cerrada.', video_url: yt('salto soga gemelos ejercicio') },
    // ══ RODILLA ═════════════════════════════════════════════
    // Gemelos (rodilla)
    { nombre: 'Press de Piernas con Talones Altos', categoria: 'Rodilla · Gemelos', descripcion: 'Prensa con los talones en el borde inferior de la plataforma. Activa gemelos en cadena cerrada.', video_url: yt('press piernas talones gemelos técnica') },
    { nombre: 'Step Up con énfasis en puntillas', categoria: 'Rodilla · Gemelos', descripcion: 'Subir el escalón empujando desde la punta del pie. Activa gemelos funcionalmente.', video_url: yt('step up puntillas gemelos ejercicio') },
    { nombre: 'Elevación de Talones de Pie con Mancuerna', categoria: 'Rodilla · Gemelos', descripcion: 'De pie, mancuerna en una mano, elevar el talón. Versión unilateral para mayor intensidad.', video_url: yt('elevación de talones mancuerna gemelos unilateral') },
    // Isquiotibiales (rodilla)
    { nombre: 'Curl de Isquiotibiales acostado (máquina)', categoria: 'Rodilla · Isquiotibiales', descripcion: 'Boca abajo, doblar las rodillas llevando los talones hacia los glúteos. Controlar el descenso.', video_url: yt('curl isquiotibial máquina acostado técnica') },
    { nombre: 'Curl de Isquiotibiales sentado (máquina)', categoria: 'Rodilla · Isquiotibiales', descripcion: 'Sentado, doblar las rodillas bajo el asiento contra la resistencia. Controlar la vuelta.', video_url: yt('curl isquiotibial máquina sentado técnica') },
    { nombre: 'Nordic Curl (Curl Nórdico)', categoria: 'Rodilla · Isquiotibiales', descripcion: 'De rodillas con pies fijos, bajar el tronco lentamente con la fuerza excéntrica de los isquiotibiales.', video_url: yt('nordic curl isquiotibiales ejercicio técnica') },
    // Cuádriceps
    { nombre: 'Extensión de Cuádriceps (máquina)', categoria: 'Rodilla · Cuádriceps', descripcion: 'Sentado, extender las rodillas hasta la extensión completa. Bajar lento. Cadena abierta.', video_url: yt('leg extension máquina cuádriceps técnica') },
    { nombre: 'Prensa de Piernas', categoria: 'Rodilla · Cuádriceps', descripcion: 'Pies al ancho de caderas en la plataforma, empujar hasta casi extender la rodilla y bajar lento.', video_url: yt('leg press prensa de piernas técnica') },
    { nombre: 'Sentadilla con Barra', categoria: 'Rodilla · Cuádriceps', descripcion: 'Barra sobre trapecios, pies al ancho de hombros. Bajar hasta paralela. Empujar desde los talones.', video_url: yt('sentadilla con barra técnica correcta') },
    // Sartorio
    { nombre: 'Flexión de Cadera con Rodilla Rotada', categoria: 'Rodilla · Sartorio', descripcion: 'De pie, elevar la rodilla hacia el hombro opuesto (flexión + abducción + rotación externa). Movimiento del sartorio.', video_url: yt('sartorio ejercicio flexión cadera rotación') },
    { nombre: 'Sentadilla con Rodillas hacia Afuera', categoria: 'Rodilla · Sartorio', descripcion: 'Sentadilla con pies en rotación externa pronunciada. Activa sartorio en cadena cerrada.', video_url: yt('sentadilla rotación externa sartorio ejercicio') },
    { nombre: 'Cruce de Pierna Sentado', categoria: 'Rodilla · Sartorio', descripcion: 'Sentado, cruzar una pierna sobre la otra (posición de sastre). Sostener. Trabajo de sartorio.', video_url: yt('estiramiento sartorio posición sastre ejercicio') },
    // Aductores
    { nombre: 'Aducción de Cadera (máquina)', categoria: 'Rodilla · Aductores', descripcion: 'Sentado, juntar las piernas contra la resistencia. Controlar la apertura.', video_url: yt('aducción cadera máquina técnica') },
    { nombre: 'Sentadilla Sumo', categoria: 'Rodilla · Aductores', descripcion: 'Pies muy abiertos con puntas hacia afuera, bajar profundo. Gran activación de aductores.', video_url: yt('sentadilla sumo aductores técnica') },
    { nombre: 'Aducción en Polea', categoria: 'Rodilla · Aductores', descripcion: 'De pie con tobillera en polea baja, llevar la pierna hacia la línea media cruzando levemente.', video_url: yt('aducción cadera polea de pie técnica') },
    // ══ CADERA ══════════════════════════════════════════════
    // Glúteo Medio
    { nombre: 'Abducción de Cadera (máquina)', categoria: 'Cadera · Glúteo Medio', descripcion: 'Sentado, separar las piernas contra la resistencia. Controlar el cierre.', video_url: yt('abducción cadera máquina glúteo medio') },
    { nombre: 'Abducción en Polea de Pie', categoria: 'Cadera · Glúteo Medio', descripcion: 'De pie, tobillera en polea baja, alejar la pierna lateralmente sin inclinar el tronco.', video_url: yt('abducción cadera polea pie glúteo medio') },
    { nombre: 'Caminata con Banda (Monster Walk)', categoria: 'Cadera · Glúteo Medio', descripcion: 'Banda en las rodillas, posición semiflexionada, caminar hacia los lados. Glúteo medio en cadena cerrada.', video_url: yt('monster walk banda glúteo medio ejercicio') },
    // Glúteo Mayor
    { nombre: 'Hip Thrust con Barra', categoria: 'Cadera · Glúteo Mayor', descripcion: 'Espalda en banco, barra sobre caderas. Elevar la pelvis apretando glúteos. Bajar controlado.', video_url: yt('hip thrust barra glúteo mayor técnica') },
    { nombre: 'Patada Trasera en Polea', categoria: 'Cadera · Glúteo Mayor', descripcion: 'De pie frente a la polea, tobillera, llevar la pierna hacia atrás con rodilla recta.', video_url: yt('patada trasera polea glúteo mayor técnica') },
    { nombre: 'Sentadilla Búlgara', categoria: 'Cadera · Glúteo Mayor', descripcion: 'Pie trasero en banco, bajar la rodilla delantera hacia el piso. Gran activación de glúteo.', video_url: yt('sentadilla búlgara split squat glúteo técnica') },
    // Isquiotibiales (cadera)
    { nombre: 'Peso Muerto Rumano con Barra', categoria: 'Cadera · Isquiotibiales', descripcion: 'De pie con barra, bajar el torso con espalda recta y rodillas levemente flexionadas. Sentir el estiramiento en la parte posterior.', video_url: yt('peso muerto rumano barra isquiotibiales técnica') },
    { nombre: 'Peso Muerto Rumano con Mancuernas', categoria: 'Cadera · Isquiotibiales', descripcion: 'Igual al rumano con barra pero con mancuernas. Mayor rango de movimiento.', video_url: yt('peso muerto rumano mancuernas isquiotibiales técnica') },
    { nombre: 'Good Morning con Barra', categoria: 'Cadera · Isquiotibiales', descripcion: 'Barra sobre trapecios, doblar el tronco hacia adelante con espalda recta. Isquiotibiales y glúteo.', video_url: yt('good morning barra isquiotibiales ejercicio') },
    // Piramidal
    { nombre: 'Rotación Externa en Decúbito (Almeja)', categoria: 'Cadera · Piramidal', descripcion: 'De lado con rodillas flexionadas, abrir la rodilla de arriba como almeja. Activa piramidal y glúteo medio.', video_url: yt('ejercicio almeja piramidal rotación externa cadera') },
    { nombre: 'Estiramiento de Piramidal en Decúbito', categoria: 'Cadera · Piramidal', descripcion: 'Boca arriba, cruzar el tobillo sobre la rodilla opuesta y jalar la pierna hacia el pecho. Sostener 30 seg.', video_url: yt('estiramiento piramidal decúbito técnica') },
    { nombre: 'Rotación Externa con Banda', categoria: 'Cadera · Piramidal', descripcion: 'De pie o sentado, banda en las rodillas, rotar la cadera hacia afuera contra resistencia.', video_url: yt('rotación externa cadera banda piramidal ejercicio') },
    // ══ LUMBAR ══════════════════════════════════════════════
    // Cuadrado Lumbar
    { nombre: 'Plancha Lateral', categoria: 'Lumbar · Cuadrado Lumbar', descripcion: 'Apoyado en un antebrazo y el borde del pie, cuerpo en línea lateral. Sostener el tiempo indicado.', video_url: yt('plancha lateral cuadrado lumbar técnica') },
    { nombre: 'Inclinación Lateral con Mancuerna', categoria: 'Lumbar · Cuadrado Lumbar', descripcion: 'De pie, mancuerna en una mano, inclinar el tronco hacia el lado contrario y volver. Activa cuadrado lumbar.', video_url: yt('inclinación lateral mancuerna cuadrado lumbar') },
    { nombre: 'Elevación de Cadera en Plancha Lateral', categoria: 'Lumbar · Cuadrado Lumbar', descripcion: 'En plancha lateral, bajar y subir la cadera. Mayor trabajo del cuadrado lumbar.', video_url: yt('elevación cadera plancha lateral cuadrado lumbar') },
    // Glúteo Medio (lumbar)
    { nombre: 'Abducción Acostado', categoria: 'Lumbar · Glúteo Medio', descripcion: 'De lado en el suelo, elevar la pierna de arriba controlando. Trabajo del glúteo medio.', video_url: yt('abducción cadera acostado glúteo medio ejercicio') },
    { nombre: 'Hip Thrust Unilateral', categoria: 'Lumbar · Glúteo Medio', descripcion: 'Espalda en banco, elevar la pelvis con una sola pierna. Activa glúteo medio para estabilizar.', video_url: yt('hip thrust unilateral glúteo medio técnica') },
    { nombre: 'Caminata Lateral con Banda', categoria: 'Lumbar · Glúteo Medio', descripcion: 'Banda en las rodillas, pasos laterales en posición semi-squat. Activa glúteo medio en funcional.', video_url: yt('caminata lateral banda glúteo medio ejercicio') },
    // Glúteo Mayor (lumbar)
    { nombre: 'Puente de Glúteos', categoria: 'Lumbar · Glúteo Mayor', descripcion: 'Boca arriba, rodillas dobladas, elevar la pelvis apretando glúteos. Sostener arriba 2 seg.', video_url: yt('puente de glúteos técnica correcta') },
    { nombre: 'Hip Thrust con Barra (lumbar)', categoria: 'Lumbar · Glúteo Mayor', descripcion: 'Espalda en banco, barra sobre caderas. Elevar la pelvis con máxima contracción de glúteo.', video_url: yt('hip thrust barra glúteo técnica') },
    { nombre: 'Patada de Glúteo en Cuatro Apoyos', categoria: 'Lumbar · Glúteo Mayor', descripcion: 'En cuatro apoyos, llevar la pierna hacia atrás y arriba con rodilla flexionada. Lento y controlado.', video_url: yt('patada glúteo cuatro apoyos ejercicio') },
    // Isquiotibiales (lumbar)
    { nombre: 'Peso Muerto Convencional', categoria: 'Lumbar · Isquiotibiales', descripcion: 'Barra en el piso, empujar con los pies hasta quedar de pie. Isquiotibiales, glúteos y espalda baja.', video_url: yt('peso muerto convencional técnica correcta') },
    { nombre: 'Peso Muerto Rumano Unilateral', categoria: 'Lumbar · Isquiotibiales', descripcion: 'De pie en una pierna, inclinar el tronco hacia adelante con la otra pierna extendida hacia atrás.', video_url: yt('peso muerto rumano unilateral isquiotibiales técnica') },
    { nombre: 'Curl Nórdico', categoria: 'Lumbar · Isquiotibiales', descripcion: 'De rodillas con pies fijos, bajar el tronco lentamente. Trabajo excéntrico de isquiotibiales.', video_url: yt('curl nórdico isquiotibiales excéntrico técnica') },
    // Erectores de la Espalda
    { nombre: 'Hiperextensión en Banco Romano', categoria: 'Lumbar · Erectores de la Espalda', descripcion: 'En el banco romano, bajar el tronco y extender hasta quedar en línea con las piernas. No hiperextender.', video_url: yt('hiperextensión banco romano erectores técnica') },
    { nombre: 'Pájaro-Perro (Bird Dog)', categoria: 'Lumbar · Erectores de la Espalda', descripcion: 'En cuatro apoyos, extender brazo y pierna opuesta. Estabiliza columna y activa erectores.', video_url: yt('bird dog pájaro perro erectores espalda técnica') },
    { nombre: 'Remo con Barra', categoria: 'Lumbar · Erectores de la Espalda', descripcion: 'Inclinado hacia adelante, jalar la barra hacia el abdomen. Erectores activos isométricamente.', video_url: yt('remo con barra inclinado erectores técnica') },
    // Dorsal Ancho (lumbar)
    { nombre: 'Jalón al Pecho en Polea', categoria: 'Lumbar · Dorsal Ancho', descripcion: 'Sentado en la polea alta, jalar la barra hacia el pecho. Codos abajo y atrás.', video_url: yt('jalón al pecho polea dorsal ancho técnica') },
    { nombre: 'Remo en Polea Baja', categoria: 'Lumbar · Dorsal Ancho', descripcion: 'Sentado frente a la polea baja, jalar hacia el abdomen. Omoplatos juntos al final.', video_url: yt('remo polea baja sentado dorsal ancho técnica') },
    { nombre: 'Remo con Mancuerna (un brazo)', categoria: 'Lumbar · Dorsal Ancho', descripcion: 'Apoyado en banco, jalar la mancuerna hacia la cadera. Espalda paralela al suelo.', video_url: yt('remo mancuerna un brazo dorsal técnica') },
    // ══ HOMBRO ══════════════════════════════════════════════
    // Trapecio
    { nombre: 'Encogimiento con Barra (Shrug)', categoria: 'Hombro · Trapecio', descripcion: 'De pie con barra, elevar los hombros hacia las orejas. Sin doblar los codos.', video_url: yt('encogimiento barra shrug trapecio técnica') },
    { nombre: 'Encogimiento con Mancuernas', categoria: 'Hombro · Trapecio', descripcion: 'De pie con mancuernas a los costados, elevar los hombros. Mayor rango que con barra.', video_url: yt('encogimiento mancuernas trapecio técnica') },
    { nombre: 'Retracción Escapular en Polea', categoria: 'Hombro · Trapecio', descripcion: 'Sentado frente a la polea, jalar juntando los omoplatos sin doblar los codos.', video_url: yt('retracción escapular polea trapecio romboides') },
    // Dorsal Ancho (hombro)
    { nombre: 'Jalón al Pecho Agarre Abierto', categoria: 'Hombro · Dorsal Ancho', descripcion: 'Agarre ancho en la polea alta, jalar hacia el pecho arqueando levemente. Énfasis en dorsal.', video_url: yt('jalón al pecho agarre ancho dorsal hombro técnica') },
    { nombre: 'Dominadas (Barra Fija)', categoria: 'Hombro · Dorsal Ancho', descripcion: 'Colgado de la barra, elevar el cuerpo hasta que el mentón supere la barra. Bajar controlado.', video_url: yt('dominadas barra fija dorsal técnica') },
    { nombre: 'Pullover con Mancuerna', categoria: 'Hombro · Dorsal Ancho', descripcion: 'Acostado en banco, mancuerna sobre el pecho, bajar hacia atrás de la cabeza. Activa dorsal y serrato.', video_url: yt('pullover mancuerna dorsal ancho técnica') },
    // Redondo Menor
    { nombre: 'Rotación Externa con Banda (codo pegado)', categoria: 'Hombro · Redondo Menor', descripcion: 'Codo pegado al cuerpo a 90°, rotar el antebrazo hacia afuera contra la banda. Activa redondo menor e infraespinoso.', video_url: yt('rotación externa hombro banda redondo menor técnica') },
    { nombre: 'Rotación Externa en Polea', categoria: 'Hombro · Redondo Menor', descripcion: 'Codo a 90° pegado al cuerpo, jalar la polea hacia afuera. Trabajo de redondo menor.', video_url: yt('rotación externa polea hombro técnica') },
    { nombre: 'Face Pull en Polea', categoria: 'Hombro · Redondo Menor', descripcion: 'Polea a nivel de la cara, jalar separando los codos. Trabaja redondo menor, infraespinoso y deltoides posterior.', video_url: yt('face pull polea rotadores externos técnica') },
    // Redondo Mayor
    { nombre: 'Remo con Agarre Prono (codos pegados)', categoria: 'Hombro · Redondo Mayor', descripcion: 'Remo en polea baja con agarre prono y codos pegados al tronco. Activa redondo mayor y dorsal.', video_url: yt('remo agarre prono codos pegados redondo mayor') },
    { nombre: 'Jalón en Polea con Brazos Extendidos', categoria: 'Hombro · Redondo Mayor', descripcion: 'De pie, jalar la polea hacia abajo con brazos extendidos (straight arm pulldown). Activa redondo mayor.', video_url: yt('straight arm pulldown polea redondo mayor técnica') },
    { nombre: 'Aducción Horizontal en Polea', categoria: 'Hombro · Redondo Mayor', descripcion: 'Brazos extendidos, jalar la polea alta hacia la cadera. Gran activación de redondo mayor.', video_url: yt('aducción horizontal polea redondo mayor hombro') },
    // Infraespinoso
    { nombre: 'Rotación Externa Acostado', categoria: 'Hombro · Infraespinoso', descripcion: 'De lado, codo a 90°, rotar el antebrazo hacia arriba. Máxima activación del infraespinoso.', video_url: yt('rotación externa hombro acostado infraespinoso técnica') },
    { nombre: 'Rotación Externa en Polea (infraespinoso)', categoria: 'Hombro · Infraespinoso', descripcion: 'Codo fijo a 90°, rotar hacia afuera contra la polea. Aislamiento del infraespinoso.', video_url: yt('rotación externa polea infraespinoso ejercicio') },
    { nombre: 'Y-T-W en Banco Inclinado', categoria: 'Hombro · Infraespinoso', descripcion: 'Boca abajo en banco inclinado, hacer formas de Y, T y W con los brazos. Activa toda la musculatura escapular posterior.', video_url: yt('YTW banco inclinado infraespinoso manguito rotador') },
    // Supraespinoso
    { nombre: 'Elevación Lateral Vacía (Empty Can)', categoria: 'Hombro · Supraespinoso', descripcion: 'De pie, elevar el brazo a 30° hacia adelante con el pulgar hacia abajo. Máxima activación del supraespinoso.', video_url: yt('empty can supraespinoso elevación ejercicio técnica') },
    { nombre: 'Elevación Lateral Llena (Full Can)', categoria: 'Hombro · Supraespinoso', descripcion: 'Igual al empty can pero con el pulgar hacia arriba. Menor compresión subacromial.', video_url: yt('full can supraespinoso elevación ejercicio técnica') },
    { nombre: 'Elevación Lateral con Polea', categoria: 'Hombro · Supraespinoso', descripcion: 'Tensión constante de la polea baja al elevar el brazo lateralmente. Activa supraespinoso.', video_url: yt('elevación lateral polea supraespinoso hombro técnica') },
    // Deltoides
    { nombre: 'Press Militar con Barra', categoria: 'Hombro · Deltoides', descripcion: 'Sentado o de pie, barra a nivel de la clavícula. Empujar hacia arriba hasta extender los codos.', video_url: yt('press militar barra deltoides técnica') },
    { nombre: 'Elevación Lateral con Mancuerna', categoria: 'Hombro · Deltoides', descripcion: 'De pie, elevar los brazos a los costados hasta la altura del hombro. Codos levemente flexionados.', video_url: yt('elevación lateral mancuerna deltoides técnica') },
    { nombre: 'Elevación Frontal con Mancuerna', categoria: 'Hombro · Deltoides', descripcion: 'De pie, elevar el brazo al frente hasta la altura del hombro. Aisla el deltoides anterior.', video_url: yt('elevación frontal mancuerna deltoides anterior técnica') },
    // Tríceps (hombro)
    { nombre: 'Extensión en Polea (hacia abajo)', categoria: 'Hombro · Tríceps', descripcion: 'De pie frente a la polea alta, empujar hacia abajo extendiendo los codos. Codos fijos al cuerpo.', video_url: yt('extensión tríceps polea hacia abajo técnica') },
    { nombre: 'Press Francés con Barra (Skullcrusher)', categoria: 'Hombro · Tríceps', descripcion: 'Acostado, barra sobre el pecho, doblar los codos bajando la barra hacia la frente. Extender.', video_url: yt('press francés skullcrusher tríceps técnica') },
    { nombre: 'Fondos en Paralelas', categoria: 'Hombro · Tríceps', descripcion: 'Entre dos apoyos, bajar doblando los codos y empujar. Torso erguido para enfatizar tríceps.', video_url: yt('fondos paralelas dips tríceps técnica') },
    // Bíceps (hombro)
    { nombre: 'Curl con Barra', categoria: 'Hombro · Bíceps', descripcion: 'De pie con barra en agarre supino, doblar los codos llevando la barra hacia los hombros.', video_url: yt('curl bíceps barra técnica correcta') },
    { nombre: 'Curl con Mancuernas Alternado', categoria: 'Hombro · Bíceps', descripcion: 'De pie, doblar un codo a la vez con supinación de la muñeca al subir.', video_url: yt('curl mancuernas bíceps alternado técnica') },
    { nombre: 'Curl en Polea', categoria: 'Hombro · Bíceps', descripcion: 'De pie frente a la polea baja, jalar hacia arriba. Tensión constante durante todo el movimiento.', video_url: yt('curl bíceps polea técnica') },
    // Subescapular
    { nombre: 'Rotación Interna en Polea', categoria: 'Hombro · Subescapular', descripcion: 'Codo pegado al cuerpo a 90°, jalar la polea hacia adentro. Trabaja el subescapular.', video_url: yt('rotación interna hombro polea subescapular técnica') },
    { nombre: 'Rotación Interna Acostado', categoria: 'Hombro · Subescapular', descripcion: 'Boca arriba, codo a 90°, rotar el antebrazo hacia abajo contra resistencia. Aislamiento de subescapular.', video_url: yt('rotación interna hombro acostado subescapular ejercicio') },
    { nombre: 'Press de Pecho Neutro (máquina)', categoria: 'Hombro · Subescapular', descripcion: 'Press en máquina de pecho con agarre neutro. Activa subescapular como rotador interno.', video_url: yt('press pecho neutro máquina subescapular técnica') },
    // Romboides
    { nombre: 'Remo en Polea con Agarre Neutro', categoria: 'Hombro · Romboides', descripcion: 'Sentado frente a la polea, jalar hacia el abdomen juntando los omoplatos al final.', video_url: yt('remo polea agarre neutro romboides técnica') },
    { nombre: 'Vuelo Posterior con Mancuernas', categoria: 'Hombro · Romboides', descripcion: 'Inclinado hacia adelante, elevar los brazos a los costados. Aisla romboides y deltoides posterior.', video_url: yt('vuelo posterior mancuernas romboides técnica') },
    { nombre: 'Retracción Escapular contra la Pared', categoria: 'Hombro · Romboides', descripcion: 'Apoyado en la pared, juntar los omoplatos sin mover los brazos. Activación isométrica de romboides.', video_url: yt('retracción escapular pared romboides ejercicio') },
    // Serrato Mayor
    { nombre: 'Protracción en Plancha', categoria: 'Hombro · Serrato Mayor', descripcion: 'En posición de plancha, empujar el suelo separando las escápulas al máximo (serratus push-up). Activa serrato mayor.', video_url: yt('serratus push up serrato mayor ejercicio técnica') },
    { nombre: 'Golpe de Boxeador en Polea', categoria: 'Hombro · Serrato Mayor', descripcion: 'De pie frente a la polea, empujar el agarre al frente como un golpe. Máxima protracción escapular.', video_url: yt('golpe boxeador polea serrato mayor protracción') },
    { nombre: 'Deslizamiento de Pared (Wall Slide)', categoria: 'Hombro · Serrato Mayor', descripcion: 'Antebrazos apoyados en la pared, deslizar hacia arriba. Activa serrato mayor en cadena cerrada.', video_url: yt('wall slide serrato mayor ejercicio técnica') },
    // ══ CODO ════════════════════════════════════════════════
    // Tríceps (codo)
    { nombre: 'Extensión en Polea hacia Abajo', categoria: 'Codo · Tríceps', descripcion: 'De pie frente a la polea alta, empujar el agarre hacia abajo extendiendo los codos. Codos fijos.', video_url: yt('extensión tríceps polea codo técnica') },
    { nombre: 'Extensión sobre la Cabeza con Mancuerna', categoria: 'Codo · Tríceps', descripcion: 'Sentado, mancuerna sobre la cabeza, doblar los codos hacia atrás y extender.', video_url: yt('extensión tríceps cabeza mancuerna técnica') },
    { nombre: 'Patada de Tríceps (Kickback)', categoria: 'Codo · Tríceps', descripcion: 'Inclinado, codo pegado al cuerpo, extender el codo llevando la mancuerna hacia atrás.', video_url: yt('kickback tríceps mancuerna técnica') },
    // Bíceps (codo)
    { nombre: 'Curl con Barra en Banco Scott', categoria: 'Codo · Bíceps', descripcion: 'Codos apoyados en el banco, doblar llevando la barra hacia los hombros. Aísla el bíceps.', video_url: yt('curl banco scott bíceps técnica') },
    { nombre: 'Curl Martillo con Mancuerna', categoria: 'Codo · Bíceps', descripcion: 'Agarre neutro (pulgar arriba), doblar el codo. Trabaja bíceps y braquiorradial.', video_url: yt('curl martillo mancuerna bíceps braquiorradial técnica') },
    { nombre: 'Curl Concentrado', categoria: 'Codo · Bíceps', descripcion: 'Sentado, codo apoyado en el muslo, doblar el codo con mancuerna. Máxima concentración en bíceps.', video_url: yt('curl concentrado bíceps mancuerna técnica') },
    // Supinadores
    { nombre: 'Supinación con Mancuerna', categoria: 'Codo · Supinadores', descripcion: 'Codo a 90° apoyado, rotar el antebrazo con la palma hacia arriba contra la mancuerna. Activa supinadores.', video_url: yt('supinación antebrazo mancuerna supinadores ejercicio') },
    { nombre: 'Supinación en Polea', categoria: 'Codo · Supinadores', descripcion: 'Agarre en la polea baja, codo fijo, rotar el antebrazo hacia la supinación. Trabajo aislado.', video_url: yt('supinación antebrazo polea ejercicio técnica') },
    { nombre: 'Curl Supinado con Banda', categoria: 'Codo · Supinadores', descripcion: 'Codo fijo, iniciar en pronación y supinar el antebrazo mientras se flexiona el codo. Trabaja supinadores y bíceps.', video_url: yt('curl supinado banda supinadores bíceps ejercicio') },
    // Pronadores
    { nombre: 'Pronación con Mancuerna', categoria: 'Codo · Pronadores', descripcion: 'Codo a 90° apoyado, rotar el antebrazo con la palma hacia abajo. Activa pronador redondo y cuadrado.', video_url: yt('pronación antebrazo mancuerna pronadores ejercicio') },
    { nombre: 'Pronación en Polea', categoria: 'Codo · Pronadores', descripcion: 'Agarre en la polea alta, codo fijo, rotar el antebrazo hacia la pronación.', video_url: yt('pronación antebrazo polea ejercicio técnica') },
    { nombre: 'Lanzamiento con Rotación (Chop) en Polea', categoria: 'Codo · Pronadores', descripcion: 'Movimiento diagonal desde arriba hacia abajo con rotación del antebrazo. Trabaja pronadores funcionalmente.', video_url: yt('chop rotación polea pronadores antebrazo funcional') },
  ]);
  console.log('✅ Seed de ejercicios actualizado');
}

// ── Usuarios ──────────────────────────────────────────────

const getUsuarioByEmail = db.prepare(`SELECT * FROM usuarios WHERE email = ?`);
const getUsuario = db.prepare(`SELECT id, email, rol, nombre FROM usuarios WHERE id = ?`);
const insertUsuario = db.prepare(`INSERT INTO usuarios (email, password, rol, nombre) VALUES (@email, @password, @rol, @nombre)`);
const updatePassword = db.prepare(`UPDATE usuarios SET password = ? WHERE id = ?`);

// ── Pacientes ─────────────────────────────────────────────

const getPacientes = db.prepare(`
  SELECT p.*,
    COUNT(DISTINCT l.id) as total_lesiones,
    COUNT(DISTINCT s.id) as total_sesiones
  FROM pacientes p
  LEFT JOIN lesiones l ON l.paciente_id = p.id
  LEFT JOIN sesiones s ON s.lesion_id = l.id
  GROUP BY p.id
  ORDER BY p.apellido, p.nombre
`);

const getPaciente = db.prepare(`SELECT * FROM pacientes WHERE id = ?`);
const getPacienteByUsuario = db.prepare(`SELECT * FROM pacientes WHERE usuario_id = ?`);

const insertPaciente = db.prepare(`
  INSERT INTO pacientes (nombre, apellido, edad, email, celular, dni)
  VALUES (@nombre, @apellido, @edad, @email, @celular, @dni)
`);

const updatePaciente = db.prepare(`
  UPDATE pacientes SET nombre=@nombre, apellido=@apellido, edad=@edad,
    email=@email, celular=@celular, dni=@dni, usuario_id=@usuario_id
  WHERE id=@id
`);

const deletePaciente = db.prepare(`DELETE FROM pacientes WHERE id = ?`);

const linkUsuarioPaciente = db.prepare(`UPDATE pacientes SET usuario_id = ? WHERE id = ?`);

// ── Lesiones ──────────────────────────────────────────────

const getLesionesByPaciente = db.prepare(`
  SELECT l.*, COUNT(s.id) as total_sesiones
  FROM lesiones l
  LEFT JOIN sesiones s ON s.lesion_id = l.id
  WHERE l.paciente_id = ?
  GROUP BY l.id
  ORDER BY l.fecha_ingreso DESC
`);

const getLesion = db.prepare(`SELECT * FROM lesiones WHERE id = ?`);
const insertLesion = db.prepare(`INSERT INTO lesiones (paciente_id, descripcion, diagnostico, fecha_lesion, fecha_ingreso, estado, notas) VALUES (@paciente_id, @descripcion, @diagnostico, @fecha_lesion, @fecha_ingreso, @estado, @notas)`);
const updateLesion = db.prepare(`UPDATE lesiones SET descripcion=@descripcion, diagnostico=@diagnostico, fecha_lesion=@fecha_lesion, fecha_ingreso=@fecha_ingreso, estado=@estado, notas=@notas WHERE id=@id`);
const deleteLesion = db.prepare(`DELETE FROM lesiones WHERE id = ?`);

// ── Sesiones ──────────────────────────────────────────────

const getSesionesByLesion = db.prepare(`SELECT * FROM sesiones WHERE lesion_id = ? ORDER BY fecha DESC`);
const getSesion = db.prepare(`SELECT * FROM sesiones WHERE id = ?`);
const insertSesion = db.prepare(`INSERT INTO sesiones (lesion_id, fecha, duracion, tecnicas, evolucion, notas) VALUES (@lesion_id, @fecha, @duracion, @tecnicas, @evolucion, @notas)`);
const updateSesion = db.prepare(`UPDATE sesiones SET fecha=@fecha, duracion=@duracion, tecnicas=@tecnicas, evolucion=@evolucion, notas=@notas WHERE id=@id`);
const deleteSesion = db.prepare(`DELETE FROM sesiones WHERE id = ?`);

// ── Ejercicios ────────────────────────────────────────────

const getEjercicios = db.prepare(`SELECT * FROM ejercicios ORDER BY categoria, nombre`);
const getEjercicio = db.prepare(`SELECT * FROM ejercicios WHERE id = ?`);
const insertEjercicio = db.prepare(`INSERT INTO ejercicios (nombre, descripcion, categoria, video_url, imagen_url) VALUES (@nombre, @descripcion, @categoria, @video_url, @imagen_url)`);
const updateEjercicio = db.prepare(`UPDATE ejercicios SET nombre=@nombre, descripcion=@descripcion, categoria=@categoria, video_url=@video_url, imagen_url=@imagen_url WHERE id=@id`);
const deleteEjercicio = db.prepare(`DELETE FROM ejercicios WHERE id = ?`);

// ── Motivos de consulta ───────────────────────────────────

const getMotivosByPaciente = db.prepare(`
  SELECT m.*,
    COUNT(e.id) as total_evoluciones,
    COALESCE(SUM(e.monto_cobrado), 0) as total_cobrado,
    COALESCE(SUM(CASE WHEN e.pagado=0 THEN e.monto_cobrado ELSE 0 END), 0) as saldo_pendiente
  FROM motivos m
  LEFT JOIN evoluciones e ON e.motivo_id = m.id
  WHERE m.paciente_id = ?
  GROUP BY m.id
  ORDER BY m.created_at DESC
`);

const getMotivo = db.prepare(`SELECT * FROM motivos WHERE id = ?`);
const insertMotivo = db.prepare(`INSERT INTO motivos (paciente_id, sintoma, aparicion, momento_dia, movimientos, afloja_dia, monto_sesion, estado) VALUES (@paciente_id, @sintoma, @aparicion, @momento_dia, @movimientos, @afloja_dia, @monto_sesion, @estado)`);
const updateMotivo = db.prepare(`UPDATE motivos SET sintoma=@sintoma, aparicion=@aparicion, momento_dia=@momento_dia, movimientos=@movimientos, afloja_dia=@afloja_dia, monto_sesion=@monto_sesion, estado=@estado WHERE id=@id`);
const deleteMotivo = db.prepare(`DELETE FROM motivos WHERE id = ?`);

// ── Evoluciones ───────────────────────────────────────────

const getEvolucionesByMotivo = db.prepare(`SELECT * FROM evoluciones WHERE motivo_id = ? ORDER BY fecha DESC`);
const getEvolucion = db.prepare(`SELECT * FROM evoluciones WHERE id = ?`);
const insertEvolucion = db.prepare(`INSERT INTO evoluciones (motivo_id, fecha, notas, dolor, tecnicas, monto_cobrado, pagado, tecnicas_sesion, ejercicios_sesion) VALUES (@motivo_id, @fecha, @notas, @dolor, @tecnicas, @monto_cobrado, @pagado, @tecnicas_sesion, @ejercicios_sesion)`);
const updateEvolucion = db.prepare(`UPDATE evoluciones SET fecha=@fecha, notas=@notas, dolor=@dolor, tecnicas=@tecnicas, monto_cobrado=@monto_cobrado, pagado=@pagado, tecnicas_sesion=@tecnicas_sesion, ejercicios_sesion=@ejercicios_sesion WHERE id=@id`);
const deleteEvolucion = db.prepare(`DELETE FROM evoluciones WHERE id = ?`);

const getUltimaEvolucionPaciente = db.prepare(`
  SELECT ev.* FROM evoluciones ev
  JOIN motivos m ON m.id = ev.motivo_id
  WHERE m.paciente_id = ?
  ORDER BY ev.fecha DESC, ev.created_at DESC
  LIMIT 1
`);

const getSaldoPaciente = db.prepare(`
  SELECT
    COALESCE(SUM(e.monto_cobrado), 0) as total_cobrado,
    COALESCE(SUM(CASE WHEN e.pagado=1 THEN e.monto_cobrado ELSE 0 END), 0) as total_pagado,
    COALESCE(SUM(CASE WHEN e.pagado=0 THEN e.monto_cobrado ELSE 0 END), 0) as saldo_pendiente,
    COUNT(e.id) as total_sesiones
  FROM evoluciones e
  JOIN motivos m ON m.id = e.motivo_id
  WHERE m.paciente_id = ?
`);

const pagarTodasEvoluciones = db.prepare(`
  UPDATE evoluciones SET pagado = 1
  WHERE motivo_id IN (SELECT id FROM motivos WHERE paciente_id = ?)
  AND pagado = 0 AND monto_cobrado > 0
`);

const getDolorEvolByPaciente = db.prepare(`
  SELECT e.fecha, e.dolor FROM evoluciones e
  JOIN motivos m ON m.id = e.motivo_id
  WHERE m.paciente_id = ? AND e.dolor IS NOT NULL
  ORDER BY e.fecha ASC
`);

// ── Estudios ──────────────────────────────────────────────

const getEstudiosByMotivo = db.prepare(`SELECT * FROM estudios WHERE motivo_id = ? ORDER BY created_at DESC`);
const insertEstudio = db.prepare(`INSERT INTO estudios (motivo_id, nombre, tipo, archivo) VALUES (@motivo_id, @nombre, @tipo, @archivo)`);
const deleteEstudio = db.prepare(`DELETE FROM estudios WHERE id = ?`);
const getEstudio = db.prepare(`SELECT * FROM estudios WHERE id = ?`);

// ── Turnos ────────────────────────────────────────────────

const getTurnos = db.prepare(`
  SELECT t.*, p.nombre, p.apellido FROM turnos t
  LEFT JOIN pacientes p ON p.id = t.paciente_id
  ORDER BY t.fecha, t.hora
`);
const getTurnosByMes = db.prepare(`
  SELECT t.*, p.nombre, p.apellido FROM turnos t
  LEFT JOIN pacientes p ON p.id = t.paciente_id
  WHERE strftime('%Y-%m', t.fecha) = ?
  ORDER BY t.fecha, t.hora
`);
const getTurno = db.prepare(`SELECT t.*, p.nombre, p.apellido FROM turnos t LEFT JOIN pacientes p ON p.id = t.paciente_id WHERE t.id = ?`);
const insertTurno = db.prepare(`INSERT INTO turnos (paciente_id, fecha, hora, duracion, motivo, estado, notas) VALUES (@paciente_id, @fecha, @hora, @duracion, @motivo, @estado, @notas)`);
const updateTurno = db.prepare(`UPDATE turnos SET paciente_id=@paciente_id, fecha=@fecha, hora=@hora, duracion=@duracion, motivo=@motivo, estado=@estado, notas=@notas WHERE id=@id`);
const deleteTurno = db.prepare(`DELETE FROM turnos WHERE id = ?`);

// ── Documentos ────────────────────────────────────────────

const getDocumentosByPaciente = db.prepare(`SELECT * FROM documentos WHERE paciente_id = ? ORDER BY created_at DESC`);
const insertDocumento = db.prepare(`INSERT INTO documentos (paciente_id, nombre, tipo, archivo) VALUES (@paciente_id, @nombre, @tipo, @archivo)`);
const deleteDocumento = db.prepare(`DELETE FROM documentos WHERE id = ?`);
const getDocumento = db.prepare(`SELECT * FROM documentos WHERE id = ?`);

// ── Dashboard ─────────────────────────────────────────────

const getDashboardStats = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM pacientes) as total_pacientes,
    (SELECT COUNT(*) FROM lesiones WHERE estado='activa') as lesiones_activas,
    (SELECT COUNT(*) FROM sesiones WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now','localtime')) as sesiones_mes,
    (SELECT COUNT(*) FROM turnos WHERE fecha = date('now','localtime') AND estado != 'cancelado') as turnos_hoy,
    (SELECT COUNT(*) FROM turnos WHERE fecha >= date('now','localtime') AND estado = 'pendiente') as turnos_proximos
`);

const getSesionesPorMes = db.prepare(`
  SELECT strftime('%Y-%m', fecha) as mes, COUNT(*) as cantidad
  FROM sesiones
  GROUP BY mes ORDER BY mes DESC LIMIT 6
`);

const getProximosTurnos = db.prepare(`
  SELECT t.*, p.nombre, p.apellido FROM turnos t
  LEFT JOIN pacientes p ON p.id = t.paciente_id
  WHERE t.fecha >= date('now','localtime') AND t.estado != 'cancelado'
  ORDER BY t.fecha, t.hora LIMIT 5
`);

const getDolorEvolucion = db.prepare(`
  SELECT s.fecha, s.dolor, s.id
  FROM sesiones s
  JOIN lesiones l ON l.id = s.lesion_id
  WHERE l.paciente_id = ? AND s.dolor IS NOT NULL
  ORDER BY s.fecha ASC
`);

// ── Ejercicios por paciente ───────────────────────────────

const getEjerciciosByPaciente = db.prepare(`
  SELECT pe.*, e.nombre, e.descripcion, e.categoria, e.video_url, e.imagen_url
  FROM paciente_ejercicios pe
  JOIN ejercicios e ON e.id = pe.ejercicio_id
  WHERE pe.paciente_id = ? AND pe.activo = 1
  ORDER BY e.categoria, e.nombre
`);

const insertPacienteEjercicio = db.prepare(`
  INSERT INTO paciente_ejercicios (paciente_id, ejercicio_id, series, repeticiones, duracion_seg, frecuencia, notas, fecha_desde)
  VALUES (@paciente_id, @ejercicio_id, @series, @repeticiones, @duracion_seg, @frecuencia, @notas, @fecha_desde)
`);

const deletePacienteEjercicio = db.prepare(`DELETE FROM paciente_ejercicios WHERE id = ?`);

module.exports = {
  // Auth
  getUsuarioByEmail: (email) => getUsuarioByEmail.get(email),
  getUsuario:        (id) => getUsuario.get(id),
  insertUsuario:     (data) => { const r = insertUsuario.run(data); return getUsuario.get(r.lastInsertRowid); },
  updatePassword:    (id, hash) => updatePassword.run(hash, id),

  // Pacientes
  getPacientes:          () => getPacientes.all(),
  getPaciente:           (id) => getPaciente.get(id),
  getPacienteByUsuario:  (uid) => getPacienteByUsuario.get(uid),
  insertPaciente:        (data) => { const r = insertPaciente.run(data); return getPaciente.get(r.lastInsertRowid); },
  updatePaciente:        (data) => { updatePaciente.run(data); return getPaciente.get(data.id); },
  deletePaciente:        (id) => deletePaciente.run(id),
  linkUsuarioPaciente:   (uid, pid) => linkUsuarioPaciente.run(uid, pid),

  // Lesiones
  getLesionesByPaciente: (id) => getLesionesByPaciente.all(id),
  getLesion:             (id) => getLesion.get(id),
  insertLesion:          (data) => { const r = insertLesion.run(data); return getLesion.get(r.lastInsertRowid); },
  updateLesion:          (data) => { updateLesion.run(data); return getLesion.get(data.id); },
  deleteLesion:          (id) => deleteLesion.run(id),

  // Sesiones
  getSesionesByLesion: (id) => getSesionesByLesion.all(id),
  getSesion:           (id) => getSesion.get(id),
  insertSesion:        (data) => { const r = insertSesion.run(data); return getSesion.get(r.lastInsertRowid); },
  updateSesion:        (data) => { updateSesion.run(data); return getSesion.get(data.id); },
  deleteSesion:        (id) => deleteSesion.run(id),

  // Ejercicios
  getEjercicios:   () => getEjercicios.all(),
  getEjercicio:    (id) => getEjercicio.get(id),
  insertEjercicio: (data) => { const r = insertEjercicio.run(data); return getEjercicio.get(r.lastInsertRowid); },
  updateEjercicio: (data) => { updateEjercicio.run(data); return getEjercicio.get(data.id); },
  deleteEjercicio: (id) => deleteEjercicio.run(id),

  // Ejercicios por paciente
  getEjerciciosByPaciente: (id) => getEjerciciosByPaciente.all(id),
  insertPacienteEjercicio: (data) => insertPacienteEjercicio.run(data),
  deletePacienteEjercicio: (id) => deletePacienteEjercicio.run(id),

  // Turnos
  getTurnos:        () => getTurnos.all(),
  getTurnosByMes:   (mes) => getTurnosByMes.all(mes),
  getTurno:         (id) => getTurno.get(id),
  insertTurno:      (data) => { const r = insertTurno.run(data); return getTurno.get(r.lastInsertRowid); },
  updateTurno:      (data) => { updateTurno.run(data); return getTurno.get(data.id); },
  deleteTurno:      (id) => deleteTurno.run(id),

  // Documentos
  getDocumentosByPaciente: (id) => getDocumentosByPaciente.all(id),
  insertDocumento:         (data) => insertDocumento.run(data),
  deleteDocumento:         (id) => deleteDocumento.run(id),
  getDocumento:            (id) => getDocumento.get(id),

  // Motivos
  getMotivosByPaciente: (id) => getMotivosByPaciente.all(id),
  getMotivo:            (id) => getMotivo.get(id),
  insertMotivo:         (data) => { const r = insertMotivo.run(data); return getMotivo.get(r.lastInsertRowid); },
  updateMotivo:         (data) => { updateMotivo.run(data); return getMotivo.get(data.id); },
  deleteMotivo:         (id) => deleteMotivo.run(id),

  // Evoluciones
  getEvolucionesByMotivo:      (id) => getEvolucionesByMotivo.all(id),
  getEvolucion:                (id) => getEvolucion.get(id),
  insertEvolucion:             (data) => { const r = insertEvolucion.run(data); return getEvolucion.get(r.lastInsertRowid); },
  updateEvolucion:             (data) => { updateEvolucion.run(data); return getEvolucion.get(data.id); },
  deleteEvolucion:             (id) => deleteEvolucion.run(id),
  pagarTodasEvoluciones:       (id) => pagarTodasEvoluciones.run(id),
  getSaldoPaciente:            (id) => getSaldoPaciente.get(id),
  getDolorEvolByPaciente:      (id) => getDolorEvolByPaciente.all(id),
  getUltimaEvolucionPaciente:  (id) => getUltimaEvolucionPaciente.get(id),

  // Estudios
  getEstudiosByMotivo: (id) => getEstudiosByMotivo.all(id),
  insertEstudio:       (data) => insertEstudio.run(data),
  deleteEstudio:       (id) => deleteEstudio.run(id),
  getEstudio:          (id) => getEstudio.get(id),

  // Dashboard
  getDashboardStats:   () => getDashboardStats.get(),
  getSesionesPorMes:   () => getSesionesPorMes.all(),
  getProximosTurnos:   () => getProximosTurnos.all(),
  getDolorEvolucion:   (pacienteId) => getDolorEvolucion.all(pacienteId),
};
