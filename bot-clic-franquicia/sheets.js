/**
 * Módulo de integración con Google Sheets.
 * Maneja lectura y escritura de gastos en la planilla.
 */

const { google } = require('googleapis');
const { OPCIONES_INGRESO_EGRESO, OPCIONES_SEDE, OPCIONES_CAJA } = require('./constants');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const HOJA_GASTOS = 'Gastos';
const HOJA_CAJA = 'Mov de caja';

// Columnas: ID | Fecha | Hora | Socio | Descripción | Monto | Estado | Fecha Reembolso
const HEADERS = ['ID', 'Fecha', 'Hora', 'Socio', 'Descripción', 'Monto', 'Estado', 'Fecha Reembolso'];

// Columnas de Mov de caja
const HEADERS_CAJA = ['Item', 'Ingreso/Egreso', 'Categoría', 'Caja', 'Sede', 'Fecha de Imputación', 'Fecha', 'Monto', 'Notas'];

let sheets = null;
let spreadsheetId = null;
let sheetNames = []; // nombres reales de las hojas en la planilla

/**
 * Carga los nombres reales de todas las hojas de la planilla.
 */
async function cargarNombresHojas() {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  sheetNames = meta.data.sheets.map(s => s.properties.title); // nombre original exacto
  console.log('[Sheets] Hojas disponibles:', sheetNames.join(', '));
}

/**
 * Resuelve el nombre real de una hoja de forma case-insensitive y sin espacios extra.
 * Retorna el nombre exacto tal como está en la planilla (con sus espacios originales).
 */
function resolverNombreHoja(nombre) {
  return sheetNames.find(n => n.trim().toLowerCase() === nombre.trim().toLowerCase()) || null;
}

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

  await cargarNombresHojas();
  await ensureHeaders();
  await formatearHojas();
  console.log('[Sheets] Conexión establecida con Google Sheets');
}

/**
 * Crea la hoja y headers si no existen.
 */
async function ensureHeaders() {
  const hojaReal = resolverNombreHoja(HOJA_GASTOS) || HOJA_GASTOS;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${hojaReal}!A1:H1`,
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${hojaReal}!A1:H1`,
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
            requests: [{ addSheet: { properties: { title: HOJA_GASTOS } } }]
          }
        });
        sheetNames.push(HOJA_GASTOS);
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
  const hoja = resolverNombreHoja(HOJA_GASTOS) || HOJA_GASTOS;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${hoja}!A:A`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return 1; // Solo headers o vacío

  const ids = rows.slice(1)
    .map(row => parseInt(row[0]))
    .filter(id => !isNaN(id));

  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

/**
 * Copia el formato de la fila anterior a la fila recién insertada.
 */
async function copiarFormatoFilaAnterior(nombreHoja, colCount) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const hoja = meta.data.sheets.find(s => s.properties.title === nombreHoja);
  if (!hoja) return;

  const sheetId = hoja.properties.sheetId;

  // Obtener cuántas filas tiene la hoja
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${nombreHoja}!A:A`,
  });
  const totalFilas = (res.data.values || []).length;
  if (totalFilas < 2) return; // No hay fila anterior de donde copiar

  const filaOrigen = totalFilas - 1;   // fila anterior (0-based)
  const filaDestino = totalFilas;       // fila nueva (0-based)

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        copyPaste: {
          source:      { sheetId, startRowIndex: filaOrigen - 1, endRowIndex: filaOrigen, startColumnIndex: 0, endColumnIndex: colCount },
          destination: { sheetId, startRowIndex: filaDestino - 1, endRowIndex: filaDestino, startColumnIndex: 0, endColumnIndex: colCount },
          pasteType: 'PASTE_FORMAT',
        },
      }],
    },
  });
}

/**
 * Registra un nuevo gasto.
 * @returns {number} ID del gasto registrado
 */
async function registrarGasto(socio, descripcion, monto) {
  const hoja = resolverNombreHoja(HOJA_GASTOS) || HOJA_GASTOS;
  const id = await getNextId();
  const ahora = new Date();
  const fecha = ahora.toISOString().split('T')[0];
  const hora = ahora.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  });

  const fila = [id, fecha, hora, socio, descripcion, monto, 'PENDIENTE', ''];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${hoja}!A:H`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [fila] },
  });

  await copiarFormatoFilaAnterior(hoja, 8);

  console.log(`[Sheets] Gasto #${id} registrado: ${socio} - ${descripcion} $${monto}`);
  return id;
}

/**
 * Obtiene todos los gastos.
 */
async function obtenerGastos() {
  const hoja = resolverNombreHoja(HOJA_GASTOS) || HOJA_GASTOS;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${hoja}!A:H`,
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
  const hoja = resolverNombreHoja(HOJA_GASTOS) || HOJA_GASTOS;
  const gastos = await obtenerGastos();
  const idx = gastos.findIndex(g => g.id === id);
  if (idx === -1) return null;

  const filaSheet = idx + 2; // +1 por header, +1 porque Sheets es 1-based
  const fechaReembolso = new Date().toISOString().split('T')[0];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${hoja}!G${filaSheet}:H${filaSheet}`,
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

/**
 * Elimina todas las validaciones (flechas de desplegable) de la hoja Mov de caja.
 */
async function limpiarValidacionesCaja() {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const hoja = meta.data.sheets.find(s => s.properties.title === HOJA_CAJA);
  if (!hoja) return;

  const sheetId = hoja.properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        setDataValidation: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 9 },
        },
      }],
    },
  });
}

