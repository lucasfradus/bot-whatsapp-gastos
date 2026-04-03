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

// ── Seed ejercicios por defecto ───────────────────────────

const hayEjercicios = db.prepare("SELECT COUNT(*) as n FROM ejercicios").get();
if (hayEjercicios.n === 0) {
  const seedEj = db.prepare(`INSERT INTO ejercicios (nombre, descripcion, categoria, video_url) VALUES (@nombre, @descripcion, @categoria, @video_url)`);
  const seedMany = db.transaction((lista) => { for (const e of lista) seedEj.run(e); });
  seedMany([
    // Rodilla
    { nombre: 'Extensión de Rodilla', categoria: 'Rodilla', descripcion: 'Sentado en silla, extender la rodilla hasta quedar con la pierna recta. Sostener 3 seg y bajar lento. 3×15 reps.', video_url: 'https://youtu.be/YyvSfVjQeL0' },
    { nombre: 'Flexión de Rodilla (acostado)', categoria: 'Rodilla', descripcion: 'Boca abajo, doblar la rodilla llevando el talón hacia los glúteos. Bajar lento. 3×12 reps.', video_url: 'https://youtu.be/1Tq3QdYUuHs' },
    { nombre: 'Sentadilla con Silla', categoria: 'Rodilla', descripcion: 'De pie frente a la silla, bajar controlando hasta casi sentarse y volver a subir. 3×10 reps.', video_url: 'https://youtu.be/ultWZbUMPL8' },
    // Cadera
    { nombre: 'Puente de Glúteos', categoria: 'Cadera', descripcion: 'Boca arriba, rodillas dobladas. Elevar la cadera apretando glúteos, sostener 3 seg y bajar. 3×15 reps.', video_url: 'https://youtu.be/OUgsJ8-Vi0E' },
    { nombre: 'Abducción de Cadera (acostado)', categoria: 'Cadera', descripcion: 'De lado, elevar la pierna de arriba manteniendo la rodilla recta. Bajar lento. 3×15 reps.', video_url: 'https://youtu.be/kDqklk2FGFA' },
    { nombre: 'Extensión de Cadera (de pie)', categoria: 'Cadera', descripcion: 'De pie apoyado en la pared, llevar una pierna hacia atrás con rodilla recta. 3×12 reps por lado.', video_url: 'https://youtu.be/OUgsJ8-Vi0E' },
    { nombre: 'Flexión de Cadera (marcha estática)', categoria: 'Cadera', descripcion: 'De pie, elevar alternadamente las rodillas al pecho como si marchara en el lugar. 3×20 reps.', video_url: 'https://youtu.be/kDqklk2FGFA' },
    // Hombro
    { nombre: 'Rotación Externa de Hombro', categoria: 'Hombro', descripcion: 'Codo pegado al cuerpo a 90°, rotar el antebrazo hacia afuera sin mover el codo. 3×15 reps.', video_url: 'https://youtu.be/PtFhZzBXvTM' },
    { nombre: 'Elevación Frontal de Hombro', categoria: 'Hombro', descripcion: 'Brazo extendido, elevar al frente hasta la altura del hombro. Bajar lento. 3×12 reps.', video_url: 'https://youtu.be/soxrZlIl35U' },
    { nombre: 'Abducción de Hombro', categoria: 'Hombro', descripcion: 'Brazos a los costados, elevar hasta la altura del hombro. Bajar lento. 3×12 reps.', video_url: 'https://youtu.be/soxrZlIl35U' },
    // Columna / Core
    { nombre: 'Plancha Abdominal', categoria: 'Core', descripcion: 'Apoyado en antebrazos y puntillas, cuerpo recto. Sostener 20-30 segundos. 3 series.', video_url: 'https://youtu.be/pSHjTRCQxIw' },
    { nombre: 'Pájaro-Perro (Bird Dog)', categoria: 'Core', descripcion: 'En cuatro apoyos, extender brazo y pierna opuesta simultáneamente. Sostener 3 seg. 3×10 reps por lado.', video_url: 'https://youtu.be/cc6UVRS7PW4' },
    { nombre: 'Estiramiento Lumbar (rodillas al pecho)', categoria: 'Core', descripcion: 'Boca arriba, llevar ambas rodillas al pecho abrazándolas. Sostener 30 seg. 3 repeticiones.', video_url: 'https://youtu.be/4BOTvaRaDes' },
    // Tobillo
    { nombre: 'Elevación de Talones', categoria: 'Tobillo', descripcion: 'De pie (con apoyo si es necesario), elevarse en puntillas y bajar lento. 3×20 reps.', video_url: 'https://youtu.be/gwLzBJYoWlI' },
    { nombre: 'Flexión Dorsal de Tobillo', categoria: 'Tobillo', descripcion: 'Sentado, doblar el tobillo llevando la punta del pie hacia la rodilla. Sostener 3 seg. 3×15 reps.', video_url: 'https://youtu.be/gwLzBJYoWlI' },
    { nombre: 'Círculos de Tobillo', categoria: 'Tobillo', descripcion: 'Sentado, realizar círculos lentos con el tobillo en ambas direcciones. 10 círculos por lado.', video_url: 'https://youtu.be/gwLzBJYoWlI' },
    // Cervical
    { nombre: 'Rotación Cervical', categoria: 'Cervical', descripcion: 'Girar la cabeza hacia un lado lentamente, sostener 3 seg y volver al centro. 10 reps por lado.', video_url: 'https://youtu.be/4S5GHhbv9KE' },
    { nombre: 'Retracción Cervical (Chin Tuck)', categoria: 'Cervical', descripcion: 'Llevar el mentón hacia adentro (doble papada). Sostener 5 seg. 3×10 reps.', video_url: 'https://youtu.be/wQylqaCl8Zo' },
    { nombre: 'Inclinación Lateral de Cuello', categoria: 'Cervical', descripcion: 'Llevar la oreja hacia el hombro lentamente. Sostener 20 seg por lado. 3 series.', video_url: 'https://youtu.be/4S5GHhbv9KE' },
  ]);
  console.log('✅ Ejercicios de ejemplo cargados');
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
  INSERT INTO pacientes (nombre, apellido, edad, email, celular)
  VALUES (@nombre, @apellido, @edad, @email, @celular)
`);

const updatePaciente = db.prepare(`
  UPDATE pacientes SET nombre=@nombre, apellido=@apellido, edad=@edad,
    email=@email, celular=@celular, usuario_id=@usuario_id
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
