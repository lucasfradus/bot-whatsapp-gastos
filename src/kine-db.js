const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, '../kine.db'));

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

// ── Seed ejercicios (INSERT OR IGNORE por nombre) ─────────

{
  const existe = db.prepare(`SELECT id FROM ejercicios WHERE nombre = ?`);
  const ins = db.prepare(`INSERT OR IGNORE INTO ejercicios (nombre, descripcion, categoria, video_url) VALUES (@nombre, @descripcion, @categoria, @video_url)`);
  const upsertMany = db.transaction((lista) => {
    for (const e of lista) {
      if (!existe.get(e.nombre)) ins.run(e);
    }
  });

  const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

  upsertMany([
    // ── CUÁDRICEPS ──────────────────────────────────────────
    { nombre: 'Prensa de Piernas (máquina) — CC', categoria: 'Cuádriceps', descripcion: 'Cadena cerrada. Pies en la plataforma al ancho de caderas, empujar hasta casi extender la rodilla y bajar lento controlando el peso.', video_url: yt('leg press máquina técnica') },
    { nombre: 'Extensión de Cuádriceps (máquina) — OA', categoria: 'Cuádriceps', descripcion: 'Cadena abierta. Sentado en la máquina, extender ambas rodillas hasta la extensión completa. Bajar lento. Aisla el cuádriceps.', video_url: yt('leg extension máquina técnica') },
    { nombre: 'Sentadilla con Barra — CC', categoria: 'Cuádriceps', descripcion: 'Cadena cerrada. Barra sobre trapecios, pies al ancho de hombros. Bajar hasta paralela controlando las rodillas. Empujar desde los talones.', video_url: yt('sentadilla con barra técnica') },
    { nombre: 'Sentadilla Goblet con Mancuerna — CC', categoria: 'Cuádriceps', descripcion: 'Cadena cerrada. Sostener mancuerna con ambas manos frente al pecho. Bajar profundo manteniendo el tronco erguido.', video_url: yt('goblet squat mancuerna técnica') },
    // ── ISQUIOTIBIALES ──────────────────────────────────────
    { nombre: 'Curl de Isquiotibiales acostado (máquina) — OA', categoria: 'Isquiotibiales', descripcion: 'Cadena abierta. Boca abajo en la máquina, doblar las rodillas llevando los talones hacia los glúteos. Controlar el descenso.', video_url: yt('curl isquiotibial máquina acostado técnica') },
    { nombre: 'Curl de Isquiotibiales sentado (máquina) — OA', categoria: 'Isquiotibiales', descripcion: 'Cadena abierta. Sentado en la máquina, doblar las rodillas bajo el asiento. Controlar la extensión al volver.', video_url: yt('curl isquiotibial máquina sentado técnica') },
    { nombre: 'Peso Muerto Rumano con Barra — CC', categoria: 'Isquiotibiales', descripcion: 'Cadena cerrada. De pie con barra, bajar el torso manteniendo la espalda recta y rodillas levemente flexionadas. Sentir el estiramiento.', video_url: yt('peso muerto rumano barra técnica') },
    { nombre: 'Peso Muerto Rumano con Mancuernas — CC', categoria: 'Isquiotibiales', descripcion: 'Cadena cerrada. Igual al rumano con barra pero con mancuernas a los costados. Mayor rango de movimiento.', video_url: yt('peso muerto rumano mancuernas técnica') },
    // ── GLÚTEO MAYOR ────────────────────────────────────────
    { nombre: 'Hip Thrust con Barra — CC', categoria: 'Glúteo Mayor', descripcion: 'Cadena cerrada. Espalda apoyada en banco, barra sobre caderas. Elevar la pelvis apretando glúteos hasta alinear cadera-rodilla-hombro.', video_url: yt('hip thrust barra técnica') },
    { nombre: 'Patada Trasera en Polea — OA', categoria: 'Glúteo Mayor', descripcion: 'Cadena abierta. De pie frente a la polea baja, con tobillera llevar la pierna hacia atrás manteniendo la rodilla recta.', video_url: yt('patada trasera polea glúteo técnica') },
    { nombre: 'Sentadilla Búlgara con Mancuernas — CC', categoria: 'Glúteo Mayor', descripcion: 'Cadena cerrada. Pie trasero elevado en banco, bajar la rodilla delantera hacia el piso. Gran activación de glúteo.', video_url: yt('sentadilla búlgara mancuernas técnica') },
    // ── GLÚTEO MEDIO ────────────────────────────────────────
    { nombre: 'Abducción de Cadera (máquina) — OA', categoria: 'Glúteo Medio', descripcion: 'Cadena abierta. Sentado en la máquina de abducción, separar las piernas contra la resistencia. Controlar el cierre.', video_url: yt('abducción de cadera máquina técnica') },
    { nombre: 'Abducción en Polea de Pie — OA', categoria: 'Glúteo Medio', descripcion: 'Cadena abierta. De pie con tobillera en polea baja, alejar la pierna lateralmente sin inclinar el tronco.', video_url: yt('abducción cadera polea de pie técnica') },
    { nombre: 'Abducción de Cadera acostado — OA', categoria: 'Glúteo Medio', descripcion: 'Cadena abierta. De lado en el suelo, elevar la pierna de arriba controlando. Punta del pie levemente hacia abajo.', video_url: yt('abducción de cadera acostado ejercicio') },
    // ── ADUCTORES ───────────────────────────────────────────
    { nombre: 'Aducción de Cadera (máquina) — OA', categoria: 'Aductores', descripcion: 'Cadena abierta. Sentado en la máquina de aducción, juntar las piernas contra la resistencia. Controlar la apertura.', video_url: yt('aducción de cadera máquina técnica') },
    { nombre: 'Sentadilla Sumo con Mancuerna — CC', categoria: 'Aductores', descripcion: 'Cadena cerrada. Pies muy abiertos con puntas hacia afuera, sostener mancuerna entre las piernas. Bajar profundo.', video_url: yt('sentadilla sumo mancuerna técnica') },
    // ── GASTROCNEMIOS ───────────────────────────────────────
    { nombre: 'Elevación de Talones (máquina de pie) — CC', categoria: 'Gastrocnemios', descripcion: 'Cadena cerrada. En la máquina de pantorrilla de pie, elevar los talones al máximo y bajar lentamente por debajo del nivel de la plataforma.', video_url: yt('elevación de talones máquina de pie técnica') },
    { nombre: 'Elevación de Talones de Pie con Mancuerna — CC', categoria: 'Gastrocnemios', descripcion: 'Cadena cerrada. De pie en escalón, sostener mancuerna. Elevar y bajar lento superando el rango normal.', video_url: yt('elevación de talones escalón mancuerna técnica') },
    // ── SÓLEO ───────────────────────────────────────────────
    { nombre: 'Elevación de Talones Sentado (máquina) — CC', categoria: 'Sóleo', descripcion: 'Cadena cerrada. Sentado con rodillas dobladas a 90°, elevar los talones con la carga sobre los muslos. El sóleo trabaja más con rodilla flexionada.', video_url: yt('elevación de talones sentado máquina sóleo') },
    { nombre: 'Elevación de Talones Sentado con Peso — CC', categoria: 'Sóleo', descripcion: 'Cadena cerrada. Igual a la máquina pero con mancuerna o barra sobre los muslos. Movimiento completo.', video_url: yt('elevación de talones sentado peso sóleo técnica') },
    // ── TIBIAL ANTERIOR ─────────────────────────────────────
    { nombre: 'Dorsiflexión con Banda o Polea — OA', categoria: 'Tibial Anterior', descripcion: 'Cadena abierta. Sentado, con banda o polea baja en el empeine, doblar el tobillo llevando la punta del pie hacia la rodilla.', video_url: yt('dorsiflexión tobillo banda polea tibial anterior') },
    { nombre: 'Marcha sobre Talones — CC', categoria: 'Tibial Anterior', descripcion: 'Cadena cerrada. Caminar apoyando solo los talones con la punta del pie elevada. Activa el tibial anterior en cadena cerrada.', video_url: yt('marcha sobre talones tibial anterior ejercicio') },
    // ── PECTORAL ────────────────────────────────────────────
    { nombre: 'Press de Banca con Barra — CC', categoria: 'Pectoral', descripcion: 'Cadena cerrada. Acostado en banco, barra al ancho de hombros. Bajar a nivel del pecho controlando y empujar hacia arriba.', video_url: yt('press de banca barra técnica') },
    { nombre: 'Press de Banca con Mancuernas — CC', categoria: 'Pectoral', descripcion: 'Cadena cerrada. Igual al press con barra pero con mancuernas. Mayor rango de movimiento y trabajo estabilizador.', video_url: yt('press de banca mancuernas técnica') },
    { nombre: 'Press en Máquina de Pecho — CC', categoria: 'Pectoral', descripcion: 'Cadena cerrada. Sentado en la máquina, empujar las palancas al frente hasta extender los codos. Bajar controlado.', video_url: yt('press de pecho máquina técnica') },
    { nombre: 'Apertura con Mancuernas (Fly) — OA', categoria: 'Pectoral', descripcion: 'Cadena abierta. Acostado en banco, mancuernas arriba con codos levemente flexionados. Abrir los brazos en arco hasta sentir estiramiento y cerrar.', video_url: yt('apertura mancuernas fly pecho técnica') },
    { nombre: 'Apertura en Polea (Cable Fly) — OA', categoria: 'Pectoral', descripcion: 'Cadena abierta. De pie entre poleas altas, llevar las manos al frente en arco cruzándolas. Tensión constante en el pectoral.', video_url: yt('cable fly polea cruzada pecho técnica') },
    // ── DORSAL ANCHO ────────────────────────────────────────
    { nombre: 'Jalón al Pecho en Polea — OA', categoria: 'Dorsal Ancho', descripcion: 'Cadena abierta. Sentado en la polea alta, jalar la barra hacia el pecho arqueando levemente la espalda. Codos abajo y atrás.', video_url: yt('jalón al pecho polea técnica') },
    { nombre: 'Remo en Polea Baja (sentado) — OA', categoria: 'Dorsal Ancho', descripcion: 'Cadena abierta. Sentado frente a la polea baja, jalar el agarre hacia el abdomen. Omoplatos juntos al final.', video_url: yt('remo polea baja sentado técnica') },
    { nombre: 'Remo con Barra — CC', categoria: 'Dorsal Ancho', descripcion: 'Cadena cerrada. Inclinado hacia adelante, jalar la barra hacia el abdomen. Mantener la espalda recta y codos cerca del cuerpo.', video_url: yt('remo con barra inclinado técnica') },
    { nombre: 'Remo con Mancuerna (un brazo) — CC', categoria: 'Dorsal Ancho', descripcion: 'Cadena cerrada. Apoyado en banco con una mano, jalar la mancuerna hacia la cadera. Mantener la espalda paralela al suelo.', video_url: yt('remo mancuerna un brazo técnica') },
    { nombre: 'Dominadas (Barra Fija) — CC', categoria: 'Dorsal Ancho', descripcion: 'Cadena cerrada. Colgado de la barra con agarre prono, elevar el cuerpo hasta que el mentón supere la barra. Bajar controlado.', video_url: yt('dominadas barra técnica') },
    // ── DELTOIDES ANTERIOR ──────────────────────────────────
    { nombre: 'Press Militar con Barra — CC', categoria: 'Deltoides', descripcion: 'Cadena cerrada. Sentado o de pie, barra a nivel de la clavícula. Empujar hacia arriba hasta la extensión completa y bajar lento.', video_url: yt('press militar barra técnica') },
    { nombre: 'Press con Mancuernas (sentado) — CC', categoria: 'Deltoides', descripcion: 'Cadena cerrada. Sentado con espalda apoyada, mancuernas a nivel del hombro. Empujar hacia arriba y bajar lento.', video_url: yt('press mancuernas hombro sentado técnica') },
    { nombre: 'Elevación Frontal con Mancuerna — OA', categoria: 'Deltoides', descripcion: 'Cadena abierta. De pie, mancuerna en la mano, elevar el brazo al frente hasta la altura del hombro. Bajar lento. Aisla el deltoides anterior.', video_url: yt('elevación frontal mancuerna hombro técnica') },
    { nombre: 'Elevación Lateral con Mancuerna — OA', categoria: 'Deltoides', descripcion: 'Cadena abierta. De pie, elevar los brazos a los costados hasta la altura del hombro. Codos levemente flexionados. Aisla el deltoides lateral.', video_url: yt('elevación lateral mancuerna hombro técnica') },
    { nombre: 'Elevación Lateral en Polea — OA', categoria: 'Deltoides', descripcion: 'Cadena abierta. De pie junto a la polea baja, jalar el agarre lateralmente hasta la altura del hombro. Tensión constante.', video_url: yt('elevación lateral polea hombro técnica') },
    { nombre: 'Face Pull en Polea — OA', categoria: 'Deltoides', descripcion: 'Cadena abierta. Polea a nivel de la cara, jalar el agarre hacia la frente separando los codos. Trabaja deltoides posterior y manguito.', video_url: yt('face pull polea técnica') },
    { nombre: 'Vuelo Posterior con Mancuernas — OA', categoria: 'Deltoides', descripcion: 'Cadena abierta. Inclinado hacia adelante, elevar los brazos a los costados. Aisla el deltoides posterior y romboides.', video_url: yt('vuelo posterior mancuernas técnica') },
    // ── MANGUITO ROTADOR ────────────────────────────────────
    { nombre: 'Rotación Externa en Polea — OA', categoria: 'Manguito Rotador', descripcion: 'Cadena abierta. Codo pegado al cuerpo a 90°, jalar la polea hacia afuera (rotación externa). Trabaja infraespinoso y redondo menor.', video_url: yt('rotación externa hombro polea técnica') },
    { nombre: 'Rotación Interna en Polea — OA', categoria: 'Manguito Rotador', descripcion: 'Cadena abierta. Codo pegado al cuerpo a 90°, jalar la polea hacia adentro (rotación interna). Trabaja subescapular.', video_url: yt('rotación interna hombro polea técnica') },
    // ── BÍCEPS ──────────────────────────────────────────────
    { nombre: 'Curl con Barra — OA', categoria: 'Bíceps', descripcion: 'Cadena abierta. De pie con barra en agarre supino, doblar los codos llevando la barra hacia los hombros. Codos fijos.', video_url: yt('curl bíceps barra técnica') },
    { nombre: 'Curl con Mancuernas alternado — OA', categoria: 'Bíceps', descripcion: 'Cadena abierta. De pie, doblar un codo a la vez llevando la mancuerna al hombro con supinación de la muñeca.', video_url: yt('curl mancuernas bíceps alternado técnica') },
    { nombre: 'Curl en Polea (Cable Curl) — OA', categoria: 'Bíceps', descripcion: 'Cadena abierta. De pie frente a la polea baja, jalar hacia arriba. Tensión constante durante todo el movimiento.', video_url: yt('curl bíceps polea técnica') },
    { nombre: 'Chin-up (Dominada Supina) — CC', categoria: 'Bíceps', descripcion: 'Cadena cerrada. Colgado de la barra con agarre supino (palmas hacia vos), elevar el cuerpo. Gran trabajo de bíceps y dorsal.', video_url: yt('chin up dominada supina bíceps técnica') },
    // ── TRÍCEPS ─────────────────────────────────────────────
    { nombre: 'Extensión en Polea (hacia abajo) — OA', categoria: 'Tríceps', descripcion: 'Cadena abierta. De pie frente a la polea alta, empujar el agarre hacia abajo extendiendo los codos. Codos fijos al cuerpo.', video_url: yt('extensión tríceps polea hacia abajo técnica') },
    { nombre: 'Extensión sobre la Cabeza con Mancuerna — OA', categoria: 'Tríceps', descripcion: 'Cadena abierta. Sentado, mancuerna sostenida con ambas manos sobre la cabeza. Doblar los codos hacia atrás y extender.', video_url: yt('extensión tríceps sobre cabeza mancuerna técnica') },
    { nombre: 'Fondos en Paralelas (Dips) — CC', categoria: 'Tríceps', descripcion: 'Cadena cerrada. Entre dos apoyos, bajar el cuerpo doblando los codos y empujar hacia arriba. Torso erguido para enfatizar tríceps.', video_url: yt('fondos paralelas dips tríceps técnica') },
    { nombre: 'Patada de Tríceps con Mancuerna — OA', categoria: 'Tríceps', descripcion: 'Cadena abierta. Inclinado con un brazo apoyado, codo pegado al cuerpo, extender el codo llevando la mancuerna hacia atrás.', video_url: yt('patada tríceps mancuerna kickback técnica') },
    // ── TRAPECIO / ROMBOIDES ────────────────────────────────
    { nombre: 'Encogimiento con Barra (Shrug) — OA', categoria: 'Trapecio', descripcion: 'Cadena abierta. De pie con barra, elevar los hombros hacia las orejas sin doblar los codos. Trabaja el trapecio superior.', video_url: yt('encogimiento barra shrug trapecio técnica') },
    { nombre: 'Encogimiento con Mancuernas — OA', categoria: 'Trapecio', descripcion: 'Cadena abierta. De pie con mancuernas a los costados, elevar los hombros. Mayor rango que con barra.', video_url: yt('encogimiento mancuernas trapecio técnica') },
    { nombre: 'Retracción Escapular en Polea — OA', categoria: 'Trapecio', descripcion: 'Cadena abierta. Sentado frente a la polea, jalar solo juntando los omoplatos sin doblar los codos. Trabaja romboides y trapecio medio.', video_url: yt('retracción escapular polea romboides técnica') },
    // ── RECTO ABDOMINAL ─────────────────────────────────────
    { nombre: 'Plancha Abdominal — CC', categoria: 'Core', descripcion: 'Cadena cerrada. En antebrazos y puntillas, cuerpo completamente recto. No dejar caer la cadera. Sostener el tiempo indicado.', video_url: yt('plancha abdominal técnica correcta') },
    { nombre: 'Crunch Abdominal — OA', categoria: 'Core', descripcion: 'Cadena abierta. Boca arriba, rodillas dobladas. Elevar los hombros del suelo flexionando el tronco. No jalar del cuello.', video_url: yt('crunch abdominal técnica correcta') },
    { nombre: 'Crunch en Máquina — OA', categoria: 'Core', descripcion: 'Cadena abierta. Sentado en la máquina abdominal, flexionar el tronco llevando los codos hacia las rodillas. Controlar el regreso.', video_url: yt('crunch máquina abdominal técnica') },
    { nombre: 'Rueda Abdominal — OA', categoria: 'Core', descripcion: 'Cadena abierta. De rodillas con la rueda, extender los brazos hacia adelante controlando la caída y volver. Nivel avanzado.', video_url: yt('rueda abdominal técnica correcta') },
    // ── OBLICUOS ────────────────────────────────────────────
    { nombre: 'Plancha Lateral — CC', categoria: 'Core', descripcion: 'Cadena cerrada. Apoyado en un antebrazo y el borde del pie, cuerpo en línea recta lateral. Sostener el tiempo indicado.', video_url: yt('plancha lateral técnica correcta') },
    { nombre: 'Woodchop en Polea — OA', categoria: 'Core', descripcion: 'Cadena abierta. Polea alta, jalar diagonalmente desde arriba hacia la cadera opuesta rotando el tronco. Trabaja oblicuos.', video_url: yt('woodchop polea oblicuos técnica') },
    { nombre: 'Russian Twist con Mancuerna — OA', categoria: 'Core', descripcion: 'Cadena abierta. Sentado con pies levantados, rotar el tronco de lado a lado sosteniendo la mancuerna con ambas manos.', video_url: yt('russian twist mancuerna oblicuos técnica') },
    // ── PARAVERTEBRALES ─────────────────────────────────────
    { nombre: 'Extensión en Banco Romano (Hiperextensión) — CC', categoria: 'Paravertebrales', descripcion: 'Cadena cerrada. En el banco romano, bajar el tronco y extender la columna hasta quedar en línea con las piernas. No hiperextender.', video_url: yt('hiperextensión banco romano técnica') },
    { nombre: 'Pájaro-Perro (Bird Dog) — CC', categoria: 'Paravertebrales', descripcion: 'Cadena cerrada. En cuatro apoyos, extender brazo y pierna opuesta. Estabiliza columna y activa paravertebrales.', video_url: yt('pájaro perro bird dog paravertebrales técnica') },
    { nombre: 'Buenos Días con Barra — OA', categoria: 'Paravertebrales', descripcion: 'Cadena abierta. Barra sobre los trapecios, doblar el tronco hacia adelante con espalda recta. Activa paravertebrales e isquiotibiales.', video_url: yt('buenos días barra ejercicio técnica') },
    // ── CERVICAL ────────────────────────────────────────────
    { nombre: 'Retracción Cervical (Chin Tuck) — CC', categoria: 'Cervical', descripcion: 'Cadena cerrada. Llevar el mentón hacia adentro como haciendo doble papada. Sostener 5 seg. Activa flexores profundos.', video_url: yt('chin tuck retracción cervical técnica') },
    { nombre: 'Flexión Cervical Activa — OA', categoria: 'Cervical', descripcion: 'Cadena abierta. Boca arriba, llevar el mentón hacia el pecho elevando la cabeza del suelo. Bajar lento.', video_url: yt('flexión cervical ejercicio técnica') },
    { nombre: 'Isometría Extensora Cervical — CC', categoria: 'Cervical', descripcion: 'Cadena cerrada. Apoyar la nuca contra la mano y hacer fuerza sin mover la cabeza. Sostener 5 seg. Activa extensores cervicales.', video_url: yt('isometría cervical extensores ejercicio') },
    { nombre: 'Extensión Cervical Activa — OA', categoria: 'Cervical', descripcion: 'Cadena abierta. Boca abajo o sentado, llevar la cabeza hacia atrás controlando. Bajar lento.', video_url: yt('extensión cervical activa ejercicio técnica') },
    { nombre: 'Rotación Cervical Activa — OA', categoria: 'Cervical', descripcion: 'Cadena abierta. Girar la cabeza hacia un lado hasta el límite indoloro. Sostener 3 seg. 10 reps por lado.', video_url: yt('rotación cervical ejercicio técnica') },
    { nombre: 'Isometría Rotatoria Cervical — CC', categoria: 'Cervical', descripcion: 'Cadena cerrada. Apoyar la palma en la sien y hacer fuerza rotando contra la mano sin mover la cabeza. 5 seg por lado.', video_url: yt('isometría cervical rotatoria ejercicio') },
    { nombre: 'Inclinación Lateral de Cuello — OA', categoria: 'Cervical', descripcion: 'Cadena abierta. Llevar la oreja hacia el hombro lentamente hasta sentir estiramiento. Sostener 20 seg por lado.', video_url: yt('inclinación lateral cuello estiramiento') },
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