/**
 * Crea la hoja "Mov de caja" con headers y validaciones de desplegables.
 */
async function ensureHojaCaja() {
  // Verificar si la hoja ya existe
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const hojaExistente = meta.data.sheets.find(s => s.properties.title === HOJA_CAJA);

  let sheetId;

  if (!hojaExistente) {
    // Crear la hoja
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: HOJA_CAJA } } }],
      },
    });
    sheetId = res.data.replies[0].addSheet.properties.sheetId;
  } else {
    sheetId = hojaExistente.properties.sheetId;
  }

  // Escribir headers
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${HOJA_CAJA}!A1:I1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS_CAJA] },
  });

  // Aplicar validaciones de desplegables (filas 2 en adelante)
  const makeDropdown = (colIndex, opciones) => ({
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
      rule: {
        condition: { type: 'ONE_OF_LIST', values: opciones.map(v => ({ userEnteredValue: v })) },
        showCustomUi: true,
        strict: true,
      },
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        makeDropdown(1, OPCIONES_INGRESO_EGRESO), // Columna B: Ingreso/Egreso
        makeDropdown(3, OPCIONES_CAJA),            // Columna D: Caja
        makeDropdown(4, OPCIONES_SEDE),            // Columna E: Sede
      ],
    },
  });

  console.log('[Sheets] Hoja "Mov de caja" lista');
}

/**
 * Registra un movimiento de caja en la hoja "Mov de caja".
 * Crea la hoja si no existe, sin headers ni dropdowns automáticos.
 */
async function registrarMovCaja(data) {
  // Buscar la hoja case-insensitive, o crearla si no existe
  let hojaReal = resolverNombreHoja(HOJA_CAJA);
  if (!hojaReal) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: HOJA_CAJA } } }] },
    });
    sheetNames.push(HOJA_CAJA);
    hojaReal = HOJA_CAJA;
  }

  const { item, ingresoEgreso, categoria, caja, sede, fechaImputacion, fecha, monto, notas } = data;

  const fila = [
    item            || '',
    ingresoEgreso   || '',
    categoria       || '',
    caja            || '',
    sede            || '',
    fechaImputacion || '',
    fecha           || '',
    monto,
    notas           || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${hojaReal}!A:I`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [fila] },
  });

  await copiarFormatoFilaAnterior(hojaReal, 9);

  console.log(`[Sheets] Mov de caja: ${ingresoEgreso} $${monto} - ${item}`);
}

/**
 * Aplica formato visual a ambas hojas: header oscuro, filas alternadas, columnas ajustadas.
 */
async function formatearHojas() {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });

  const getSheetId = (nombre) => {
    const h = meta.data.sheets.find(s => s.properties.title === nombre);
    return h ? h.properties.sheetId : null;
  };

  const idGastos = getSheetId(HOJA_GASTOS);
  const idCaja   = getSheetId(HOJA_CAJA);

  // Color header: azul oscuro #283593, texto blanco
  const HEADER_BG  = { red: 0.157, green: 0.208, blue: 0.576 };
  const WHITE      = { red: 1, green: 1, blue: 1 };
  // Filas alternadas: blanco y gris muy claro #F8F9FA
  const ROW_ALT    = { red: 0.973, green: 0.976, blue: 0.980 };

  const formatHeader = (sheetId, colCount) => ([
    // Fondo + texto blanco + negrita en header
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: { foregroundColor: WHITE, bold: true, fontSize: 10 },
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'CENTER',
            wrapStrategy: 'CLIP',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment,wrapStrategy)',
      },
    },
    // Freeze header
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Filas pares (alternadas) fondo gris claro
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: colCount }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=ISEVEN(ROW())' }] },
            format: { backgroundColor: ROW_ALT },
          },
        },
        index: 0,
      },
    },
    // Alto de fila del header
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 36 },
        fields: 'pixelSize',
      },
    },
  ]);

  const requests = [];

  if (idGastos !== null) {
    requests.push(...formatHeader(idGastos, 8));
    // Anchos columnas Gastos: ID, Fecha, Hora, Socio, Descripción, Monto, Estado, Fecha Reemb.
    const anchosGastos = [60, 100, 70, 130, 250, 100, 110, 120];
    anchosGastos.forEach((px, i) => {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId: idGastos, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
          properties: { pixelSize: px },
          fields: 'pixelSize',
        },
      });
    });
  }


  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    console.log('[Sheets] Formato visual aplicado');
  }
}

module.exports = {
  init,
  registrarGasto,
  obtenerGastos,
  obtenerResumenSocio,
  obtenerTotalMes,
  marcarReembolsado,
  obtenerUltimos,
  registrarMovCaja,
};
