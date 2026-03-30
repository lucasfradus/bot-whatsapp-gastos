/**
 * Módulo de integración con Google Sheets.
 * Maneja lectura y escritura de gastos en la planilla.
 */

const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const HOJA_GASTOS = 'Gastos';

// Columnas: ID | Fecha | Hora | Socio | Descripción | Monto | Estado | Fecha Reembolso
const HEADERS = ['ID', 'Fecha', 'Hora', 'Socio', 'Descripción', 'Monto', 'Estado', 'Fecha Reembolso'];

let sheets = null;
let spreadsheetId = null;

/**
 * Inicializa la conexión con Google Sheets.
 */
async function init(sheetId, credentialsJson) {
  spreadsheetId = sheetId;

  const credentials = typeof credentialsJson === 'string'
    ? JSON.parse(credentialsJson)
    : credentialsJson;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });

  sheets = google.sheets({ version: 'v4', auth });

  // Asegurar que la hoja existe con headers
  await ensureHeaders();
  console.log('[Sheets] Conexión establecida con Google Sheets');
}

/**
 * Crea la hoja y headers si no existen.
 */
async function ensureHeaders() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${HOJA_GASTOS}!A1:H1`,
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${HOJA_GASTOS}!A1:H1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS] },
      });
    }
  } catch (err) {
    // Si la hoja no existe, crearla
    if (err.code === 400 || err.message?.includes('Unable to parse range')) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: { properties: { title: HOJA_GASTOS } }
            }]
          }
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${HOJA_GASTOS}!A1:H1`,
          valueInputOption: 'RAW',
          requestBody: { values: [HEADERS] },
        });
      } catch (createErr) {
        console.error('[Sheets] Error creando hoja:', createErr.message);
      }
    }
  }
}

/**
 * Obtiene el próximo ID disponible.
 */
async function getNextId() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${HOJA_GASTOS}!A:A`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return 1; // Solo headers o vacío

  const ids = rows.slice(1)
    .map(row => parseInt(row[0]))
    .filter(id => !isNaN(id));

  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

/**
 * Registra un nuevo gasto.
 * @returns {number} ID del gasto registrado
 */
async function registrarGasto(socio, descripcion, monto) {
  const id = await getNextId();
  const ahora = new Date();
  const fecha = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
  const hora = ahora.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  });

  const fila = [id, fecha, hora, socio, descripcion, monto, 'PENDIENTE', ''];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${HOJA_GASTOS}!A:H`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [fila] },
  });

  console.log(`[Sheets] Gasto #${id} registrado: ${socio} - ${descripcion} $${monto}`);
  return id;
}

/**
 * Obtiene todos los gastos.
 */
async function obtenerGastos() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${HOJA_GASTOS}!A:H`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1).map(row => ({
    id: parseInt(row[0]) || 0,
    fecha: row[1] || '',
    hora: row[2] || '',
    socio: row[3] || '',
    descripcion: row[4] || '',
    monto: parseFloat(row[5]) || 0,
    estado: row[6] || 'PENDIENTE',
    fechaReembolso: row[7] || '',
  }));
}

/**
 * Obtiene gastos pendientes de un socio específico.
 */
async function obtenerResumenSocio(socio) {
  const gastos = await obtenerGastos();
  const pendientes = gastos.filter(
    g => g.socio.toLowerCase() === socio.toLowerCase() && g.estado === 'PENDIENTE'
  );

  const total = pendientes.reduce((sum, g) => sum + g.monto, 0);
  return { pendientes, total };
}

/**
 * Obtiene el total de gastos del grupo para un mes.
 * @param {number} mes - Mes (1-12). Si no se pasa, usa el mes actual.
 * @param {number} anio - Año. Si no se pasa, usa el año actual.
 */
async function obtenerTotalMes(mes, anio) {
  const ahora = new Date();
  mes = mes || (ahora.getMonth() + 1);
  anio = anio || ahora.getFullYear();

  const gastos = await obtenerGastos();
  const delMes = gastos.filter(g => {
    const [y, m] = g.fecha.split('-').map(Number);
    return y === anio && m === mes;
  });

  const total = delMes.reduce((sum, g) => sum + g.monto, 0);
  const porSocio = {};
  delMes.forEach(g => {
    porSocio[g.socio] = (porSocio[g.socio] || 0) + g.monto;
  });

  return { total, porSocio, cantidad: delMes.length, mes, anio };
}

/**
 * Marca un gasto como reembolsado.
 * @returns {object|null} El gasto actualizado, o null si no se encontró.
 */
async function marcarReembolsado(id) {
  const gastos = await obtenerGastos();
  const idx = gastos.findIndex(g => g.id === id);
  if (idx === -1) return null;

  const filaSheet = idx + 2; // +1 por header, +1 porque Sheets es 1-based
  const fechaReembolso = new Date().toISOString().split('T')[0];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${HOJA_GASTOS}!G${filaSheet}:H${filaSheet}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['REEMBOLSADO', fechaReembolso]] },
  });

  const gasto = gastos[idx];
  gasto.estado = 'REEMBOLSADO';
  gasto.fechaReembolso = fechaReembolso;

  console.log(`[Sheets] Gasto #${id} marcado como reembolsado`);
  return gasto;
}

/**
 * Obtiene los últimos N gastos.
 */
async function obtenerUltimos(n = 5) {
  const gastos = await obtenerGastos();
  return gastos.slice(-n);
}

module.exports = {
  init,
  registrarGasto,
  obtenerGastos,
  obtenerResumenSocio,
  obtenerTotalMes,
  marcarReembolsado,
  obtenerUltimos,
};
